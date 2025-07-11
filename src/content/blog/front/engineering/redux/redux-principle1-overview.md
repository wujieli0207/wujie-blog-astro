---
title: 探索 redux：状态管理的艺术
excerpt: 要理解 redux，首先要理解 redux 中的几个核心概念：Store、Action、Reducer 和 Component
publishDate: '2024-12-17'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: 探索 redux：状态管理的艺术
---

## redux 的核心概念与原则

要理解 redux，首先要理解 redux 中的几个核心概念：Store、Action、Reducer 和 Component

- Store：全局状态的存储中心，整个状态树都存储在 redux 中
- Action：用来描述一次具体的操作，是唯一能够改变 Store 的方式
- Reducer：一个纯函数，根据当前的状态和接收到的 Action，能够计算出最新的状态
- Component：用户的操作界面，在 react 中通常就是 react 组件

用一张图来说明 Store、Action、Reducer、 Component 四个核心概念

1. 首先从 Component 开始，当用户在页面进行一次操作时，会触发 Action
2. Action 会将用户操作分配给 Store
3. Store 将当前状态和收到的 Action 交给 Reducer 计算出新的状态
4. Store 状态更新后，会通知 Component 重新渲染，更新页面

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/Screenshot%202023-12-16%20at%2007.31.20.png)

redux 的核心是提供一个状态可预测的状态管理工具，除了上面讲到的四个核心外，还有三个基本原则用来保证状态管理的可预测性

1. **单一数据源**：所有状态统一保存在 Store 中，保证状态的统一维护、统一存储以及状态在不同组件间的共享
2. **状态是只读的**：状态的只读性质意味着不能直接修改状态，唯一的修改状态的方式只能通过 Action。通过 Action 保证了状态修改可以通过 Action 追踪，可以撤销或者重做，即使在异步的情况下也可以保证状态的一致性
3. **通过纯函数修改状态**：前面提到负责计算最新状态的 Reducer 是一个纯函数，纯函数的特点是**没有副作用，给定相同的输入能够返回相同的输出**，通过纯函数的确定性保证了状态的可预测性。并且通过纯函数的拆分，可以将一个大的 Reducer 拆分为多个小的 Reducer，保证每个 Reducer 的简单和独立

## redux 技术栈的架构和关系

在 react 项目中使用 redux 通常还会使用到 @reduxjs/toolkit、react-redux 这一类的工具库，还有 redux-thunk、redux-persist 等按需使用的中间件，下面我们从 redux 和 redux 相关的工具库、中间件的架构和关系来理解 redux

首先看 redux 的核心方法，redux 本质上是通过**发布-订阅模式**实现状态管理的，所以核心方法包括

- createStore：用于创建 Store 存储全局状态，作为发布-订阅模式中的通道
- dispatch：redux 中的发布者，通过 dispatch 方法发布 actions（actions 描述状态如何改变）
- subscribe：订阅者通过 subscribe 方法注册回调用函数，当状态发生变化时，注册的回调函数会被执行
- getState：获取当前状态的快照

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/Screenshot%202023-12-17%20at%2011.31.38.png)

redux 相关的工具库主要有两个

1. redux-toolkit：redux 官方维护的工具库，目的是简化 redux 的操作配置，在 redux 上做了一层封装
2. react-redux：也是 redux 官方维护的，用于 react 组件和 redux Store 交互

redux-toolkit 使用过程中的核心方法包括

- configureStore：设置和配置 Store，自动集成中间件和 DevTools
- createSlice：用于创建切片（slice），一个 slice 相当于一个小型的状态操作对象，包括初始化的 State 定义和操作状态的 Action 和 Reducer

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/Screenshot%202023-12-17%20at%2011.33.57.png)

react-redux 的核心 api 主要有三类

- Provider 组件：包裹在应用最外层，保证所有 react 组件都能访问到 Store
- hooks：用于在 react 组件中使用 Store 和 Action
- connect：用于选择性的将 Store 和 Action 传递到 react 组件中（更推荐使用 hooks 的方式操作 Store）

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/Screenshot%202023-12-17%20at%2011.36.37.png)

除了两个官方维护的工具库外，redux 中还有一个很重要的**中间件机制**，通过中间件能够插入自定义的 dispatch 逻辑，扩展 redux 的功能，常用的 redux 中间件包括

- redux-thunk：允许 Action 返回一个函数而不是对象，可以延迟 Action 的派发或者只在特定条件下才派发 Action
- redux-promise：可以派发一个包含 Promise 的 Action
- redux-presist：自动保存 Store 到本地存储中（localStorage）

中间件本质一个函数，接收 Store 的 dispatch 和 getState 方法作为参数，并返回一个函数接受下一个中间件的 dispatch 方法作为入参。redux 通过 applyMiddleware 方法注册中间件

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/Screenshot%202023-12-17%20at%2011.37.23.png)

## 总结

最后总结一下 redux 的核心概念、核心原则和相关技术栈

- 核心概念：通过 Store 统一管理状态，通过 Action 描述状态的更新，通过 Reducer 计算出最新的状态
- 核心原则：单向数据流、只能通过 Action 修改状态、使用纯函数保证没有副作用三个原则，保证整个状态是可预测的
- 相关技术栈：
  - redux 是整个生态的核心，提供核心的状态管理能力
  - reach-redux 是 react 组件和 redux 连接的桥梁，提供了在 react 组件中访问和操作 redux 状态的能力
  - redux-toolkit 简化了 redux 的配置和使用，减少了样板代码并且提升了开发体验
  - redux 通过中间件机制和一系列中间件生态扩展了基础功能

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/Screenshot%202023-12-17%20at%2011.14.04.png)
