---
title: JavaScript 数组方法总结
excerpt: JavaScript 数组方法总结
publishDate: '2021-12-23'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: JavaScript 数组方法总结
---

## 数组基础操作

- 创建数组的方式有两种
  - `new Array()`
  - `[]`
- 添加数组
  - 尾部添加：`array.push(item)`
  - 头部添加：`array.unshift(item)`
  - 直接添加：`array[index] = item`
  - 指定索引位置添加：`array.splice(index, 0, item)`
- 删除数组
  - 尾部删除：`array.pop(item)`
  - 头部删除：`array.shift(item)`
  - 指定索引位置删除：`array.splice(index, 1)`
- 修改数组
  - 直接通过索引修改：`array[index] = item`
  - 修改指定位置的某一个元素：`array.splice(index, 1, item)`
- 获取数组长度：`array.length` （最大的数字索引值 + 1）

## 数组常用方法

### 分割与组合方法

- splice() 方法

  - `array.splice(index [, deleteCount, item1, item2])` 从索引 `index` 的位置开始删除 `deleteCount` 个元素，并在当前位置插入 `item1, item2` 元素，最后返回被处理后的元素数组
  - 常用应用场景
    - `array.splice(index, 1)` 从索引位置删除一个元素
    - `array.splice(index, 0, item)` 在索引位置添加一个元素

- slice() 方法

  - `array.slice([start], [end])` 创建**一个新数组**，将索引从 `start` 到 `end` 的元素复制到新的数组，可以传入负
  - 常用应用场景
    - `array.slice()` 获取一个新的数组副本（不影响原数组）

- concat() 方法
  - `array.concat(arg1, arg2...)` 创建**一个新数组**，将第二个开始的所有参数拼接至第一个数组，第二个开始的参数可以是数组或者值

### 循环数组方法

- `for (let i = 0; i < array.length; i++)` 速度最快，可以兼容旧版浏览器

- `for (let item of array)` 只能获取数组 item

- `for (let key in array)` 不建议使用此方法循环数组

  - `for in` 适用于对象循环，并为对象循环做了相关优化，但对数组循环没有优化，循环速度更慢
  - `for in` 会循环数组的所有属性，在处理“类数组”是没有必要的

- forEach() 方法
  - `array.forEach((item, index, array) => {})` 循环遍历数组，item 为元素，index 为索引，array 为被遍历的数组
  - 注意 **forEach 没有返回值**

### 查找数组方法

- indexOf() / lastIndexOf() 方法

  - `array.indexOf(item, from)` 从索引 from 开始查找 item，如果没有找到则返回 -1
  - `array.lastIndexOf(item, from)` 从索引 from 开始查找 item，查找方向为**从右至左**,如果没有找到则返回 -1

- includes() 方法

  - `array.indludes(item, from)` 从索引 from 开始查找 item，如果没有找到则**返回 false**
  - 检查是否包含某个元素**优先使用 includes()**
  - 注：includes() 能够正确识别 NAN

- find() / findIndex() 方法

  - 如果返回为 true，则返回 item 并**停止迭代**
  - 如果返回为 false，则返回 undefined
  - 使用场景

  ```javascript
  let result = array.find((item, index, array) => {
    item.id === 1
  })
  ```

  - findIndex() 方法返回的是 index ，其余和 find() 方法没有区别

- filter() 方法
  - 返回**所有匹配元素组成的数组**
    - 如果返回为 true，则 item 被放到结果数据，迭代继续直到完成
    - 如果什么都没有找到则返回空数组
  - 使用示例
  ```javascript
  // 返回结果为数组
  let results = array.filter((item, index, array) => {
    item.id < 3
  })
  ```

### 转换数组方法

- map() 方法

  - 对每个元素都调用函数，**返回一个新的数组**
  - 使用示例

  ```javascript
  let array = [1, 2, 3]
  let result = array.map((item, index, array) => {
    item * 2
  })
  console.log(result) // [1, 4, 6]
  ```

- sort() 方法

  - 对当前数组进行排序（**没有生成新数组**）
  - 默认使用字符串排序，如果是**数字排序需要指定参考函数**
  - 返回为负数，按照升序排列（**负数表示小于**）

  ```javascript
  array.sort((a, b) => {
    a - b
  })
  ```

  - 返回为正数，按照降序排列（上述例子相反，**正数表示大于**）

- reverse() 方法

  - 颠倒元素顺序

- split() / join() 方法

  - `array.split(delim, [length])` 根据提供的分隔符 delim 将字符串分割成数组，length 用于限制生成数组的长度
  - `array.join(delim)` 使用分隔符 delim 将数组组成字符串

- reduce() / reduceRight() 方法

  ```javascript
  let value = array.reduce((accumulator, item, index, array) => {}, [initial])
  ```

  - 参数含义
    - accumulator：上一个函数调用的结果，第一次等于 initial 参数（如果提供了 initial 参数的话），如果没提供 initial 参数，则以第一个参数作为初始值，从第二个参数开始迭代
    - item、index、array：数组元素、索引、数组本身
  - 使用示例：

  ```javascript
  const array = [1, 2, 3, 4, 5]
  let result = array.reduce((sum, curent) => {
    sum + current
  }) // result = 15
  ```

  - 注意事项：如果不指定 initial 参数，如果数组为空则会报错，所以建议**始终指定初始值**
  - `array.reduceRight()` 的遍历方向为从右至左，其余和 reduce 相同

- some() / every() 方法

  - `array.some(fn)` 类似于 `||` ，如果 fn 返回一个真值，some() 方法立刻返回 true 并停止迭代
  - `array.every(fn)` 类似于 `&&` ，如果 fn 返回全部为真，every() 方法立刻返回 true，否则返回 false

- fill() 方法
  - `array.fill(value, start, end)` 从索引 start 到 end，用重复的 value 填充数组

### 判断数组方法

- `Object.prototype.toString.call()`

  - 每一个继承 Object 对象都有 toString 方法，**如果 toString 方法没有被重写的话，会返回 `[Object type]`**, type 是对象的类型
  - 常用于判断浏览器内置对象

  ```javascript
  Object.prototype.toString.call(['1', '2']) // "[object Array]"
  Object.prototype.toString.call(1) // "[object Number]"
  Object.prototype.toString.call('wujie') // "[object String]"
  Object.prototype.toString.call(null) // "[object null]"
  Object.prototype.toString.call(undefined) // "[object undefined]"
  Object.prototype.toString.call(function () {}) // "[object Function]"
  ```

- `instanceof`

  - 内部机制是通过判断对象的原型链能否找到类型的 prototype
  - 如果能够找到 Array 原型，则判断为数组 `instanceof Array`
  - `instanceof` 只能判断对象类型，**不能判断原始类型**，并且所有对象类型 `instanceof Object` 都是 `true`

- `Array.isArray()`
  - 优于 `instancof`，**因为 `Array.isArray` 可以检测出 iframs**
  - 可以通过 `Object.prototype.toString.call()` 实现 isArray() 方法
    ```javascript
    if (!Array.isArray()) {
      Array.isArray = function (arg) {
        return Object.prototype.toString.call(arg) === '[object Array]'
      }
    }
    ```

### 数组方法注意事项

- `sort`、`reverse`、`splice` 方法修改的是数组本身
