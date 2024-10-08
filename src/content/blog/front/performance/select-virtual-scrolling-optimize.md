---
title: 拒绝卡顿，element select 组件虚拟滚动优化
excerpt: 拒绝卡顿，element select 组件虚拟滚动优化
publishDate: '2023-04-09'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: 拒绝卡顿，element select 组件虚拟滚动优化
---

不知道大家在开发过程中有没有遇到这样一个场景，后端接口一次性返回上千条数据（比如国家地区），接口不支持分页，不能筛选，只能前端自己通过 select 组件全量渲染出来。这种渲染大量 DOM 的场景下会造成页面非常卡顿，我在网上搜索了一下一般有两种解决方案

1. 前端自己实现数据分页效果
2. 虚拟滚动，比如 element plus 就有专门的 [select 虚拟滚动组件](https://element-plus.gitee.io/zh-CN/component/select-v2.html)

最好的方案当然时直接使用成熟的轮子，奈何我们的项目是 vue 2.7，所以只能借助支持 vue2 的虚拟滚动组件 [vue-virtual-scroll-list](https://github.com/tangbc/vue-virtual-scroll-list)，自己封装一个 select 虚拟滚动组件

## 组件实现

首先在项目中引入 vue-virtual-scroll-list

```shell
npm i vue-virtual-scroll-list
```

接下来开发封装虚拟滚动组件，因为使用的是 vue2.7 版本，为了以后项目升级 vue3，所以直接使用 composition api 的方式开发。在 el-select 组件内部引入安装好的 vue-virtual-scroll-list，定义好组件的基础结构，和需要传入的 props 属性

```js
<template>
  <el-select
    v-model="value"
    v-bind="$atts"
    v-on="$listeners"
  >
    <virtual-scroll-list
      ref="virtualListRef"
    ></virtual-scroll-list>
  </el-select>
</template>

<script setup>
  import VirtualScrollList from 'vue-virtual-scroll-list'

  const props = defineProps({
    // 当前
    value: {
      type: [String, Number],
      default: '',
    },
    // 下拉展示的 options
    options: {
      type: Array,
      default: () => [],
    },
    // label 键值
    labelKey: {
      type: String,
      default: 'label',
    },
    // value 键值
    valueKey: {
      type: String,
      default: 'value',
    },
  })

  const { value, options, labelKey, valueKey } = toRefs(props)

  const virtualListRef = ref(null)
</script>

```

根据官网文档描述，有三个必填属性，`data-key`, `data-sources`, `data-component`，我们可以直接选取 value 作为唯一的 `data-key`，`data-sources` 就是我们传入的 options，`data-component` 需要我们将 el-option 封装为一个独立的组件

| 属性             | 是否必填 | 默认值 | 类型               | 描述                                                                                         |
| ---------------- | -------- | ------ | ------------------ | :------------------------------------------------------------------------------------------- |
| `data-key`       | 必填     |        | String \| Function | 虚拟滚动列表每一项的唯一 id，如果是函数的话需要返回 string                                   |
| `data-sources`   | 必填     |        | Array[Object]      | 虚拟滚动的数据列表，每个数组项必须是对象，并且每个对象必须有一个唯一的属性与 `data-key` 匹配 |
| `data-component` | 必填     |        | Component          | 虚拟滚动每一项的渲染组件                                                                     |
| `keeps`          | 非必填   | 30     | Number             | 虚拟列表展示的真实 DOM 的数量                                                                |
| `extra-props`    | 非必填   | {}     | Object             | 传递给子组件的额外参数                                                                       |

我们先将 el-option 封装为一个独立组件，需要注意的是 vue-virtual-scroll-list 默认传入是数组是 source，所以需要从 source 属性中根据 labelKey 和 valueKey 找到需要加载的 label 和 value

```js
<template>
  <el-option
    :key="value"
    :label="label"
    :value="value"
    v-bind="$atts"
    v-on="$listeners"
   />
</template>

<script setup>
  import { computed, toRefs } from 'vue'

  const props = defineProps({
    source: {
      type: Object,
      default: () => {},
    },
    valueKey: {
      type: [String, Number],
      default: '',
    },
    labelKey: {
      type: String,
      default: '',
    },
  })

  const { source, valueKey, labelKey } = toRefs(props)

  const value = computed(() => source.value[valueKey.value])
  const label = computed(() => source.value[labelKey.value])
</script>
```

接着在父组件中引入封装的 el-option 组件，这里我们取名为 OptionNode，然后传入 `data-key`, `data-sources`, `data-component` 三个必填属性，同时将 labelKey 和 valueKey 通过 `extra-props` 属性传递给子组件。vue-virtual-scroll-list 组件需要显式设置列表的高度和滚动条，不然在元素过多时会出现列表过长的情况，同时为了配合项目，这里我将 `keeps` 属性设置为 20，也就是只渲染 20 个真实 DOM 节点

```diff
<template>
  <fe-select
    v-model="value"
    v-bind="$atts"
    v-on="$listeners"
  >
    <virtual-scroll-list
      ref="virtualListRef"
+     class="virtual-scroll-list"
+     :data-key="dataKey"
+     :data-sources="allOptions"
+     :data-component="OptionNode"
+     :keeps="20"
+     :extra-props="{
+       labelKey,
+       valueKey,
+     }"
    ></virtual-scroll-list>
  </fe-select>
</template>

<script setup>
  import { toRefs, ref, nextTick, computed, watch, onMounted } from 'vue'
  import VirtualScrollList from 'vue-virtual-scroll-list'
+ import OptionNode from './option-node.vue'

  const props = defineProps({
    value: {
      type: [String, Number],
      default: '',
    },
    options: {
      type: Array,
      default: () => [],
    },
    labelKey: {
      type: String,
      default: 'label',
    },
    valueKey: {
      type: String,
      default: 'value',
    },
  })

  const { value, options, labelKey, valueKey } = toRefs(props)

  const virtualListRef = ref(null)

+ const dataKey = ref(valueKey)
+ const allOptions = options.value
</script>

+ <style lang="scss" scoped>
+   .virtual-scroll-list {
+     height: 200px;
+     overflow: auto;
+   }
+ </style>

```

这个时候就可以初步实现虚拟列表滚动的效果了，但由于虚拟滚动仅渲染部分 DOM，所有还有两个问题需要考虑

- 保存了选择项后，再二次加载时，需要显示保存项，这时需要从完整 options 中找到保存项并放在列表最上面
- 筛选列表选项时，需要从完整 options 找到符合要求的选项并加载，同时在关闭列表时，需要重置列表

针对以上两个问题，我们引入一个 currentOptions 记录当前的 options，通过 `remote-method` 实现搜索效果，通过 `visible-change` 事件实现重置列表。经过优化后的代码如下

```diff
<template>
  <fe-select
    v-model="value"
+   filterable
+   remote
+   :remote-method="handleRemoteMethod"
    v-bind="$atts"
+   @visible-change="handleVisiableChange"
    v-on="$listeners"
  >
    <virtual-scroll-list
      ref="virtualListRef"
      class="virtual-scroll-list"
      :data-key="dataKey"
      :data-sources="currentOptions"
      :data-component="OptionNode"
      :keeps="20"
      :extra-props="{
        labelKey,
        valueKey,
      }"
    ></virtual-scroll-list>
  </fe-select>
</template>

<script setup>
  import { toRefs, ref, nextTick, computed, watch, onMounted } from 'vue'
  import VirtualScrollList from 'vue-virtual-scroll-list'
  import OptionNode from './option-node.vue'
+ import { cloneDeep, isNil } from 'lodash-es'

  const props = defineProps({
    value: {
      type: [String, Number],
      default: '',
    },
    options: {
      type: Array,
      default: () => [],
    },
    labelKey: {
      type: String,
      default: 'label',
    },
    valueKey: {
      type: String,
      default: 'value',
    },
  })

  const { value, options, labelKey, valueKey } = toRefs(props)

  const virtualListRef = ref(null)

  const dataKey = ref(valueKey)

+ // 当前筛选的 options
+ const currentOptions = ref([])
+ // 全量 options
+ // 注意这里需要深拷贝
+ const allOptions = computed(() => cloneDeep(options.value))

+ onMounted(() => {
+   handleInitOptions(allOptions.value, value.value)
+ })

+ watch([value, options], ([newVal, newOptions], [_oldVal, oldOptions]) => {
+   // 异步加载 options 时，如果 value 有值，需要将 value 对应的 option 放在第一位
+   if ((!isNil(newVal) || newVal !== '') && newOptions.length > 0 && oldOptions.length === 0) {
+     handleInitOptions(newOptions, newVal)
+   }
+ })

+ /**
+  * @description 因为 DOM 不是全量加载，所以需要手动处理
+  */
+ function handleRemoteMethod(query) {
+   if (query !== '') {
+     currentOptions.value = allOptions.value.filter((item) => {
+       return item[labelKey.value].includes(query)
+     })
+   } else {
+     currentOptions.value = allOptions.value
+   }
+ }

+ function handleVisiableChange(val) {
+   // 隐藏下拉框时，重置数据
+   if (!val) {
+     virtualListRef.value && virtualListRef.value.reset()
+     nextTick(() => {
+       currentOptions.value = allOptions.value
+     })
+   }
+ }

+ /**
+  * @description 异步加载 options 时，如果 value 有值，需要将 value 对应的 option 放在第一位
+  */
+ function handleInitOptions(allOptions, value) {
+   const existOption = allOptions.find((item) => {
+     return item[valueKey.value] === value
+   })
+   if (existOption) {
+     currentOptions.value.push(existOption)
+   }

+   currentOptions.value.push(
+     ...allOptions.filter((item) => {
+       return item[valueKey.value] !== value
+     })
+   )
+ }
</script>

<style lang="scss" scoped>
  .virtual-scroll-list {
    height: 200px;
    overflow: auto;
  }
</style>

```

## 总结

最后我们来看一下最终实现效果，可以看到在实际选项有 10000 个情况下，每次渲染出来的 DOM 只有 20 个，而且不论是滚动还是查询都丝滑流畅，完成的组件封装代码和示例我也放在 github 上（[链接](https://github.com/wujieli0207/element-virtual-select)），欢迎大家点个 star

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/%E7%A4%BA%E4%BE%8B.gif)
