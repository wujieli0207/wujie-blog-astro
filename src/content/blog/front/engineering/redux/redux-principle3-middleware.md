---
title: redux 中间件解码：扩展 redux 功能的秘密
excerpt: 在上一篇文章：redux 原理探秘：从 redux 到 react-redux 和 redux-toolkit 中，介绍了 redux、react-redux 和 redux-toolkit 的核心实现原理，这篇文章我们继续分析 redux 的另一个特性：中间件
publishDate: '2024-12-27'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: redux 中间件解码：扩展 redux 功能的秘密
---

在[上一篇文章](https://www.wujieli.com/blog/front/engineering/redux/redux-principle3-middleware)中，介绍了 redux、react-redux 和 redux-toolkit 的核心实现原理，这篇文章我们继续分析 redux 的另一个特性：中间件

redux 中间件是扩展 Redux 功能强大工具，它们充当着 action 被发送到 reducer 之前的拦截器，提供了一种灵活的方式来增强 Redux 的基本功能。接下来我们通过中间件注册和常用中间件实现原理两个方面分析 redux 中间件功能

## 注册 redux 中间件

在 redux 中，通过 `applyMiddleware` 方法注册注册中间件，本质是一个 **Action 被发送到 Reducer 之前的拦截器**，在这段过程之间执行自定义操作，增强 redux 的功能，下面来看具体实现步骤

- 接收一系列中间件作为参数，每一个中间件是一个高阶函数，遵循 `store => next => action => {}` 的形式，其中
  - aciton：当前被处理的 action 对象
  - next：调用链中的下一个中间件的 dispatch 函数，用于链式调用
  - store：Store 的引用
- 初始化传入的中间件，并将中间件组合成一个链式数组
- 通过 `compose` 方法替换原有的 `dispatch` 方法
- 最后将新的 `dispatch` 方法返回出去

```ts
export default function applyMiddleware(
  ...middlewares: Middleware[]
): StoreEnhancer<any> {
  // 返回一个函数，这个函数将接收 createStore 函数
  return (createStore) => (reducer, preloadedState) => {
    // 使用 createStore 方法和传入的 reducer 和 preloadedState 创建 store
    const store = createStore(reducer, preloadedState)
    let dispatch: Dispatch = () => {}

    // 传递给每个中间件的参数
    const middlewareAPI: MiddlewareAPI = {
      getState: store.getState,
      dispatch: (action, ...args) => dispatch(action, ...args),
    }
    // 初始化每一个中间件，返回一个中间件链式数组
    const chain = middlewares.map((middleware) => middleware(middlewareAPI))
    // 替换原始的 dispatch 方法
    dispatch = compose<typeof dispatch>(...chain)(store.dispatch)

    return {
      ...store,
      dispatch,
    }
  }
}
```

在 `applyMiddleware` 方法实现中，最重要的部分是如何在 dispatch 之前执行中间件，redux 通过 `compose` 方法实现这一拦截器的效果

`compose` 方法通过 `reduce` 的组合，实际上创建了一个从右到左的函数嵌套，比如有三个中间件函数 `[f, g, h, dispatch]`，`compose(f, g, h, dispatch)` 执行后会产生 `dispatch(f(g(h(...args))))` 的嵌套，从而达到依次执行中间件，再执行具体的 Reducer

```ts
export default function compose(...funcs: Function[]) {
  // 没有传入函数，直接根据接收到的参数的函数
  if (funcs.length === 0) {
    return <T>(arg: T) => arg
  }

  // 只传入一个函数，直接返回，不用做处理
  if (funcs.length === 1) {
    return funcs[0]
  }

  // 通过 reduce 组合多个函数
  return funcs.reduce(
    (a, b) =>
      // 返回一个新的函数，新函数先调用 b，再用 b 的返回值调用 a 函数
      (...args: any) =>
        a(b(...args))
  )
}
```

## 常用中间件实现原理

在了解了如何在 redux 注册中间件，接下来我们继续分析 redux 常用中间件的实现原理，redux 常用的中间件包括

- redux-thunk：允许 Action 返回一个函数而不是对象，可以延迟 Action 的派发或者只在特定条件下才派发 Action
- redux-promise：可以派发一个包含 Promise 的 Action
- redux-presist：自动保存 Store 到本地存储中（localStorage）

### redux-thunk

redux 的实现原理相对简单，就是判断传入的 action 是否是函数

- 如果是函数，返回 action 函数的直接结果
- 如果不是函数，直接传递给下一个中间件的 dispatch 函数

```ts
function createThunkMiddleware<
  State = any,
  BasicAction extends Action = AnyAction,
  ExtraThunkArg = undefined,
>(extraArgument?: ExtraThunkArg) {
  const middleware: ThunkMiddleware<State, BasicAction, ExtraThunkArg> =
    ({ dispatch, getState }) =>
    (next) =>
    (action) => {
      // action 是函数，返回 action 函数的直接结果
      if (typeof action === 'function') {
        return action(dispatch, getState, extraArgument)
      }

      // action 不是函数，直接传递给下一个中间件的 dispatch 函数
      return next(action)
    }
  return middleware
}

export const thunk = createThunkMiddleware()
```

### redux-promise

redux-promise 的实现原理也相对简单，就是判断传入的 action 是否是 Promise，如果是 Promise 则在 Promise 处理之后（then / catch），将处理结果派发为一个新的 Action

这里提一下代码中的 isFSA 判断， FSA（Flux Standard Action）是一种约定，用于定义 Redux 和类似 Flux 架构中 actions 的格式，目的是为了促进不同的 Redux 应用或库之间的互操作性，具体定义标准如下（就是 redux 的 Action 常用定义）

```ts
{
  type: 'ADD_TODO', // 表示 action 的类型，必须
  payload: {}, // 携带与 action 相关的数据
}

```

redux-promise 实现代码

```ts
import isPromise from 'is-promise'
import { isFSA } from 'flux-standard-action'

export default function promiseMiddleware({ dispatch }) {
  return (next) => (action) => {
    if (!isFSA(action)) {
      return isPromise(action) ? action.then(dispatch) : next(action)
    }

    return isPromise(action.payload)
      ? action.payload
          .then((result) => dispatch({ ...action, payload: result }))
          .catch((error) => {
            dispatch({ ...action, payload: error, error: true })
            return Promise.reject(error)
          })
      : next(action)
  }
}
```

### redux-persist

分析 redux-persist 的 4 个 action

- PERSIST：启动持久化过程，确保从启动时刻起，所有状态更改都会被记录和持久化
- REHYDRATE：持久化存储中的状态重新注入到 redux Store，应用重新加载或启动时使用
- PURGE：清除持久化存储中的所有数据
- PAUSE：暂停持久化过程

redux-persist 的核心实现方法是 `persistReducer`，这个函数会将传入的 Reducer 改造为一个加强版的 Reducer，加强版的 Reducer 能够在处理 Action 时，将状态更新同步到指定的 Storage（LocalStorage / SessionStorage） 中

我们先看 `persistReducer` 实现 PERSIST 启动持久化的过程

- 创建持久化对象：通过 `createPersistoid` 创建一个新的持久化对象，将状态更新到 Storage 中
- 获取存储的状态：使用 `getStoredState` 从 Storage 获取当前持久化的状态
- 重构（Rehydration）：通过 `_rehydrate` 将 Storage 的状态注入到 redux 中
- 更新状态：返回一个包含初始持久化状态（`_persist`）的新状态对象

```ts
export default function persistReducer(
  config: PersistConfig<S>,
  baseReducer: Reducer<S, A>
) {
  // 获取存储状态，这里的 defaultGetStoredState 就是从 Storage 中获取 Store 数据了
  const getStoredState = config.getStoredState || defaultGetStoredState
  // 定义持久化对象，用于更新存储的状态
  let _persistoid: Persistoid | null = null
  // 定义是否暂停更新
  let _paused = true

  return (state: any, action: any) => {
    const { _persist, ...rest } = state || {}
    const restState: S = rest

    if (action.type === PERSIST) {
      // 封闭标志，防止重复重构
      let _sealed = false
      const _rehydrate = (payload: any, err?: Error) => {
        if (!_sealed) {
          action.rehydrate(config.key, payload, err)
          _sealed = true
        }
      }

      // 解除暂停，开始处理 PERSIST action
      _paused = false

      // 创建持久化对象，用于后续的持久化操作
      if (!_persistoid) _persistoid = createPersistoid(config)

      // 注册持久化 key
      action.register(config.key)

      // 从存储中获取状态
      getStoredState(config).then((restoredState) => {
        if (restoredState) {
          const migrate = config.migrate || ((s, _) => Promise.resolve(s))
          migrate(restoredState as any).then((migratedState) => {
            _rehydrate(migratedState)
          })
        }
      })

      // 返回新的状态，并初始化 _persist
      return {
        ...baseReducer(restState, action),
        _persist: { rehydrated: false },
      }
    }

    // 运行基础 reducer 并根据需要更新状态
    const newState = baseReducer(restState, action)
    if (newState === restState) return state
    return conditionalUpdate({ ...newState, _persist })
  }
}
```

接下来看 `persistReducer` 在应用重新加载时执行 REHYDRATE 的过程，REHYDRATE 的核心是通过 `stateReconciler` 确定 Storage 和 redux 状态如何组合，比如哪些部分应该被覆盖、哪些部分应该保留，状态协调器分为有两个版本

- autoMergeLevel1：默认的状态协调器，在第一层级上合并状态，但不会深入嵌套的对象
- autoMergeLevel2：在第一层和第二层级上合并状态，对于更深层级的嵌套对象，会保留整个对象

通过 `stateReconciler` 确定了状态之后，最后调用 `conditionalUpdate` 方法更新持久化对象

```ts
export default function persistReducer() {
  const conditionalUpdate = (state: any) => {
    // 如果状态已重构（rehydrated）且未暂停，则更新持久化对象
    state._persist.rehydrated &&
      _persistoid &&
      !_paused &&
      _persistoid.update(state)
    return state
  }

  // REHYDRATE 实现逻辑
  if (action.type === REHYDRATE) {
    // Action key 匹配时才处理
    if (action.key === config.key) {
      // 调用基础 reducer 以处理可能存在的其他逻辑
      const reducedState = baseReducer(restState, action)
      // Storage 的状态
      const inboundState = action.payload
      // 创建状态协调器，合并来自 Storage 的状态（inbound state）与应用当前的初始状态（initial state）
      const reconciledRest: S =
        stateReconciler !== false && inboundState !== undefined
          ? stateReconciler(inboundState, state, reducedState, config)
          : reducedState

      // 创建新状态，包括重构后的状态和持久化相关的元数据
      const newState = {
        ...reconciledRest,
        _persist: { ..._persist, rehydrated: true },
      }
      // 更新持久化对象
      return conditionalUpdate(newState)
    }
  }
}
```
