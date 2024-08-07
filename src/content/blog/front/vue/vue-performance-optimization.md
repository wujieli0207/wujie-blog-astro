---
title: Vue 中直接上手的性能优化方案
excerpt: Vue 中直接上手的性能优化方案
publishDate: '2022-07-30'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: Vue 中直接上手的性能优化方案
---

最近使用 Vue 开发的过程中使用到一些对于性能有所提升的编码方式，所以特别梳理出来，可以作为后续 Vue 开发的编码规范使用

性能优化方案主要分为三类，下面就详细讲讲这三类优化方案的应用

- 减少响应式使用
- 减少 DOM 渲染
- 减少打包体积

## 减少响应式使用

Vue 中使用最方便的就是响应式的变量，在读取（get）对象属性的时候收集副作用函数（effect）依赖，在写入（set）属性时取出副作用函数依赖执行，但是收集依赖、触发依赖执行毕竟都会影响到性能，所以在明确知道不需要使用响应式变量的场景下，就应该减少响应式变量的使用

### 1. 使用 computed 缓存计算结果

computed 和普通方法的区别在于：computed 会**缓存计算结果**，只有当计算的内容改变的时候才会重新计算，而普通方法每次都会重新计算。所以对于有计算逻辑的取值，建议尽量都通过 computed 来封装一层

比如下面这个示例就是简单的将 props 通过 computed 封装一层后共 template 使用

```ts
const getTooltipStyle = computed((): CSSProperties => {
  return {
    color: props.color,
    fontSize: props.fontSize,
  }
})
```

### 2. 本地化响应式变量

根据 Vue 响应式变量的原理，每次访问响应式数据时，都会收集依赖，所以在需要频繁使用响应式变量的时候，可以先将响应式变量用一个本地变量存储，转换为一个非响应式的变量

在 Vue3 中可以使用 `unref` 这个 api 来获取到响应式变量参数本身（Vue2 中直接通过 `this` 赋值就好）

```ts
const tableData = ref([])

const unrefTableData = unref(tableData) // 本地化变量后再做大量操作
unrefTableData.forEach((item) => {
  // 具体操作
})
```

### 3. 函数式组件（Vue2）

函数式组件是指：只接受一些 prop 参数，无响应式数据，无实例的组件，主要应用在创建简单的展示组件，比如标题 header、纯展示的表单等等。因为没有响应式数据和实例，所以初始化速度比普通有状态的组件快很多，并且还支持返回多个节点

在 Vue2 中声明函数式组件的方式如下

```vue
<!-- template 中的声明方式 -->
<template functional></template>

<!-- jsx 中的声明方式 -->
Vue.component("list", { functional: true, })
```

但是在 Vue3 中，有状态的组件性能已经大大提升，和无状态组件（函数式组件）几乎没有差异，并且有状态组件也支持了返回多个节点，所以官方也移除了 `functional` 定义函数式组件的方式，**注意 Vue3 中是不兼容 Vue2 的函数式组件定义**，所以如果未来打算升级 Vue3 的小伙伴就不建议使用函数式组件了

## 减少 DOM 渲染压力

### 1. DOM 频繁切换展示的情况使用 v-show

这是一个老身长谈的优化方案了，原理在于 `v-if` 和 `v-show` 实现方式的区别，对于 `v-if` 在不符合条件的情况下不会渲染 DOM 节点，对于 `v-show` 则是将各个条件情况都渲染出来，在通过 `display: block / none` 进行切换，所以在频繁切换 DOM 展示情况的场景下，使用 `v-show` 的性能会相对更好，比如一个可编辑单元格需要频繁切换编辑和保存后的状态的时候

但 `v-show` 也不是没有缺点，因为会把各个分支情况都提前渲染出来，如果节点很多并且不需要频繁切换状态，用 `v-if` 会是更好的选择

### 2. keep-alive 缓存组件状态

在 Vue 中切换组件时，组件内部的状态也会丢失，比如我们在填写一个表单的时候，切换到另外一个组件填写其他信息，在切换回之前的表单组件后，原来填写的信息会被刷新掉，这种情况下就会使用到 keep-alive 组件缓存组件状态

比较常用的做法是在 `<router-view>` 标签内嵌套一层 `<transition>` 标签增加组件切换时的过渡动画效果，再嵌套一层 `<keep-alive>` 标签缓存组件状态，最后使用 `<component>` 渲染动态组件或者元素

```vue
<router-view>
  <template #default="{ Component, route }">
    <transition>
       <keep-alive>
         <component :is="Component" :key="route.path" />
     </keep-alive>
    </transition>
  </template>
</router-view>
```

### 3. 路由懒加载

我们都知道 Vue 是单页面页面应用，如果在首屏加载的时候就把所有需要使用的路由都加载出来的话，那就太浪费性能了，所以使用懒加载的方式加载路由，减少首屏加载的压力，才是更合理的方案

在 vue-router 中使用路由懒加载需要通过箭头函数返回一个 `import` 组件的路径，这样在运行到这个组件的时候，才会运行 `import` 编译加载组件

```ts
const form: AppRouteRecordRaw = {
  path: '/basicForm',
  name: 'BasicForm',
  component: () => import('/@/views/form/index.vue'),
  meta: {
    title: '基础表单',
  },
}

export default form
```

### 4. 图片懒加载

图片使用懒加载的原因和路由懒加载类似，都是为了减少不必要的渲染。比如我们有一张很长的页面有很多数据或者图片需要展示，而显示屏幕的可视高度却是固定的，所以在屏幕高度外的内容完全可以等到页面需要的时候再加载，从而减少了可是屏幕区域内的渲染压力

图片懒加载的原理是：判断图片出现在当前窗口时，将 `data-src` 替换为 `src` 加载图片，比较常用三个可视区域判断方式是

- `img.getBoundingClientRect().top` < `document.documentElement.clientHeight`（元素相对于窗口位置 < 窗体高度）
- `IntersectionObserver` api，当其监听到目标元素的可见部分到达屏幕高度内，执行指定的回调函数
- `loading="lazy"` 属性（目前兼容性不是特别好，参考[Lazy loading - Web 性能](https://developer.mozilla.org/zh-CN/docs/Web/Performance/Lazy_loading)）

在 Vue 中使用图片懒加载推荐使用 [vue-lazyload](https://github.com/hilongjw/vue-lazyload/tree/next) 这个插件，直接通过 `v-lazy` 这个指令就可以实现图片懒加载的效果

```vue
<ul>
  <li v-for="img in list">
    <img v-lazy="img.src" >
  </li>
</ul>
```

### 5. 组件销毁时要清除定时器、EventListener

有时我们会在项目中开启 `setTimeout` 来定时触发一些事件，比如定时提醒表单保存之类的需求，如果在离开组件时没有及时清除掉定时器或者是 `EventListener` ，很多页面堆积起来很容易造成页面卡顿和内存泄漏

常见的方案是在离开组件之前的 `onBeforeUnmount` 生命周期钩子中清除掉定时器和 `EventListener`

```ts
onBeforeUnmount(() => {
  try {
    instance?.destroy?.()
  } catch (error) {
    instanceRef.value = null
  }
})
```

在清除 `EventListener` 要注意：**移除相同的函数**。以下第一种情况不能清理掉 click 事件，因为它们是不同的函数对象，需要使用第二种指向相同函数对象的方式清除

```js
// 这种情况不生效，因为指向的是不同函数对象
input.addEventListener('click', () => console.log('Hello'))
input.removeEventListener('click', () => console.log('Hello'))

// 此时指向相同的函数对象才能清理掉 EventListener 事件
function handler() {
  console.log('Hello')
}

input.addEventListener('click', () => handler)
input.removeEventListener('click', () => handler)
```

### 6. 列表使用唯一 key

这个主要是和 diff 算法的效率有关，所以我也把它作为减少 DOM 渲染压力的一个方案。在我们使用 `v-for` 循环渲染内容的时候，需要为每个组件分配一个 id，这样在组件内容有更新的时候，diff 算法通过 id 能够更高效的找到变化的节点，让 dom 渲染更迅速。同时需要注意分配的 id 最好不是数组的 index，因为一旦增加或减少数组元素，index 也会发生变化，这样就失去 id 的效果了

```vue
<template v-for="schema in getSchema" :key="schema.field">
  <form-item
    :schema="schema"
    :form-props="getProps"
    :all-default-values="defaultValueRef"
  />
</template>
```

## 减少打包体积

### 1. 开启 gzip 压缩

gzip 一种文件压缩的格式，比较适合文本文件的压缩，通常会缩小两倍以上的体积，所以用在代码文件的压缩上非常合适

我们现在使用的打包工具还是 webpack，在 webpack 中开启 gzip 打包的话可以使用 `compression-webpack-plugin` 这个插件，具体配置如下

```js
const CompressionPlugin = require('compression-webpack-plugin')
module.exports = {
  configureWebpack: {
    plugins: [
      new CompressionPlugin({
        test: /\.(js|css|json|html)&/,
        tereshold: 10 * 1024, // 超过 10 k 才压缩
      }),
    ],
  },
}
```

开启 gzip 除了要在代码中增加配置外，还需要服务端的支持，在前端中比较常用的是 Nginx，在 Nginx 中开启 gzip 压缩的主要配置参数如下

```shell
#开启和关闭gzip模式
gzip on;

#gizp压缩起点，文件大于10k才进行压缩
gzip_min_length 10k;

# gzip 压缩级别，1-9，数字越大压缩的越好，也越占用CPU时间，一般为 5，再大效果就不明显了
gzip_comp_level 5;

# 进行压缩的文件类型。
gzip_types text/plain application/javascript application/x-javascript text/css application/xml text/javascript ;

#nginx对于静态文件的处理模块，开启后会寻找以.gz结尾的文件，直接返回，不会占用cpu进行压缩，如果找不到则不进行压缩
gzip_static on

# 是否在http header中添加Vary: Accept-Encoding，建议开启
gzip_vary on;

# 设置压缩所需要的缓冲区大小，以4k为单位，如果文件为7k则申请2*4k的缓冲区
gzip_buffers 2 4k;

# 设置gzip压缩针对的HTTP协议版本
gzip_http_version 1.1;
```

### 2. 按需引入第三方组件

我们平时使用的 UI 组件一般都是大而全的，我们的项目中很少会全部使用到，所以按需引入第三方组件，能够有效减少应用包体积

以我们现在使用的 Element Plus 组件为例，使用 `unplugin-vue-components` 和 `unplugin-auto-import` 这两个插件来实现（[参考官方教程](https://element-plus.gitee.io/zh-CN/guide/quickstart.html#%E6%8C%89%E9%9C%80%E5%AF%BC%E5%85%A5)）

首先引入两个插件

```shell
pnpm i -D unplugin-vue-components unplugin-auto-import
```

然后再 Webpack 配置两个插件即可

```ts
// webpack.config.js
const AutoImport = require('unplugin-auto-import/webpack')
const Components = require('unplugin-vue-components/webpack')
const { ElementPlusResolver } = require('unplugin-vue-components/resolvers')

module.exports = {
  // ...
  plugins: [
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
}
```
