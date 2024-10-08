---
title: vue 项目优雅的对 url 参数加密
excerpt: vue 项目优雅的对 url 参数加密
publishDate: '2022-10-25'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: vue 项目优雅的对 url 参数加密
---

## 实现方案：stringifyQuery 和 parseQuery

近期因为公司内部的安全检查，说我们现在的系统中参数是明文的，包括给后端请求的参数和前端页面跳转携带的参数，因为是公司内部使用的系统，在安全性方面的设计考虑确实不够充分

对于参数的加密和解密很好实现，直接采用常用的 AES 算法，前后端定义好通用的密钥和加解密方式就好，前端加解密这里主要使用到 [crypto-js](https://github.com/brix/crypto-js) 这个工具包，再通过一个类简单封装一下加解密的算法即可

```ts
// src\utils\cipher.ts
import { encrypt, decrypt } from 'crypto-js/aes'
import { parse } from 'crypto-js/enc-utf8'
import pkcs7 from 'crypto-js/pad-pkcs7'
import ECB from 'crypto-js/mode-ecb'
import UTF8 from 'crypto-js/enc-utf8'

// 注意 key 和 iv 至少都需要 16 位
const AES_KEY = '1111111111000000'
const AES_IV = '0000001111111111'

export class AesEncryption {
  private key
  private iv

  constructor(key = AES_KEY, iv = AES_IV) {
    this.key = parse(key)
    this.iv = parse(iv)
  }

  get getOptions() {
    return {
      mode: ECB,
      padding: pkcs7,
      iv: this.iv,
    }
  }

  encryptByAES(text: string) {
    return encrypt(text, this.key, this.getOptions).toString()
  }

  decryptByAES(text: string) {
    return decrypt(text, this.key, this.getOptions).toString(UTF8)
  }
}
```

对于前端页面间跳转携带参数，我们项目使用的都是 vue-router 的 query 来携带参数，但是有那么多页面跳转的地方，不可能都手动添加加解密方法处理吧，工作量大不说，万一漏改一个就可能导致整个页面无法加载了，这锅可不能背

首先想到的方法是在路由守卫 `beforeEach` 中对参数进行加密，然后在 `afterEach` 守卫中对参数进行解密，但是这个想法在 `beforeEach` 中加密就无法实现。原因是 `beforeEach(to, from, next)` 的第三个参数 `next` 函数中，如果**参数是路由对象，会导致跳转死循环**

接下来经过几个小时百思不得其解（~~摸鱼~~）之后，最终在 [API 参考 | Vue Router (vuejs.org)](https://router.vuejs.org/zh/api/#stringifyquery) 找到这样两个 API：`stringifyQuery` 和 `parseQuery`，官网的定义如下

> stringifyQuery：对查询对象进行字符串化的自定义实现。不应该在前面加上 `?`。应该正确编码查询键和值
>
> parseQuery：用于解析查询的自定义实现。必须解码查询键和值

比如，官网建议如果想使用 qs 包来解析查询，可以这样配置

```js
import qs from 'qs'

createRouter({
  // 其他配置...
  parseQuery: qs.parse,
  stringifyQuery: qs.stringify,
})
```

现在最终的解决方案就很明确了，自定义两个参数加密、解密的方法，然后在 `createRouter` 中添加到 `stringifyQuery` 和 `parseQuery` 这两个方法就可以了，下面是详细代码

```ts
// src/router/helper/query.js
import { isArray, isNull, isUndefined } from 'lodash-es'
import { AesEncryption } from '@/utils/cipher'
import type {
  LocationQuery,
  LocationQueryRaw,
  LocationQueryValue,
} from 'vue-router'

const aes = new AesEncryption()

/**
 *
 * @description 解密:反序列化字符串参数
 */
export function stringifyQuery(obj: LocationQueryRaw): string {
  if (!obj) return ''

  const result = Object.keys(obj)
    .map((key) => {
      const value = obj[key]

      if (isUndefined(value)) return ''

      if (isNull(value)) return key

      if (isArray(value)) {
        const resArray: string[] = []

        value.forEach((item) => {
          if (isUndefined(item)) return

          if (isNull(item)) {
            resArray.push(key)
          } else {
            resArray.push(key + '=' + item)
          }
        })
        return resArray.join('&')
      }

      return `${key}=${value}`
    })
    .filter((x) => x.length > 0)
    .join('&')

  return result ? `?${aes.encryptByAES(result)}` : ''
}

/**
 *
 * @description 解密:反序列化字符串参数
 */
export function parseQuery(query: string): LocationQuery {
  const res: LocationQuery = {}

  query = query.trim().replace(/^(\?|#|&)/, '')

  if (!query) return res

  query = aes.decryptByAES(query)

  query.split('&').forEach((param) => {
    const parts = param.replace(/\+/g, ' ').split('=')
    const key = parts.shift()
    const val = parts.length > 0 ? parts.join('=') : null

    if (!isUndefined(key)) {
      if (isUndefined(res[key])) {
        res[key] = val
      } else if (isArray(res[key])) {
        ;(res[key] as LocationQueryValue[]).push(val)
      } else {
        res[key] = [res[key] as LocationQueryValue, val]
      }
    }
  })

  return res
}

// src/router/index.js
// 创建路由使用加解密方法
import { parseQuery, stringifyQuery } from './helper/query'

export const router = createRouter({
  // 创建一个 hash 历史记录。
  history: createWebHashHistory(import.meta.env.VITE_PUBLIC_PATH),
  routes: basicRoutes,
  scrollBehavior: () => ({ left: 0, top: 0 }),
  stringifyQuery, // 序列化query参数
  parseQuery, // 反序列化query参数
})
```

加密的效果如下，我也在 [github 上传了加密方式的 demo](https://github.com/wujieli0207/vue-router-encrypt)，可以直接下载体验一下

![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202210241054873.png)

## 更进一步：相关实现原理

在实现完这两个功能之后，我突然想翻一下 Vue Router 的源码，看一下 `stringifyQuery` 和 `parseQuery` 的实现原理，避免以后遇到类似的问题再抓瞎

打开 [Vue Router@4](https://github.com/vuejs/router)的源码，整个项目是用 pnpm 管理 monorepo 的方式组织，通过 rollup.config.js 中定义的 `input` 入口可以知道，所有的方法都通过 packages/router/src/index.ts 导出

首先先看初始化路由实例的 `createRouter` 方法，这个方法主要做了这么几件事

1. 通过 `createRouterMatcher` 方法，根据路由配置列表创建 matcher，返回 5 个操作 matcher 方法。matcher 可以理解为路由页面匹配器，包含路由所有信息和 crud 操作方法
2. 定义三个路由守卫：beforeEach、beforeResolve、afterEach
3. 声明当前路由 currentRoute，对 url 参数 paramas 进行编码处理
4. 添加路由的各种操作方法，最后返回一个 router 对象

一个简化版本的 `createRouter` 方法如下所示，前文使用到的 `stringifyQuery` 和 `parseQuery` 都是在这个方法中加载

```ts
export function createRouter(options: RouterOptions): Router {
  // 创建路由匹配器 matcher
  const matcher = createRouterMatcher(options.routes, options)

  // ! 使用到的 stringifyQuery 和 parseQuery
  const parseQuery = options.parseQuery || originalParseQuery
  const stringifyQuery = options.stringifyQuery || originalStringifyQuery

  // ! 路由守卫定义
  const beforeGuards = useCallbacks<NavigationGuardWithThis<undefined>>()
  const beforeResolveGuards = useCallbacks<NavigationGuardWithThis<undefined>>()
  const afterGuards = useCallbacks<NavigationHookAfter>()

  // 声明当前路由
  const currentRoute = shallowRef<RouteLocationNormalizedLoaded>(
    START_LOCATION_NORMALIZED
  )
  let pendingLocation: RouteLocation = START_LOCATION_NORMALIZED

  // leave the scrollRestoration if no scrollBehavior is provided
  if (isBrowser && options.scrollBehavior && 'scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }

  // url 参数进行编码处理
  const normalizeParams = applyToParams.bind(
    null,
    (paramValue) => '' + paramValue
  )
  const encodeParams = applyToParams.bind(null, encodeParam)
  const decodeParams: (params: RouteParams | undefined) => RouteParams =
    applyToParams.bind(null, decode)
}
```

从创建路由实例来看， `stringifyQuery` 和 `parseQuery` 两个参数如果没有自定义传入的情况下，会使用 vue-router 默认的解析函数

默认的 `stringifyQuery` 函数用于把参数由对象形式转换为字符串连接形式，主要流程

1. 循环参数 query 对象
2. 特殊处理参数为 null 的情况，参数值为 null 的情况会拼接在 url 链接中但是没有值，而参数值为 undefined 则会直接忽略
3. 将对象转化为数组，并且对每个对象的值进行 encoded 处理
4. 将数组拼接为字符串参数

```ts
// vue-router 默认的序列化 query 参数的函数
export function stringifyQuery(query: LocationQueryRaw): string {
  let search = ''
  for (let key in query) {
    const value = query[key]
    key = encodeQueryKey(key)
    // 处理参数为 null 的情况
    if (value == null) {
      if (value !== undefined) {
        search += (search.length ? '&' : '') + key
      }
      continue
    }
    // 将参数处理为数组，便于后续统一遍历处理
    const values: LocationQueryValueRaw[] = isArray(value)
      ? value.map((v) => v && encodeQueryValue(v))
      : [value && encodeQueryValue(value)]

    values.forEach((value) => {
      // 跳过参数为 undefined 的情况，只拼接有值的参数
      if (value !== undefined) {
        search += (search.length ? '&' : '') + key
        if (value != null) search += '=' + value
      }
    })
  }

  return search
}

// 示例参数，如下参数会被转换为：name=wujieli&age=12&address
// query: {
//   id: undefined,
//   name: 'wujieli',
//   age: 12,
//   address: null,
// },
```

默认的 `parseQuery` 函数用来将字符串参数解析为对象，主要流程

1. 排除空字符串和字符串前的 "?"
2. 对字符串用 "&" 分割，遍历分割后的数组
3. 根据 "=" 截取参数的 key 和 value，并对 key 和 value 做 decode 处理
4. 处理 key 重复存在的情况，如果 key 对应 value 是数组，就把 value 添加进数组中，否则就覆盖前一个 value

```ts
// vue-router 默认的序列化 query 参数的函数
export function parseQuery(search: string): LocationQuery {
  const query: LocationQuery = {}
  // 因为要对字符串进行 split('&') 操作，所以优先排除空字符串
  if (search === '' || search === '?') return query
  // 排除解析参数前的 ?
  const hasLeadingIM = search[0] === '?'
  const searchParams = (hasLeadingIM ? search.slice(1) : search).split('&')

  for (let i = 0; i < searchParams.length; ++i) {
    // 根据 = 截取参数的 key 和 value，并做 decode 处理
    const searchParam = searchParams[i].replace(PLUS_RE, ' ')
    const eqPos = searchParam.indexOf('=')
    const key = decode(eqPos < 0 ? searchParam : searchParam.slice(0, eqPos))
    const value = eqPos < 0 ? null : decode(searchParam.slice(eqPos + 1))

    // 处理 key 重复存在的情况
    if (key in query) {
      // an extra variable for ts types
      let currentValue = query[key]
      if (!isArray(currentValue)) {
        currentValue = query[key] = [currentValue]
      }
      // we force the modification
      ;(currentValue as LocationQueryValue[]).push(value)
    } else {
      query[key] = value
    }
  }
  return query
}
```

`stringifyQuery` 这个方法用在创建 router 实例时提供的 `resolve` 方法中用来生成 url，`parseQuery` 方法主要用在 `router.push`、`router.replace` 等方法中解析 url 携带的参数

```ts
// stringifyQuery 方法的使用
function resolve(
  rawLocation: Readonly<RouteLocationRaw>,
  currentLocation?: RouteLocationNormalizedLoaded
): RouteLocation & { href: string } {
  // ...
  // 链接的完整 path，包括路由 path 和后面的完整参数
  const fullPath = stringifyURL(
    stringifyQuery,
    assign({}, rawLocation, {
      hash: encodeHash(hash),
      path: matchedRoute.path,
    })
  )
}

// parseQuery 方法会封装在 locationAsObject 方法中使用
function locationAsObject(
  to: RouteLocationRaw | RouteLocationNormalized
): Exclude<RouteLocationRaw, string> | RouteLocationNormalized {
  return typeof to === 'string'
    ? parseURL(parseQuery, to, currentRoute.value.path)
    : assign({}, to)
}
```

以上就是 `stringifyQuery` 和 `parseQuery` 两个方法的实现原理，可以看到源码中对于参数的加密解密考虑的处理是更多的，其实也可以把两个方法的源码拷贝出来，加上加密、解密的方法然后覆盖源码即可
