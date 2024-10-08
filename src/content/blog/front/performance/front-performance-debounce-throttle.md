---
title: 浅谈前端性能优化：节流和防抖
excerpt: 浅谈前端性能优化：节流和防抖
publishDate: '2022-07-14'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: 浅谈前端性能优化：节流和防抖
---

## 什么是节流和防抖

防抖，顾名思义，就是防止异常情况下的抖动，假设你在给女朋友挑礼物的时候，生怕女朋友不满意，不断的在搜索框里改变着想要购买的礼物，这时候不但你很焦虑，搜索框也很焦虑，因为假设每改变一次内容都要像服务端请求一次的话，那压力得多大啊，所以搜索框得等你冷静下来的时候在向服务端请求。那怎么判断你冷静下来了呢？比较合适的方法是**通过时间判断**，比如你输入了一个商品的关键字，一段时间没有改变内容，搜索框就知道你冷静了，它就可以向服务端去请求需要搜索的内容了

所以**防抖的含义，就是在触发高频操作的 n 秒内只执行一次，如果在 n 秒内又被触发，那么就重新计算时间**，等到 n 秒确定完成之后再触发

说到节流，想象一下这样一个场景：M2 芯片的 Macbook Air 今晚 8 点开启预售，你从 7 点 55 分开始就准备好选商品 -> 加购物车 -> 下单付款一系列操作，你要不断的疯狂点击按钮才能进行到下一步操作，如果每点一次按钮都要向服务端请求一次，想象一下这会给服务端带来多大的压力。所以这个时候节流就派上用场了

所以所谓**节流，就是节约流量，对于高频率的事件来说，在 n 秒内只会执行一次**。也就是通过每隔一段时间执行一次的方式，以此来达到节约流量的效果，从而稀释了高频率操作对于服务端带来的压力

所以防抖和节流的区别也就很明显了

- 防抖是**阻止**你的疯狂操作，在你冷静下来后的最后一次才执行
- 节流是**稀释**你的疯狂操作，不论你有多疯狂，我就是冷静的按照计划执行

## 如何实现节流和防抖

下面看一下最基础的防抖、节流函数实现逻辑

防抖函数实现逻辑主要是基于 `setTimeout` 来控制，如果在规定的 `delay` 时间内的话就清理掉 `timer`，否则就执行传入的函数

```js
function debounce(fn, delay = 500) {
  let timer

  return function () {
    // 用户输入时清理掉第一个 setTimeout
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      // 改变 this 指向为调用 debounce 所指的对象
      fn.apply(this, arguments)
    }, delay)
  }
}
```

节流函数虽然也使用了 `setTimeout` 函数，但主要的实现逻辑还是基于“锁”的方式实现的，在执行完函数的一段时间内，`flag` 会被锁住，直到时间结束后 `flag` 锁被打开才能进入下一次循环

```js
function throttle(fn, delay = 500) {
  // 加锁，true 表示可以进入下一次循环，false 表示不可以
  let flag = true
  return function () {
    if (!flag) return
    flag = false
    setTimeout(() => {
      fn.apply(this, arguments)
      // 在 setTimeout 执行完毕后，把标记设置为 true，表示可以执行下一次循环
      flag = true
    }, delay)
  }
}
```

## 还有没有更好的方式

节流函数虽然可以实现稀释的效果，但总是等待一段时间在执行不仅用户体验差了一些，而且万一在间隔等待的时间有其他业务逻辑要实现，那不是就更麻烦了，所有就有了**利用防抖函数来优化节流函数**的方法，具体来说就是

- 在规定的时间内，还是按照节流函数的逻辑按照间隔执行
- 在规定的时间后，按照防抖函数的逻辑立即执行

具体实现方式如下

```js
function throttle(fn, delay = 500) {
  let flag = true
  let last = 0

  return function () {
    let now = Number(new Date())

    if (!flag) return
    flag = false

    // 优化逻辑：规定时间内等待执行，规定时间后立刻执行
    if (now - last < delay) {
      setTimeout(() => {
        fn.apply(this, arguments)
      }, delay)
    } else {
      fn.apply(this, arguments)
    }

    flag = true
    last = now
  }
}
```

但是在实际开发过程中，直接使用比较成熟的轮子是比较好的方式，所以要做项目中使用防抖函数和节流函数的话，我会推荐使用 lodash。[lodash](https://www.lodashjs.com/) 一致性、模块化、高性能的 JavaScript 实用工具库，主要是封装了各种工具函数，让开发变的更简单高效，并且封装的工具函数相比自己手写的函数考虑了更多的边界问题，让我们的代码更加健壮

如果要在项目使用的话，直接引入 es 版本的依赖就好（如果是使用 ts 的项目，最好再引入 type 依赖）

```bash
pnpm i lodash-es
pnpm i -D @types/lodash-es
```

然后在项目中直接引入防抖函数(debounce)和节流函数()就可以直接使用了

```ts
import { debounce, throttle } from 'lodash-es'

debounce(() => {
  console.log('debounce!')
}, 1000)

throttle(() => {
  console.log('throttle!')
}, 1000)
```

既然用到了 lodash 的函数，那就顺便分析看看源码做了哪些方面的提升和优化，首先看看防抖函数（[源码地址](https://github.com/lodash/lodash/blob/2f79053d7bc7c9c9561a30dda202b3dcd2b72b90/debounce.js)）

封装的防抖函数主要增加了 `cancel()` 方法来停止函数的调用，或者是通过 `flush()` 方法立即执行调用，还可以通过配置参数 `option` 来控制执行的时机，并且还加入了各种边界判断（比如判断传入的 `func` 参数是否是函数，处理 `requestAnimationFrame` 的情况等等），下面展示的一些核心的函数逻辑

```js
function debounce(func, wait, options) {
  let lastArgs, lastThis, maxWait, result, timerId, lastCallTime

  let lastInvokeTime = 0
  let leading = false
  let maxing = false
  let trailing = true

  // 对于输入参数的判断和处理
  if (typeof func !== 'function') {
    throw new TypeError('Expected a function')
  }
  wait = +wait || 0
  if (isObject(options)) {
    leading = !!options.leading
    maxing = 'maxWait' in options
    maxWait = maxing ? Math.max(+options.maxWait || 0, wait) : maxWait
    trailing = 'trailing' in options ? !!options.trailing : trailing
  }

  // 改变 this 指向，执行 debounce 包裹的函数
  function invokeFunc(time) {
    const args = lastArgs
    const thisArg = lastThis

    lastArgs = lastThis = undefined
    lastInvokeTime = time
    result = func.apply(thisArg, args)
    return result
  }

  // 开启 setTimeout
  function startTimer(pendingFunc, wait) {
    return setTimeout(pendingFunc, wait)
  }

  // 指定延迟前调用函数
  function leadingEdge(time) {
    lastInvokeTime = time
    timerId = startTimer(timerExpired, wait)
    return leading ? invokeFunc(time) : result
  }

  function remainingWait(time) {
    const timeSinceLastCall = time - lastCallTime
    const timeSinceLastInvoke = time - lastInvokeTime
    const timeWaiting = wait - timeSinceLastCall

    return maxing
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting
  }

  // 判断函数立即执行函数调用，如果等待时间 > 最大时间的情况下就立即执行
  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime
    const timeSinceLastInvoke = time - lastInvokeTime

    return (
      lastCallTime === undefined ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxing && timeSinceLastInvoke >= maxWait)
    )
  }

  // 判断是否超过最大等待时间，超过就立即执行
  function timerExpired() {
    const time = Date.now()
    if (shouldInvoke(time)) {
      return trailingEdge(time)
    }
    timerId = startTimer(timerExpired, remainingWait(time))
  }

  // 指定延迟后调用函数
  function trailingEdge(time) {
    timerId = undefined

    if (trailing && lastArgs) {
      return invokeFunc(time)
    }
    lastArgs = lastThis = undefined
    return result
  }

  function debounced(...args) {
    const time = Date.now()
    const isInvoking = shouldInvoke(time)

    lastArgs = args
    lastThis = this
    lastCallTime = time

    if (isInvoking) {
      if (timerId === undefined) {
        return leadingEdge(lastCallTime)
      }
      if (maxing) {
        timerId = startTimer(timerExpired, wait)
        return invokeFunc(lastCallTime)
      }
    }
    if (timerId === undefined) {
      timerId = startTimer(timerExpired, wait)
    }
    return result
  }
  return debounced
}

export default debounce
```

节流函数的实现就更简单了，主要就是基于对防抖函数 `debounce` 的封装，定义了一个最大延迟实践 `maxWait`（大佬们写的代码果然就是简洁），所以可以看到节流本质也是防抖函数的一个分支

```js
function throttle(func, wait, options) {
  let leading = true
  let trailing = true

  if (typeof func !== 'function') {
    throw new TypeError('Expected a function')
  }
  if (isObject(options)) {
    leading = 'leading' in options ? !!options.leading : leading
    trailing = 'trailing' in options ? !!options.trailing : trailing
  }
  return debounce(func, wait, {
    leading,
    trailing,
    maxWait: wait,
  })
}

export default throttle
```
