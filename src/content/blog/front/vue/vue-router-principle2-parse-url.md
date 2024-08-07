---
title: vue Router 4源码解析2：url 如何跳转
excerpt: vue Router 4源码解析2：url 如何跳转
publishDate: '2023-05-14'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: vue Router 4源码解析2：url 如何跳转
---

在[上一篇文章](https://www.wujieli.com/blog/front/vue/vue-router-principle1-create-router)我介绍了如何创建路由，下面我们来分析当输入一个 url 时，如何通过路由跳转到对应页面

## 基础概念介绍

先介绍一下浏览器的 window.location 对象，通过 location 对象能够访问到 url 每个部分的参数

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202305120652081.png)

其次要介绍一下 window.history 对象，history 对象能够[操作浏览器会话历史](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/history)，从而实现页面跳转的效果，history 对象有四个核心对象和属性

- `history.pushState(data, title, [, url])` 方法：向历史记录栈顶添加一条记录
  - data：`onpopstate` 事件触发时作为参数传递
  - title：页面标题，除了 safari 之外的浏览器都会忽略 title 参数
  - url：页面地址
- `history.replaceState(data, title, [, url])` 方法：更改当前历史记录
- `history.state` 属性：存储上述方法的 data 数据
- `history.scrollRestoration` 属性：自动的（auto）或手动的（manual）恢复浏览器的页面滚动位置

  但是通过 history 对象实现路由跳转，刷新页面会重新发起请求，如果服务端没有匹配到请求 url 就会产生 404，所以也需要服务端配合改造，设置一个没有匹配默认返回的地址

  结合 location 对象和 history 对象，我们具备了获取 url 和跳转 url 的能力，通过这两个能力，下面我们来分析路由跳转的实现原理

## 路由跳转实现原理

我们在创建路由时，会定义 history 属性，vue-router 有三种方式：`createWebHistory` 、 `createWebHashHistory` 和 `createMemoryHistory`，因为 `createWebHistory` 是基于基础 history 对象实现，所以我们分析 `createWebHistory` 的实现原理

### createWebHistory

`createWebHistory` 方法实现主要分为 5 步，我们先看整体方法示意图，再具体介绍每一步实现

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202305141134660.png)

```ts
export function createWebHistory(base?: string): RouterHistory {
  // 第一步：标准化 base 参数
  base = normalizeBase(base)
  // 第二步：创建 history
  const historyNavigation = useHistoryStateNavigation(base)
  // 第三步：创建路由监听器
  const historyListeners = useHistoryListeners(
    base,
    historyNavigation.state,
    historyNavigation.location,
    historyNavigation.replace
  )
  // 第四步：定义 go 方法，创建完成的路由导航对象
  function go(delta: number, triggerListeners = true) {
    if (!triggerListeners) historyListeners.pauseListeners()
    history.go(delta)
  }

  const routerHistory: RouterHistory = assign(
    {
      // it's overridden right after
      location: '',
      base,
      go,
      createHref: createHref.bind(null, base),
    },

    historyNavigation,
    historyListeners
  )

  // 第五步：添加 location 和 state 访问劫持
  Object.defineProperty(routerHistory, 'location', {
    enumerable: true,
    get: () => historyNavigation.location.value,
  })

  Object.defineProperty(routerHistory, 'state', {
    enumerable: true,
    get: () => historyNavigation.state.value,
  })

  return routerHistory
}
```

#### 第一步：标准化 base 参数

通过 `normalizeBase` 方法处理 base 参数，主要是为了规范化 base 参数，避免错误如果没有传递 base 参数的话，在浏览器环境取 `<base>` 标签的链接，否则默认为 `/`，保证 base 前又一个前导斜杠，并移除末尾斜杠

```ts
export function normalizeBase(base?: string): string {
  // 如果没有传入 base 参数，
  if (!base) {
    // 在浏览器中 base 取 <base> 标签的链接，否则默认为 /
    if (isBrowser) {
      // respect <base> tag
      const baseEl = document.querySelector('base')
      base = (baseEl && baseEl.getAttribute('href')) || '/'
      // strip full URL origin
      base = base.replace(/^\w+:\/\/[^\/]+/, '')
    } else {
      base = '/'
    }
  }

  // 确保 base 前有一个前导斜杠，避免问题
  if (base[0] !== '/' && base[0] !== '#') base = '/' + base

  // 移除 base 末尾斜杠
  return removeTrailingSlash(base)
}
```

#### 第二步：创建 history 对象

通过 `useHistoryStateNavigation` 方法创建 vue-router 的 history 对象，本质上是对浏览器的 history 对象属性和方法做了一个映射

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202305141343341.png)

```ts
function useHistoryStateNavigation(base: string) {
  const { history, location } = window

  // private variables
  const currentLocation: ValueContainer<HistoryLocation> = {
    value: createCurrentLocation(base, location),
  }
  const historyState: ValueContainer<StateEntry> = { value: history.state }
  // 刷新后通过 changeLocation 方法创建 historyState
  if (!historyState.value) {
    changeLocation()
  }

  function changeLocation(): void {}

  function replace(to: HistoryLocation, data?: HistoryState) {}

  function push(to: HistoryLocation, data?: HistoryState) {}

  return {
    location: currentLocation,
    state: historyState,

    push,
    replace,
  }
}
```

`changeLocation` 方法用来更新浏览器历史记录并触发页面导航，首先根据 base 获取跳转的完整 url，在通过 replace 判断通过浏览器的 `replaceState` 还是 `pushState` 进行页面跳转

```ts
function changeLocation(
  to: HistoryLocation,
  state: StateEntry,
  replace: boolean
): void {
  const hashIndex = base.indexOf('#')
  // 获取跳转的完整 url
  const url =
    hashIndex > -1
      ? (location.host && document.querySelector('base')
          ? base
          : base.slice(hashIndex)) + to
      : createBaseLocation() + base + to
  try {
    // 通过 replace 判断通过 replaceState 还是 pushState 进行页面跳转
    history[replace ? 'replaceState' : 'pushState'](state, '', url)
    historyState.value = state
  } catch (err) {
    location[replace ? 'replace' : 'assign'](url)
  }
}
```

`replace` 方法和 `push` 方法都使用到 `buildState` 创建 state，主要目的是为了在 state 中添加页面滚动位置，在返回到时候能够再回到原来的位置

```ts
function buildState(
  back: HistoryLocation | null,
  current: HistoryLocation,
  forward: HistoryLocation | null,
  replaced: boolean = false,
  computeScroll: boolean = false
): StateEntry {
  return {
    back,
    current,
    forward,
    replaced,
    position: window.history.length,
    // 记录页面滚动位置
    scroll: computeScroll ? computeScrollPosition() : null,
  }
}
```

`replace` 方法先通过 `buildState` 方法创建一个新的 state，再通过 `changeLocation` 方法进行页面跳转，最后再更新 currentLocation 的值

```ts
function replace(to: HistoryLocation, data?: HistoryState) {
  const state: StateEntry = assign(
    {},
    history.state,
    buildState(
      historyState.value.back,
      // keep back and forward entries but override current position
      to,
      historyState.value.forward,
      true
    ),
    data,
    { position: historyState.value.position }
  )

  changeLocation(to, state, true)
  currentLocation.value = to
}
```

`push` 方法和 `replace` 方法类似，但要注意的是，`push` 方法会**通过 `changeLocation` 进行两次页面跳转**，第一次通过 `replaceState` 进行页面跳转，目的是为了在 state 中记录页面滚动的位置，第二次通过 `pushState` 才是真正的跳转

```ts
function push(to: HistoryLocation, data?: HistoryState) {
  const currentState = assign(
    {},
    historyState.value,
    history.state as Partial<StateEntry> | null,
    {
      forward: to,
      scroll: computeScrollPosition(),
    }
  )

  // 第一次通过 replaceState 跳转，在 state 记录页面滚动位置
  changeLocation(currentState.current, currentState, true)

  const state: StateEntry = assign(
    {},
    buildState(currentLocation.value, to, null),
    { position: currentState.position + 1 },
    data
  )

  // 第二次通过 pushState 实现 push 跳转
  changeLocation(to, state, false)
  currentLocation.value = to
}
```

#### 第四步：创建路由监听器

通过 `useHistoryListeners` 方法创建路由监听器，当路由变化时做响应修改，方法主要定义了对于 history 操作事件 popstate 的处理方法 `popStateHandler`，最后再返回操作监听事件三个方法

```ts
function useHistoryListeners(
  base: string,
  historyState: ValueContainer<StateEntry>,
  currentLocation: ValueContainer<HistoryLocation>,
  replace: RouterHistory['replace']
) {
  // 监听回调函数集合
  let listeners: NavigationCallback[] = []
  let teardowns: Array<() => void> = []

  // 暂停状态
  let pauseState: HistoryLocation | null = null

  // 处理浏览器历史状态更改
  const popStateHandler: PopStateListener = () => {}

  // 停止监听操作
  function pauseListeners() {
    pauseState = currentLocation.value
  }

  // 添加监听回调函数
  function listen(callback: NavigationCallback) {}

  // 当用户从当前页面导航离开时记录当前页面滚动位置
  function beforeUnloadListener() {}

  // 清空 teardowns 数组，移除监听事件
  function destroy() {}

  // 监听 history 操作事件 popstate
  window.addEventListener('popstate', popStateHandler)
  // 监听页面离开的时间 beforeunload
  window.addEventListener('beforeunload', beforeUnloadListener, {
    passive: true,
  })

  return {
    pauseListeners,
    listen,
    destroy,
  }
}
```

`popStateHandler` 方法主要做了两件事

1. 处理跳转地址，更新 state 缓存信息，如果是暂停监听状态，停止跳转并重置 pauseState
2. 遍历回调函数并执行，相当于发布订阅模式通知所有注册的订阅者

```ts
const popStateHandler: PopStateListener = ({
  state,
}: {
  state: StateEntry | null
}) => {
  // 跳转的新地址
  const to = createCurrentLocation(base, location)
  // 当前地址
  const from: HistoryLocation = currentLocation.value
  // 当前 state
  const fromState: StateEntry = historyState.value
  // 计步器，当用户从当前页面导航离开时将调用该函数
  let delta = 0

  if (state) {
    currentLocation.value = to
    historyState.value = state

    // ignore the popstate and reset the pauseState
    if (pauseState && pauseState === from) {
      pauseState = null
      return
    }
    delta = fromState ? state.position - fromState.position : 0
  } else {
    // 如果没有 state，则执行 replace 回调
    replace(to)
  }

  // 遍历回调事件并执行
  listeners.forEach((listener) => {
    listener(currentLocation.value, from, {
      delta,
      type: NavigationType.pop,
      direction: delta
        ? delta > 0
          ? NavigationDirection.forward
          : NavigationDirection.back
        : NavigationDirection.unknown,
    })
  })
}
```

`listen` 监听方法向 listeners 数组中存储回调函数，并且在内部定义了 `teardown` 方法用来清除回调函数

```ts
function listen(callback: NavigationCallback) {
  listeners.push(callback)

  // 如果 listeners 数组包含 callback，则清空 callback
  const teardown = () => {
    const index = listeners.indexOf(callback)
    if (index > -1) listeners.splice(index, 1)
  }

  teardowns.push(teardown)
  return teardown
}
```

`beforeUnloadListener` 方法用于在离开页面是，判断 history 中是否有历史页面状态数据，如果有的话，就记录当前页面的位置

```ts
function beforeUnloadListener() {
  const { history } = window
  if (!history.state) return
  // 如果 history 中有状态，则通过 scroll 记录当前页面位置
  history.replaceState(
    assign({}, history.state, { scroll: computeScrollPosition() }),
    ''
  )
}
```

`destory` 方法清空 teardowns 数组，移除监听事件

```ts
function destroy() {
  // 清空 teardowns 数组，移除监听事件
  for (const teardown of teardowns) teardown()
  teardowns = []
  window.removeEventListener('popstate', popStateHandler)
  window.removeEventListener('beforeunload', beforeUnloadListener)
}
```

#### 第四步：创建完整路由导航对象

定义 go 方法，可以直接使用计步器跳转到对应历史路由，再将 location、base 等状态合并创建完成的路由导航对象

```ts
// 定义 go 方法，如果第二个参数 triggerListeners 为 false 则暂停监听
function go(delta: number, triggerListeners = true) {
  if (!triggerListeners) historyListeners.pauseListeners()
   history.go(delta)
  }

  // 创建完整的路由导航对象
  const routerHistory: RouterHistory = assign(
    {
    // it's overridden right after
    location: '',
    base,
    go,
    createHref: createHref.bind(null, base),
    },

    historyNavigation,
    historyListeners
  )
}
```

#### 第五步：添加 lacation 和 state 访问劫持

添加 lacation 和 state 访问劫持，保证访问 location 和 value 属性时获取的是具体值而不是代理对象

```ts
// 第五步：添加 lacation 和 state 访问劫持
Object.defineProperty(routerHistory, 'location', {
  enumerable: true,
  get: () => historyNavigation.location.value,
})

Object.defineProperty(routerHistory, 'state', {
  enumerable: true,
  get: () => historyNavigation.state.value,
})
```

### createWebHashHistory

`createWebHashHistory` 本质也是基于 `createWebHistory` 的方式来实现，在 base 中会默认拼接一个 `#`，在回顾下第一幅图，如果 url 链接中带有 `#` 后面的部分会作为锚点，就不会再刷新时请求服务器。最后再将处理好的 base 参数传入 `createWebHistory` 方法，同样借助 history 实现路由跳转

```ts
export function createWebHashHistory(base?: string): RouterHistory {
  base = location.host ? base || location.pathname + location.search : ''
  // 确保链接会拼接一个 #
  if (!base.includes('#')) base += '#'

  return createWebHistory(base)
}
```

### createMemoryHistory

`createMemoryHistory` 方法用于服务端渲染，因为服务端没有浏览器的 history 对象，所以实现方式是基于内存，下面我们简单分析一下具体实现

在 `createMemoryHistory` 方法中，定义 queue 作为历史记录的存储队列，定义 position 作为计步器，设置 location、push、replace 的方法都是基于 queue 的出队入队操作实现，最后再将相关路由操作方法放在 routerHistory 对象中返回

```ts
export function createMemoryHistory(base: string = ''): RouterHistory {
  let listeners: NavigationCallback[] = []
  let queue: HistoryLocation[] = [START]
  let position: number = 0
  // 第一步：
  base = normalizeBase(base)

  function setLocation(location: HistoryLocation) {
    position++
    if (position === queue.length) {
      // we are at the end, we can simply append a new entry
      queue.push(location)
    } else {
      // we are in the middle, we remove everything from here in the queue
      queue.splice(position)
      queue.push(location)
    }
  }

  // 触发监听回调函数执行
  function triggerListeners(
    to: HistoryLocation,
    from: HistoryLocation,
    { direction, delta }: Pick<NavigationInformation, 'direction' | 'delta'>
  ): void {
    const info: NavigationInformation = {
      direction,
      delta,
      type: NavigationType.pop,
    }
    for (const callback of listeners) {
      callback(to, from, info)
    }
  }

  const routerHistory: RouterHistory = {
    // rewritten by Object.defineProperty
    location: START,
    // TODO: should be kept in queue
    state: {},
    base,
    createHref: createHref.bind(null, base),

    replace(to) {
      // remove current entry and decrement position
      queue.splice(position--, 1)
      setLocation(to)
    },

    push(to, data?: HistoryState) {
      setLocation(to)
    },

    listen(callback) {
      listeners.push(callback)
      return () => {
        const index = listeners.indexOf(callback)
        if (index > -1) listeners.splice(index, 1)
      }
    },
    destroy() {
      listeners = []
      queue = [START]
      position = 0
    },

    go(delta, shouldTrigger = true) {
      const from = this.location
      const direction: NavigationDirection =
        delta < 0 ? NavigationDirection.back : NavigationDirection.forward
      position = Math.max(0, Math.min(position + delta, queue.length - 1))
      if (shouldTrigger) {
        triggerListeners(this.location, from, {
          direction,
          delta,
        })
      }
    },
  }

  Object.defineProperty(routerHistory, 'location', {
    enumerable: true,
    get: () => queue[position],
  })

  return routerHistory
}
```
