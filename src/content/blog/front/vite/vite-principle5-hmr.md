---
title: 即时代码热更新，vite 热更新背后的原理
excerpt: 即时代码热更新，vite 热更新背后的原理
publishDate: '2023-08-06'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: 即时代码热更新，vite 热更新背后的原理
---

vite 热更新的主要作用是为了实现**局部刷新**的效果，这样之前操作的状态都能够保存

vite 热更新的基本实现方式如下

- 基于一套完整的 [ESM HMR 规范](https://github.com/FredKSchott/esm-hmr)，在文件发生改变时 vite 会检测到相应 ESM 模块变化，触发相应的 API，实现局部的更新
- `import.meta` 对象是现代浏览器原生的一个内置对象，vite 在这个对象上的 `hot` 属性中定义了一套完整的热更新属性和方法

简单举一个例子来说，就是当 `import.meta.hot` 属性存在时，会调用 accept 方法，对相关模块重新渲染

```ts
if (import.meta.hot) {
  import.meta.hot.accept((mod) => mod.render())
}
```

下面我们就来具体分析 vite 热更新的具体实现原理

## 实现原理

从整体角度来看，vite 热更新主要分为三步

1. 创建模块依赖图：建立模块间的依赖关系
2. 服务端收集更新模块：监听文件变化，确定需要更新的模块
3. 客户端派发更新：客户端执行文件更新

### 创建模块依赖图

在 vite 中，主要通过 `ModuleGraph` 和 `ModuleNode` 来建立各模块依赖关系，`ModuleGraph` 记录模块及模块的所有依赖，`ModuleNode` 记录模块节点具体信息

模块依赖图在项目启动时通过 `ModuleGraph` 类创建一个实例

```ts
const moduleGraph: ModuleGraph = new ModuleGraph((url, ssr) =>
  container.resolveId(url, undefined, { ssr })
)
```

`ModuleGraph` 主要通过三个 Map 和一个 Set 来记录模块信息，包括

- urlToModuleMap：原始请求 url 到模块节点的映射，如 /src/index.tsx（vite 中的每个模块 url 是唯一的）
- idToModuleMap：模块 id 到模块节点的映射，id 是原始请求 url 经过 `resolveId` 钩子解析后的结果
- fileToModulesMap：文件到模块节点的映射，由于单文件可能包含多个模块，如 .vue 文件，因此 Map 的 value 值为一个集合
- safeModulesPath：录被认为是“安全”的模块路径，安全路径不需要模块转换和处理

```ts
// 目录：packages/vite/src/node/server/moduleGraph.ts
export class ModuleGraph {
  urlToModuleMap = new Map<string, ModuleNode>()
  idToModuleMap = new Map<string, ModuleNode>()
  fileToModulesMap = new Map<string, Set<ModuleNode>>()
  safeModulesPath = new Set<string>()
}
```

`ModuleGraph` 三个 map 中存储的就是 `ModuleNode` 模块节点的信息，`ModuleNode` 中记录了三个和热更新相关的重要属性

- importers：当前模块被哪些模块引用
- clientImportedModules：当前模块依赖的其他模块
- acceptedHmrDeps：其他模块对当前模块的依赖关系，发生热更新时，根据 acceptedHmrDeps 记录的信息通知其他模块信息热更新

```ts
export class ModuleNode {
  // 原始请求 url
  url: string
  // 文件绝对路径 + query
  id: string | null = null
  // 文件绝对路径
  file: string | null = null
  type: 'js' | 'css'
  info?: ModuleInfo
  // resolveId 钩子返回结构的元数据
  meta?: Record<string, any>
  // 重要：当前模块被哪些模块引用
  importers = new Set<ModuleNode>()
  // 重要：当前模块依赖的其他模块
  clientImportedModules = new Set<ModuleNode>()
  // 接收热更新的模块
  acceptedHmrDeps = new Set<ModuleNode>()
  acceptedHmrExports: Set<string> | null = null
  importedBindings: Map<string, Set<string>> | null = null
  // 是否为 接受自身模块更新
  isSelfAccepting?: boolean
  // 经过 transform 钩子编译后的结果
  transformResult: TransformResult | null = null
  // 上一次热更新时间戳
  lastHMRTimestamp = 0
  lastInvalidationTimestamp = 0

  constructor(url: string, setIsSelfAccepting = true) {
    this.url = url
    this.type = isDirectCSSRequest(url) ? 'css' : 'js'
    if (setIsSelfAccepting) {
      this.isSelfAccepting = false
    }
  }
}
```

那么 `ModuleNode` 模块的节点信息是在什么时候创建的呢，上一篇文章中介绍了 vite 会模拟 Rollup 执行一系列钩子，其中有一个 `transform` 代码转换钩子，`ModuleNode` 就是在这个时候创建的

首先通过 `transformRequest` 方法获取代码转换的结果，该方法会调用 `doTransform` 方法执行代码转换过程

在通过 `doTransform` -> `loadAndTransform` -> `_ensureEntryFromUrl`，如果在 idToModuleMap 中没有记录模块节点信息的话，就会创建一个 `ModuleNode` 实例并记录到对应的 map 中

```ts
// 目录：packages/vite/src/node/server/middlewares/transform.ts
const result = await transformRequest(url, server, {
  html: req.headers.accept?.includes('text/html'),
})

// 目录：packages/vite/src/node/server/transformRequest.ts
export function transformRequest() {
  const request = doTransform(url, server, options, timestamp)
}

/**
 * 执行代码转换过程
 */
async function doTransform() {
  // 从 ModuleGraph 查找节点信息
  const module = await server.moduleGraph.getModuleByUrl(url, ssr)

  // 命中缓存，直接返回缓存
  const cached = module && module.transformResult
  if (cached) {
    return cached
  }

  // 调用 PluginContainer 的 resolveId 和 load 方法进行模块加载
  const resolved = module
    ? undefined
    : (await pluginContainer.resolveId(url, undefined, { ssr })) ?? undefined

  const result = loadAndTransform()
  return result
}

async function loadAndTransform() {
  mod ??= await moduleGraph._ensureEntryFromUrl(url, ssr, undefined, resolved)
}

async _ensureEntryFromUrl() {
  rawUrl = removeImportQuery(removeTimestampQuery(rawUrl))
  let mod = this._getUnresolvedUrlToModule(rawUrl, ssr)
  if (mod) return mod

  const modPromise = (async () => {
    // 调用各插件的 resolveId 得到路径
    const [url, resolvedId, meta] = await this._resolveUrl(rawUrl,ssr,resolved)
    mod = this.idToModuleMap.get(resolvedId)

    if (!mod) {
      // 如果没有缓存，创建新的 ModuleNode 对象
      // 记录到 urlToModuleMap、idToModuleMap、fileToModulesMap
      mod = new ModuleNode(url, setIsSelfAccepting)

      this.urlToModuleMap.set(url, mod)
      this.idToModuleMap.set(resolvedId, mod)
      fileMappedModules.add(mod)
    }
    return mod
  })()

  return modPromise
}
```

在创建了 `ModuleNode` 实例之后，模块之间的依赖关系同样是在 `transform` 钩子中创建，在钩子中 vite 定义了一个 `vite:import-analysis` 插件，插件执行过程中会得到三个解析信息

- importedUrls: 当前模块的依赖模块 url 集合
- acceptedUrls: 当前模块中通过 import.meta.hot.accept 声明的依赖模块 url 集合
- isSelfAccepting: 分析 import.meta.hot.accept 的用法，标记是否为接受自身更新的类型

根据这三个信息，通过 `updateModuleInfo` 方法更新 `ModuleNode` 实例的三个核心属性：importers、clientImportedModules、acceptedHmrDeps

```ts
async updateModuleInfo(
  mod: ModuleNode,
  importedModules: Set<string | ModuleNode>,
  importedBindings: Map<string, Set<string>> | null,
  acceptedModules: Set<string | ModuleNode>,
  acceptedExports: Set<string> | null,
  isSelfAccepting: boolean,
): Promise<Set<ModuleNode> | undefined> {
  mod.isSelfAccepting = isSelfAccepting
  let resolveResults = new Array(importedModules.size)

  for (const imported of importedModules) {
      // 当前模块被哪些模块引用
      imported.importers.add(mod)
      resolveResults[nextIndex] = imported
    }
  }
  // 当前模块依赖的其他模块
  mod.clientImportedModules = new Set(resolveResults)

  resolveResults = new Array(acceptedModules.size)
  for (const accepted of acceptedModules) {
      resolveResults[nextIndex] = accepted
  }
  // 接收热更新的模块
  mod.acceptedHmrDeps = new Set(resolveResults)

  return noLongerImported
}
```

小结一下创建模块依赖图这一步骤

1. 服务启动时创建 `ModuleGraph` 实例，记录模块信息
2. 执行 transform 钩子过程中，创建 `ModuleNode` 实例记录模块节点具体信息
3. transform 钩子的 `vite:import-analysis` 插件执行过程中，解析记录模块间的依赖关系，记录三个核心属性：importers、clientImportedModules、acceptedHmrDeps

### 服务端收集更新模块

在服务启动阶段，使用 chokidar 的 `watch` 方法创建文件监听器，监听文件的修改、新增、删除操作

```ts
const watcher = chokidar.watch(
  [root, ...config.configFileDependencies, config.envDir],
  resolvedWatchOptions
) as FSWatcher
```

当文件修改时，有三个执行步骤

1. 获取到标准的文件路径
2. 通过 moduleGraph 实例的 `onFileChange` 方法移除文件缓存信息
3. 执行热更新方法 `onHMRUpdate`

```ts
// 监听文件修改操作
watcher.on('change', async (file) => {
  // 标准化文件路径
  file = normalizePath(file)
  // 移除文件缓存信息
  moduleGraph.onFileChange(file)
  // 执行热更新方法
  await onHMRUpdate(file, false)
})
```

对于文件的新增和删除，使用的同一个方法，执行步骤和文件修改类似，只是第二步的方法有所不同，但本质上都是使用 moduleGraph 的 `onFileChange` 方法移除文件缓存信息，再执行热更新方法 `onHMRUpdate`

```ts
// 监听文件新增和删除操作
const onFileAddUnlink = async (file: string) => {
  // 标准化文件路径
  file = normalizePath(file)
  // 处理新增和修改文件操作，本质也是移除文件缓存信息
  await handleFileAddUnlink(file, server)
  // 执行热更新方法
  await onHMRUpdate(file, true)
}

// 监听文件新增
watcher.on('add', onFileAddUnlink)
// 监听文件删除
watcher.on('unlink', onFileAddUnlink)
```

所以核心的两个方法是 `onFileChange` 和 `handleHMRUpdate` ，下面来具体分析这两个方法

`onFileChange` 方法会根据文件路径获取到所有模块，并遍历所有模块调用 `invalidateModule` 方法去除文件缓存信息

在 `invalidateModule` 方法的执行过程中，还会遍历依赖当前模块的其他模块，清除掉依赖信息，做到完整的清除文件缓存

```ts
onFileChange(file: string): void {
  const mods = this.getModulesByFile(file)
  if (mods) {
    // 记录被遍历过的模块，避免重复清理
    const seen = new Set<ModuleNode>()

    mods.forEach((mod) => {
      // 去除文件缓存信息
    this.invalidateModule(mod, seen)
    })
  }
}


invalidateModule(
  mod: ModuleNode,
  seen: Set<ModuleNode> = new Set(),
  timestamp: number = Date.now(),
  isHmr: boolean = false,
  hmrBoundaries: ModuleNode[] = [],
): void {
  // 如果当前模块被遍历清理过，则直接返回
  if (seen.has(mod)) return
  seen.add(mod)

  mod.transformResult = null

  if (hmrBoundaries.includes(mod)) return

  // 遍历依赖当前模块的其他模块，清除掉依赖信息
  mod.importers.forEach((importer) => {
    if (!importer.acceptedHmrDeps.has(mod)) {
      this.invalidateModule(importer, seen, timestamp, isHmr)
    }
  })
}
```

`onHMRUpdate` 方法中调用 `handleHMRUpdate` 执行具体模块热更新

```ts
const onHMRUpdate = async (file: string, configOnly: boolean) => {
  if (serverConfig.hmr !== false) {
    try {
      await handleHMRUpdate(file, server, configOnly)
    } catch (err) {
      ws.send({
        type: 'error',
        err: prepareError(err),
      })
    }
  }
}
```

`handleHMRUpdate` 有三个执行步骤：

1. 如果是配置文件、环境变量更新，直接重启服务，因为热更新相关的配置可能有变化
2. 如果是客户端注入的文件(vite/dist/client/client.mjs)、html 文件更新，直接刷新页面，因为对于这两类文件没有办法进行局部热更新
3. 如果是普通文件更新，通过 `updateModules` 执行热更新操作

```ts
export async function handleHMRUpdate(
  file: string,
  server: ViteDevServer,
  configOnly: boolean
): Promise<void> {
  const { ws, config, moduleGraph } = server
  const shortFile = getShortName(file, config.root)
  const fileName = path.basename(file)

  const isConfig = file === config.configFile
  const isConfigDependency = config.configFileDependencies.some(
    (name) => file === name
  )
  const isEnv =
    config.inlineConfig.envFile !== false &&
    (fileName === '.env' || fileName.startsWith('.env.'))
  // ===== 1.配置文件/环境变量声明文件变化，直接重启服务 =====
  if (isConfig || isConfigDependency || isEnv) {
    try {
      await server.restart()
    } catch (e) {
      config.logger.error(colors.red(e))
    }
    return
  }

  if (configOnly) return

  // ===== 2.客户端注入的文件(vite/dist/client/client.mjs)更改 =====
  // 给客户端发送 full-reload 信号，刷新页面
  if (file.startsWith(normalizedClientDir)) {
    ws.send({
      type: 'full-reload',
      path: '*',
    })
    return
  }

  // ===== 3.普通文件更改 =====
  // 获取需要更新的文件
  const mods = moduleGraph.getModulesByFile(file)

  const timestamp = Date.now()
  // 初始化 hmr 上下文
  const hmrContext: HmrContext = {
    file,
    timestamp,
    modules: mods ? [...mods] : [],
    read: () => readModifiedFile(file),
    server,
  }

  // 依次处理 handleHotUpdate 钩子，拿到插件处理后的 hmr 模块
  for (const hook of config.getSortedPluginHooks('handleHotUpdate')) {
    const filteredModules = await hook(hmrContext)
    if (filteredModules) {
      hmrContext.modules = filteredModules
    }
  }

  // 没有需要热更新的模块直接 return
  if (!hmrContext.modules.length) {
    // html 文件更新重新刷新页面
    if (file.endsWith('.html')) {
      ws.send({
        type: 'full-reload',
        path: config.server.middlewareMode
          ? '*'
          : '/' + normalizePath(path.relative(config.root, file)),
      })
    }
    return
  }

  // 模块热更新核心方法
  updateModules(shortFile, hmrContext.modules, timestamp, server)
}
```

`updateModules` 方法会遍历需要更新的模块，通过 `propagateUpdate` 方法收集热更新边界并判断是否超过边界，如果超过了边界范围则需要全量刷新，如果在范围内则记录下来需要热更新的模块信息

```ts
export function updateModules(
  file: string,
  modules: ModuleNode[],
  timestamp: number,
  { config, ws, moduleGraph }: ViteDevServer
): void {
  const updates: Update[] = []
  const traversedModules = new Set<ModuleNode>()
  let needFullReload = false

  for (const mod of modules) {
    // 初始化热更新边界集合
    const boundaries: { boundary: ModuleNode; acceptedVia: ModuleNode }[] = []
    // 收集 热更新 边界
    const hasDeadEnd = propagateUpdate(mod, traversedModules, boundaries)

    if (needFullReload) continue
    // 在热更新边界范围外，需要全量刷新
    if (hasDeadEnd) {
      needFullReload = true
      continue
    }

    // 记录热更新边界信息
    updates.push(
      ...boundaries.map(({ boundary, acceptedVia }) => ({
        type: `${boundary.type}-update` as const,
        timestamp,
        path: normalizeHmrUrl(boundary.url),
        explicitImportRequired:
          boundary.type === 'js'
            ? isExplicitImportRequired(acceptedVia.url)
            : undefined,
        acceptedPath: normalizeHmrUrl(acceptedVia.url),
      }))
    )
  }

  // full load 标识，全量刷新
  if (needFullReload) {
    ws.send({
      type: 'full-reload',
    })
    return
  }

  // 通过 websocket 向客户端发送需要热更新的模块
  ws.send({
    type: 'update',
    updates,
  })
}
```

小结一下服务端收集更新模块这一步

1. 在服务启动阶段，会通过 chokidar 的 `watch` 方法方法创建一个文件监听器，当文件发生修改、新增和删除操作时，执行热更新操作
2. 热更新操作前会调用 moduleGraph 实例的 `onFileChange` 方法，清理文件的缓存信息
3. 通过 `updateModules` 执行收集需要热更新的模块，通过 websocket 向客户端发送需要热更新的模块

### 客户端派发更新

上一步服务端通过 websocket 发送给客户端需要热更新的信息如下，接下来我们就来分析客户端是如何接收这个信息，并进行热更新操作的

```json
{
  "type": "update",
  "update": [
    {
      // 更新类型，也可能是 `css-update`
      "type": "js-update",
      // 更新时间戳
      "timestamp": 1650702020986,
      // 热更模块路径
      "path": "/src/main.ts",
      // 接受的子模块路径
      "acceptedPath": "/src/render.ts"
    }
  ]
}
```

在项目启动阶段，会向创建的 index.html 中拼接一段 script 脚本 `<script type="module" src="/@vite/client"></script>`

```ts
server.transformIndexHtml = createDevHtmlTransformFn(server)

const devHtmlHook: IndexHtmlTransformHook = async (
  html,
  { path: htmlPath, filename, server, originalUrl }
) => {
  // 代码省略 。。。

  html = s.toString()

  // html 末尾拼接 <script type="module" src="/@vite/client"></script>
  const CLIENT_PUBLIC_PATH = '/@vite/client'
  return {
    html,
    tags: [
      {
        tag: 'script',
        attrs: {
          type: 'module',
          src: path.posix.join(base, CLIENT_PUBLIC_PATH),
        },
        injectTo: 'head-prepend',
      },
    ],
  }
}
```

script 脚本 `/@vite/client` 会向客户端注入一段默认的代码，代码中执行的 `setupWebSocket` 方法会创建一个 websocket 服务用于监听服务端发送的热更新信息，接收到的信息会通过 `handleMessage` 方法处理

```ts
function setupWebSocket(
  protocol: string,
  hostAndPath: string,
  onCloseWithoutOpen?: () => void
) {
  const socket = new WebSocket(`${protocol}://${hostAndPath}`, 'vite-hmr')
  let isOpened = false

  // 开启事件
  socket.addEventListener(
    'open',
    () => {
      isOpened = true
      notifyListeners('vite:ws:connect', { webSocket: socket })
    },
    { once: true }
  )

  socket.addEventListener('message', async ({ data }) => {
    // 接收并处理服务端的热更新信息
    handleMessage(JSON.parse(data))
  })

  return socket
}
```

`handleMessage` 方法主要是根据不同的类型执行不同的操作，我们接下来主要分析 update 时的热更新核心逻辑

```ts
async function handleMessage(payload: HMRPayload) {
  switch (payload.type) {
    case 'connected': {
      // 当客户端成功连接到服务器时触发，表示 HMR 已准备就绪
      break
    }
    case 'update': {
      // 当一个或多个模块发生更新时触发，热更新的核心逻辑
      break
    }
    case 'custom': {
      // 自定义消息类型，用于实现特定的自定义功能
      break
    }
    case 'full-reload': {
      // 页面完全刷新时的操作
      break
    }
    case 'prune': {
      // 清除不再使用的模块
      break
    }
    case 'error': {
      // 在 HMR 过程中发生错误时触发
      break
    }
    default: {
      // 默认情况下，处理未知的消息类型
      const check: never = payload
      return check
    }
  }
}
```

update 类型的操作中，包含 js 和 css 文件的热更新，两类文件的更新原理类似，我们主要分析 js 文件的热更新。在遍历 payload 的 updates 时，如果类型是 js-update 就会将 `fetchUpdate` 方法放入 `queueUpdate` 方法中执行

```ts
case 'update':
  await Promise.all(
    payload.updates.map(async (update): Promise<void> => {
      // js 文件热更新
      if (update.type === 'js-update') {
        return queueUpdate(fetchUpdate(update))
      }
    }
  )
  break
```

`queueUpdate` 方法的作用是缓冲由同一 src 文件变化触发的多个热更新，以相同的发送顺序调用，避免因为 HTTP 请求往返而导致顺序不一致

```ts
async function queueUpdate(p: Promise<(() => void) | undefined>) {
  queued.push(p)
  if (!pending) {
    pending = true
    await Promise.resolve()
    pending = false
    const loading = [...queued]
    queued = []
    ;(await Promise.all(loading)).forEach((fn) => fn && fn())
  }
}
```

`fetchUpdate` 方法是执行客户端热更新的主要逻辑，有 4 个步骤

1. 通过 hotModulesMap 获取 HMR 边界模块相关信息
2. 获取需要执行的更新回调函数
3. 对将要更新更新的模块进行失活操作，并通过动态 import 拉去最新的模块信息
4. 返回函数，用来执行所有回调

```ts
async function fetchUpdate({
  path,
  acceptedPath,
  timestamp,
  explicitImportRequired,
}: Update) {
  // 1. 获取 HMR 边界模块相关信息
  const mod = hotModulesMap.get(path)
  if (!mod) return

  let fetchedModule: ModuleNamespace | undefined
  const isSelfUpdate = path === acceptedPath

  // 2. 需要执行的更新回调函数
  // mod.callbacks 为 import.meta.hot.accept 中绑定的更新回调函数
  const qualifiedCallbacks = mod.callbacks.filter(({ deps }) =>
    deps.includes(acceptedPath),
  )

  // 3. 对将要更新更新的模块进行失活操作，并通过动态 import 拉去最新的模块信息
  if (isSelfUpdate || qualifiedCallbacks.length > 0) {
    const disposer = disposeMap.get(acceptedPath)
    if (disposer) await disposer(dataMap.get(acceptedPath))

    const [acceptedPathWithoutQuery, query] = acceptedPath.split(`?`)
    try {
      fetchedModule = await import(
        base +
          acceptedPathWithoutQuery.slice(1) +
          `?${explicitImportRequired ? 'import&' : ''}t=${timestamp}${
            query ? `&${query}` : ''
          }`
      )
    }
  }

  // 4. 返回函数，用来执行所有回调
  return () => {
    for (const { deps, fn } of qualifiedCallbacks) {
      fn(deps.map((dep) => (dep === acceptedPath ? fetchedModule : undefined)))
    }
  }
}
```

其中需要解释一下的就是 hotModulesMap 存储的边界模块信息是什么时候获取的，同样也是在 `/@vite/client` 注入的客户端脚本中，通过 `createHotContext` 方法注入，并赋值给 `import.meta.hot`

```ts
str().prepend(
  `import { createHotContext as __vite__createHotContext } from "${clientPublicPath}";` +
    `import.meta.hot = __vite__createHotContext(${JSON.stringify(
      normalizeHmrUrl(importerModule.url)
    )});`
)
```

## 总结

最后总结一些 vite 热更新的实现原理

1. 创建模块依赖图：服务启动时创建 `ModuleGraph` 实例，执行 transform 钩子时创建 `ModuleNode` 实例，记录模块间的依赖关系
2. 服务端收集更新模块：服务启动时通过 chokidar 创建监听器，当文件发生变化时收集需要热更新的模块，将需要更新的模块信息通过 websocket 发送给客户端
3. 客户端派发更新：服务器启动时会在 index.html 注入一段客户端代码，创建一个 websocket 服务监听服务端端发送的热更新信息，在收到服务端的信息后根据模块依赖关系进行模块热更新

![1691319058993.png](http://notesimgs.oss-cn-shanghai.aliyuncs.com/2023-08/1691319058993.png)
