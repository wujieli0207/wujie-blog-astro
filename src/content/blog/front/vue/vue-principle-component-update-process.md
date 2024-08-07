---
title: vue3 源码学习：组件更新过程
excerpt: vue3 源码学习：组件更新过程
publishDate: '2023-04-08'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: vue3 源码学习：组件更新过程
---

在前一篇[文章](https://www.wujieli.com/blog/front/vue/vue-principle-template-ref)中，我介绍了 vue3 中组件初次渲染为 DOM 元素的过程，下面介绍一下当组件发生变化时，vue3 更新组件的过程

组件类型的 vnode 挂载的过程时，在 `setupRenderEffect` 方法中，定义了一个 `componentUpdateFn` 方法并通过 `ReactiveEffect` 转换一个副作用的渲染函数，当组件状态发生变化时，会自动触发副作用函数 `componentUpdateFn` 执行，下面我们来看更新时的函数执行逻辑

可以看到当组件更新时，会进入到 `patch` 函数中执行更新逻辑

```ts
const componentUpdateFn = () => {
  // 组件初次挂载
  if (!instance.isMounted) {
    // ...
  }
  // 组件更新逻辑
  else {
    let { next, vnode } = instance

    // next 记录未渲染的父组件 vnode
    if (next) {
      next.el = vnode.el
      updateComponentPreRender(instance, next, optimized)
    } else {
      next = vnode
    }

    // 更新子节点 node
    const nextTree = renderComponentRoot(instance)
    const prevTree = instance.subTree
    instance.subTree = nextTree

    // 核心：进入patch 更新流程
    patch(/* 相关参数 */)

    next.el = nextTree.el
  }
}
```

`patch` 函数根据不同类型的 vnode 做不同的处理操作，同样我们看核心 `processElement` 处理元素类型和`processComponent` 处理组件类型函数过程

## 组件类型更新过程

由于是更新组件，n1 不为 null，进入到 `updateComponent` 函数

```ts
const processComponent = (/* 相关参数 */) => {
  n2.slotScopeIds = slotScopeIds
  if (n1 == null) {
    // 挂载操作
  } else {
    // 更新组件
    updateComponent(n1, n2, optimized)
  }
}
```

在 `updateComponent` 函数执行逻辑如下

1. 调用 `shouldUpdateComponent` 方法判断是否需要更新组件，如果不用更新组件，则仅更新节点 DOM 元素缓存和 instance 的 vnode
2. 如果需要更新组件，将新 vnode 赋值给 instance 的 next 属性，并调用 instance 的 `update` 方法更新组件，`update` 方法就是在挂载组件时，在 `setupRenderEffect` 方法中定义的响应式函数

```ts
const updateComponent = (n1: VNode, n2: VNode, optimized: boolean) => {
  const instance = (n2.component = n1.component)!
  // 判断函数是否需要更新
  if (shouldUpdateComponent(n1, n2, optimized)) {
    instance.next = n2
    instance.update()
  }
  // 无需更新仅复制元素
  else {
    n2.el = n1.el
    instance.vnode = n2
  }
}
```

那么组件在什么情况下需要更新呢，`shouldUpdateComponent` 中定义了下面几种情况都会强制更新组件

- HMR 热更新
- 动态节点，动态节点包括含有 vue 指令的节点（v-if 等）和使用了 transition 的节点
- 优化过 vnode（即存在 patchFlag 标志位）
  - 子节点是动态插槽（在 v-for 中）
  - 存在完整属性标志位 `PatchFlags.FULL_PROPS`，比较新旧 props 是否相同，不相同强制更新
  - 存在部分属性标志位 `PatchFlags.PROPS`，新旧节点的动态 props 不同则强制更新
- 手动编写 `render` 函数的场景
- 新 props 存在而旧 props 不存在
- 存在 emits 时，新旧 props 不同则强制更新

```ts
export function shouldUpdateComponent(
  prevVNode: VNode,
  nextVNode: VNode,
  optimized?: boolean
): boolean {
  const { props: prevProps, children: prevChildren, component } = prevVNode
  const { props: nextProps, children: nextChildren, patchFlag } = nextVNode
  const emits = component!.emitsOptions

  // 热更新场景
  if (nextVNode.dirs || nextVNode.transition) {
    return true
  }

  // 当存在优化标志位
  if (optimized && patchFlag >= 0) {
    // 子节点是动态插槽
    if (patchFlag & PatchFlags.DYNAMIC_SLOTS) {
      return true
    }
    // 存在完整属性标志位
    if (patchFlag & PatchFlags.FULL_PROPS) {
      if (!prevProps) {
        return !!nextProps
      }
      return hasPropsChanged(prevProps, nextProps!, emits)
    }
    // 存在部分属性标志位
    else if (patchFlag & PatchFlags.PROPS) {
      const dynamicProps = nextVNode.dynamicProps!
      for (let i = 0; i < dynamicProps.length; i++) {
        const key = dynamicProps[i]
        if (
          nextProps![key] !== prevProps![key] &&
          !isEmitListener(emits, key)
        ) {
          return true
        }
      }
    }
  } else {
    // 手动编写 render 函数
    if (prevChildren || nextChildren) {
      if (!nextChildren || !(nextChildren as any).$stable) {
        return true
      }
    }
    // 新旧 props 相同则跳过更新
    if (prevProps === nextProps) {
      return false
    }
    if (!prevProps) {
      return !!nextProps
    }
    if (!nextProps) {
      return true
    }
    return hasPropsChanged(prevProps, nextProps, emits)
  }

  return false
}
```

另一点需要提出的是，在 `shouldComponentUpdate` 结果为 true 判断需要更新时，会将新节点 vnode 赋值给 next 属性，此处 next 属性的作用是：标记接下来需要渲染的子组件，当 next 属性存在时，通过 `updateComponentPreRender` 更新实例上的 props、slots、vnode 信息，保证后续组件渲染取值是最新的

```diff
const componentUpdateFn = () => {
  // 组件初次挂载
  if (!instance.isMounted) {

  }
  // 组件更新逻辑
  else {
    let { next, vnode } = instance

+   // next 记录未渲染的父组件 vnode
+    if (next) {
+     next.el = vnode.el
+     updateComponentPreRender(instance, next, optimized)
    } else {
      next = vnode
    }

    // 更新子节点 node
    const nextTree = renderComponentRoot(instance)
    const prevTree = instance.subTree
    instance.subTree = nextTree

    // 核心：进入patch 更新流程
    patch( /* 相关参数 */)

    next.el = nextTree.el
  }
}
```

## 元素更新过程

更新元素时，由于 n1 不为 null，同样进入到 `patchElement` 更新元素方法

```ts
const processElement = (/* 相关参数 */) => {
  if (n1 == null) {
  } else {
    patchElement(/* 相关参数 */)
  }
}
```

`patchElement` 方法执行过程如下，函数中的核心逻辑是进入 `patchChildren` 方法对子节点进行完整的 diff 处理过程

- 根据 dynamicChildren 判断是否是动态元素（比如带有 v-for 指令的元素），如果是动态元素调用 `patchBlockChildren` 更新动态子节点，否则调用 `patchChildren` 方法更新
- 根据 patchFlag，依次处理 props、class、style 等属性

```ts
const patchElement = (/* 相关参数 */) => {
  const el = (n2.el = n1.el!)
  let { patchFlag, dynamicChildren } = n2
  patchFlag |= n1.patchFlag & PatchFlags.FULL_PROPS
  const oldProps = n1.props || EMPTY_OBJ
  const newProps = n2.props || EMPTY_OBJ

  // 根据 dynamicChildren 判断是否是动态元素
  if (dynamicChildren) {
    // 处理动态子节点
    patchBlockChildren(/* 相关参数 */)
  } else if (!optimized) {
    // 全量diff处理子节点
    patchChildren(/* 相关参数 */)
  }

  // 根据 patchFlag，依次处理 props、class、style 等属性
  if (patchFlag > 0) {
    if (patchFlag & PatchFlags.FULL_PROPS) {
      // element props contain dynamic keys, full diff needed
      patchProps(/* 相关参数 */)
    } else {
      if (patchFlag & PatchFlags.CLASS) {
        if (oldProps.class !== newProps.class) {
          hostPatchProp(el, 'class', null, newProps.class, isSVG)
        }
      }
      if (patchFlag & PatchFlags.STYLE) {
        hostPatchProp(el, 'style', oldProps.style, newProps.style, isSVG)
      }

      if (patchFlag & PatchFlags.PROPS) {
        const propsToUpdate = n2.dynamicProps!
        for (let i = 0; i < propsToUpdate.length; i++) {
          const key = propsToUpdate[i]
          const prev = oldProps[key]
          const next = newProps[key]
          // #1471 force patch value
          if (next !== prev || key === 'value') {
            hostPatchProp(/* 相关参数 */)
          }
        }
      }
    }

    if (patchFlag & PatchFlags.TEXT) {
      if (n1.children !== n2.children) {
        hostSetElementText(el, n2.children as string)
      }
    }
  } else if (!optimized && dynamicChildren == null) {
    patchProps(/* 相关参数 */)
  }
}
```

在 `patchChildren` 中，子节点一共分为三种类型：文本类型、数组类型、空节点，数组类型即代表元素还存在子节点。根据新旧节点这三种类型的两两组合，一个会存在 9 种场景，代码中的判断逻辑相对复杂，但整理为表格之后就非常清晰明了。对于新旧节点都是数组类型，进入完成 diff 算法的计划再新写一篇文章

|              | 新节点为空 | 新节点文本             | 新节点为数组             |
| ------------ | ---------- | ---------------------- | ------------------------ |
| 旧节点为空   | 不做操作   | 添加新文本             | 添加新子节点             |
| 旧节点为文本 | 删除旧文本 | 更新文本               | 移除旧文本，添加新子节点 |
| 旧节点为数组 | 删除旧数组 | 移除旧节点，添加新文本 | **完整 diff 算法**       |

```ts
const patchChildren: PatchChildrenFn = (/* 相关参数 */) => {
  const c1 = n1 && n1.children
  const prevShapeFlag = n1 ? n1.shapeFlag : 0
  const c2 = n2.children

  const { patchFlag, shapeFlag } = n2
  // 如果存在 patchFlag，进行优化算法处理
  if (patchFlag > 0) {
    if (patchFlag & PatchFlags.KEYED_FRAGMENT) {
      patchKeyedChildren(/* 相关参数 */)
      return
    } else if (patchFlag & PatchFlags.UNKEYED_FRAGMENT) {
      patchUnkeyedChildren(/* 相关参数 */)
      return
    }
  }

  // 新旧节点三种类型 9 种组合的处理过程
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    // 新节点是文本节点，旧节点是数组或文本节点，先卸载旧节点
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      unmountChildren(c1 as VNode[], parentComponent, parentSuspense)
    }
    // 新旧节点都是文本节点，更新文本内容
    if (c2 !== c1) {
      hostSetElementText(container, c2 as string)
    }
  } else {
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 新旧节点都是数组，完整 diff 算法
      if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        patchKeyedChildren(/* 相关参数 */)
      } else {
        // 新节点不是数组，旧节点是数组，卸载旧节点
        unmountChildren(c1 as VNode[], parentComponent, parentSuspense, true)
      }
    } else {
      // 新节点是数组，旧节点是文本节点，先卸载旧节点
      if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
        hostSetElementText(container, '')
      }
      // 新节点是数组，挂载新节点
      if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        mountChildren(/* 相关参数 */)
      }
    }
  }
}
```

## 组件更新过程总结

上面介绍了组件类型和元素类型的更新过程，下面我们举一个具体的例子来总结整体的回顾流程

父组件 App.vue

```js
<template>
  <div>
    父组件
    <child :msg="msg" />
    <button @click="handleUpdateMsg">更新 msg</button>
  </div>
</template>
<script setup>
  import { ref } from 'vue'
  import Child from './child.vue'

  const msg = ref('初始化')

  function handleUpdateMsg() {
    msg.value = '更新后'
  }
</script>
```

子组件 child.vue

```js
<template>
  {{ msg }}
</template>
<script setup>
  import { toRefs } from 'vue'
  const props = difineProps({
    msg: {
      type: String
    }
  })

  const { msg } = toRefs(props)
</script>
```

在父组件 App.vue 中，内部使用了一个 child.vue 子组件，当点击按钮修改 msg 时，两个组件的更新过程如下

1. 点击按钮，App 组件自身状态发生变化，进入组件更新逻辑，此时 next 属性为 null，根据新旧 subTree 进入 `patch` 方法
2. 此时组件的类型为 div，进入 `patchElement` 更新元素，此时 div 节点下有 child 子组件，进入组件更新流程
3. 子组件 child 进入 `updateComponent` 方法，`shouldUpdateComponent` 判断为 true 需要更新组件，将新子组件 vnode 赋值为 instance.next，调用 `instance.update()` 方法进入副作用渲染函数
4. 此时 next 属性有值，调用 `updateComponentPreRender` 更新实例数据，完成子组件 child 渲染过程
5. 子组件更新完成后，父组件 App 根据最新的实例数据，渲染最新的子节点

最后在上次的挂载流程图上，补充组件过程过程的逻辑（蓝色部分）

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/%E6%88%AA%E5%B1%8F2023-04-08%2014.16.47.png)
