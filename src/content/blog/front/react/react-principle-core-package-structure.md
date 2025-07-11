---
title: 从 react 目录看 react 核心包结构
excerpt: 从 react 目录看 react 核心包结构
publishDate: '2024-11-13'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: 从 react 目录看 react 核心包结构
---

## 核心包结构

react 项目采用的是 Monorepo 的项目结构，packages 目录下有 35 个目录，但对于核心原理的了解，实际只有 4 个包，分别是 react、react-dom、react-reconciler、scheduler（版本是 18.2.0），下面我们先简单介绍一下这 4 个包的主要用途

react：基础包，提供创建 react 组件、状态管理、生命周期管理等必要的函数，我们在开发过程中使用的 api 主要都来自这个包的定义

react-dom：web 应用的渲染器，主要作用是将 React 组件转换为 DOM 节点，并渲染在浏览器上。在 React 18 中，更推荐使用的渲染 api 是 `createRoot.render`，在 concurrent 模式（并发模式）下性能更好

react-reconciler：react 的核心包，通过实现协调算法（diff 算法）**管理 react 状态的输入和输出**，主要功能包括

- 接受状态输入，将更新逻辑封装到回调函数
- 将回调函数放入 scheduler 进行调用执行
- 回调函数执行完成后获取到更新结果，交给渲染器（react-dom 或 react-native）渲染到页面上

scheduler：从名字就可以看出是一个调度器，主要有两个功能

1. 通过**调整任务的优先级**，控制 react-reconciler 放入的回调函数的执行时机
2. 在 concurrent 模式（并发模式）下实现**任务分片**，也就是可以暂时中断低优先级的任务，执行高优先级的任务，高优先级完成后再继续执行低优先级的任务

下面用一个例子来简单的说明这 4 个包作用，这是一段典型的 react 代码，点击 “+1” 按钮后统计数字会 +1

```tsx
import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  function handleClick() {
    setCount(count + 1)
  }

  return (
    <>
      <div>{count}</div>
      <button onClick={handleClick}>+1</button>
    </>
  )
}

export default App
```

首先在这段代码中，通过 react 包导入了一个方法 `useState`，用于管理 App 组件内部定义的 count 状态

当点击 +1 按钮后，会调用 `setCount` 方法更新组件的状态，此时 react-reconciler 包会收到 `setCount` 方法发起的更新请求，对比虚拟 DOM 并决定是否需要更新，然后将更新请求包装为一个回调函数，发送给 scheduler 包

scheduler 包在接收到更新函数后，会根据任务的优先级放入到任务队列，然后循环执行任务队列中的任务，直到任务清空

当 `setCount` 更新任务在 scheduler 中执行完成后，react-reconciler 包将更新的结果发送给 react-dom 包，react-dom 将更新结果转换为真实的 DOM 并渲染在页面上

## 总结

react 18 中核心的 4 个包分别是

- react：定义组件和管理组件内部状态
- react-reconciler：管理状态的输入和输出
- scheduler：管理任务的优先级和调度
- react-dom：渲染 react 组件到 web 页面上

最后用一张图来总结一下 4 个核心包的作用和相互关系

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/Screenshot%202023-11-13%20at%2011.49.49.png)
