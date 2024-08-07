---
title: 什么是类数组
excerpt: 什么是类数组
publishDate: '2021-12-24'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: 什么是类数组
---

## 对象是类数组常见情况

- 对象是类数组的情况

  - 函数参数对象 arguments
  - 用 `getElementsByTagName/Classname/Name` 获得的 HTMLCollection
  - 用 `querySelector` 获得的 NodeList

- 函数参数对象 arguments 特点

  - `Object.prototype.toString.call` 返回 `[object arguments]`，代表不是数组
  - 具有 length 属性
  - callee 属性：获取当前的函数

- 用 `getElementsByTagName/Classname/Name` 获得的 HTMLCollection

  - `Object.prototype.toString.call` 返回 `[object HTMLFormElement]`，代表不是数组
  - HTML DOM 对象的一个接口，包含获取到的 DOM 元素集合类
  - DOM 更新时会实时更新

- 用 `querySelector` 获得的 NodeList
  - `Object.prototype.toString.call` 返回 `[object NodeList]`，代表不是数组
  - 实时更新

## 类数组应用场景

- 遍历函数参数
- 定义链接字符串函数

```js
function myConcat(separa) {
  let args = Array.prototype.slice.call(arguments, 1)
  return args.join(separa)
}
console.log(myConcat(', ', 'red', 'orange', 'blue'))
```

- 函数间传递参数

```js
function foo(a, b, c) {
  console.log(a, b, c)
}
// 通过 apply 方法传递函数参数
function bar() {
  foo.apply(this, arguments)
}
bar(1, 2, 3) // 1 2 3
```

## 类数组转化为数组的方式

- 借用数组方法转化为数组

```js
let arrayLike = {
  0: 'java',
  1: 'script',
  length: 2,
}

// 借用 push 方法
Array.prototype.push.call(arrayLike, 'wujie')
console.log(arrayLike) // { '0': 'java', '1': 'script', '2': 'wujie', length: 3 }
```

- 借用 ES6 展开运算符或 `Array.from` 转化为数组

```js
function sum(a, b) {
  // 通过展开运算符将类数组转化为数组，从而可以使用数组方法，Array.from 有类似效果
  const args = [...arguments]
  return args.reduce((sum, cur) => sum + cur)
}

console.log(sum(1, 2)) // 3
```
