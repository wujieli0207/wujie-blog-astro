---
title: vue 中优雅的捕获 Promise 异常
excerpt: vue 中优雅的捕获 Promise 异常
publishDate: '2022-08-07'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: vue 中优雅的捕获 Promise 异常
---

最近接手的几个老的 Vue 项目对于请求都没有异常处理，研究了一些解决方案，正好借机梳理一下如何在 Vue 中更优雅的捕获 Promise 异常

## 常规的异常捕获方式

在 Promise 提供了一个 `.catch` 方法用来捕获异常，假设有很多异步请求，通常会把 `.catch` 方法放在链式调用的最末尾。正常情况下末尾的 `.catch` 不会被触发，但当前面的任何一个 Promise rejected 之后，`.catch` 就可以捕获到异常

```js
promiseFunction1({
  year: unref(year),
})
  .then((res) => {
    if (res.status === 200) {
      return promiseFunction2(res.data?.name || '')
    }
  })
  .then((res) => {
    if (res.status === 200) {
      const getUserInfo = userInfoResult.data
      // ... 具体操作
    }
  })
  // 异常捕获
  .catch((error) => console.error(error))
```

如果使用 Promise 的语法糖 async / await 的话，可以使用更符合直觉的 `try...catch` 捕获异常，上面这个请求例子就可以修改为

```js
async function handleUserInfo() {
  try {
    const userResult = await promiseFunction1({ year: unref(year) })
    if (userResult.status !== 200) return

    const userInfoResult = await promiseFunction2(res.data?.name || '')
    if (userInfoResult.status !== 200) return

    getUserInfo = userInfoResult.data
    // ... 具体操作
  } catch (error) {
    console.error(error)
  }
}
```

不管是 `.then` 方法还是 `try...catch` 都需要增加一些代码操作，最重要的是可能会忘记捕获异常，所以下面介绍两个更好一些的解决方案

## 好一些的方式：await-to-js

[await-to-js](https://github.com/scopsy/await-to-js) 是一个大佬对 async / await 返回内容进行的一层封装，在不用 `try...catch` 的方式下也能进行异常捕获

在使用前需要先引入这个依赖：`npm i await-to-js`，下面我们来改写简化一下之前的异常捕获方式

```js
import to from 'await-to-js'

async function handleUserInfo() {
  const [userError, userResult] = await promiseFunction1({ year: unref(year) })
  if (userResult.status !== 200) return

  const [userInfoError, userInfoResult] = await promiseFunction2(
    res.data?.name || ''
  )
  if (userInfoResult.status !== 200) return

  getUserInfo = userInfoResult.data
  // ... 具体操作
}
```

await-to-js 的实现也就短短几行代码，本质就是对 Promise 的 `.then` 和 `.catch` 返回结果进行组合，然后整体作为一个 Promise 再返回出去

```ts
export function to<T, U = Error>(
  promise: Promise<T>,
  errorExt?: object // 传递给 err 对象的附加信息
): Promise<[U, undefined] | [null, T]> {
  return promise
    .then<[null, T]>((data: T) => [null, data])
    .catch<[U, undefined]>((err: U) => {
      if (errorExt) {
        const parsedError = Object.assign({}, err, errorExt)
        return [parsedError, undefined]
      }

      return [err, undefined]
    })
}

export default to
```

虽然 await-to-js 简化了代码，但还是需要引入依赖，对请求进行一层包裹，还是稍微麻烦了一点，如果我们对异常处理没有特殊处理的需要，仅仅只是捕获并且抛出，为了追求更简洁的代码；或者项目中有非常多的地方没有异常捕获，需要一个一个的手工增加非常麻烦，针对这两种情况，还有没有更好的办法呢？

## 更好的方式：全局捕获

在 Vue2 的全局配置中提供了一个 `errorHandler` 钩子可以用于捕获全局异常，但是最低版本要求 2.2.0+

`errorHandler` 第一个参数 `err` 是具体的错误信息，第二个参数 `vm` 是 Vue 组件信息，第三个参数 `info` 是 Vue 特定的错误信息，比如错误所在的生命周期钩子。一般为了捕获 Vue 特定的 `info` 信息，在内部处理时还会加上一层 `nextTick` ，确保捕获的是 DOM 渲染完成之后的信息。另外最好在根据不同环境配置判断是否需要捕获异常，增加程序的灵活性

```js
// errorHandler 使用示例
import Vue from 'vue'

// 配置项形式：'development' | ['development', 'production']
const { errorLog: needErrorLog } = settings

// 根据配置判断什么环境下需要捕获异常
function checkNeedErrorLog() {
  const env = process.env.NODE_ENV

  if (isString(needErrorLog)) {
    return env === needErrorLog
  }
  if (isArray(needErrorLog)) {
    return needErrorLog.includes(env)
  }

  return false
}

// 全局异常捕获
if (checkNeedErrorLog()) {
  Vue.config.errorHandler = function (err, vm, info) {
    Vue.nextTick(() => {
      console.error(`[${projectName}]: ${err}。`, `Vue info: ${info}`, vm)
    })
  }
}
```

根据[官网的描述](https://cn.vuejs.org/v2/api/#errorHandler)，不同的 Vue 版本捕获的信息不同，所以建议最好是更新 Vue 2.6.0 以上的版本，这样就可以全局捕获到 Promise 和 async / await 抛出的异常了，

> 从 2.2.0 起，`errorHandler` 钩子也会捕获组件生命周期钩子里的错误。同样的，当这个钩子是 `undefined` 时，被捕获的错误会通过 `console.error` 输出而避免应用崩溃
>
> 从 2.4.0 起，`errorHandler` 钩子也会捕获 Vue 自定义事件处理函数内部的错误
>
> 从 2.6.0 起，`errorHandler` 钩子也会捕获 `v-on` DOM 监听器内部抛出的错误。另外，如果任何被覆盖的钩子或处理函数返回一个 Promise 链 (例如 async 函数)，则来自其 Promise 链的错误也会被处理

在 Vue3 中，除了提供 `errorHandler` 钩子外，还提供了 `warnHandler` 钩子，两个钩子的用法相同，区别是是 `warnHandler` 只在开发环境生效，生产环境会被忽略

```js
app.config.warnHandler = function (msg, vm, trace) {
  // `trace` 是组件的继承关系追踪
}
```
