---
title: vue Router 4源码解析：如何创建路由
excerpt: vue Router 4源码解析：如何创建路由
publishDate: '2023-04-29'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: vue Router 4源码解析：如何创建路由
---

## Vue Router 基础使用

在 vue3 项目中使用 vue router，我们通常会在 /src/router 目录下定义 router 相关参数，然后在 main 文件中引入安装至 app 实例

```ts
// 定义 router 参数
import { createRouter, createWebHashHistory } from 'vue-router'

// 创建一个可以被 Vue 应用程序使用的路由实例
export const router = createRouter({
  // 创建一个 hash 历史记录。
  history: createWebHashHistory(),
  // 应该添加到路由的初始路由列表。
  routes: basicRoutes as unknown as RouteRecordRaw[],
  scrollBehavior: () => ({ left: 0, top: 0 }),
})

// main 文件中安装至 app 实例
import { router } from '@/router'

app.use(router)
```

所以根据使用可以看到，核心的方法主要是 `createRouter` 创建路由实例，和 `app.use` 挂载路由（实际会调用 `router.install` 方法），下面我们来分析具体实现原理

## 创建路由原理

通过 `createRouter` 创建路由实例，`createRouter` 方法的核心主要是返回一个路由实例 router，我们先通过 TS 类型定义看看创建参数和 router 实例包含的属性

```ts
export function createRouter(options: RouterOptions): Router {
  /*...*/
}
```

函数参数 `RouterOptions` 的 TS 类型定义，可以看到比较核心的两个属性是 history 和 routes，history 定义路由导航方式是 hash 模式还是 history 模式，routes 定义初始化的路由列表。parseQuery 和 stringifyQuery 两个属性解析和序列化路由，可以用来做路由参数加密

```ts
export interface RouterOptions extends PathParserOptions {
  // 定义路由导航方式，分为 hash 模式和 history 模式
  history: RouterHistory
  // 初始化路由列表
  routes: Readonly<RouteRecordRaw[]>
  // 路由跳转后滚动事件
  scrollBehavior?: RouterScrollBehavior
  // 解析和序列化路由参数，常用于路由参数加密
  parseQuery?: typeof originalParseQuery
  stringifyQuery?: typeof originalStringifyQuery
  // 定义 router-link 组件的链接被点击后，默认在链接上添加的 class 名称
  linkActiveClass?: string
  linkExactActiveClass?: string
}
```

函数返回类型主要定义了 router 实例的核心属性和自定义方法

```ts
export interface Router {
  // 当前路由
  readonly currentRoute: Ref<RouteLocationNormalizedLoaded>
  // 路由配置项，即 createRouter 传入参数
  readonly options: RouterOptions
  // 是否允许监听 history 事件，通常用于微前端
  listening: boolean

  // 路由的 crud
  addRoute(parentName: RouteRecordName, route: RouteRecordRaw): () => void
  addRoute(route: RouteRecordRaw): () => void
  removeRoute(name: RouteRecordName): void
  hasRoute(name: RouteRecordName): boolean
  getRoutes(): RouteRecord[]

  // 返回路由地址的标准化版本
  resolve(
    to: RouteLocationRaw,
    currentLocation?: RouteLocationNormalizedLoaded
  ): RouteLocation & { href: string }

  // 路由 push 跳转，history 栈会增加跳转路由
  push(to: RouteLocationRaw): Promise<NavigationFailure | void | undefined>

  // 路由 replace 跳转，更换 history 栈顶元素
  replace(to: RouteLocationRaw): Promise<NavigationFailure | void | undefined>

  // 路由后退、前进、跳转
  back(): ReturnType<Router['go']>
  forward(): ReturnType<Router['go']>
  go(delta: number): void

  // 路由守卫三个方法
  beforeEach(guard: NavigationGuardWithThis<undefined>): () => void
  beforeResolve(guard: NavigationGuardWithThis<undefined>): () => void
  afterEach(guard: NavigationHookAfter): () => void
  // 路由错误处理
  onError(handler: _ErrorHandler): () => void
  // 是否完成初始化导航
  isReady(): Promise<void>
  // vue 实例注册 router 的方法
  install(app: App): void
}
```

接下来我们看 `createRouter` 方法具体实现，由于方法很长，这里先列出属性定义，后续再逐步展开，其中相对比较核心的包括

- matcher 属性：解析路由配置，创建路由规则，处理路由匹配
- parseQuery 和 stringifyQuery 属性：路由参数处理
- routerHistory 属性：定义路由历史记录处理方式，分为 hash 和 history（计划第二篇文章讲解）
- beforeGuards、beforeResolveGuards、afterGuards 属性：路由导航（计划第三篇文章讲解）
- install 方法：向 vue 实例中注册 router 实例

```ts
export function createRouter(options: RouterOptions): Router {
  // 解析路由配置，创建路由规则，处理路由匹配
  const matcher = createRouterMatcher(options.routes, options)
  // 路由参数处理
  const parseQuery = options.parseQuery || originalParseQuery
  const stringifyQuery = options.stringifyQuery || originalStringifyQuery
  // 定义路由历史记录处理方式，分为 hash 和 history
  const routerHistory = options.history

  // 定义路由守卫
  const beforeGuards = useCallbacks<NavigationGuardWithThis<undefined>>()
  const beforeResolveGuards = useCallbacks<NavigationGuardWithThis<undefined>>()
  const afterGuards = useCallbacks<NavigationHookAfter>()

  // 定义当前路由
  const currentRoute = shallowRef<RouteLocationNormalizedLoaded>(
    START_LOCATION_NORMALIZED
  )
  // 暂存正在进行的导航操作，用于地址变化时判断导航是否完成
  let pendingLocation: RouteLocation = START_LOCATION_NORMALIZED

  // 路由参数规范化
  const normalizeParams = applyToParams.bind(
    null,
    (paramValue) => '' + paramValue
  )
  const encodeParams = applyToParams.bind(null, encodeParam)
  const decodeParams: (params: RouteParams | undefined) => RouteParams =
    applyToParams.bind(null, decode)

  let started: boolean | undefined
  const installedApps = new Set<App>()

  const router: Router = {
    /* router 实例属性 */
    install,
  }

  return router
}
```

### matcher 属性

matcher 属性由 `createRouterMatcher` 方法创建，方法中定义了 matchers 数组和 matcherMap map 来存储路由匹配规则，并返回了 5 个关于 matcher 的增删改查操作函数

```ts
export function createRouterMatcher(
  routes: Readonly<RouteRecordRaw[]>,
  globalOptions: PathParserOptions
): RouterMatcher {
  // 定义 matchers 数组，存储所有路由匹配规则
  const matchers: RouteRecordMatcher[] = []
  // 定义 matcher Map，通过 路由名称 更快的定位到匹配规则
  const matcherMap = new Map<RouteRecordName, RouteRecordMatcher>()
  // 合并选项参数
  globalOptions = mergeOptions(
    { strict: false, end: true, sensitive: false } as PathParserOptions,
    globalOptions
  )

  // 通过 路由名称获取对应 matchers
  function getRecordMatcher(name: RouteRecordName) {}

  // 添加路由
  function addRoute(
    record: RouteRecordRaw,
    parent?: RouteRecordMatcher,
    originalRecord?: RouteRecordMatcher
  ) {}

  function removeRoute(matcherRef: RouteRecordName | RouteRecordMatcher) {}

  // 获取 matchers 数组
  function getRoutes() {}

  // 新增 matcher
  function insertMatcher(matcher: RouteRecordMatcher) {}

  // 获得路由的标准化版本
  function resolve(
    location: Readonly<MatcherLocationRaw>,
    currentLocation: Readonly<MatcherLocation>
  ): MatcherLocation {}

  // 遍历初始化路由，对每一个路由使用 addRoute 方法处理
  routes.forEach((route) => addRoute(route))

  return { addRoute, resolve, removeRoute, getRoutes, getRecordMatcher }
}
```

#### addRoute 方法

`addRoute` 方法用来添加路由，方法参数有三个：record 是需要添加的路由、parent 是父 matcher、originalRecord 是原始 matcher，parent 和 originalRecord 参数是可选参数，如果传入的话说明添加路由还需要结合父路由和别名路由处理。下面是 `addRoute` 方法的实现步骤

1. 通过 `normalizeRouteRecord`方法标准化 record，合并 options 和全局 option

   ```ts
   function addRoute(
     record: RouteRecordRaw,
     parent?: RouteRecordMatcher,
     originalRecord?: RouteRecordMatcher
   ) {
     const isRootAdd = !originalRecord
     // 标准化 record
     const mainNormalizedRecord = normalizeRouteRecord(record)
     mainNormalizedRecord.aliasOf = originalRecord && originalRecord.record
     // 合并自定义 options 和全局 options
     const options: PathParserOptions = mergeOptions(globalOptions, record)
   }
   ```

   这里的 `normalizeRouteRecord` 方法会将传入的 record 转换为一个标准的 matcher 数组

   ```ts
   export function normalizeRouteRecord(
     record: RouteRecordRaw
   ): RouteRecordNormalized {
     return {
       path: record.path,
       redirect: record.redirect,
       name: record.name,
       meta: record.meta || {},
       aliasOf: undefined,
       beforeEnter: record.beforeEnter,
       props: normalizeRecordProps(record),
       children: record.children || [],
       instances: {},
       leaveGuards: new Set(),
       updateGuards: new Set(),
       enterCallbacks: {},
       components:
         'components' in record
           ? record.components || null
           : record.component && { default: record.component },
     }
   }
   ```

2. 处理别名 alias

   根据[官网的说明](https://router.vuejs.org/zh/guide/essentials/redirect-and-alias.html#%E5%88%AB%E5%90%8D)，alias 不会修改访问的 url，所以在处理 alias 参数时，取出别名属性后放入 normalizedRecords 数组中，相当于新增一条访问的路由

   ```ts
   function addRoute(/*相关参数*/) {
     if ('alias' in record) {
       // alias 统一转化为数组遍历
       const aliases =
         typeof record.alias === 'string' ? [record.alias] : record.alias!
       for (const alias of aliases) {
         normalizedRecords.push(
           assign({}, mainNormalizedRecord, {
             components: originalRecord
               ? originalRecord.record.components
               : mainNormalizedRecord.components,
             // 将别名路由放入 path
             path: alias,
             aliasOf: originalRecord
               ? originalRecord.record
               : mainNormalizedRecord,
           }) as typeof mainNormalizedRecord
         )
       }
     }
   }
   ```

3. 遍历 normalizedRecords，处理嵌套路由 path，通过 `createRouteRecordMatcher` 方法生成匹配器

   `createRouteRecordMatcher` 方法通过 `tokenizePath` 编码 + `tokensToParser` 解码，将 path 转化为一个 token 数组，后续通过传入的 path 就能够匹配到对应的路由

   ```ts
   function addRoute(/*相关参数*/) {
     for (const normalizedRecord of normalizedRecords) {
       const { path } = normalizedRecord
       // 处理嵌套路由 path
       if (parent && path[0] !== '/') {
         const parentPath = parent.record.path
         const connectingSlash =
           parentPath[parentPath.length - 1] === '/' ? '' : '/'
         normalizedRecord.path =
           parent.record.path + (path && connectingSlash + path)
       }
       // 创建匹配器
       matcher = createRouteRecordMatcher(normalizedRecord, parent, options)
     }
   }
   ```

4. 处理 originRecord

   如果 originRecord 存在就将 matcher 放入 originRecord 的 alias 中；否则将第一个 matcher 作为 originalRocord 处理。此外当 originalMatcher 和 matcher 不相等时，说明 matcher 是有别名记录产生，放入 originalMatcher 的 alias 中

   ```ts
   function addRoute(/*相关参数*/) {
     for (const normalizedRecord of normalizedRecords) {
       if (originalRecord) {
         originalRecord.alias.push(matcher)
       } else {
         // 如果 originRecord 不存在的话，将第一个 matcher 作为 originalRocord
         originalMatcher = originalMatcher || matcher
         // originalMatcher 和 matcher 不相等时，说明 matcher 是有别名记录产生，放入 originalMatcher 的 alias 中
         if (originalMatcher !== matcher) originalMatcher.alias.push(matcher)

         // 避免嵌套调用删除多余路由
         if (isRootAdd && record.name && !isAliasRecord(matcher))
           removeRoute(record.name)
       }
     }
   }
   ```

5. 遍历子路路由，循环调用 addRoute 方法处理子路由

   ```ts
   function addRoute(/*相关参数*/) {
     for (const normalizedRecord of normalizedRecords) {
       // 5. 遍历子路路由，循环调用 addRoute 方法处理子路由
       if (mainNormalizedRecord.children) {
         const children = mainNormalizedRecord.children
         for (let i = 0; i < children.length; i++) {
           addRoute(
             children[i],
             matcher,
             originalRecord && originalRecord.children[i]
           )
         }
       }
     }
   }
   ```

6. 插入 matcher

   ```ts
   function addRoute(/*相关参数*/) {
     for (const normalizedRecord of normalizedRecords) {
       // 排除掉没有定义 components、name、redirect 其中一个的 matcher，避免无法展示路由内容
       if (
         (matcher.record.components &&
           Object.keys(matcher.record.components).length) ||
         matcher.record.name ||
         matcher.record.redirect
       ) {
         insertMatcher(matcher)
       }
     }
   }
   ```

   在 `insertMatcher` 方法中，会首先比较优先级，判断需要插入的 matcher 优先级更高才会放入到 matchers 数组。同时，如果 matcher 不是别名 record 的话，放入 matcherMap 中，便于通过 name 快速检索

   ```ts
   function insertMatcher(matcher: RouteRecordMatcher) {
     let i = 0
     while (
       i < matchers.length &&
       // 比较优先级，避免重复插入
       comparePathParserScore(matcher, matchers[i]) >= 0 &&
       (matcher.record.path !== matchers[i].record.path ||
         !isRecordChildOf(matcher, matchers[i]))
     ) {
       i++
       matchers.splice(i, 0, matcher)
     }

     // 如果 matcher 不是别名 record 的话，放入 matcherMap 中，便于通过 name 快速检索
     if (matcher.record.name && !isAliasRecord(matcher))
       matcherMap.set(matcher.record.name, matcher)
   }
   ```

7. 返回一个删除原始 matcher 后的 matcher 集合

   ```ts
   function addRoute(/*相关参数*/) {
     return originalMatcher ? () => removeRoute(originalMatcher!) : noop
   }
   ```

至此 `addRoute` 方法的整体流程就完成了，流程很长，用一张图总结一下 `addRoute` 的整体实现过程

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202304280656907.png)

#### removeRoute 方法

`removeRoute` 方法的实现过程相对比较简单

- 如果传入的参数是 string / symbol 类型，说明是路由名称，从 matcherMap 数组中找到名称对应 matcher，分别删除 matcherMap、matchers、children、alias 中的 matcher
- 否则如果从 matchers 找到需要删除的 matcher 的话，同样也删除 matcherMap、matchers、children、alias 中的 matcher

```ts
function removeRoute(matcherRef: RouteRecordName | RouteRecordMatcher) {
  if (isRouteName(matcherRef)) {
    const matcher = matcherMap.get(matcherRef)
    if (matcher) {
      matcherMap.delete(matcherRef)
      matchers.splice(matchers.indexOf(matcher), 1)
      matcher.children.forEach(removeRoute)
      matcher.alias.forEach(removeRoute)
    }
  } else {
    const index = matchers.indexOf(matcherRef)
    if (index > -1) {
      matchers.splice(index, 1)
      if (matcherRef.record.name) matcherMap.delete(matcherRef.record.name)
      matcherRef.children.forEach(removeRoute)
      matcherRef.alias.forEach(removeRoute)
    }
  }
}
```

### parseQuery 和 stringifyQuery 属性

parseQuery 属性和 originalStringifyQuery 属性如果没有自定义的话，会通过默认的方法进行处理，两个方法都是标准的 url 参数序列化和反序列化过程，很值得作为标准模板使用。两个方法的原理在我的另一篇文章 [vue 项目优雅的对 url 参数加密](https://www.wujieli.com/blog/front/vue/vue-url-parameter-encryption) 的实现原理部分有详细介绍，这里就不再重复复制了

```ts
import {
  parseQuery as originalParseQuery,
  stringifyQuery as originalStringifyQuery,
} from './query'

const parseQuery = options.parseQuery || originalParseQuery
const stringifyQuery = options.stringifyQuery || originalStringifyQuery
```

### install 方法

`router.install` 方法用于向 vue 的 app 实例中这册 router 实例，在 install 方法中，主要包括如下几步

1. 向 vue 中注册两个路由内置组件
2. 定义 `$router` 属性，可以直接通过 `this.$router` 访问 router 属性
3. 初始化 router 时设置 started 属性为 true，避免 router 实例注册到多个 vue 实例时重复加载
4. 设置初始化路由属性并赋值
5. 向 vue 实例中注入 router 等属性，便于全局使用
6. 定义 vue 实例卸载的 unmount 方法，重置相关属性，注意 started 设置为 false

```ts
const router: Router = {
  install(app: App) {
    const router = this
    // 向 vue 中注册两个路由内置组件
    app.component('RouterLink', RouterLink)
    app.component('RouterView', RouterView)

    // 定义 $router 属性，可以直接通过 this.$router 访问 router 属性
    app.config.globalProperties.$router = router
    Object.defineProperty(app.config.globalProperties, '$route', {
      enumerable: true,
      get: () => unref(currentRoute),
    })

    // 初始化 router 时设置 started 属性为 true，避免 router 实例注册到多个 vue 实例时重复加载
    if (
      isBrowser &&
      !started &&
      currentRoute.value === START_LOCATION_NORMALIZED
    ) {
      started = true
    }

    // 设置初始化路由属性并赋值
    const reactiveRoute = {} as {
      [k in keyof RouteLocationNormalizedLoaded]: ComputedRef<
        RouteLocationNormalizedLoaded[k]
      >
    }
    for (const key in START_LOCATION_NORMALIZED) {
      reactiveRoute[key] = computed(() => currentRoute.value[key])
    }

    // 向 vue 实例中注入 router 等属性，便于全局使用
    app.provide(routerKey, router)
    app.provide(routeLocationKey, reactive(reactiveRoute))
    app.provide(routerViewLocationKey, currentRoute)

    // 定义 vue 实例卸载的 unmount 方法，重置相关属性，注意 started 设置为 false
    const unmountApp = app.unmount
    installedApps.add(app)
    app.unmount = function () {
      installedApps.delete(app)
      // the router is not attached to an app anymore
      if (installedApps.size < 1) {
        // invalidate the current navigation
        pendingLocation = START_LOCATION_NORMALIZED
        removeHistoryListener && removeHistoryListener()
        removeHistoryListener = null
        currentRoute.value = START_LOCATION_NORMALIZED
        started = false
        ready = false
      }
      unmountApp()
    }
  },
}
```

## 创建路由原理总结

最后我们再总结一下创建路由的整体过程

1. 通过 `createRouter` 创建路由
2. 通过 `createRouterMatcher` 创建路由规则匹配器
3. 通过 `parseQuery` 和 `stringifyQuery` 解析路由参数
4. 通过 `createWebHistory` 或 `createWebHashHistory` 定义路由历史记录处理方式
5. 定义路由守卫处理过程
6. 返回 router 实例，通过 `router.install` 方法注册至 app 实例

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202304290756341.png)
