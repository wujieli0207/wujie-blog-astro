---
title: 深入 vite 原理，vite 是如何解析配置文件的
excerpt: 深入 vite 原理，vite 是如何解析配置文件的
publishDate: '2023-07-23'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: 深入 vite 原理，vite 是如何解析配置文件的
---

在[上一篇文章](https://www.wujieli.com/blog/front/vite/vite-principle1-start-vite-project)介绍了在开发环境启动 vite 的整体实现过程，其中第一步配置文件解析是最为重要的部分，下面展开讲讲 vite 解析配置文件的实现原理

```ts
const config = await resolveConfig(inlineConfig, 'serve')
```

## 配置文件解析

配置文件解析的核心方法是 `resolveConfig` ，方法定义在 `packages/vite/src/node/config.ts` 文件下，解析配置文件的过程主要有五步

1. 加载配置文件
2. 解析用户插件
3. 加载环境变量
4. 创建路径解析器
5. 解析插件流水线，调用每个插件的 `configResolved` 钩子

### 第一步：加载配置文件

vite 的配置主要来自两个地方：命令行和配置文件。命令行配置在启动项目时，通过 cac 解析并传递到了 `resolveConfig` 方法中，而配置文件中的配置则需要通过 `loadConfigFromFile` 方法加载

获取到命令行和配置文件的配置后，通过 `mergeConfig` 方法合并两个配置，其中命令行配置的优先级是高于配置文件的

```ts
export async function resolveConfig(inlineConfig: InlineConfig) {
  // 此处的 config 是 命令行配置
  let config = inlineConfig

  // ========== 1. 加载配置文件 ==========
  let { configFile } = config
  if (configFile !== false) {
    const loadResult = await loadConfigFromFile(
      configEnv,
      configFile,
      config.root,
      config.logLevel
    )
    if (loadResult) {
      // 命令行配置和配置文件配置合并
      config = mergeConfig(loadResult.config, config)
      configFile = loadResult.path
      configFileDependencies = loadResult.dependencies
    }
  }
}
```

vite 的配置文件都定义 vite.config 文件下，但根据 ts / js、ESModule / CommonJS 划分，一共有六种文件后缀

```ts
export const DEFAULT_CONFIG_FILES = [
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
  'vite.config.cjs',
  'vite.config.mts',
  'vite.config.cts',
]
```

`loadConfigFromFile` 解析配置文件的第一步就是获取配置文件路径，然后根据文件类型和 package.json 的配置判断是 ESModule 还是 CommonJS，因为两种模式的配置文件加载方式存在一定区别

```ts
export async function loadConfigFromFile(
  configEnv: ConfigEnv,
  configFile?: string,
  configRoot: string = process.cwd(),
  logLevel?: LogLevel,
): Promise<{
  path: string
  config: UserConfig
  dependencies: string[]
} | null> {

  // 1. 获取配置文件路径
  let resolvedPath: string | undefined
  // 如果定义配置文件路径，直接解析
  if (configFile) {
    resolvedPath = path.resolve(configFile)
  } else {
    // 没有定义，从默认的 6 个配置文件定义中获取
    for (const filename of DEFAULT_CONFIG_FILES) {
      const filePath = path.resolve(configRoot, filename)
      if (!fs.existsSync(filePath)) continue

      resolvedPath = filePath
      break
    }
  }

  // 2. 判断是 ESModule 还是 CommonJS
  let isESM = false
  if (/\.m[jt]s$/.test(resolvedPath)) {
    isESM = true
  } else if (/\.c[jt]s$/.test(resolvedPath)) {
    isESM = false
  } else {
    try {
      const pkg = lookupFile(configRoot, ['package.json'])
      isESM =
        !!pkg && JSON.parse(fs.readFileSync(pkg, 'utf-8')).type === 'module'
    } catch (e) {}
  }

  try {
    // 3. 通过 EsBuild 将配置文件打包成 js 代码
    const bundled = await bundleConfigFile(resolvedPath, isESM)
    // 4. 解析配置参数
    const userConfig = await loadConfigFromBundledFile
    (
      resolvedPath,
      bundled.code,
      isESM,
    )

    const config = await (typeof userConfig === 'function'
      ? userConfig(configEnv)
      : userConfig
    }
    return {
      path: normalizePath(resolvedPath),
      config,
      dependencies: bundled.dependencies,
    }
  } catch (e) {
    throw e
  }
}
```

接下来通过 `bundleConfigFile` 方法，使用 esbuild 将配置文件打包成 js 代码

除了基础的配置参数外，注意到 write 参数配置的是 false，也就是不写入文件，这样可以提升打包速度

此外在打包过程中也会定义两个插件

- externalize-deps 插件：用于处理外部依赖解析，通过 onResolve 钩子处理依赖解析，将非相对路径的依赖和内置模块标记为外部依赖。这样打包工具就不需要处理被标记过的外部插件，可以有效减少打包体积
- inject-file-scope-variables 插件：用于在文件作用域内注入变量

```ts
async function bundleConfigFile(
  fileName: string,
  isESM: boolean
): Promise<{ code: string; dependencies: string[] }> {
  const dirnameVarName = '__vite_injected_original_dirname'
  const filenameVarName = '__vite_injected_original_filename'
  const importMetaUrlVarName = '__vite_injected_original_import_meta_url'
  const result = await build({
    absWorkingDir: process.cwd(), // 工作目录绝对路径
    entryPoints: [fileName], // 打包入口文件
    outfile: 'out.js', // 输出文件路径（实际上不会写入文件）
    write: false, // 不写入文件
    target: ['node14.18', 'node16'], // 打包 ndoe 版本
    platform: 'node', // 目标平台为 Node.js
    bundle: true, // 打包为单个文件
    format: isESM ? 'esm' : 'cjs', // 打包格式，esm 或者 cjs
    mainFields: ['main'], // 入口文件字段
    sourcemap: 'inline',
    metafile: true,
    // 需要注入的全局字段
    define: {
      __dirname: dirnameVarName,
      __filename: filenameVarName,
      'import.meta.url': importMetaUrlVarName,
    },
    plugins: [
      {
        // 处理外部依赖解析
        // 通过 onResolve 钩子处理依赖解析，将非相对路径的依赖和内置模块标记为外部依赖
        // 通过返回 { external: true } 来告知打包工具不需要处理
        name: 'externalize-deps',
        setup(build) {},
      },
      {
        // 作用：文件作用域内注入变量
        // 通过 onLoad 钩子读取文件内容，在内容前添加变量的注入代码
        name: 'inject-file-scope-variables',
        setup(build) {},
      },
    ],
  })
  const { text } = result.outputFiles[0]
  return {
    code: text,
    dependencies: result.metafile ? Object.keys(result.metafile.inputs) : [],
  }
}
```

在获取打包好的配置文件之后，会通过 `loadConfigFromBundledFile` 方法来解析配置参数，这里对于 ESModule 和 CommonJS 的处理逻辑的是有区别的，对于 ESModule 采用的 AOP 编译的方式，主要分为三步

1. 将编译后代码写入临时文件
2. 通过 ESM import 读取临时内容
3. 获取配置内容后删除临时内容

```ts
async function loadConfigFromBundledFile(
  fileName: string,
  bundledCode: string,
  isESM: boolean
): Promise<UserConfigExport> {
  if (isESM) {
    const fileBase = `${fileName}.timestamp-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const fileNameTmp = `${fileBase}.mjs`
    const fileUrl = `${pathToFileURL(fileBase)}.mjs`
    // 编译后代码写入 临时文件
    await fsp.writeFile(fileNameTmp, bundledCode)
    try {
      // 通过 ESM import 读取临时内容
      return (await dynamicImport(fileUrl)).default
    } finally {
      // 获取配置内容后删除临时内容
      fs.unlink(fileNameTmp, () => {})
    }
  }
  // CommonJS 处理方式
  else {
  }
}
```

而对于 CommonJS，采用的是 JIT 即时编译的方式

1. 重写原生 `require.entensions` 方法，特殊处理 vite 配置文件
2. 清除 require 缓存，调用 require 方法获取配置
3. 恢复原生 `require.entensions` 方法

```ts
async function loadConfigFromBundledFile(
  fileName: string,
  bundledCode: string,
  isESM: boolean
): Promise<UserConfigExport> {
  if (isESM) {
  }
  // CommonJS 处理方式
  else {
    const extension = path.extname(fileName)
    const realFileName = await promisifiedRealpath(fileName)
    const loaderExt = extension in _require.extensions ? extension : '.js'
    // 默认拦截器
    const defaultLoader = _require.extensions[loaderExt]!
    // 通过拦截原生 require.extensions 的加载函数实现加载 bundle 后配置
    _require.extensions[loaderExt] = (module: NodeModule, filename: string) => {
      if (filename === realFileName) {
        // 特殊处理 vite 配置文件
        ;(module as NodeModuleWithCompile)._compile(bundledCode, filename)
      } else {
        defaultLoader(module, filename)
      }
    }
    // 清除 require 缓存
    delete _require.cache[_require.resolve(fileName)]
    // 调用 require 获取配置对象
    const raw = _require(fileName)
    // 恢复原生 require.extensions
    _require.extensions[loaderExt] = defaultLoader
    return raw.__esModule ? raw.default : raw
  }
}
```

之所以要做这样的区分，是因为 ESModule 在 Node 环境执行过程中需要手动加上 `--experimental-loader` 参数才能正常运行自定义 loader，所以要采用 AOP 编译这种 hack 的方式保证 ESModule 配置文件的正确执行。对于 CommonJS，可以直接注册一个自定义 loader 处理配置文件，所以通过拦截 `require.extensions` 来实现对打包后的配置文件的加载

小结一下获取配置文件这一步骤，通过入口方法 `loadConfigFromFile` 加载配置文件，经过获取配置文件的路径，判断配置文件类型之后，通过 `bundleConfigFile` 方法将配置文件打包成 js 代码，再通过 `loadConfigFromBundledFile` 方法解析配置参数

![1690151318670.png](http://notesimgs.oss-cn-shanghai.aliyuncs.com/2023-07/1690151318670.png)

### 第二步：解析用户插件

在解析用户插件时，会先通过 apply 参数过滤出用户定义的插件，然后按照 pre、normal、post 获取三类用户插件

```ts
// 通过 apply 参数过滤出用户插件
const filterPlugin = (p: Plugin) => {
  if (!p) {
    return false
  } else if (!p.apply) {
    return true
  } else if (typeof p.apply === 'function') {
    return p.apply({ ...config, mode }, configEnv)
  } else {
    return p.apply === command
  }
}

// resolve plugins
const rawUserPlugins = (
  (await asyncFlatten(config.plugins || [])) as Plugin[]
).filter(filterPlugin)

// 对用户插件进行排序，获取 pre、normal、post 三类用户插件
const [prePlugins, normalPlugins, postPlugins] = sortUserPlugins(rawUserPlugins)
```

接下来根据 pre、normal、post 顺序，通过 `runConfigHook` 方法执行用户定义的插件

```ts
const userPlugins = [...prePlugins, ...normalPlugins, ...postPlugins]
config = await runConfigHook(config, userPlugins, configEnv)

async function runConfigHook(
  config: InlineConfig,
  plugins: Plugin[],
  configEnv: ConfigEnv
): Promise<InlineConfig> {
  let conf = config

  for (const p of getSortedPluginsByHook('config', plugins)) {
    const hook = p.config
    const handler = hook && 'handler' in hook ? hook.handler : hook
    if (handler) {
      const res = await handler(conf, configEnv)
      if (res) {
        conf = mergeConfig(conf, res)
      }
    }
  }

  return conf
}
```

这一步相对比较简单，就是获取用户定义的插件，然后依次执行就好

![1690152523738.png](http://notesimgs.oss-cn-shanghai.aliyuncs.com/2023-07/1690152523738.png)

### 第三步：加载环境变量

加载环境变量的第一步是先通过 `normalizePath` 方法获取到环境变量文件地址，然后通过 `loadEnv` 方法获取环境变量

```ts
// 获取环境变量文件地址
const envDir = config.envDir
  ? normalizePath(path.resolve(resolvedRoot, config.envDir))
  : resolvedRoot
// 加载环境变量配置
const userEnv = loadEnv(mode, envDir, resolveEnvPrefix(config))
```

`loadEnv` 方法首先会读取 `.env` 文件配置，按照 `.env` -> `.env.local` -> `.env.[mode]` -> `.env.[mode].local` 的顺序依次读取配置文件，然后会读取 `process.env` 的配置

需要注意的是，不论是 `.env` 配置还是 `process.env` 配置，都需要以 VITE\_ 开头

```ts
export function loadEnv(
  mode: string,
  envDir: string,
  prefixes: string | string[] = 'VITE_'
): Record<string, string> {
  prefixes = arraify(prefixes)
  const env: Record<string, string> = {}
  const envFiles = [
    /** default file */ `.env`,
    /** local file */ `.env.local`,
    /** mode file */ `.env.${mode}`,
    /** mode local file */ `.env.${mode}.local`,
  ]

  // 解析 .env 文件配置
  const parsed = Object.fromEntries(
    envFiles.flatMap((file) => {
      const filePath = path.join(envDir, file)
      if (!tryStatSync(filePath)?.isFile()) return []

      return Object.entries(parse(fs.readFileSync(filePath)))
    })
  )
  expand({ parsed })

  // 依次读取 .env 文件配置, .env.local 文件配置, .env.[mode] 文件配置, .env.[mode].local 文件配置，需要以 VITE_ 开头
  for (const [key, value] of Object.entries(parsed)) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      env[key] = value
    }
  }

  // 读取 process.env 配置,需要以 VITE_ 开头
  for (const key in process.env) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      env[key] = process.env[key] as string
    }
  }

  return env
}
```

![1690169524529.png](http://notesimgs.oss-cn-shanghai.aliyuncs.com/2023-07/1690169524529.png)

### 第四步：构建解析对象

最终返回的 resolved 解析对象有非常多的属性和方法，这里单独介绍两个和依赖预构建相关的属性

第一个 cacheDir 是预构建产物缓存的目录，顺序为：自定义 cacheDir 配置 -> `node_modules/.vite` 目录 -> `.vite` 目录

```ts
// 解析依赖预构建的缓存目录
const cacheDir = normalizePath(
  config.cacheDir
    ? path.resolve(resolvedRoot, config.cacheDir)
    : pkgDir
      ? path.join(pkgDir, `node_modules/.vite`)
      : path.join(resolvedRoot, `.vite`)
)
```

第二个 `createResolver` 方法会创建一个创建模块解析器，用于解析模块的依赖关系和别名，处理依赖预构建，对于别名解析和实际模块解析会使用不同的 pluginContaier，最后统一调用插件容器的 resolveId 方法获取解析结果

```ts
const createResolver: ResolvedConfig['createResolver'] = (options) => {
  let aliasContainer: PluginContainer | undefined
  let resolverContainer: PluginContainer | undefined
  return async (id, importer, aliasOnly, ssr) => {
    let container: PluginContainer
    // 别名解析和实际模块解析使用不同的 container
    if (aliasOnly) {
      // 新建别名 container
      container =
        aliasContainer ||
        (aliasContainer = await createPluginContainer({
          ...resolved,
          plugins: [aliasPlugin({ entries: resolved.resolve.alias })],
        }))
    } else {
      // 新建解析 container
      container =
        resolverContainer ||
        (resolverContainer = await createPluginContainer({
          ...resolved,
          plugins: [
            aliasPlugin({ entries: resolved.resolve.alias }),
            resolvePlugin({
              ...resolved.resolve,
              root: resolvedRoot,
              isProduction,
              isBuild: command === 'build',
              ssrConfig: resolved.ssr,
              asSrc: true,
              preferRelative: false,
              tryIndex: true,
              ...options,
              idOnly: true,
            }),
          ],
        }))
    }
    return (
      // 调用插件容器的 resolveId 方法来查找给定模块 ID 的解析结果
      (
        await container.resolveId(id, importer, {
          ssr,
          scan: options?.scan,
        })
      )?.id
    )
  }
}
```

然后会创建一个 resolvedConfig 对象，resolvedConfig 包含在配置文件解析过程中新增的属性和方法，最后将 config 和 resolvedConfig 统一汇总到 resolved 对象

```ts
const resolvedConfig: ResolvedConfig = {
  // 配置文件的路径
  configFile: configFile ? normalizePath(configFile) : undefined,
  // 配置文件依赖的文件路径列表
  configFileDependencies: configFileDependencies.map((name) =>
    normalizePath(path.resolve(name))
  ),
  // 内联的配置对象（命令行配置）
  inlineConfig,
  // 项目根目录的绝对路径
  root: resolvedRoot,
  // 项目的基础路径
  base: resolvedBase.endsWith('/') ? resolvedBase : resolvedBase + '/',
  rawBase: resolvedBase, // 未经处理的项目基础路径
  // 模块解析选项
  resolve: resolveOptions,
  // 公共目录的绝对路径
  publicDir: resolvedPublicDir,
  // 缓存目录的绝对路径
  cacheDir,
  // 命令行命令
  command,
  // 运行模式（开发模式或生产模式）
  mode,
  // 是否作为 worker 运行
  isWorker: false,
  // 主配置文件，当前版本无效
  mainConfig: null,
  // 是否是生产环境
  isProduction,
  // 用户配置的插件列表
  plugins: userPlugins,
  // CSS 配置选项
  css: resolveCSSOptions(config.css),
  // esbuild 配置选项
  esbuild:
    config.esbuild === false
      ? false
      : {
          jsxDev: !isProduction,
          ...config.esbuild,
        },
  // 服务器配置选项
  server,
  // 构建配置选项
  build: resolvedBuildOptions,
  // 预览配置选项
  preview: resolvePreviewOptions(config.preview, server),
  // 环境变量目录的绝对路径
  envDir,
  // 环境变量的映射对象
  env: {
    ...userEnv,
    BASE_URL,
    MODE: mode,
    DEV: !isProduction,
    PROD: isProduction,
  },
  // 决定是否包含在构建的资源文件列表中
  assetsInclude(file: string) {
    return DEFAULT_ASSETS_RE.test(file) || assetsFilter(file)
  },
  // 日志记录器
  logger,
  // 包缓存
  packageCache,
  // 创建模块解析器的函数
  createResolver,
  // 优化依赖的选项
  optimizeDeps: {
    disabled: 'build',
    ...optimizeDeps,
    esbuildOptions: {
      preserveSymlinks: resolveOptions.preserveSymlinks,
      ...optimizeDeps.esbuildOptions,
    },
  },
  // Worker 配置选项
  worker: resolvedWorkerOptions,
  // 应用类型（SPA 或 SSR）
  appType: config.appType ?? (middlewareMode === 'ssr' ? 'custom' : 'spa'),
  // 获取排序后的插件列表的函数
  getSortedPlugins: undefined!,
  // 获取排序后的插件钩子列表的函数
  getSortedPluginHooks: undefined!,
}

// 解析后的对象统一放入 resolved 中
const resolved: ResolvedConfig = {
  ...config,
  ...resolvedConfig,
}
```

![1690170044452.png](http://notesimgs.oss-cn-shanghai.aliyuncs.com/2023-07/1690170044452.png)

### 第五步：解析插件流水线

这一步首先首先通过 `resolvePlugins` 方法收集执行过程所有插件，主要分为五类插件

1. 别名插件
2. 用户自定义 pre 插件(带有`enforce: "pre"`属性)
3. vite 核心插件
4. Vite 生产环境插件 & 用户插件(带有 `enforce: "post"`属性)
5. 开发特有插件

```ts
// 目录：packages/vite/src/node/plugins/index.ts

export async function resolvePlugins(
  config: ResolvedConfig,
  prePlugins: Plugin[],
  normalPlugins: Plugin[],
  postPlugins: Plugin[]
): Promise<Plugin[]> {
  const isBuild = config.command === 'build'
  const isWatch = isBuild && !!config.build.watch
  const buildPlugins = isBuild
    ? await (await import('../build')).resolveBuildPlugins(config)
    : { pre: [], post: [] }
  const { modulePreload } = config.build

  return [
    ...(isDepsOptimizerEnabled(config, false) ||
    isDepsOptimizerEnabled(config, true)
      ? [
          isBuild
            ? optimizedDepsBuildPlugin(config)
            : optimizedDepsPlugin(config),
        ]
      : []),
    isWatch ? ensureWatchPlugin() : null,
    isBuild ? metadataPlugin() : null,
    watchPackageDataPlugin(config.packageCache),
    // ===== 1. 别名插件 =====
    preAliasPlugin(config),
    aliasPlugin({ entries: config.resolve.alias }),
    // ===== 2. 用户自定义 pre 插件(带有`enforce: "pre"`属性) =====
    ...prePlugins,
    // ===== 3. vite 核心插件 =====
    modulePreload === true ||
    (typeof modulePreload === 'object' && modulePreload.polyfill)
      ? modulePreloadPolyfillPlugin(config)
      : null,
    resolvePlugin({
      ...config.resolve,
      root: config.root,
      isProduction: config.isProduction,
      isBuild,
      packageCache: config.packageCache,
      ssrConfig: config.ssr,
      asSrc: true,
      getDepsOptimizer: (ssr: boolean) => getDepsOptimizer(config, ssr),
      shouldExternalize:
        isBuild && config.build.ssr && config.ssr?.format !== 'cjs'
          ? (id, importer) => shouldExternalizeForSSR(id, importer, config)
          : undefined,
    }),
    htmlInlineProxyPlugin(config),
    cssPlugin(config),
    config.esbuild !== false ? esbuildPlugin(config) : null,
    jsonPlugin(
      {
        namedExports: true,
        ...config.json,
      },
      isBuild
    ),
    wasmHelperPlugin(config),
    webWorkerPlugin(config),
    assetPlugin(config),
    ...normalPlugins,
    wasmFallbackPlugin(),
    // ===== 4. Vite 生产环境插件 & 用户插件(带有 `enforce: "post"`属性) =====
    definePlugin(config),
    cssPostPlugin(config),
    isBuild && buildHtmlPlugin(config),
    workerImportMetaUrlPlugin(config),
    assetImportMetaUrlPlugin(config),
    ...buildPlugins.pre,
    dynamicImportVarsPlugin(config),
    importGlobPlugin(config),
    ...postPlugins,
    ...buildPlugins.post,
    // ===== 6. 开发特有插件 =====
    ...(isBuild
      ? []
      : [clientInjectionsPlugin(config), importAnalysisPlugin(config)]),
  ].filter(Boolean) as Plugin[]
}
```

获取所有插件之后，通过 `createPluginHookUtils` 方法添加插件操作工具函数，主要是获取排序后的插件和排序后的插件 hooks，这里单独封装的目的主要是将获取结果放到缓存中，提升性能

```ts
export function createPluginHookUtils(
  plugins: readonly Plugin[]
): PluginHookUtils {
  const sortedPluginsCache = new Map<keyof Plugin, Plugin[]>()

  // 获取排序后的插件
  function getSortedPlugins(hookName: keyof Plugin): Plugin[] {
    if (sortedPluginsCache.has(hookName))
      return sortedPluginsCache.get(hookName)!
    const sorted = getSortedPluginsByHook(hookName, plugins)
    sortedPluginsCache.set(hookName, sorted)
    return sorted
  }
  // 获取排序后插件 hooks
  function getSortedPluginHooks<K extends keyof Plugin>(
    hookName: K
  ): NonNullable<HookHandler<Plugin[K]>>[] {
    const plugins = getSortedPlugins(hookName)
    return plugins
      .map((p) => {
        const hook = p[hookName]!
        return typeof hook === 'object' && 'handler' in hook
          ? hook.handler
          : hook
      })
      .filter(Boolean)
  }

  return {
    getSortedPlugins,
    getSortedPluginHooks,
  }
}
```

最后再通过 `Promise.all` 方法，按顺序执行执行所有插件的 configResolved 钩子

```ts
await Promise.all([
  ...resolved
    .getSortedPluginHooks('configResolved')
    .map((hook) => hook(resolved)),
  ...resolvedConfig.worker
    .getSortedPluginHooks('configResolved')
    .map((hook) => hook(workerResolved)),
])
```

![1690256650892.png](http://notesimgs.oss-cn-shanghai.aliyuncs.com/2023-07/1690256650892.png)

## 总结

最后总结一下 vite 解析配置文件的全过程，一共分为五个步骤

1. 加载配置文件：获取配置文件路径后，通过 EsBuild 将配置文件打包成 js 代码，并根据配置文件是 ESM 还是 CommonJS 进行不同的解析操作
2. 解析用户插件：过滤出用户插件之后，依次执行用户插件的 config 钩子
3. 加载环境变量：依次加载 `.env` 配置文件和 `process.env` 中以 VITE\_ 开头的环境变量
4. 构建解析对象：包含配置文件解析过程中新增的属性和方法
5. 解析插件流水线：获取所有插件后，并行执行插件的 configResolved 钩子

![1690257273430.png](http://notesimgs.oss-cn-shanghai.aliyuncs.com/2023-07/1690257273430.png)
