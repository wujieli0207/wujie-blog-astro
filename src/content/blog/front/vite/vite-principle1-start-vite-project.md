---
title: 初识 vite 原理，vite 是如何启动项目的
excerpt: 初识 vite 原理，vite 是如何启动项目的
publishDate: '2023-07-22'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: 初识 vite 原理，vite 是如何启动项目的
---

我们使用 vite 的时候，只需要在 package.json 中定义一个简单的命令，就可以启动项目，那么这个简单的命令，是如何启动 vite 项目的呢，下面我们来详细介绍一下

```json
"scripts": {
  "dev": "vite"
},
```

## 执行命令行脚本

在执行 `pnpm install` 命令的时候，`node_modules/.bin` 下会创建多个命令行脚本。当执行 vite 命令的时候，就会找到 `.bin` 目录的下的 vite 脚本，从 vite 脚本中可以看到，执行的是 `vite/bin/vite.js` 文件

![1689678960545.png](http://notesimgs.oss-cn-shanghai.aliyuncs.com/2023-07/1689678960545.png)

vite.js 中的核心内容就是执行了 `start` 方法，动态引入了 `../dist/node/cli.js` ，这个地址是打包后的地址，在 vite 源码中，脚本地址在 `packages/vite/src/node/cli.ts`

```js
function start() {
  return import('../dist/node/cli.js')
}

start()
```

cli.ts 的核心功能是解析命令行参数并启动本地项目，解析命令行参数通过 cac 库，这里我们主要看启动本地项目的命令。在 cac 库中，通过 `command` 定义基础命令，通过 `alias` 方法定于命令别名，通过 `option` 方法定义命令行参数，最后通过 `action` 方法执行具体的操作

```ts
const cli = cac('vite')

cli
  .command('[root]', 'start dev server') // default command
  .alias('serve') // the command is called 'serve' in Vite's API
  .alias('dev') // alias to align with the script name
  .option('--host [host]', `[string] specify hostname`)
  .option('--port <port>', `[number] specify port`)
  .option('--https', `[boolean] use TLS + HTTP/2`)
  .option('--open [path]', `[boolean | string] open browser on startup`)
  .option('--cors', `[boolean] enable CORS`)
  .option('--strictPort', `[boolean] exit if specified port is already in use`)
  .option(
    '--force',
    `[boolean] force the optimizer to ignore the cache and re-bundle`
  )
  .action()
```

在 `action` 方法中，最核心的部分就是引入了 `createServer` 方法，通过 `listen` 启动本地 server

```ts
cli.action(async (/* 入参数 */) => {
  filterDuplicateOptions(options)
  // 核心：启动本地 server
  const { createServer } = await import('./server')
  try {
    const server = await createServer({
      root,
      base: options.base,
      mode: options.mode,
      configFile: options.config,
      logLevel: options.logLevel,
      clearScreen: options.clearScreen,
      optimizeDeps: { force: options.force },
      server: cleanOptions(options),
    })

    await server.listen()

    // 控制台输出本地 server 启动结果
    const info = server.config.logger.info

    server.printUrls()
    // 定义控制台的操作快捷键
    bindShortcuts(server, {})
  } catch (e) {
    process.exit(1)
  }
})
```

这里我们小结一下，在输入命令启动项目时，通过寻找 `node_module/.bin` 目录下的 vite 脚本，再执行 cli.ts 文件中引入的 `createServer` 方法启动本地项目

接下来我们来分析核心的 `createServer` 方法

## createServer

`createServer` 方法有八个核心步骤，如下图所示，每个步骤展开来都很可以很深入的分析，所以我计划在这篇文章中先整体介绍实现过程，在后续的文章中再深入的分析几个重要步骤的实现原理

![1689982737902.png](http://notesimgs.oss-cn-shanghai.aliyuncs.com/2023-07/1689982737902.png)

### 第一步：配置参数解析

参数解析涉及三个部分

1. `resolveConfig` 方法解析 vite 核心配置，包括来自命令行、vite.config 文件的配置参数
2. `resolveHttpsConfig` 方法解析 https 相关的配置，用来在开发环境模拟 https
3. `resolveChokidarOptions` 方法解析 chokidar 相关配置，主要和监听文件变动相关

```ts
const config = await resolveConfig(inlineConfig, 'serve')
const { root, server: serverConfig } = config
const httpsOptions = await resolveHttpsConfig(config.server.https)
const { middlewareMode } = serverConfig

const resolvedWatchOptions = resolveChokidarOptions(config, {
  disableGlobbing: true,
  ...serverConfig.watch,
})
```

### 第二步：创建 HTTP 和 WebSocket server

这一步通过 `createHttpServer` 创建一个 HTTP 服务器实例，根目录的 index.html 就是服务器的入口

通过 `createWebSocketServer` 创建 WebSocket 服务器，主要是用于实现热更新（HMR），当代码发生变化时，服务器通过 WebSocket 向客户端发送更新通知

```ts
const httpServer = middlewareMode
  ? null
  : await resolveHttpServer(serverConfig, middlewares, httpsOptions)
const ws = createWebSocketServer(httpServer, config, httpsOptions)

if (httpServer) {
  setClientErrorHandler(httpServer, config.logger)
}
```

### 第三步：启动 chokidar 启动监听文件

chokidar 能够创建一个文件监听器，监听文件和目录的变化，实时地响应文件的增删改操作，也是用于实现热更新功能

```ts
const watcher = chokidar.watch(
  [root, ...config.configFileDependencies, config.envDir],
  resolvedWatchOptions
) as FSWatcher

// 文件变化操作
watcher.on('change', async (file) => {
  file = normalizePath(file)
  moduleGraph.onFileChange(file)

  await onHMRUpdate(file, false)
})

// 文件新增和删除操作
watcher.on('add', onFileAddUnlink)
watcher.on('unlink', onFileAddUnlink)
```

### 第四步：创建 ModuleGraph 实例

第四步通过 `ModuleGraph` class 创建一个模块依赖图实例，模块依赖图主要用于维护各个模块之间的依赖关系，主要有两个用处

1. 热更新过程中，通过模块依赖图获取所有相关依赖，保证正确完整的实现热更新
2. 打包过程中，根据模块之间的依赖关系进行优化，比如将多个模块合并为一个请求、按需加载模块等，提高打包速度和加载性能

```ts
const moduleGraph: ModuleGraph = new ModuleGraph((url, ssr) =>
  container.resolveId(url, undefined, { ssr })
)
```

### 第五步：创建插件容器

通过 `createPluginContainer` 方法创建插件容器，插件容器主要有三个功能

1. 管理的插件的生命周期
2. 在插件之间传递上下文对象，上下文对象包含 vite 的内部状态和配置信息，这样插件通过上下文对象就能访问和修改 vite 内部状态
3. 根据插件的钩子函数，在特定的时机执行插件

```ts
const container = await createPluginContainer(config, moduleGraph, watcher)
```

### 第六步：定义 ViteDevServer 对象

ViteDevServer 对象就是 `createServer` 方法最终返回的对象，主要包含前几步创建的对象实例和启动 server 相关的核心方法

其中比较特殊的是 `createDevHtmlTransformFn` 方法，这个方法用于在开发环境下转换 index.html 文件，默认注入一段客户端代码 `/@vite/client` ，用于在客户端创建 WebSocket，接收服务端热更新传递的消息

```ts
const server: ViteDevServer = {
  // ===== 核心属性 =====
  config, // 配置属性
  middlewares, // 中间件
  httpServer, // HTTP server 实例
  watcher, // chokidar 文件监听实例
  pluginContainer: container, // 插件容器
  ws, // WebSocket 实例
  moduleGraph, // 模块依赖图

  // ===== 核心方法 =====
  // index.html 转换方法
  transformIndexHtml: createDevHtmlTransformFn(server),
  // 启动 server 方法
  async listen(port?: number, isRestart?: boolean) {
    ;/.../
  },
  // 打开浏览器
  openBrowser() {
    ;/.../
  },
  // 关闭 server
  async close() {
    ;/.../
  },
  // 打印 url
  printUrls() {
    ;/.../
  },
  // 重启 server
  async restart(forceOptimize?: boolean) {
    ;/.../
  },
}
```

### 第七步：执行 configureServer 定义函数

configureServer 主要用于配置开发服务器，比如在内部 [connect](https://github.com/senchalabs/connect) 中添加自定义中间件。在这一步，从配置中获取所有 configureServer 钩子并放入 postHooks 钩子中，在内部中间中间件定义好之后，执行 postHooks 钩子

注意到 postHooks 是在处理 index.html 中间件之前执行，目的是为了自定义的中间件能够在返回 index.html 之前处理请求

```ts
const postHooks: ((() => void) | void)[] = []
for (const hook of config.getSortedPluginHooks('configureServer')) {
  postHooks.push(await hook(server))
}

// 其他中间件定义...

// 执行 post 插件
postHooks.forEach((fn) => fn && fn())

// 处理 index.html 中间件
middlewares.use(indexHtmlMiddleware(server))
```

### 第八步：定义内部中间件

通过 connect 包创建 middlewares 中间件。中间件主要是用来处理 HTTP 请求和响应，通过定义一系列的中间件并且按照一定的顺序执行，每个中间件函数对请求和响应进行处理，然后将处理后的请求和响应传递给下一个中间件函数，直到最后一个中间件函数处理完毕并发送响应

```ts
import connect from 'connect'

const middlewares = connect() as Connect.Server
```

定义好 middlewares 之后，通过 `use` 方法添加启动项目阶段需要的中间件，一共有 14 个

```ts
// 计算操作执行时间
middlewares.use(timeMiddleware(root))

// 处理是否允许跨域
middlewares.use(corsMiddleware(typeof cors === 'boolean' ? {} : cors))

// 请求代理
middlewares.use(proxyMiddleware(httpServer, proxy, config))

// base 地址处理
middlewares.use(baseMiddleware(server))

// 通过 launch-editor-middleware，在代码编辑器打开指定的文件，跳转到指定行号
middlewares.use('/__open-in-editor', launchEditorMiddleware())

// 热更新 ping header 处理
middlewares.use(function viteHMRPingMiddleware(req, res, next) {
  if (req.headers['accept'] === 'text/x-vite-ping') {
    res.writeHead(204).end()
  } else {
    next()
  }
})

// 处理 public 目录
middlewares.use(servePublicMiddleware(config.publicDir, config.server.headers))

// 响应请求之前，对请求的文件进行预处理
middlewares.use(transformMiddleware(server))

// 静态文件处理
middlewares.use(serveRawFsMiddleware(server))
middlewares.use(serveStaticMiddleware(root, server))

// 处理单页应用退回问题
middlewares.use(htmlFallbackMiddleware(root, config.appType === 'spa'))

// 处理 index.html
middlewares.use(indexHtmlMiddleware(server))

// 处理 404 情况
middlewares.use(function vite404Middleware(_, res) {
  res.statusCode = 404
  res.end()
})

// 错误处理
middlewares.use(errorMiddleware(server, middlewareMode))
```

## 总结

最后总结一下，在开发过程中，vite 启动命令执行后，实际执行的是 node_module/.bin 目录下的 vite 脚本，在解析命令行参数之后，通过执行 `createServer.listen` 方法启动 vite

`createServer` 方法主要有 8 个执行步骤，分别是

1. 配置参数解析，包括 vite 核心配置、https 配置、chokidar 配置
2. 创建 HTTP 和 WebSocket server，用于启动开发 server 和热更新通信
3. 启动 chokidar 文件监听器，监听文件变化，实现热更新
4. 创建 ModuleGraph 实例，记录模块依赖关系
5. 创建插件容器，管理插件生命周期、执行过程、插件之间传递上下文
6. 定义 ViteDevServer 对象，包含核心配置和启动开发 server 核心方法
7. 执行 configureServer 定义函数，创建自定义中间件
8. 定义内部中间件

![1689982737902.png](http://notesimgs.oss-cn-shanghai.aliyuncs.com/2023-07/1689982737902.png)
