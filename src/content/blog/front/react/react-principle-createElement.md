---
title: 初识 react 原理，createElement 方法做了什么
excerpt: 初识 react 原理，createElement 方法做了什么
publishDate: '2024-11-05'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: 初识 react 原理，createElement 方法做了什么
---

## 基础介绍

我们在使用 react 的时候，编写的都是 jsx 语法

```jsx
function Child({id}) {
  return <div id={id}>Child</div>
}

function App() {
  return (
   <div>
     <Child id="child">
    </div>
  )
}
```

在编译阶段，上面的 jsx 代码会被 Babel 的 `@babel/plugin-transform-react-jsx` 插件转化为 `createElement` 的形式

```js
function Child({ id }) {
  return React.createElement('div', { id: id }, 'Child')
}

function App() {
  return React.createElement(
    'div',
    null,
    React.createElement(Child, { id: 'child' })
  )
}
```

下面我们就来具体分析 `createElement` 方法的具体实现

## createElement 实现原理

`createElement` 方法定义在 `packages/react/src/React.js` ，在开发环境和生产环境会使用不同的方法，我们直接看开发环境使用的 `createElementProd` 方法

```ts
// packages/react/src/React.js
const createElement: any = __DEV__
  ? createElementWithValidation
  : createElementProd
```

`createElementProd` 方法有三个参数，type 是元素的类型，可以是 html 元素，也可以是自定义的组件；config 是元素上面的各种属性；children 是元素的子节点

`createElementProd` 方法主要有三个实现步骤，下面我们来具体分析每一步的实现

1. 处理 config 属性和默认属性 defaultProps
2. 处理 children 子节点
3. 通过 `ReactElement` 方法返回 react 元素

第一步首先处理 config 属性，config 中存在 4 个特殊的元素，对于这 4 个特殊的元素，会先校验是否存在，如果存在才放到 props 中，其他属性则直接放到 props 中

这 4 个特殊的属性分别是

- key：元素的唯一标识，可以根据 key 更高效的判断哪些元素需要做新增、修改、删除操作
- ref：获取 react 元素的引用，可以用来直接操作 dom 元素
- self：标识 react 元素所属的组件实例的 `this` 上下文，主要是在 devtool 中使用
- srouce：标识 react 元素的源码位置信息，主要是在开发调试中更方便

如果 type 存在 defaultProps 属性的话，会遍历 defaultProps，如果在 props 中也没有 defaultProps 的属性定义的话，就放到 props 中

```ts
export function createElement(type, config, children) {
  let propName

  // 1. 处理 config 属性和默认属性 defaultProps
  const props = {}

  let key = null
  let ref = null
  let self = null
  let source = null

  if (config != null) {
    if (hasValidRef(config)) {
      ref = config.ref
    }
    if (hasValidKey(config)) {
      key = '' + config.key
    }

    self = config.__self === undefined ? null : config.__self
    source = config.__source === undefined ? null : config.__source

    // 其余属性都作为 props 传递
    for (propName in config) {
      if (
        hasOwnProperty.call(config, propName) &&
        !RESERVED_PROPS.hasOwnProperty(propName)
      ) {
        props[propName] = config[propName]
      }
    }
  }

  // 处理 defaultProps 属性
  if (type && type.defaultProps) {
    const defaultProps = type.defaultProps
    for (propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName]
      }
    }
  }
}
```

第二步处理 children 子节点，因为元素的子节点可能只有一个，也可能有多个

- 如果只有一个子节点（`createElement` 方法的参数有 3 个参数)，直接将 children 放到 props 中
- 如果有多个并列的子节点（`createElement` 参数数量大于 3)，将所有子节点放到一个数组 childArray 中，再将 childArray 放到 props 中

```ts
export function createElement(type, config, children) {
  // ...

  // 2. 处理 children 子节点
  const childrenLength = arguments.length - 2
  if (childrenLength === 1) {
    props.children = children
  } else if (childrenLength > 1) {
    const childArray = Array(childrenLength)
    for (let i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2]
    }
    props.children = childArray
  }

  // ...
}
```

第三步使用 `ReactElement` 方法创建 react 元素，`ReactElement` 方法本质上工厂函数，将上一步处理好的 type、key、ref、props 封装为一个标准对象，对象新增了两个属性

- `$$typeof`: 标记这是一个 react 元素
- `_owner`: 用于记录创建当前元素的组件，即父组件

```ts
export function createElement(type, config, children) {
  // ...

  // 3. 返回 react 元素
  return ReactElement(
    type,
    key,
    ref,
    self,
    source,
    ReactCurrentOwner.current,
    props
  )
}

function ReactElement(type, key, ref, self, source, owner, props) {
  const element = {
    // 标记这是一个 react 元素
    $$typeof: REACT_ELEMENT_TYPE,

    // createElement 传进来的属性
    type: type,
    key: key,
    ref: ref,
    props: props,

    // 记录创建当前元素的组件，即父组件
    _owner: owner,
  }

  return element
}
```

## 总结

在编译阶段，Babel 会将 jsx 转换为 `createElement` 嵌套的形式，`createElement` 方法本质是将 jsx 的嵌套结构，转化为标准的 react 元素，主要有三个实现步骤

1. 处理 jsx 的属性，将 jsx 上的属性放到 props 中
2. 处理 jsx 的子节点，将子节点 children 放到 props 中
3. 通过 `ReactElement` 创建一个 react 元素
