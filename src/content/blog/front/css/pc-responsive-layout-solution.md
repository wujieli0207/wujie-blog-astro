---
title: PC 端响应式布局方案
excerpt: 最近在工作中做了一些响应式布局的功能和可视化大屏的开发，所以这里我也整理一下用到的响应式布局方案作为未来项目开发的参考方案
publishDate: '2022-10-16'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: PC 端响应式布局方案
---

最近在工作中做了一些响应式布局的功能和可视化大屏的开发，所以这里我也整理一下用到的响应式布局方案作为未来项目开发的参考方案

## 常用实现方案

### flex 布局

flex 布局一把梭能解决绝大多情况下的响应式布局问题，尤其是全屏布局、两列布局、内容居中之类的场景，下面就是一个使用 flex 实现的全屏布局 demo

[flex 全屏布局 demo - 码上掘金 (juejin.cn)](https://code.juejin.cn/pen/7154945301076410383)

但是对于一些特殊的场景，比如由于宽度缩小但是字体大小没有变化导致的换行错位问题，就需要使用到下面一些方案

### 媒体查询

媒体查询有两种用法

- 直接在 css 文件中定义不同屏幕下的样式
- 通过 link 中的媒体查询，不同屏幕引用不同的分辨率

比如我要实现一个 1400px 和 900px 两个不同屏幕下的样式，我可以这样使用媒体查询

```css
/** 方式一：直接定义两个屏幕的样式 **/
@media screen and (max-width: 1400px) {
  .home {
    width: 80%;
    font-size: 14px;
  }
}

@media screen and (max-width: 900px) {
  .home {
    width: 100%;
    font-size: 10px;
  }
}
```

```html
<!-- 方式二：通过 link 引用不同屏幕的 css 文件 -->
<link rel="stylesheet" media="(max-width: 1400px)" href="pc.css" />
<link rel="stylesheet" media="(max-width: 900px)" href="laptop.css" />
```

媒体查询的兼容性也非常不错，除了 ie 大部分浏览器都支持

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202210151059234.png)

### 动态 rem / em 方案

em 和 rem 都是相对单位，区别在于

- em 根据自身字体大小计算
- rem 根据根节点 html 的字体大小计算（root em），默认是 16 px

所有单位无论是 绝对单位 还是 相对单位，最终都是转化为 px 在屏幕上显示。所以我们只要根据屏幕宽度和设计图的宽度动态声明 `font-size` 的大小，然后以 em / rem 作为长度单位声明所有节点的几何属性，就可以实现自适应布局的效果

```js
function autoResponse(width = 750) {
  const target = document.documentElement
  console.log(target.clientWidth)
  if (target.clientWidth >= 600) {
    target.style.fontSize = '40px'
  } else {
    target.style.fontSize = `${(target.clientWidth / width) * 100}px`
  }
}

autoResponse()

window.addEventListener('resize', autoResponse)
```

但需要注意的是要在 html 的 meta 属性中将布局窗口设置为屏幕宽度，并且禁止缩放屏幕

```html
<meta
  name="viewport"
  content="width=device-width, user-scalable=no, initial-scale=1, minimum-scale=1, maximum-scale=1"
/>
```

### Viewport 方案

动态 rem / em 方案本质是让页面元素根据屏幕宽度变化等比例缩放，而 CSS 的 Viewport 单位就是相对屏幕宽高的长度单位，常用的 Viewport 单位有四个

- vw：viewpoint width，视窗宽度，1vw 相当于 `window.innerWidth` 的 1%
- vh：viewpoint height，视窗高度，1vh 相当于 `window.innerHeight` 的 1%
- vmin：vw 和 vh 中较小的长度
- vmax：vw 和 vh 中较大的长度

在实际开发中，我们可以使用 [postcss-px-to-viewport](https://www.npmjs.com/package/postcss-px-to-viewport) 这个插件来帮助我们把设计稿的 px 转换成 viewport 单位，这样根据设计稿开发出来的页面可以有很好的响应式效果。另外现在 Viewport 的兼容性支持也非常完善了，这是目前最为推荐响应式方案

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202210161432426.png)

### scale 整体缩放

最后这个方案主要是是应用在大屏可视化的开发场景

我们在拿到设计稿的时候，会有一个基础的宽高比，比如在 figma 就会有一些常用的设备比例参数，Desktop 的 1440 _1024 就表示设计稿是以 width = 1440px、height = 1024px 进行设计的，如果我们按照这个比例进行开发，那么在 1440_ 1024 分辨率的设备上就能完美展示，但是在其他设备上就会存在展示不完整或者留白的问题

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202210161044144.png)

既然有了基础比例，我们只要针对不同分辨率下做整体的缩放就好了，这个时候就要使用到 css 的 `scale()` 函数。[`scale()`](https://developer.mozilla.org/zh-CN/docs/Web/CSS/scale) 可以用来设置 `tranform` 属性的缩放比例，如果只有一个参数，比如 `scale(0.8)`，就是 x 轴和 y 轴同时缩小 80%；如果有两个参数，比如 `scale(0.8，0.9)`，就是 x 轴缩小 80%，y 轴缩小 90%。

为了得到缩放比例我们需要拿当前屏幕的宽高比例（比如：1920 _1080）和设计稿比例（比如上图的 1440_ 1024）做一个比较

- 如果当前屏幕宽高比（1920 / 1080）**大于**设计稿宽高比（1440 \* 1024），需要缩放的比例就是**屏幕高度除以设计稿高度**（1080 / 1024 = 1.05）
- 如果当前屏幕宽高比（1200 / 900）**小于**设计稿宽高比（1440 \* 1024），需要缩放的比例就是**屏幕宽度除以设计稿宽度**（1200 / 1440 = 0.83）

下面是简单的代码示例

```js
const scale =
  document.documentElement.clientWidth / document.documentElement.clientHeight >
  designDraftWidth / designDraftHeight
    ? document.documentElement.clientHeight / designDraftHeight
    : document.documentElement.clientWidth / designDraftWidth
```

有了缩放比例，我们只需要监听浏览器的 `resize` 事件，实时更新缩放比例就可可以达到响应式的效果了，这里放一个 [618 数据大屏](https://sugar.aipage.com/dashboard/5f81db321ff3e080e9f09168c923854f)作为实现效果参考

但是这个方案有几个小问题需要注意，

- 在极端情况下（比如分辨率很高的大屏展示中），可能会因为缩放造成字体模糊问题和不能正确监听到点击事件问题
- scale 的兼容性相对就没有很好，如果要使用的话需要考虑下兼容性的问题
- 监听 `resize` 事件最好加上防抖避免性能问题，离开页面时也要注意销毁 `resize` 事件

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202210160749015.png)

## 一些简单的经验总结

- 首选 flex 布局方式和 Element 的 row / col 布局，能够很大程度上减少响应式布局的开发工作量

- 对于一个页面 container 中存在多个展示内容的场景，最好在 container 中定义 Viewport 宽高，组件内部的宽度、高度都设置为 100%，其他几何属性通过 Viewport 定义，这样可以增加组件内部的复用性
- 对于需要特殊处理的属性可以通过
  1. 媒体查询特殊处理样式
  2. 监听 `resize` 事件，通过响应式变量修改组件内部样式属性
- 对于使用 echarts 展示数据的场景，要在浏览器 `resize`事件后手动调用 echarts 的 `resize()` 方法保证图表展示的响应性
