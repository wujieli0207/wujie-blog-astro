---
title: redux 原理探秘：从 redux 到 react-redux 和 redux-toolkit
excerpt: 在上一篇文章：探索 redux：状态管理的艺术 中介绍了 redux 和核心概念、核心原则和相关技术栈架构，下面这篇文章我们开始深入研究 redux 和相关工具 react-redux、redux-toolkit 的实现原理
publishDate: '2024-12-21'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: redux 原理探秘：从 redux 到 react-redux 和 redux-toolkit
---

在[上一篇文章](https://www.wujieli.com/blog/front/engineering/redux/redux-principle1-overview)中介绍了 redux 和核心概念、核心原则和相关技术栈架构，下面这篇文章我们开始深入研究 redux 和相关工具 react-redux、redux-toolkit 的实现原理

## redux 实现原理

在介绍 redux 核心方法之前，先整体回顾一下 redux 的核心方法

- createStore 是创建 Store 的入口，也是实现发布-订阅模式的核心
- 通过 getState 方法能够获取到当前的状态
- 通过 subscribe 方法注册订阅回调函数，通过 dispatch 执行 Reducer 更新状态并触发订阅者函数执行，实现发布-订阅模式
- 通过 Observable 方法将 Store 转化为一个可观察对象

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/Screenshot%202023-12-17%20at%2011.31.38.png)

### createStore 方法

createStore 方法核心实现步骤如下

- 定义了 getState、subscribe、dispatch、observable 方法，用于实现获取 Store 的状态和发布-订阅模式
- 通过 dispatch 方法初始化所有状态
- 最后返回包含 getState、subscribe、dispatch、observable 方法的 store 对象

```ts
export function createStore(
  reducer: Reducer<S, A, PreloadedState>,
  preloadedState?: PreloadedState | StoreEnhancer<Ext, StateExt> | undefined,
  enhancer?: StoreEnhancer<Ext, StateExt>
): Store<S, A, StateExt> & Ext {
  // 定义状态变量
  let currentReducer = reducer
  let currentState: S | PreloadedState | undefined = preloadedState as
    | PreloadedState
    | undefined

  // 获取当前状态快照
  function getState() {}

  // 注册回调函数
  function subscribe(listener: () => void) {}

  // 派发 action，触发状态更新
  function dispatch(action: A) {}

  // 实现了 Observable 协议的函数，使得 Store 可以被观察
  function observable() {}

  // 创建 store 后初始化所有状态
  dispatch({ type: ActionTypes.INIT } as A)

  const store = {
    dispatch: dispatch as Dispatch<A>,
    subscribe,
    getState,
    [$$observable]: observable,
  } as unknown as Store<S, A, StateExt> & Ext
  return store
}
```

### getState 方法

getState 方法比较简单，就是返回了当前的状态 currentState

```ts
export function createStore() {
  function getState(): S {
    return currentState as S
  }
}
```

### subscribe 方法

subscribe 方法用于订阅者注册回调函数，有几个关键点

- 回调函数被存储在一个 Map 对象中，但是在方法中却定义了两个 Map 对象： currentListeners 和 nextListeners，这是为了**防止在 dispatch 过程中对订阅者列表进行修改**引起的潜在问题
  - 在添加或删除订阅方法前，都会通过 ensureCanMutateNextListeners 方法创建一份 nextListeners 副本，添加和删除操作都是在 nextListeners 副本上进行
  - 当需要通知订阅者时（即执行 dispatch 方法），通过将 nextListeners 复制到 currentListeners，再遍历 currentListeners 触发所有订阅者执行
- 在 subscribe 方法执行时，为每个订阅者分配了一个唯一的 id（即 listenerId），在取消订阅的 unsubscribe 方法中，通过闭包能够访问到定义的 listenerId，从而实现移除监听器的效果

```ts
export function createStore() {
  // 定义状态变量
  let currentReducer = reducer
  let currentState: S | PreloadedState | undefined = preloadedState as
    | PreloadedState
    | undefined
  let currentListeners: Map<number, ListenerCallback> | null = new Map()
  let nextListeners = currentListeners

  function subscribe(listener: () => void) {
    // 标记为已订阅状态
    let isSubscribed = true

    // 避免直接修改 currentListeners
    ensureCanMutateNextListeners()
    // 为每个订阅者分配一个唯一的 id
    const listenerId = listenerIdCounter++
    // 将监听器添加到 nextListeners
    nextListeners.set(listenerId, listener)

    // 返回一个取消订阅函数
    // 实现逻辑就是通过 id 从 nextListeners 移除监听器
    return function unsubscribe() {
      if (!isSubscribed) return

      isSubscribed = false

      ensureCanMutateNextListeners()
      nextListeners.delete(listenerId)
      currentListeners = null
    }
  }

  // 保护 currentListeners 数组不被意外修改
  function ensureCanMutateNextListeners() {
    // 创建一份 nextListeners 副本，避免直接修改 currentListeners
    if (nextListeners === currentListeners) {
      nextListeners = new Map()
      currentListeners.forEach((listener, key) => {
        nextListeners.set(key, listener)
      })
    }
  }

  return store
}
```

### dispatch 方法

dispatch 方法用于执行 Reducer 更新状态并通知所有订阅者执行，具体实现有两个关键点

- 在执行 reducer 更新状态前，会通过 isDispatching 设置为 true 的方式加锁，确保不会执行其他 action，reducer 更新状态结束后，再关闭锁
- 在遍历通知订阅者前，将 nextListeners 复制到 currentListeners 再遍历执行，避免对于 nextListeners 的操作造成订阅者执行错误

```ts
export function createStore() {
  // 定义状态变量
  let currentReducer = reducer
  let currentState: S | PreloadedState | undefined = preloadedState as
    | PreloadedState
    | undefined
  let currentListeners: Map<number, ListenerCallback> | null = new Map()
  let nextListeners = currentListeners
  let isDispatching = false

  function dispatch(action: A) {
    // 确保不会执行其他 action
    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions.')
    }

    try
      // isDispatching 设置为 true，相当于加锁
      isDispatching = true
      // 执行 reducer 函数更新状态
      currentState = currentReducer(currentState, action)
    } finally {
      // 结束 dispatch 执行关闭锁
      isDispatching = false
    }

    // 修改状态后，触发所有订阅者执行
    // 注意这里将 nextListeners 复制到 currentListeners 再遍历执行，
    // 避免对于 nextListeners 的操作造成订阅者执行错误
    const listeners = (currentListeners = nextListeners)
    listeners.forEach((listener) => {
      listener()
    })

    // 返回 action，符合 dispatch 的标准行为
    return action
  }

  return store
}
```

### observable 方法

observable 方法将 Store 转换为一个符合 [Observable](https://tc39.github.io/proposal-observable/) 提案的可观察对象，可以应用在到响应式编程中或者与 RxJS 集成

可以这样理解可观察对象：Store 就是一个黑盒，内部的状态如何变化是无法知道的，而转变为可观察对象（observable）之后，就像带上了一副透视眼镜，每当状态变化时，都能够通过透视眼镜（observable 的 next 方法），获取到最新的状态

observable 方法实现步骤如下

1. 定义 observeState 方法观察 observer 对象状态的变化，通过 observer 的 next 属性传入当前的状态
2. 立即执行一次 observeState 方法确保当前状态被观察，然后调用 subscribe 方法注册当前观察者，这样当后续的状态变化时，都能够通过发布-订阅模式获取到最新的状态

```ts
export function createStore() {
  function observable() {
    // 引用 store 的 subscribe 方法
    const outerSubscribe = subscribe

    return {
      // 实现 subscribe 方法，接收一个 observer 对象
      subscribe(observer) {
        // 定义一个函数来观察状态变化
        function observeState() {
          // 确保 observer 有 next 方法
          if (observer.next) {
            // 调用 next 方法并传入当前状态
            observer.next(getState())
          }
        }

        // 立即执行一次以确保当前状态被观察
        observeState()
        // 调用外部的 subscribe 方法注册观察者
        const unsubscribe = outerSubscribe(observeState)
        // 返回一个取消订阅的方法
        return { unsubscribe }
      },

      // 返回 observable 对象本身，符合 Observable 协议
      [$$observable]() {
        return this
      },
    }
  }
}
```

## react-redux 实现原理

react-redux 是 react 组件获取和操作 redux 状态的桥梁，提供了三类 api 用来操作状态

- Provider 组件：包裹在应用最外层，使用 react 的 context 来传递 Store
- connect：一个高阶函数，用于将 Store 和 Action 映射到 react 组件的 props
- hooks：用于在 react 组件中使用 Store 和 Action，简化 connect 的操作

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/Screenshot%202023-12-17%20at%2011.33.57.png)

因为现在更推荐使用 hooks 操作 Store，所以接下来我们分析 react-redux 中更为常用 Provider 组件和 hooks 的实现原理

### Provider 组件

首先先看 Provider 组件的实现原理，实现步骤如下

- 接收 Store 和可选的 context 作为参数
- 定义包含 store 和订阅逻辑的 contextValue
- 使用 react 的 useIsomorphicLayoutEffect hook 监听 store 状态变化，进行订阅和通知
- 通过 Context.Provider 将 contextValue 传递给子组件，保证 react 的子组件能够访问 Store

```tsx
import { useMemo } from 'react'

function Provider<A extends Action<string> = UnknownAction, S = unknown>({
  store,
  context,
  children,
}: ProviderProps<A, S>) {
  // Redux store 和订阅逻辑
  const contextValue = useMemo(() => {
    // 创建一个订阅对象，它负责监听 store 的变化
    const subscription = createSubscription(store)
    return {
      store,
      subscription,
    }
  }, [store])

  // 获取当前的 store 状态
  const previousState = useMemo(() => store.getState(), [store])

  // 客户端渲染优先使用 useLayoutEffect，否则使用 useEffect
  useIsomorphicLayoutEffect(() => {
    const { subscription } = contextValue
    // 设置订阅对象的状态变化时的回调函数，尝试订阅 store 的变化
    subscription.onStateChange = subscription.notifyNestedSubs
    subscription.trySubscribe()

    // 如果上次渲染后 store 状态发生了变化，通知所有子订阅者
    if (previousState !== store.getState()) {
      subscription.notifyNestedSubs()
    }

    // 组件卸载时的清理逻辑，取消订阅并清理回调函数
    return () => {
      subscription.tryUnsubscribe()
      subscription.onStateChange = undefined
    }
  }, [contextValue, previousState])

  // 优先使用自定义的 context，否则使用默认的 ReactReduxContext
  const Context = context || ReactReduxContext

  // 使用 Context.Provider 包裹子组件，并传递 contextValue
  // 允许子组件通过 context 访问到 Redux store 和订阅逻辑
  return <Context.Provider value={contextValue}>{children}</Context.Provider>
}
```

### hooks 简化操作

使用 react-redux 提供的 hooks 在 react 组件中直接操作 Store，相比于使用 connect 更加简单，下面就分析两个最常用的的 hooks：useSelector 和 useDispatch

useSelector 用于在 react 组件中，通过回调函数获取某一部分自己需要的 Store，核心实现原理如下

1. 从 react 组件的上下文 Context 中获取 Store
2. 通过传入的回调函数 selector 获取需要的 Store

```ts
import { useCallback, Context } from 'react'

export function createSelectorHook(context = ReactReduxContext): UseSelector {
  const useReduxContext = useDefaultReduxContext

  return function useSelector<TState, Selected extends unknown>(
    selector: (state: TState) => Selected
  ): Selected {
    // 从 Context 中获取 Store
    const { store } = useReduxContext()

    // 使用 useCallback hooks 包裹提高性能
    const wrappedSelector = useCallback<typeof selector>(
      {
        [selector.name](state: TState) {
          // 通过传入的回调函数 selector 获取 Store
          const selected = selector(state)

          return selected
        },
      }[selector.name],
      [selector]
    )

    // 返回选择的状态
    return selectedState
  }
}

export const useSelector = createSelectorHook()
```

useDispatch 用于在 react 组件中获取 dispatch 方法，实现原理也很简单，直接返回了 Store 的 dispatch 方法

```ts
export function createDispatchHook(context = ReactReduxContext) {
  const useStore =
    context === ReactReduxContext ? useDefaultStore : createStoreHook(context)

  return function useDispatch() {
    // 本质就是返回了 Store 的 dispatch 方法
    const store = useStore()
    return store.dispatch
  }
}

export const useDispatch = createDispatchHook()
```

## redux-toolkit

redux-toolkit 提供了一系列简化 redux 配置和操作的方法，下面我们分析两个最常用的方法

- configureStore：简化了 createStore 方法的配置
- createSlice：将初始状态 Store、Action、Reducer 统一放在一个切片（Slice）集中管理

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/Screenshot%202023-12-17%20at%2011.33.57.png)

### configureStore 方法

configureStore 方法最终会调用 redux 的 createStore 方法创建 Store，但是简化了如下部分的配置

- 中间件配置：包含了一些常用的默认中间件（如：redux-trunk），并且不用手动配置 applyMiddleware 就可以添加中间件
- DevTools 配置：自动集成 Redux DevTools，并且支持自定义配置，并且生产环境时可以自动禁用 DevTools
- Reducer 组合：可以接受一个 Reducer 对象，将多个 Reducer 组合起来
- 增强器配置，简化了增强器的操作，无需手动组合

```ts
export function configureStore<
  S = any,
  A extends Action = UnknownAction,
  M extends Tuple<Middlewares<S>> = Tuple<[ThunkMiddlewareFor<S>]>,
  E extends Tuple<Enhancers> = Tuple<
    [StoreEnhancer<{ dispatch: ExtractDispatchExtensions<M> }>, StoreEnhancer]
  >,
  P = S,
>(options: ConfigureStoreOptions<S, A, M, E, P>): EnhancedStore<S, A, E> {
  // 构建获取默认中间件的函数
  const getDefaultMiddleware = buildGetDefaultMiddleware<S>()

  const {
    reducer = undefined,
    middleware,
    devTools = true,
    preloadedState = undefined,
    enhancers = undefined,
  } = options || {}

  let rootReducer: Reducer<S, A, P>

  // 根据 reducer 类型创建 rootReducer
  if (typeof reducer === 'function') {
    rootReducer = reducer
  } else if (isPlainObject(reducer)) {
    rootReducer = combineReducers(reducer) as unknown as Reducer<S, A, P>
  }

  // 定义最终的中间件数组
  let finalMiddleware: Tuple<Middlewares<S>>
  if (typeof middleware === 'function') {
    finalMiddleware = middleware(getDefaultMiddleware)
  } else {
    finalMiddleware = getDefaultMiddleware()
  }

  // 配置 compose 函数，用于增强器的组合
  let finalCompose = compose

  // devTool 相关配置
  if (devTools) {
    finalCompose = composeWithDevTools({
      // Enable capture of stack traces for dispatched Redux actions
      trace: !IS_PRODUCTION,
      ...(typeof devTools === 'object' && devTools),
    })
  }

  // 创建中间件增强器
  const middlewareEnhancer = applyMiddleware(...finalMiddleware)

  // 构建获取默认增强器的函数
  const getDefaultEnhancers = buildGetDefaultEnhancers<M>(middlewareEnhancer)
  // 获取最终的增强器数组
  let storeEnhancers =
    typeof enhancers === 'function'
      ? enhancers(getDefaultEnhancers)
      : getDefaultEnhancers()

  const composedEnhancer: StoreEnhancer<any> = finalCompose(...storeEnhancers)

  // 最终调用 redux 的 createStore 创建 Store
  return createStore(rootReducer, preloadedState as P, composedEnhancer)
}
```

### createSlice 方法

createSlice 方法目标是创建一个 slice 切片统一管理 Store、Action、Reducer 并简化配置，具体实现步骤如下

- 定义 slice 名称和 reducer 路径
- 配置 reducers，支持函数或对象
- 创建 context 管理 reducers 和 action creators
- 遍历并处理 reducers，生成 action types 和 reducers
- 构建最终的 reducer 和 slice 对象，包括 reducer、actions、caseReducers 和其他实用方法

```ts
export function buildCreateSlice({ creators }: BuildCreateSliceConfig = {}) {
  return function createSlice(options) {
    const { name, reducerPath = name } = options

    // 将 reducer 配置为函数或对象形式
    const reducers =
      (typeof options.reducers === 'function'
        ? options.reducers(buildReducerCreators<State>())
        : options.reducers) || {}

    const reducerNames = Object.keys(reducers)

    // 创建 context 管理 reducers 和 action creators
    const context: ReducerHandlingContext<State> = {
      sliceCaseReducersByName: {},
      sliceCaseReducersByType: {},
      actionCreators: {},
      sliceMatchers: [],
    }

    // 定义处理 reducers 的方法
    const contextMethods: ReducerHandlingContextMethods<State> = {
      // 添加一个 case reducer 和对应的 action 类型
      addCase(typeOrActionCreator, reducer) {},
      // 添加一个 matche 和对应的 reducer，处理不基于特定 action 类型的通用逻辑
      addMatcher(matcher, reducer) {},
      // 将一个 action creator 暴露在 slice 的 actions 对象中
      exposeAction(name, actionCreator) {},
      // 将一个 case reducer 暴露在 slice 的 caseReducers 对象中
      exposeCaseReducer(name, reducer) {},
    }

    // 遍历 reducers 并应用
    reducerNames.forEach((reducerName) => {
      const reducerDefinition = reducers[reducerName]
      const reducerDetails: ReducerDetails = {
        reducerName,
        type: getType(name, reducerName),
        createNotation: typeof options.reducers === 'function',
      }
      handleNormalReducerDefinition<State>(
        reducerDetails,
        reducerDefinition,
        contextMethods
      )
    })

    // 构建最终的 reducer 函数
    function buildReducer() {
      const [
        extraReducers = {},
        actionMatchers = [],
        defaultCaseReducer = undefined,
      ] =
        typeof options.extraReducers === 'function'
          ? executeReducerBuilderCallback(options.extraReducers)
          : [options.extraReducers]

      const finalCaseReducers = {
        ...extraReducers,
        ...context.sliceCaseReducersByType,
      }

      return createReducer(options.initialState, (builder) => {
        for (let key in finalCaseReducers) {
          builder.addCase(key, finalCaseReducers[key] as CaseReducer<any>)
        }
        for (let sM of context.sliceMatchers) {
          builder.addMatcher(sM.matcher, sM.reducer)
        }
        for (let m of actionMatchers) {
          builder.addMatcher(m.matcher, m.reducer)
        }
        if (defaultCaseReducer) {
          builder.addDefaultCase(defaultCaseReducer)
        }
      })
    }

    // 定义和返回 slice 对象
    let _reducer: ReducerWithInitialState<State>

    const slice = {
      // slice 的唯一标识名
      name,
      // 在 State 树中的路径，通常与 slice 名称相同
      reducerPath,
      // 定义如何根据接收到的 action 和当前 state，并计算新 state 的函数
      reducer(state, action) {},
      // 自动生成的 action creators，与 slice 中的 reducers 相关联
      actions: context.actionCreators,
      // case reducers 集合，每个 case reducer 对应处理一种 action
      caseReducers: context.sliceCaseReducersByName,
      // 获取 slice 的初始状态函数
      getInitialState() {},
      // 创建和缓存对应 slice 状态的选择器函数
      getSelectors(selectState: (rootState: any) => State = selectSelf) {
        const selectorCache = emplace(injectedSelectorCache, this, {
          insert: () => new WeakMap(),
        })

        return emplace(selectorCache, selectState, {
          insert: () => {
            const map: Record<string, Selector<any, any>> = {}
            for (const [name, selector] of Object.entries(
              options.selectors ?? {}
            )) {
              map[name] = wrapSelector(
                this,
                selector,
                selectState,
                this !== slice
              )
            }
            return map
          },
        }) as any
      },
      // 从全局状态中提取出当前 slice 的状态
      selectSlice(state) {},
      // 获取包含 slice 的所有选择器
      get selectors() {
        return this.getSelectors(this.selectSlice)
      },
      // 将 reducer 动态注入到 store 中（通常用在代码拆分或动态加载 reducer 场景）
      injectInto(injectable, { reducerPath: pathOpt, ...config } = {}) {},
    }

    return slice
  }
}

export const createSlice = buildCreateSlice()
```
