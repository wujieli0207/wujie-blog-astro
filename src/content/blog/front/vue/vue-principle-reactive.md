---
title: vue3 源码学习：reactive 响应式原理
excerpt: vue3 源码学习：reactive 响应式原理
publishDate: '2023-04-15'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: vue3 源码学习：reactive 响应式原理
---

## reactive 功能介绍

根据官方的推荐，reactive 通常用于创建响应式对象或者数组，本质上是对原始对象的代理，所以响应式对象和原始对象是不相等的

```js
<template>
  {{ state.count }}
</template>

<script setup>
  import { reactive } from 'vue'
  const raw = {
    count: 0,
    name: 'hello'
  }
  const state = reactive(raw)

  // 响应式对象和原始对象不相等
  console.log(state === raw) // false
  console.log(state === reactive(raw)) // true
</script>
```

但是 reactive 使用过程中有两个限制

1. 只对对象类型生效（对象、数组、Map、Set），对原始类型无效（string、number）
2. 替换或者解构 reactive 对象可能造成响应式丢失，如果需要结构的话需要通过通过 `toRefs` 保持响应式

   ```ts
   const state = reactive({
     count: 0,
     name: 'hello',
   })

   // 结构会导致响应式丢失
   const { count, name } = state

   // 使用 toRefs 方法保持响应式
   const { count, name } = toRefs(state)
   ```

## reactive 实现原理

响应式相关的 api 都定义在 reactivity 这个包下面，`reactive` 入口函数可以看出，非只读的对象通过 `createReactiveObject` 方法创建响应式变量

```ts
export function reactive(target: object) {
  // 如果对象是只读的，直接返回对象
  if (isReadonly(target)) {
    return target
  }

  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers,
    reactiveMap
  )
}
```

在 `createReactiveObject` 方法中

- 首先根据传入对象 target 做一系列判断，如果不满足条件则直接返回 target，只有 target 是对象类型、没有被 proxy 代理、在缓存 proxyMap 中不存在、符合 targetType 要求才会使用 Proxy 代理
- 使用 Proxy 代理对象时会根据 targetType 不同使用不同的代理方法，最后把 proxy 后的对象放入缓存并返回即可

```ts
function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>
) {
  // 非对象类型直接返回 target
  if (!isObject(target)) {
    return target
  }
  // 对象已经是 proxy，直接返回
  if (target[ReactiveFlags.RAW] && !(isReadonly && target[ReactiveFlags.IS_REACTIVE])) {
    return target
  }
  // 在缓存中存在 proxyMap，直接返回缓存对象
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }
  // 不符合 target 类型要求，直接返回
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    return target
  }

  // 核心：根据传入对象的不同类型，使用不同的代理方法，再使用 Proxy 代理
  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers
  )
  // 设置缓存并返回代理对象
  proxyMap.set(target, proxy)
  return proxy
}
```

那么 targetType 是如何被定义的，从 TargetType 枚举可以看出，targetType 分别有三类，在通过 `getTargetType` 获取对象类型时，如果对象被标记了 skip 属性或者不允许添加新属性，则会被标记为 INVALID。然后 Object 和 Array 类型被划分至 COMMON 普通对象，Map、Set、WeakMap、WeakSet 被划分至集合对象

```ts
const enum TargetType {
  INVALID = 0, // 非法对象
  COMMON = 1, // 普通对象
  COLLECTION = 2, // 集合对象
}

function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return TargetType.COLLECTION
    default:
      return TargetType.INVALID
  }
}

// 获取对象类型
function getTargetType(value: Target) {
  return value[ReactiveFlags.SKIP] || !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}
```

再确定了对传入对象 target 类型之后，接下来我们先看普通对象和数组的代理方法定义，根据需要创建的 reactive 类型不同，会区分为如下 4 类

```ts
mutableHandlers // 普通 reactive 代理方法
shallowReactiveHandlers // 浅响应式 reactive 代理方法
readonlyHandlers // 只读 reactive 代理方法
shallowReadonlyHandlers // 浅响应只读 reactive 代理方法
```

其中 `mutableHandlers` 定义了完整的 reactive 代理方法，涵盖了对属性的增删改查过程

```ts
export const mutableHandlers: ProxyHandler<object> = {
  get,
  set,
  deleteProperty,
  has,
  ownKeys,
}
```

### get 方法代理

get 代理方法通过 `createGetter` 方法创建，`createGetter` 会返回一个 get 函数，从完整的方法函数可以看到，会对类型为普通对象和数组，以及属性 key 不同时有不同的处理方式，具体判断我都写在注释中了

```ts
function createGetter(isReadonly = false, shallow = false) {
  return function get(target: Target, key: string | symbol, receiver: object) {
    // 如果属性 key 是 reactive、readonly、shallow，直接返回
    // 如果 key 是 raw 类型，并且能够从缓存中获取代理结果，直接返回 target
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    } else if (key === ReactiveFlags.IS_SHALLOW) {
      return shallow
    } else if (
      key === ReactiveFlags.RAW &&
      receiver ===
        (isReadonly
          ? shallow
            ? shallowReadonlyMap
            : readonlyMap
          : shallow
            ? shallowReactiveMap
            : reactiveMap
        ).get(target)
    ) {
      return target
    }

    // 在非只读场景下，处理数组和属性 key 是 hasOwnProperty 时的代理结果
    const targetIsArray = isArray(target)

    if (!isReadonly) {
      if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
        return Reflect.get(arrayInstrumentations, key, receiver)
      }
      if (key === 'hasOwnProperty') {
        return hasOwnProperty
      }
    }

    // 获取 get 代理结果
    const res = Reflect.get(target, key, receiver)

    // 处理 key 是 Symbol 类型场景
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res
    }

    // 如果对象是非只读，通过 track 方法手机依赖
    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key)
    }

    // 如果对象是浅响应场景，直接返回结果
    if (shallow) {
      return res
    }

    // 如果代理结果是 ref 类型，对于非数组 key 的响应式，返回的是 .value 移除 ref 包裹的结果
    if (isRef(res)) {
      return targetIsArray && isIntegerKey(key) ? res : res.value
    }

    // 如果代理结果是 ref 类型，在非只读情况下递归调用 reactive 方法将整个对象都设置为响应式
    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res)
    }

    return res
  }
}
```

但是对 `createGetter` 方法进行简化后，可以看到核心部分只有 4 行代码，通过 `Reflect.get` 获取代理结果，通过 `tarck` 方法追踪函数的副作用，简化后的 `createGetter` 方法如下

```ts
function createGetter(isReadonly = false, shallow = false) {
  const res = Reflect.get(target, key, receiver)

  track(target, TrackOpTypes.GET, key)

  return res
}
```

在介绍 `track` 方法之前，先要说明一下响应式依赖的存储数据结构 targetMap，targetMap 自身是一个 weakMap，键是原始对象，值是 map 实例；map 实例存储的键是原始对象的 key，值是由副作用函数组成的 set 集合。这样就形成了一个 target -> key -> effect 的结构，我们只要通过代理对象 target 和 key 就能够拿到全部的副作用函数

另外为什么 targetMap 使用的是 weakMap 而不是普通 Map，因为 weakMap 是弱引用，当 weakMap 的 key 没有引用时， 垃圾回收机制会将 key 和 value 从内存中移除。当对象 target 没有任何响应式依赖时，说明不需要再对 target 作响应式追踪，及时移除能够避免内存溢出

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/截屏2023-03-12 18.58.37.png)

在 `track` 方法中， 当 shouldTrack 为 true，activeEffect 副作用函数存在时才收集依赖，从 targetMap 中根据 target 和 key 获取响应式依赖并交给 `trackEffects` 处理。在 `trackEffects` 方法中，在满足条件的情况下，将依赖放入集合中

```ts
export function track(target: object, type: TrackOpTypes, key: unknown) {
  // 当 shouldTrack 为 true，activeEffect 副作用函数存在时才收集依赖
  if (shouldTrack && activeEffect) {
    // 从 targetMap 中根据对象 key 获取对应的副作用函数，获取不到直接创建
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = createDep()))
    }

    // 将 dep 副作用函数集合交给 trackEffects 执行
    trackEffects(dep)
  }
}

export function trackEffects(dep: Dep) {
  let shouldTrack = false
  // 在没有超过依赖递归最大深度的情况下，新添加追踪的依赖才收集
  if (effectTrackDepth <= maxMarkerBits) {
    if (!newTracked(dep)) {
      dep.n |= trackOpBit
      shouldTrack = !wasTracked(dep)
    }
  } else {
    // 超过依赖递归最大深度，需要追踪依赖
    shouldTrack = !dep.has(activeEffect!)
  }

  // 如果应该收集依赖，则将 activeEffect 副作用函数添加到 dep 副作用函数集合中
  if (shouldTrack) {
    dep.add(activeEffect!)
    activeEffect!.deps.push(dep)
  }
}
```

另外要单独说一下对于数组的 get 方法处理，对于数组的操作方法主要分

- 数组查询方法，不会改变数组长度，比如 `includes`、`indexOf` 方法
- 操作数组方法，会改变数组长度，比如 `push`、`pop` 等方法

对于这两类操作，在 vue3 中通过直接重写数组方法 `createArrayInstrumentations`

- 对于数组查询类方法，会遍历数组并对数组的每一项做响应式追踪，然后先从 this 指向的代理对象查询，查询不到再从 this.raw 指向的原数组查询
- 而对于操作数组的方法，因为操作过程会读取数组的 length 属性，造成副作用函数的死循环，所以在执行数组操作方法，先禁止 track，操作完成后再恢复

```ts
function createArrayInstrumentations() {
  const instrumentations: Record<string, Function> = {}
  // 数组查询方法
  ;(['includes', 'indexOf', 'lastIndexOf'] as const).forEach((key) => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      const arr = toRaw(this) as any
      for (let i = 0, l = this.length; i < l; i++) {
        track(arr, TrackOpTypes.GET, i + '')
      }
      // 执行数组查询
      const res = arr[key](...args)
      if (res === -1 || res === false) {
        return arr[key](...args.map(toRaw))
      } else {
        return res
      }
    }
  })
  // 数组操作方法
  ;(['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach((key) => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      // 执行操作方法前先停止 track
      pauseTracking()
      // 执行数组操作方法
      const res = (toRaw(this) as any)[key].apply(this, args)
      // 恢复 track
      resetTracking()
      return res
    }
  })
  return instrumentations
}
```

### set 方法代理

set 代理方法通过 `createSetter` 方法创建，`createSetter` 方法同样会对 readonly、shallow 等场景做处理，下面只列最核心的部分。首先排除掉 target 的原型链也是 proxy 的情况，避免二次触发 setter，再根据 key 是否存在于 target 中，执行新增属性还是修改属性 `trigger` 方法

```ts
function createSetter(shallow = false) {
  return function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object
  ): boolean {
    // 判断 key 是否存在于 target 中
    const hadKey =
      isArray(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn(target, key)
    // set 方法的执行结果
    const result = Reflect.set(target, key, value, receiver)

    // target 的原型链也是 proxy 的情况下，通过 Reflect.set 修改原型链上的属性会再次出发 setter
    // 所以此时就不用触发 trigger 了
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        trigger(target, TriggerOpTypes.ADD, key, value)
      } else if (hasChanged(value, oldValue)) {
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
      }
    }
    return result
  }
}
```

`trigger` 函数会从 targetMap 中获取响应式依赖集合，也就是需要执行的副作用函数，然后通过 triggerEffects 方法执行获取到的副作用函数

```ts
export function trigger(/*相关参数*/) {
  const depsMap = targetMap.get(target)
  // targetMap 中没有说明没有追踪依赖，直接返回
  if (!depsMap) {
    return
  }

  let deps: (Dep | undefined)[] = []
  // key 为 length 表示对数组的依赖执行
  if (key === 'length' && isArray(target)) {
    const newLength = Number(newValue)
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= newLength) {
        deps.push(dep)
      }
    })
  } else {
    // 获取对象中的依赖函数
    if (key !== void 0) {
      deps.push(depsMap.get(key))
    }
  }

  // 通过 triggerEffects 执行副作用函数
  if (deps.length === 1) {
    if (deps[0]) {
      triggerEffects(deps[0])
    }
  } else {
    const effects: ReactiveEffect[] = []
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep)
      }
    }
    triggerEffects(createDep(effects))
  }
}
```

在 `triggerEffects` 函数中，会把传入的副作用函数集合转化为数组统一遍历，然后先执行 computed 类型的副作用函数，因为 computed 执行过程中可能会产生新的副作用函数，最后再执行非 computed 类型的副作用函数，所有副作用函数都通过 `triggerEffect` 函数执行

`triggerEffect` 执行过程中会判断副作用函数是否有 scheduler 调度器，有的话直接执行调度器，没有的话直接通过 `run` 方法执行副作用函数

```ts
export function triggerEffects(dep: Dep | ReactiveEffect[]) {
  // 将副作用函数转换为函数统一遍历
  const effects = isArray(dep) ? dep : [...dep]
  // 首先执行 computed 类型的副作用函数，因为 computed 执行过程中可能会产生新的副作用函数
  for (const effect of effects) {
    if (effect.computed) {
      triggerEffect(effect)
    }
  }
  // 执行非 computed 类型的副作用函数
  for (const effect of effects) {
    if (!effect.computed) {
      triggerEffect(effect)
    }
  }
}

function triggerEffect(effect: ReactiveEffect) {
  if (effect !== activeEffect || effect.allowRecurse) {
    if (effect.scheduler) {
      effect.scheduler()
    } else {
      effect.run()
    }
  }
}
```

### deleteProperty、has、ownKeys 方法代理

这三个方法也是在对属性做删除、查询属性、查询属性 key 时，做响应式操作。`deleteProperty` 方法在删除属性时执行 `trigger` 执行副作用函数，`has` 和 `ownKeys` 查找属性时执行 `track` 收集副作用函数

```ts
function deleteProperty(target: object, key: string | symbol): boolean {
  const hadKey = hasOwn(target, key)
  const oldValue = (target as any)[key]
  const result = Reflect.deleteProperty(target, key)
  if (result && hadKey) {
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}

function has(target: object, key: string | symbol): boolean {
  const result = Reflect.has(target, key)
  if (!isSymbol(key) || !builtInSymbols.has(key)) {
    track(target, TrackOpTypes.HAS, key)
  }
  return result
}

function ownKeys(target: object): (string | symbol)[] {
  track(target, TrackOpTypes.ITERATE, isArray(target) ? 'length' : ITERATE_KEY)
  return Reflect.ownKeys(target)
}
```

## reactive 原理回顾

最后我们来整理一下 reactive 方法整体的实现原理，整体一共分为三步

1. 根据代理对象的类型，通过 Proxy 创建代理
2. 定义对象操作的不同代理对象，主要是 get 读取操作和 set 编辑操作
3. get 操作时通过 `track` 方法收集副作用函数，set 操作时通过 `trigger` 方法执行副作用函数

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202304151257570.png)
