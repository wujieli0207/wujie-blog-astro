---
title: vue3 源码学习：ref 模板引用原理
excerpt: vue3 源码学习：ref 模板引用原理
publishDate: '2023-04-02'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: vue3 源码学习：ref 模板引用原理
---

## ref 模板引用功能简介

根据官网的描述，`ref` 是一个特殊的 attribute，当一个 DOM 元素或者子组件实例被挂在后，能够直接获取到挂载元素的属性或者方法

```js
<script setup>
  import { ref, onMounted } from 'vue'

  // 声明一个 ref 来存放该元素的引用
  // 必须和模板里的 ref 同名
  const input = ref(null)

  onMounted(() => {
    input.value.focus()
  })
</script>

<template>
  <input ref="input" />
</template>
```

所以简单来说，ref 模板引用就是直接进行 DOM 操作的一个方式，类似 `getElementById()`，用来完成一些 vue 数据驱动模型无法覆盖的场景。不过需要注意的是，对 DOM 操作一定是要在 DOM 渲染完成之后，所以在使用 ref 模板引用的过程中需要考虑到 DOM 不存在的情况

下面介绍一下 vue3 中 ref 模板引用的实现原理

## 实现原理

vue3 通过 `createApp` 方法创建 vue 实例并通过 `mount` 方法挂载 DOM 节点，在 `mount` 方法执行过程中，通过 `createVNode` 方法创建一个 vnode 节点，从最终生成 vnode 节点的 `createBaseVNode` 的方法中可以看到，ref 属性已经包含在创建的 vnode 对象中

```ts
// 函数参数已省略，具体函数目录在 packages/runtime-core/src/vnode.ts
function createBaseVNode() {
  const vnode = {
    type,
    props,
    key: props && normalizeKey(props),
    // ref 模板引用属性
    ref: props && normalizeRef(props),
    children,
    component: null,
    ctx: currentRenderingInstance,
    // ... 省略部分属性
  } as VNode

  // 返回一个 vnode 对象
  return vnode
}
```

通过 `normalizeRef` 方法创建了 ref 属性，可以看到在满足条件的情况下将 currentRenderingInstance 变量赋值给了 ref 属性

```ts
const normalizeRef = ({
  ref,
  ref_key,
  ref_for,
}: VNodeProps): VNodeNormalizedRefAtom | null => {
  return (
    ref != null
      ? isString(ref) || isRef(ref) || isFunction(ref)
        ? // 在满足条件的情况下将 currentRenderingInstance 变量赋值给了 ref 属性
          { i: currentRenderingInstance, r: ref, k: ref_key, f: !!ref_for }
        : ref
      : null
  ) as any
}
```

currentRenderingInstance 变量用于记录当前渲染的组件实例，通过 `setCurrentRenderingInstance` 方法来设置 currentRenderingInstance 变量，同时返回父组件的实例

```ts
export function setCurrentRenderingInstance(
  instance: ComponentInternalInstance | null
): ComponentInternalInstance | null {
  const prev = currentRenderingInstance
  // 记录当前组件实例
  currentRenderingInstance = instance
  // 返回父组件的组件实例
  return prev
}
```

`setCurrentRenderingInstance` 方法之所以会返回父组件的实例，是因为 vue3 渲染过程中会渲染父组件再渲染子组件，在渲染子组件过程中，当需要用到父组件实例时（比如通过 inject 获取依赖注入的值），就可以通过 `setCurrentRenderingInstance` 的返回值直接获取

在子组件渲染完成后，`setCurrentRenderingInstance` 会被再次调用并将当前的组件实例设置为父组件渲染实例，这样确保子组件在渲染完成之后，还能够正确获取到父组件的实例

`renderComponentRoot` 方法返回组件的 vnode，过程中设置了 currentRenderingInstanc 变量

```ts
export function renderComponentRoot(
  instance: ComponentInternalInstance
): VNode {
  let result

  // 设置当前正在渲染的组件实例
  const prev = setCurrentRenderingInstance(instance)

  // ... 执行组件的 setup 函数和 render 函数以生成组件的 VNode

  // 将当前的组件实例设置为父组件渲染实例
  setCurrentRenderingInstance(prev)

  return result // 返回组件的 VNode
}
```

在 `renderComponentRoot` 函数执行完成后，进入到 `patch` 方法将 vnode 转换为真实的 DOM，在 patch 函数执行的末尾，通过 `setRef` 方法来设置 ref 模板引用

```ts
const patch: PatchFn = (
  n1,
  n2,
  parentComponent = null,
  parentSuspense = null
  // 省略部分参数
) => {
  // ... 不同类型的 vnode 处理过程

  // 设置 ref 模板引用
  if (ref != null && parentComponent) {
    setRef(ref, n1 && n1.ref, parentSuspense, n2 || n1, !n2)
  }
}
```

在 `setRef` 方法中对于 ref 类型有几种处理情况（源码中还有很多边界情况，这里只是最简化的场景）

- 数组类型的 ref，遍历调用 `setRef` 方法处理
- 函数类型的 ref，直接执行 ref 函数（vue3 中所有函数都通过 `callWithErrorHandling` 方法执行）
- 字符串类型的 ref，将 ref 值 value 赋值给渲染上下文的 setupState 对象

```ts
export function setRef(
  rawRef: VNodeNormalizedRef,
  oldRawRef: VNodeNormalizedRef | null,
  parentSuspense: SuspenseBoundary | null,
  vnode: VNode,
  isUnmount = false
) {
  // 数组形式的 ref，遍历调用 setRef 方法
  if (isArray(rawRef)) {
    rawRef.forEach((r, i) =>
      setRef(
        r,
        oldRawRef && (isArray(oldRawRef) ? oldRawRef[i] : oldRawRef),
        parentSuspense,
        vnode,
        isUnmount
      )
    )
    return
  }

  // ! 如果是异步组件并且还没有挂载，直接返回
  if (isAsyncWrapper(vnode) && !isUnmount) {
    return
  }

  // 处理 ref 的值 value
  // ! 如果是组件，获取组件的实例，否则获取 vnode 的 元素
  const refValue =
    vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT
      ? getExposeProxy(vnode.component!) || vnode.component!.proxy
      : vnode.el
  const value = isUnmount ? null : refValue

  const setupState = owner.setupState

  // 函数类型的 ref，执行 ref 函数
  if (isFunction(ref)) {
    callWithErrorHandling(ref, owner, ErrorCodes.FUNCTION_REF, [value, refs])
  } else if (_isString) {
    // 字符串类型的 ref，如果在对应渲染上下文存在 ref 的 key
    // 赋值 ref 值给渲染下文 setupState
    if (hasOwn(setupState, ref)) {
      setupState[ref] = value
    }
  }
}
```

最后再简单梳理一下 ref 模板引用的实现流程

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/%E6%88%AA%E5%B1%8F2023-04-02%2015.09.59.png)
