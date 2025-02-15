---
title: pinia 源码实现解析
excerpt: pinia 源码实现解析
publishDate: '2023-04-22'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: pinia 源码实现解析
---

## 基础介绍

pinia 是一个同时支持 Vue2 / Vue3 的状态管理工具，相比于 vuex，pinia 有三个优点

- 简化概念，只保留 state、getter、action，分别对应于 vue 中的 data、computed、methods
- 同时支持 options 和 setup 方式定义和完整的 TS 支持，符合 Vue3 推荐的编程模式
- 体积更小，并且支持 SSR 和代码拆分，性能更好

在基础的使用过程，pinia 也非常简便，这里以 vue3 中使用为例（示例来源于[官网](https://pinia.vuejs.org/zh/getting-started.html)）

在安装好 pinia 包之后，在 main 文件中通过 `createPinia` 方法定义根 pinia 实例

```diff
  import { createApp } from 'vue'
+ import { createPinia } from 'pinia'
  import App from './App.vue'

+ const pinia = createPinia()
  const app = createApp(App)

+ app.use(pinia)
  app.mount('#app')
```

在定义好根 pinia 实例之后，需要通过 `defineStore` 方法定义 Store，`defineStore` 支持 option 和 setup 方式定义。option 定义便于从 vuex 中迁移，也符合 vue2 的 option api 使用习惯，setup 定义更符合 vue3 的 setup 编程习惯

options 方式定义 Store 示例

```ts
export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: {
    double: (state) => state.count * 2,
  },
  actions: {
    increment() {
      this.count++
    },
  },
})
```

setup 方式定义 Store 示例

```ts
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)

  function increment() {
    count.value++
  }

  return { count, increment }
})
```

在定义好 Store 之后，我们就可以直接编码中使用了，需要注意的是，因为 store 是通过 `reactive` 包装的对象，直接解构会丢失响应性，需用通过 `storeToRefs` 方法来保持结构后的响应性（类似 vue3 的 `toRefs`）

```ts
<script setup>
  import {storeToRefs} from 'pinia' import {useCounterStore} from '@/stores/counter' 
  const counterStore = useCounterStore() 
  // 注意解构 store 需要通过 storeToRefs 方法 
  const {(count, increment)} = storeToRefs(counterStore)
</script>
```

## 源码解析

### 创建 pinia 实例

从基础介绍可以看到，通过 `createPinia` 方法创建的了一个 pinia 实例， `createPinia` 方法的源码主要分为两步

1. 定义用于存储全部 store 的 state 对象和插件列表
2. 初始化 pinia 实例，注册至 devtool 之后返回 pinia 实例

```ts
export function createPinia(): Pinia {
  const scope = effectScope(true)
  // 定义用于存储全部 store 的 state 对象
  const state = scope.run<Ref<Record<string, StateTree>>>(() =>
    ref<Record<string, StateTree>>({})
  )!

  // 定义插件离列表和待安装的插件
  let _p: Pinia['_p'] = []
  let toBeInstalled: PiniaPlugin[] = []

  // 定义 pinia 实例
  const pinia: Pinia = markRaw({
    install(app: App) {
      /*...*/
    },

    use(plugin) {
      /*...*/
    },

    _p,
    _a: null,
    _e: scope,
    _s: new Map<string, StoreGeneric>(),
    state,
  })

  // 注册 devtool
  if (USE_DEVTOOLS && typeof Proxy !== 'undefined') {
    pinia.use(devtoolsPlugin)
  }

  return pinia
}
```

在 pinia 实例中，定义的两个方法，`pinia.install` 方法用于向 vue 中注册 pinia，在 `app.use` 执行过程中会直接调用 `install` 方法。`install` 方法执行过程分为

1. 设置当前激活的 pinia 实例
2. 将 pinia 实例通过 `provide` 方法注册到全局，便于所有子组件调用
3. 注册 devtool 和插件

`pinia.use` 方法用于向 pinia 中注册插件，将传入的 plugin 放入插件数组并返回当前 pinia 实例

```ts
const pinia: Pinia = markRaw({
  install(app: App) {
    setActivePinia(pinia)
    if (!isVue2) {
      pinia._a = app
      // 重要：将 pinia 实例注册到全局，便于所有子组件调用
      app.provide(piniaSymbol, pinia)
      app.config.globalProperties.$pinia = pinia
      // 注册 devtool
      if (USE_DEVTOOLS) {
        registerPiniaDevtools(app, pinia)
      }
      // 注册插件
      toBeInstalled.forEach((plugin) => _p.push(plugin))
      toBeInstalled = []
    }
  },

  use(plugin) {
    if (!this._a && !isVue2) {
      toBeInstalled.push(plugin)
    } else {
      _p.push(plugin)
    }
    return this
  },

  _p,
  _a: null,
  _e: scope,
  _s: new Map<string, StoreGeneric>(),
  state,
})
```

此外 pinia 实例还包含一些内部属性，比较重要的是的 `pinia._s` 属性和 `pinia.state` 属性，前者用于储存 id 和 store 实例的 map 映射，避免重复创建，后者用于存储全部 store 的 state

```ts
const pinia: Pinia = markRaw({
  _p, // pinia 插件
  _a: null, // vue app实例
  _e: scope, // pinia 实例的 effect scope
  // 核心：存储 id 和 store 实例的 map 映射，避免重复创建
  _s: new Map<string, StoreGeneric>(),
  state, // 存储全部 store 的 state
})
```

### 定义 store

在全局创建并注册 pinia 实例后，接下来我们可以定义需要全局管理状态的 store。定义 store 需要通过 `defineStore` 方法，`defineStore` 方法首先根据传入参数，判断是 options 定义还是 setup 定义，然后定义内部函数 `useStore` 并返回

```ts
export function defineStore(
  idOrOptions: any,
  setup?: any,
  setupOptions?: any
): StoreDefinition {
  let id: string
  let options

  // 通过第二个参数是否是 function 类型，判断是否是 setup 形式的 store
  const isSetupStore = typeof setup === 'function'
  // idOrOptions 可以是丢像或者 string，通过类型确定 store id 和 options
  if (typeof idOrOptions === 'string') {
    id = idOrOptions
    options = isSetupStore ? setupOptions : setup
  } else {
    options = idOrOptions
    id = idOrOptions.id
  }

  function useStore(pinia?: Pinia | null, hot?: StoreGeneric): StoreGeneric {
    //...
  }

  // 返回 store 的创建结果
  useStore.$id = id
  return useStore
}
```

`useStore` 方法执行过程主要分为三步

1. 获取 vue 实例，如果 vue 实例存在，通过 inject 方法将 pinia 注入到当前 vue 实例
2. 设置当前激活的 pinia 实例
3. 判断缓存中是否存在 store id，如果存在直接取出 store 实例并返回，不存在则根据 options 还是 setup 类型创建 store

```ts
function useStore(pinia?: Pinia | null, hot?: StoreGeneric): StoreGeneric {
  // 获取当前 vue 实例
  const currentInstance = getCurrentInstance()
  // 如果 vue 实例存在，通过 inject 方法将 pinia 注入到当前 vue 实例并使用
  pinia = currentInstance && inject(piniaSymbol, null)
  // 设置为当前激活的 pinia 实例
  if (pinia) setActivePinia(pinia)
  pinia = activePinia!

  // 如果在缓存中没有定义该 store id，则创建
  if (!pinia._s.has(id)) {
    // setup 和 options 两种 store 的定义
    if (isSetupStore) {
      createSetupStore(id, setup, options, pinia)
    } else {
      createOptionsStore(id, options as any, pinia)
    }
  }

  // 缓存中存在 store 实例，直接取出并返回
  const store: StoreGeneric = pinia._s.get(id)!
  return store as any
}
```

#### createOptionsStore

在 option 类型的定义方法 `createOptionsStore` 中，定义了一个 `setup` 方法，并将相关参数传入了 `createSetupStore` 方法创建一个 store 并返回，所以创建 store 的核心方式还是通过 `createSetupStore` 方法

```ts
function createOptionsStore(
  id: Id,
  options: DefineStoreOptions<Id, S, G, A>,
  pinia: Pinia,
  hot?: boolean
): Store<Id, S, G, A> {
  const { state, actions, getters } = options

  function setup() {
    //...
  }

  // store
  store = createSetupStore(id, setup, options, pinia, hot, true)

  return store as any
}
```

再详细看一下内部定义的 `setup` 函数，函数的主要功能就是将 state、getters、actions 合并到一个对象中返回，保持和 setup 定义的一致性，便于后续统一处理

```ts
function setup() {
  // 创建 state 空对象
  if (!initialState) {
    /* istanbul ignore if */
    if (isVue2) {
      set(pinia.state.value, id, state ? state() : {})
    } else {
      pinia.state.value[id] = state ? state() : {}
    }
  }

  // 获取 state 属性
  const localState = toRefs(pinia.state.value[id])

  // 将 state、getters、actions 合并到一个对象中返回
  return assign(
    localState,
    actions,
    Object.keys(getters || {}).reduce(
      (computedGetters, name) => {
        computedGetters[name] = markRaw(
          computed(() => {
            setActivePinia(pinia)
            const store = pinia._s.get(id)!
            if (isVue2 && !store._r) return
            return getters![name].call(store, store)
          })
        )
        return computedGetters
      },
      {} as Record<string, ComputedRef>
    )
  )
}
```

#### createSetupStore

`createSetupStore` 方法很长，我们逐步拆解为每个步骤进行解读

1. 在 setup 场景下，创建一个 state 空对象

   ```ts
   function createSetupStore(/*相关参数*/): Store<Id, S, G, A> {
     // 1. 在 setup 场景下，创建一个 state 空对象
     const initialState = pinia.state.value[$id] as UnwrapRef<S> | undefined
     if (!isOptionsStore && !initialState && (!__DEV__ || !hot)) {
       if (isVue2) {
         set(pinia.state.value, $id, {})
       } else {
         pinia.state.value[$id] = {}
       }
     }
   }
   ```

2. 创建 partialStore 属性，内部主要包括自定义的方法，在通过 reactive 将 partialStore 转换为响应式 store，并将 store 存储到 pinia.\_s map 对象中

   ```ts
   function createSetupStore(/*相关参数*/): Store<Id, S, G, A> {
     // 2. 创建 partialStore 属性，内部主要包括自定义的方法，在通过 reactive 将 partialStore 转换为响应式 store
     const partialStore = {
       _p: pinia,
       $id,
       $onAction: addSubscription.bind(null, actionSubscriptions),
       $patch,
       $reset,
       $subscribe,
       $dispose,
     } as _StoreWithState<Id, S, G, A>
     const store: Store<Id, S, G, A> = reactive(
       partialStore
     ) as unknown as Store<Id, S, G, A>
     // 将 store 存储到 pinia._s map 对象中
     pinia._s.set($id, store)
   }
   ```

3. 执行 `setup` 方法，获取 store 数据并且遍历处理。`setup` 返回值主要分为两类，ref / reactive 和 Function，在遍历过程中将 ref / reactive 和 Function 挂载到 store 实例上

   ```ts
   function createSetupStore(/*相关参数*/): Store<Id, S, G, A> {
     // 执行 setup 方法，获取 store 数据
     const setupStore = pinia._e.run(() => {
       scope = effectScope()
       return scope.run(() => setup())
     })!

     // 遍历 store 数据
     for (const key in setupStore) {
       const prop = setupStore[key]

       // 处理返回属性是 ref 或 reactive 的情况
       if ((isRef(prop) && !isComputed(prop)) || isReactive(prop)) {
         // 非 optionsStore 的情况下
         if (!isOptionsStore) {
           // 合并 initialState
           if (initialState && shouldHydrate(prop)) {
             if (isRef(prop)) {
               prop.value = initialState[key]
             } else {
               mergeReactiveObjects(prop, initialState[key])
             }
           }
           // 将 prop 赋值给 pinia.state.value[$id][key]
           if (isVue2) {
             set(pinia.state.value[$id], key, prop)
           } else {
             pinia.state.value[$id][key] = prop
           }
         }
       }
       // 处理返回函数，即 action
       else if (typeof prop === 'function') {
         // 函数进过包装处理
         const actionValue = wrapAction(key, prop)
         // 挂载到 store 实例
         if (isVue2) {
           set(setupStore, key, actionValue)
         } else {
           setupStore[key] = actionValue
         }
         optionsForPlugin.actions[key] = prop
       }
     }
   }
   ```

4. 定义 `$state` 属性的 get 和 set 方法，可以直接通过 `$state` 方法

   ```ts
   function createSetupStore(/*相关参数*/): Store<Id, S, G, A> {
     Object.defineProperty(store, '$state', {
       get: () => pinia.state.value[$id],
       set: (state) => {
         $patch(($state) => {
           assign($state, state)
         })
       },
     })
   }
   ```

5. 注册 devtool、安装自定义的 plugin，最后返回 store 实例

   ```ts
   function createSetupStore(/*相关参数*/): Store<Id, S, G, A> {
     // 注册 devtool
     if (USE_DEVTOOLS) {
       const nonEnumerable = {
         writable: true,
         configurable: true,
         enumerable: false,
       }

       ;(
         ['_p', '_hmrPayload', '_getters', '_customProperties'] as const
       ).forEach((p) => {
         Object.defineProperty(
           store,
           p,
           assign({ value: store[p] }, nonEnumerable)
         )
       })
     }

     // 安装 plugin
     pinia._p.forEach((extender) => {
       if (USE_DEVTOOLS) {
         const extensions = scope.run(() =>
           extender({
             store,
             app: pinia._a,
             pinia,
             options: optionsForPlugin,
           })
         )!
         Object.keys(extensions || {}).forEach((key) =>
           store._customProperties.add(key)
         )
         assign(store, extensions)
       } else {
         assign(
           store,
           scope.run(() =>
             extender({
               store,
               app: pinia._a,
               pinia,
               options: optionsForPlugin,
             })
           )!
         )
       }
     })

     return store
   }
   ```

至此 `createSetupStore` 方法创建 store 实例的方法就结束了

## 原理回顾

最后我们回顾一下整体的实现流程
![image.png](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202305150627506.png)
