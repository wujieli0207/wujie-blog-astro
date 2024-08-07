---
title: 因为懒，我写了个同步 cookie 的插件
excerpt: 在一次偶然的百度中发现 chrome 插件可以突破跨域的限制，获取到不同域名下的 cookie，然后百度了一下 chrome 插件的开发者文档，找到了监听 cookie 变化的事件，研究到这里，我觉得可以开始实现需求了

publishDate: '2022-09-14'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: 因为懒，我写了个同步cookie的插件
---

## 为什么需要同步 cookie 的需求？

因为我们公司统一登录、统一认证体系实现方式是通过在公司域名下的 cookie 注入 acces_token 等内容，然后在不同系统间通过携带的 cookie 信息进行认证并跳转到对应系统。因为本地开发环境 localhost 和公司域名不在同一个域下，导致需要模拟登录后，需要手动将相关 cookie 信息拷贝在 main.js 文件中，注入到 localhost 域名下。这就导致每次换一个用户登录，我就要手动复制下面这些内容，而且当 cookie 过期时也要重复一遍这样的操作，这对一个程序员来说太繁琐了，太麻烦了，严重影响了摸鱼时间

```js
// 每次在开发环境都要手动复制 4 个 cookie 信息
const evnNode = process.env.VUE_APP_ENV

if (evnNode === 'development') {
  document.cookie = 'access_token=xxx'
  document.cookie = 'refresh_token=xxx'
  document.cookie = 'token_since=123'
  document.cookie = 'original_access_token=xxx'
}
```

所以在这样一个背景下，我开始探索有什么办法能不用每次都手动复制这 4 个复制 cookie 的方案

最初想到的方案是直接通过获取公司域名下的 cookie 信息，但因为浏览器的安全性质，是不能获取跨域的 cookie 信息的，这个时候又想到改造浏览器的安全限制，但这个方案不具有通用性，就先放弃了。第二个考虑的方案是本地起一个 node 中间件，通过这个中间间实现携带 cookie，但是因为实现复杂也放弃了

之后在一次偶然的百度中发现 chrome 插件可以突破跨域的限制，获取到不同域名下的 cookie，然后百度了一下 chrome 插件的开发者文档，找到了监听 cookie 变化的事件，研究到这里，我觉得可以开始实现需求了

## 撸起袖子开始干

一个 chrome 插件本质也是一个前端应用运行在 chrome 浏览器的环境里，所以直接就选择了 Vue3 + Vite2 进行开发。先用 `pnpm create vite` 初始化一个 vite 项目，安装好需要使用的 UI 库 Ant Design Vue，删掉无用的内容之后先得到一个基础的项目结构

接下来配置 chrome 插件的信息，chrome 插件主要是在 `manifest.json` 文件中配置基础信息。在 public 目录下新建一个 `manifast.json` 文件，文件中有几个配置是比较重要的，这里特别解释一下

- `manifest_version`：定义配置清单的版本，从 Chrome 88 开始就是 V3，我是用的也是 3 这个版本
- `permissions`：申请操作 chrome 的一些操作权限，这个插件里我主要用到的是 storage 和 cookies 的权限
- `host_permissions`：申请有权限操作的域名，这里直接指定所有域名 `"<all_urls>"` 即可
- `background`：后台运行脚本指定的属性，可以是 HTML，也可以是 JS 文件，主要是用于在后台监听 cookie 变化

插件的 icon 我是在阿里的 [iconfont](https://www.iconfont.cn/) 上下载的，下载时可以选择不同的大小，其他信息就直接附上源码好了

```json
{
  "manifest_version": 3,
  "name": "sync-cookie-extension",
  "version": "1.0.0",
  "description": "开发环境同步测试 cookie 至 localhost，便于本地请求服务携带 cookie",
  "icons": {
    "16": "sources/cookie16.png",
    "32": "sources/cookie32.png",
    "48": "sources/cookie48.png",
    "128": "sources/cookie128.png"
  },
  "action": {
    "default_icon": "sources/cookie48.png",
    "default_title": "解决本地开发 localhost 请求无法携带 cookie 问题",
    "default_popup": "index.html"
  },
  "permissions": ["storage", "cookies"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

然后就是插件的功能开发，根据需求这个插件主要实现的两个功能

1. 支持配置需要同步到本地的域名和 cookie 名称，支持开启和关闭同步

2. 当配置列表中的 cookie 发生变化时，能够将同步至本地

第一个功能就是基于可编辑表格的 CRUD 一套功能，我是用的 Ant Design Vue 来开发的，一套操作下来页面效果是这样的（[源码地址](https://github.com/wujieli0207/chrome-sync-cookie-extension/blob/master/src/components/Main.vue)）

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/%E6%88%AA%E5%B1%8F2022-09-04%2007.32.34.png)

下面就是实现最主要的同步功能：当 from 字段下 cookie name 发上变化时，将 cookie 同步至 to 字段对应的域名下（默认是 localhost ）

第一步先要将我们在列表中配置的域名信息存储在 localstorage 中，一方面为了在插件后台中能够获取到需要同步的列表，另一方面当插件刷新时列表信息也不会丢失。然后还要写一个同步 cookie 的方法 `updateCookie` 方法用于加载时第一次同步 cookie

```ts
// 在 useStorage.ts 中定义存储 localstorage 方法和更新 cookie 的方法
import {
  ICookieTableDataSource,
  ICookie,
  TCookieConfig,
  LIST_KEY,
} from '../type'

// 增加协议头
function addProtocol(uri: string) {
  return uri.startsWith('http') ? uri : `http://${uri}`
}

// 移除协议头
function removeProtocol(uri: string) {
  return uri.startsWith('http')
    ? uri.replace('http://', '').replace('https://', '')
    : uri
}

const useStorage = () => {
  async function updateStorage(list: ICookieTableDataSource[]) {
    await chrome.storage.local.set({ [LIST_KEY]: list })
  }

  async function getStorage(key = LIST_KEY) {
    return await chrome.storage.local.get(key)
  }

  async function updateCookie(config: TCookieConfig) {
    try {
      const cookie = await chrome.cookies.get({
        url: addProtocol(config.from || 'url'),
        name: config.cookieName || 'name',
      })

      return cookie ? await setCookie(cookie, config) : null
    } catch (error) {
      console.error('error: ', error)
    }
  }

  function setCookie(cookie: ICookie, config: TCookieConfig) {
    return chrome.cookies.set({
      url: addProtocol(config.to || 'url'),
      domain: removeProtocol(config.to || 'url'),
      name: cookie.name,
      path: '/',
      value: cookie.value,
    })
  }

  return {
    updateStorage,
    getStorage,
    updateCookie,
  }
}

export default useStorage
```

第二步就是在插件首次加载的时候，从 localhost 读取是否开启同步和配置列表，然后读取配置列表的信息更新 cookie

```ts
// 读取是否同步开启和配置列表
const dataSource = ref<ICookieTableDataSource[]>(DEFAULT_LIST) // DEFAULT_LIST 是默认最初的同步列表，这样第一次加载插件时 localstorage 为空的话也不用手动在写一遍

const { updateStorage, getStorage, updateCookie } = useStorage()

onMounted(async () => {
  // 初始化开启同步状态
  const openSyncLocal = await getStorage('isOpenSync')

  if (!isEmpty(openSyncLocal)) {
    isOpenSync.value = openSyncLocal.isOpenSync
  }

  // 从 localStorage 初始化数据
  const storage = await getStorage()
  const domainList = !isEmpty(storage)
    ? (Object.values(storage[LIST_KEY]) as ICookieTableDataSource[])
    : []

  if (!isEmpty(domainList)) {
    dataSource.value = domainList
  }

  // 更新 localStorage 和 cookie
  if (!isEmpty(unref(dataSource))) {
    updateStorage(dataSource.value)

    dataSource.value.forEach((item) => {
      updateCookie({
        from: item.from,
        to: item.to,
        cookieName: item.cookieName,
      })
    })
  }
})
```

第三步当是否开启同步状态和配置列表发生变化时需要更新 localhost，这里使用 watch 监听同步状态的改变，然后再保存同步列表的方法里新增更新 localstorage

```ts
watch(isOpenSync, async () => {
  await chrome.storage.local.set({ isOpenSync: isOpenSync.value })
})

async function handleSave(rowId: string) {
  Object.assign(
    dataSource.value.filter((item) => item.id === rowId)[0],
    editableData[rowId]
  )
  delete editableData[rowId]
  // 更新 localStorage
  updateStorage(dataSource.value)
}
```

到这里已经实现的第一次的 cookie 同步功能，然后就要用到监听 cookie 变化的事件 `chrome.cookies.onChanged.addListener` 了。我们之前在 `manifest.json` 文件中配置了 `background` 这个参数，这个时候就要用上了

```json
"background": {
  "service_worker": "background.js",
  "type": "module"
}
```

在项目 public 目录下新建 `background.js`，添加 cookie 改变监听事件函数，然后从 localhost 中获取是否开启同步状态和配置列表，在开启同步的状态下，从列表中找到需要更新的 cookie 同步至本地就可以了

```js
addCookiesChangeEvent()

function addCookiesChangeEvent() {
  console.log('start addCookiesChangeEvent')
  chrome.cookies.onChanged.addListener(async ({ cookie, removed }) => {
    // 判断是否开启同步
    const openSyncObj = await chrome.storage.local.get('isOpenSync')
    const isOpenSync = openSyncObj.isOpenSync

    if (!isOpenSync) return

    const storage = await chrome.storage.local.get(['domainList'])

    if (Object.keys(storage).length === 0) return
    const domainList = Object.values(storage['domainList'])

    // 需求更新的 cookie
    const target = domainList.find((item) => {
      return (
        equalDomain(item.from, cookie.domain) && item.cookieName === cookie.name
      )
    })

    if (target) {
      if (removed) {
        removeCookie(cookie, target)
      } else {
        setCookie(cookie, target)
      }
    }
  })
}

function setCookie(cookie, config) {
  return chrome.cookies.set({
    url: addProtocol(config.to || 'url'),
    domain: removeProtocol(config.to || 'url'),
    name: cookie.name,
    path: '/',
    value: cookie.value,
  })
}

function removeCookie(cookie, config) {
  chrome.cookies.remove({
    url: addProtocol(config.to || 'url'),
    name: cookie.name,
  })
}

// 增加协议头
function addProtocol(uri) {
  return uri.startsWith('http') ? uri : `http://${uri}`
}

// 移除协议头
function removeProtocol(uri) {
  return uri.startsWith('http')
    ? uri.replace('http://', '').replace('https://', '')
    : uri
}

function equalDomain(domain1, domain2) {
  return addProtocol(domain1) === addProtocol(domain2)
}
```

到这里同步功能就已经实现了，接下来打包项目 `pnpm run build`，打开 chrome 浏览器开发者模式，选择“加载解压缩的扩展”，选择打包的 dist 文件安装，如果安装成功的话可以看到这样一个图标

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/%E6%88%AA%E5%B1%8F2022-09-04%2009.17.10.png)

最后测试一下插件的效果，在百度域名下输入一个测试域名，然后在 localhost 下刷新一下，可以看到 cookie 已经成功同步过去了，大功告成

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/%E6%88%AA%E5%B1%8F2022-09-04%2009.27.04.png)

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/%E6%88%AA%E5%B1%8F2022-09-04%2009.27.47.png)

代码我也上传到了 github，有兴趣的话大家也可以 star 支持一波，[源码地址](https://github.com/wujieli0207/chrome-sync-cookie-extension)
