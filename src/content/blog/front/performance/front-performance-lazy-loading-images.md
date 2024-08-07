---
title: 浅谈前端性能优化：图片懒加载
excerpt: 所谓图片懒加载，就是需要展示图片的时候再加载，当图片没有进入我们的视觉范围内的时候，图片还没有加载，只用一个占位符或者 loading 图片替代。当我们滚动页面时，占位符或者 loading 图片进入到我们的视觉范围，就加载图片。这样可以解决一次性加载大量图片带来的性能问题
publishDate: '2022-09-25'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: 浅谈前端性能优化：图片懒加载
---

## 图片懒加载基本原理

所谓图片懒加载，就是需要展示图片的时候再加载，当图片没有进入我们的视觉范围内的时候，图片还没有加载，只用一个占位符或者 loading 图片替代。当我们滚动页面时，占位符或者 loading 图片进入到我们的视觉范围，就加载图片。这样可以解决一次性加载大量图片带来的性能问题

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202209251607000.png)

为了实现图片懒加载有两个核心问题需要解决

1. 如何判断图片已经在可视区域范围内？
2. 图片进入可视区域后，如何触发加载图片

对于第二个问题需要用到 DOM 元素的 [dataset 属性](https://zh.javascript.info/dom-attributes-and-properties#fei-biao-zhun-de-te-xing-dataset)，所有以 `data-` 开头的属性都可以用做自定义属性，所以我们可以定义一个 `data-src` 属性存放需要加载的图片链接，`src` 属性使用 loading 占位图片，当需要加载图片的时候，把 `src` 的链接更换为 `data-src` 的链接即可

```html
<img data-src="需要加载的图片链接" src="loading 图片链接" />
```

所以剩下要解决的是第一个问题：如何判断图片进入可视区域内？

## 方案一：getBoundingClientRect()

这个方案需要获取两个高度：浏览器窗口高度（可视区域高度）和元素距离浏览器窗口顶部的高度

浏览器窗口高度通过 `document.documentElement.clientHeight` 这个 API 来获取，另外我也在网上找了一张浏览器常用高度的示意图供大家参考

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/Untitled.png)

获取元素距离可视区域顶部的高度需要通过`getBoundingClientRect()` API 来实现，`getBoundingClientRect()` 获取的是 DOM 元素相对于窗口的坐标集合，集合中有多个属性，其中的 top 属性就是当前元素元素距离窗口可视区域顶部的距离（下图是所有距离属性的示意图）

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202209251610228.png)

有了这两个高度判断的 API，实现方案就简单了，通过监听**当前可视区域的高度** - **元素距离可视区域顶部的高度**，当这个高度差小于 0 时说明图片已经进入可视区域，这时开始加载图片

```js
// 获取所有图片标签
const imgs = document.getElementsByTagName('img')
// 获取可视区域的高度
const viewHight = document.documentElement.clientHeight
// 统计当前加载到了哪张照片，避免每一次都从第一张照片开始检查
let num = 0

function lazyload() {
  for (let i = num; i < imgs.length; i++) {
    const item = imgs[i]
    // 可视区域高度减去元素顶部距离可视区域顶部的高度，如果差值大于 0 说明元素展示
    let distance = viewHight - item.getBoundingClientRect().top
    if (distance >= 0) {
      // 展示真实图片
      item.src = item.getAttribute('data-src')
      num = i + 1
    }
  }
}

// 监听 scroll 事件
window.addEventListener('scroll', lazyload, false)

lazyload()
```

下面是我使用马上掘金实现的一个小 demo，大家可以直接体验一下效果

[图片懒加载：监听可视窗口实现 - 码上掘金](https://code.juejin.cn/pen/7134838493754163234)

但是使用这个方案有一个弊端，就是 scroll 是同步事件，在滚动时需要大量计算，很容易造成性能问题，所以会需要配合节流方法一起使用（可以看看我的[这篇文章](https://www.wujieli.com/blog/front/performance/front-performance-debounce-throttle)对于节流的介绍）。所以对于这个问题，还有没有其他更好的方案呢？

## 方案二：Intersection Observer

`IntersectionObserver` 提供了一种**异步观察**目标元素与其祖先元素或 viewport 交叉状态的方法，可以通过浏览器全局访问，目的就是为了解决监听 scroll 同步事件带来的性能问题

`IntersectionObserver(callback, options)` 方法有两个参数，下面分别介绍一下这两个参数

`callback` 参数：当元素可见性变化时执行的回调函数，所以当元素进入时会触发一次 `callback` ，离开时还会触发一次 `callback` 。`callback` 函数有一个 `entries` 作为入参，`entries` 是一个对象，有 7 个属性，前两个属性很重要，是用于实现图片懒加载的核心属性

- target：观察的目标 DOM 元素
- isIntersecting：目标元素 target 当前是否可见，可见为 true
- time：返回一个记录从 `IntersectionObserver` 的时间到交叉被触发的时间的时间戳
- rootBounds：根元素的矩形区域的信息，`getBoundingClientRect()` 方法的返回值，如果没有根元素（即直接相对于视口滚动），则返回 null
- boundingClientRect：目标元素的矩形信息
- intersectionRatio：相交区域和目标元素的比例值 intersectionRect/boundingClientRect 不可见时小于等于 0
- intersectionRect：目标元素和视窗（根）相交的矩形信息

虽然剩余 5 个属性暂时还用不上，但是为了方便大家理解这 5 个属性，我还是画了一个示意图

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202209251607872.png)

options 是可选参数配置，主要有三个属性

- root：监听对象的祖先元素，一般都是默认为 root
- thresholds：阈值列表，决定什么时候触发 `callback` 函数。默认是 0，就是当目标元素刚出现在交界处时就会触发 `callback` 函数
- rootMargin：扩大或缩小 viewport 的范围，可以理解为划定一个范围

另外 `IntersectionObserver` 还有三个方法，用于启动和停止监听

- `IntersectionObserver.observe()`：开始监听
- `IntersectionObserver.disconnect()`：停止监听
- `IntersectionObserver.unobserve(element)`：停止监听特定的 element 元素

有了上面这些基础知识的铺垫之后，下面是图片懒加载方法实现的核心代码，原理也是一样，在当前元素可见时把 `src` 替换为 `data-src` 中的真实链接

```js
const io = new IntersectionObserver((entries) => {
  entries.forEach((item) => {
    // 当前元素可见时
    if (item.isIntersecting) {
      item.target.src = item.target.dataset.src // 替换 src
      io.unobserve(item.target) // 停止观察当前元素，避免不可见时再次调用 callback 函数
    }
  })
})

const imgs = document.querySelectorAll('[data-src]')

// 监听所有图片元素
imgs.forEach((item) => {
  io.observe(item)
})
```

同样附上 demo 链接体验一下效果

[图片懒加载：根据 IntersectionObserver 实现 - 码上掘金](https://code.juejin.cn/pen/7134699544843026439)

从浏览器兼容性的角度看，`IntersectionObserver` 也兼容了大部分浏览器，如果大家没有特别的浏览器兼容需要，完全可以使用这个性能更好的方法来实现图片懒加载

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202209251608066.png)
