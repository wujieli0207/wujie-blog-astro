---
title: JavaScript 继承实现方式
excerpt: JavaScript 继承实现方式
publishDate: '2021-12-24'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: JavaScript 继承实现方式
---

## 原型链继承

- 将子类的原型对象指向父类的实例
- 优点：继承了父类的模板，又继承了父类的原型对象
- 缺点：
  - 无法实现多继承(因为已经指定了原型对象了)
  - 父类的所有 引用属性（info）会被所有子类共享，更改一个子类的引用属性，其他子类也会受影响
  - 创建子类时，无法向父类构造函数传参数

```javascript
function Parent() {
  this.info = {
    name: 'Parent',
    age: 18,
  }
}

Parent.prototype.getInfo = function () {
  console.log(this.info)
}

function Child() {}

// 将子类的原型对象指向父类的实例
Child.prototype = new Parent()

let child = new Child()
child.info.gender = 'M'
child.getInfo() // { name: 'Parent', age: 18, gender: 'M' }
```

## 构造函数继承

- 在子类构造函数内部使用 `apply` 或 `call` 来调用父类构造函数，复制父类的实例属性给子类
- 优点：
  - 解决了原型链继承中子类实例共享父类引用对象的问题，实现**多继承**
  - 创建子类实例时，可以向父类传递参数
- 缺点：
  - 构造继承只能继承父类的实例属性和方法，不能继承父类原型的属性和方法（方法属性写在构造函数中，每次创建示例都会被初始化）

```javascript
function Parent(name) {
  this.info = {
    name,
    hobby: ['football', 'basketball'],
  }
}

Parent.prototype.getInfo = function () {
  console.log(this.info)
}

function Child(name, age) {
  // 继承父类属性
  Parent.call(this, name)
  this.age = age
}

// 继承父类方法
Child.prototype = new Parent()

let child1 = new Child('wujie1', 19)
child1.info.hobby.push('soccer')
console.log(child1.getInfo()) // { name: 'wujie1', hobby: [ 'football', 'basketball', 'soccer' ] }
console.log(child1.age)

let child2 = new Child('wujie2', 20)
console.log(child2.getInfo()) // { name: 'wujie2', hobby: [ 'football', 'basketball' ] }
console.log(child2.age)
```

## 组合继承

- 使用**原型链继承**保证子类继承父类**原型**的属性和方法
- 使用**构造继承**保证子类继承父类**实例**的属性和方法

```js
function Parent(name) {
  this.info = {
    name,
    hobby: ['football', 'basketball'],
  }
}

Parent.prototype.getInfo = function () {
  console.log(this.info)
}

function Child(name, age) {
  // 继承父类属性
  Parent.call(this, name)
  this.age = age
}

// 继承父类方法
Child.prototype = new Parent()

let child1 = new Child('wujie1', 19)
child1.info.hobby.push('soccer')
console.log(child1.getInfo()) // { name: 'wujie1', hobby: [ 'football', 'basketball', 'soccer' ] }
console.log(child1.age)

let child2 = new Child('wujie2', 20)
console.log(child2.getInfo()) // { name: 'wujie2', hobby: [ 'football', 'basketball' ] }
console.log(child2.age)
```

## 原型式继承

- 通过拷贝对象引用方式实现，但可能导致对象被修改

```js
let parent = {
  name: 'parent',
  hobby: ['football', 'basketball'],
}

let child = Object.create(parent)
child.name = 'child'
child.hobby.push('soccer')

console.log(child.name) // child
console.log(child.hobby) // [ 'football', 'basketball', 'soccer' ]
```

## 寄生式继承

- 通过获取对象的浅拷贝，再对浅拷贝方法增强（添加方法），也就是在原型式寄生的基础上再添加方法

```js
let parent = {
  name: 'parent',
  hobby: ['football', 'basketball'],
}

function clone(original) {
  let clone = Object.create(original)
  clone.getHobby = function () {
    return this.hobby
  }
  return clone
}

let child = clone(parent)
child.name = 'child'
child.hobby.push('soccer')

console.log(child.name) // child
console.log(child.hobby) // [ 'football', 'basketball', 'soccer' ]
console.log(child.getHobby()) // [ 'football', 'basketball', 'soccer' ]
```

## 寄生组合式继承

- 将组合继承，寄生式继承组合起来实现的继承，是所有继承方式的最优解
- 优点：解决了组合继承父类会被调用两次和属性在不同层级会重复的问题

```js
function Parent() {
  this.name = 'parent'
  this.hobby = ['football', 'basketball']
}

Parent.prototype.getHobby = function () {
  return this.hobby
}

function Child() {
  Parent.call(this)
  this.friend = 'child friends'
}

function clone(parent, child) {
  child.prototype = Object.create(parent.prototype)
  child.prototype.constructor = child
}

clone(Parent, Child)

Child.prototype.getFriend = function () {
  return this.friend
}

let child = new Child()
console.log(child.getHobby()) // [ 'football', 'basketball' ]
console.log(child.getFriend()) // child friend
```

## class 继承

- 通过 `extends`、`super` 实现

```javascript
class Parent {
  constructor(name) {
    this.name = name
  }
  getName() {
    console.log(this.name)
  }
}
class Child extends Parent {
  constructor(name) {
    super(name)
    this.age = 18
  }
}
```
