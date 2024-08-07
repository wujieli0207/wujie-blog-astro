---
title: 秒启动的基石，vite 依赖预构建的原理
excerpt: 秒启动的基石，vite 依赖预构建的原理
publishDate: '2023-07-30'
tags:
  - front-end-tech
seo:
  image:
    src: '/front-end-tech.jpg'
    alt: 秒启动的基石，vite 依赖预构建的原理
---

vite 在开发环境能够做到秒启动的原因有两个

- No Bundle：即跳过打包，通过浏览器 ESModule 解析源文件
- 依赖预构建：将常用依赖提前编译和处理，从而在启动阶段大大减少了开销

依赖预构建不仅能实现 vite 的秒启动，还能够兼容 CommonJS 的依赖产物、合并 ESModule 多个模块，下面就展开讲讲 vite 依赖预构建的实现原理

## 实现原理

依赖预构建的核心方法是 `optimizeDeps` ，在 `packages/vite/src/node/optimizer/index.ts` 文件下，主要有 4 个实现步骤

1. 缓存判断，命中缓存直接返回
2. 依赖扫描
3. 添加依赖到优化列表
4. 执行依赖打包

可以看到实现步骤非常清晰，下面就具体分析每一步的实现原理

```ts
export async function optimizeDeps(
  config: ResolvedConfig,
  force = config.optimizeDeps.force,
  asCommand = false
): Promise<DepOptimizationMetadata> {
  // 第一步：缓存判断,命中缓存直接返回
  const cachedMetadata = await loadCachedDepOptimizationMetadata(config, force, asCommand)
  if (cachedMetadata) {
    return cachedMetadata
  }

  // 第二步：依赖扫描
  const deps = await discoverProjectDependencies(config).result

  // 第三步：添加依赖到优化列表
  await addManuallyIncludedOptimizeDeps(deps, config)

  const depsInfo = toDiscoveredDependencies(config, deps)

  // 第四步：执行依赖打包
  const result = await runOptimizeDeps(config, depsInfo).result
  await result.commit()

  // 返回打包 meta 信息，后续写入 _metadata.json
  return result.metadata
}
```

### 第一步：缓存判断

通过 `loadCachedDepOptimizationMetadata` 方法判断预构建的缓存 meta 信息是否存在，meta 信息都统一保存在 \_meta.json 文件中

缓存判断的实现步骤如下

1. 通过 `cleanupDepsCacheStaleDirs` 方法，清理异常退出或执行中断的缓存目录，放在 setTimeout 中异步执行是为了确保加载缓存数据之前，所有残留的缓存目录都已经被清理，保证缓存的一致性和正确性
2. 通过 `getDepsCacheDir` 获取缓存依赖路径，也就是 \_metadata.json 文件所在的文件路径
3. 通过 `parseDepsOptimizerMetadata` 方法解析 meta 数据和依赖预构建缓存 optimized 相关的数据
4. 将 meta 数据中的 hash 和 `getDepHash` 依赖获取的 hash 值做对比，如果相同说明命中缓存，直接返回 meta 信息，如果不相同，则移除掉 \_metadata.json 文件，准备刷新缓存

```ts
export async function loadCachedDepOptimizationMetadata(
  config: ResolvedConfig,
  ssr: boolean,
  force = config.optimizeDeps.force,
  asCommand = false
): Promise<DepOptimizationMetadata | undefined> {
  if (firstLoadCachedDepOptimizationMetadata) {
    firstLoadCachedDepOptimizationMetadata = false
    // 清理异常退出残留的依赖处理目录
    setTimeout(() => cleanupDepsCacheStaleDirs(config), 0)
  }

  // 获取缓存依赖路径
  const depsCacheDir = getDepsCacheDir(config, ssr)

  if (!force) {
    let cachedMetadata: DepOptimizationMetadata | undefined
    try {
      // 获取 _metadata.json 文件所在路径
      const cachedMetadataPath = path.join(depsCacheDir, '_metadata.json')
      // 解析 meta 数据
      cachedMetadata = parseDepsOptimizerMetadata(
        await fsp.readFile(cachedMetadataPath, 'utf-8'),
        depsCacheDir
      )
    } catch (e) {}
    // 命中缓存，直接读取缓存 mata 信息
    if (cachedMetadata && cachedMetadata.hash === getDepHash(config, ssr)) {
      return cachedMetadata
    }
  }

  // 移除文件，准备刷新缓存
  await fsp.rm(depsCacheDir, { recursive: true, force: true })
}
```

`getDepHash` 方法需要展开讲讲，影响缓存 hash 变化的主要有两个方面：lock 文件和配置文件，lock 文件内部记录着依赖的具体信息，如果发生变化自然需要重新构建。另一方面配置文件中的一些参数会影响依赖预构建的方式，如果变化的话同样也需要重新构建

目前 vite 支持的 npm、yarn、pnpm、bun 作为依赖管理工具，bun 是一个更快速的依赖编译和解析工具，这里提供一篇[文章](https://www.51cto.com/article/714560.html)作为参考

影响预构建的配置有以下几个配置

- mode：开发 / 生产环境
- root：项目根路径
- resolve：路径解析配置
- buildTarget：最终构建的浏览器兼容目标，比如 es2020，edge88 等等
- assetsInclude：自定义资源类型
- plugins：插件配置
- optimizeDeps：预构建配置

将 lock 文件中的依赖和配置参数合并之后，通过 crypto 的 `createHash` 方法生成当前依赖和配置的最终 hash

```ts
export function getDepHash(config: ResolvedConfig, ssr: boolean): string {
  const lockfilePath = lookupFile(config.root, lockfileNames)
  // 获取 lock 文件内容
  let content = lockfilePath ? fs.readFileSync(lockfilePath, 'utf-8') : ''
  if (lockfilePath) {
    const lockfileName = path.basename(lockfilePath)
    const { checkPatches } = lockfileFormats.find((f) => f.name === lockfileName)!
    if (checkPatches) {
      const fullPath = path.join(path.dirname(lockfilePath), 'patches')
      const stat = tryStatSync(fullPath)
      if (stat?.isDirectory()) {
        content += stat.mtimeMs.toString()
      }
    }
  }

  const optimizeDeps = getDepOptimizationConfig(config, ssr)
  // 增加会影响依赖预构建的配置
  content += JSON.stringify(
    {
      // 开发 / 生产环境
      mode: process.env.NODE_ENV || config.mode,
      // 项目根路径
      root: config.root,
      // 路径解析配置
      resolve: config.resolve,
      // 最终构建的浏览器兼容目标
      buildTarget: config.build.target,
      // 自定义资源类型
      assetsInclude: config.assetsInclude,
      // 插件
      plugins: config.plugins.map((p) => p.name),
      // 预构建配置
      optimizeDeps: {
        include: optimizeDeps?.include,
        exclude: optimizeDeps?.exclude,
        esbuildOptions: {
          ...optimizeDeps?.esbuildOptions,
          plugins: optimizeDeps?.esbuildOptions?.plugins?.map((p) => p.name),
        },
      },
    },
    // 特殊正则和函数类型
    (_, value) => {
      if (typeof value === 'function' || value instanceof RegExp) {
        return value.toString()
      }
      return value
    }
  )
  // 通过调用 crypto 的 createHash 方法生成哈希
  return getHash(content)
}
```

### 第二步：依赖扫描

在第一步没有命中缓存之后，接下来这一步就要开始扫描有哪些依赖，`discoverProjectDependencies` 方法比较简单，核心在于通过 `scanImports` 方法获取依赖扫描的结果

```ts
export function discoverProjectDependencies(config: ResolvedConfig): {
  cancel: () => Promise<void>
  result: Promise<Record<string, string>>
} {
  // 获取依赖扫描结果
  const { cancel, result } = scanImports(config)

  return {
    cancel,
    result: result.then(({ deps, missing }) => {
      return deps
    }),
  }
}
```

`scanImports` 方法主要分为三步

1. 通过 `computeEntries` 方法寻找入口
2. 通过 `prepareEsbuildScanner` 方法执行依赖扫描，建立 esbuild 上下文
3. 执行 esbuild 上下文的 `rebuild` 方法，获取依赖扫描结果

```ts
export function scanImports(config: ResolvedConfig): {
  cancel: () => Promise<void>
  result: Promise<{
    deps: Record<string, string>
    missing: Record<string, string>
  }>
} {
  const deps: Record<string, string> = {}
  const missing: Record<string, string> = {}
  let entries: string[]

  const scanContext = { cancelled: false }

  // 第一步：寻找入口
  const esbuildContext: Promise<BuildContext | undefined> = computeEntries(config).then(
    (computedEntries) => {
      entries = computedEntries

      if (scanContext.cancelled) return

      // 第二步：使用 Esbuild 执行依赖扫描
      return prepareEsbuildScanner(config, entries, deps, missing, scanContext)
    }
  )

  const result = esbuildContext.then((context) => {
    return context.rebuild().then(() => {
      return {
        deps: orderedDependencies(deps),
        missing,
      }
    })
  })

  return {
    cancel: async () => {
      scanContext.cancelled = true
      return esbuildContext.then((context) => context?.cancel())
    },
    result,
  }
}
```

第一步 `computeEntries` 方法用于寻找依赖扫描的入口，按照以下三个顺序寻找

- 首先从 optimizeDeps.entries 中获取入口，支持 glob 语法
- 其次从 build.rollupOptions.input 中获取入口，同时兼容字符串、数组、对象配置方式
- 最后是兜底逻辑，没有配置入口，默认从根目录寻找

```ts
async function computeEntries(config: ResolvedConfig) {
  let entries: string[] = []

  const explicitEntryPatterns = config.optimizeDeps.entries
  const buildInput = config.build.rollupOptions?.input

  // 先从 optimizeDeps.entries 中获取入口，支持 glob 语法
  if (explicitEntryPatterns) {
    entries = await globEntries(explicitEntryPatterns, config)
  }
  // 其次从 build.rollupOptions?.input 中获取入口，兼容数组和对象
  else if (buildInput) {
    const resolvePath = (p: string) => path.resolve(config.root, p)
    if (typeof buildInput === 'string') {
      entries = [resolvePath(buildInput)]
    } else if (Array.isArray(buildInput)) {
      entries = buildInput.map(resolvePath)
    } else if (isObject(buildInput)) {
      entries = Object.values(buildInput).map(resolvePath)
    }
  } else {
    // 兜底逻辑，如果没有配置，自动从根目录寻找
    entries = await globEntries('**/*.html', config)
  }

  entries = entries.filter((entry) => isScannable(entry) && fs.existsSync(entry))

  return entries
}
```

第二步 `prepareEsbuildScanner` 中，通过 `esbuildScanPlugin` 方法通过定义 esbuild 插件的形式，定义在扫描过程中需要的文件处理，比如

- 支持 对 html、vue、svelte、astro(一种新兴的类 html 语法) 四种后缀的入口文件进行了解析
- 支持对 bare import 场景的处理逻辑
- external 规则处理，排除不需要扫描的依赖

最后利用 esbuild 的 `context` 方法，将相对路径解析为决定路径的上下文环境，此时的产物是不写入磁盘的，能够节省 IO 的时间

```ts
async function prepareEsbuildScanner(
  config: ResolvedConfig,
  entries: string[],
  deps: Record<string, string>,
  missing: Record<string, string>,
  scanContext?: { cancelled: boolean }
): Promise<BuildContext | undefined> {
  const container = await createPluginContainer(config)

  if (scanContext?.cancelled) return

  // 扫描需要用到的 Esbuild 插件
  const plugin = esbuildScanPlugin(config, container, deps, missing, entries)

  const { plugins = [], ...esbuildOptions } = config.optimizeDeps?.esbuildOptions ?? {}

  return await esbuild.context({
    absWorkingDir: process.cwd(),
    write: false, // ! 产物不写入磁盘，节省 IO 时间
    stdin: {
      contents: entries.map((e) => `import ${JSON.stringify(e)}`).join('\n'),
      loader: 'js',
    },
    bundle: true,
    format: 'esm',
    logLevel: 'silent',
    plugins: [...plugins, plugin],
    ...esbuildOptions,
  })
}
```

最后通过 `scanImports` 方法扫描依赖的结果 result 作为整个方法的返回，至此第二步扫描依赖就结束了

### 第三步：添加依赖到优化列表

在扫描了依赖之后，接下来就需要将依赖添加到优化列表

首先会通过 `addManuallyIncludedOptimizeDeps` 方法处理在配置文件自定义添加到优化列表的依赖，也就是配置文件中的 optimizeDeps 配置，主要实现步骤如下

1. 获取配置文件中的 optimizeDeps 配置
2. 创建路径解析函数
3. 遍历需要添加的依赖数组
   1. 对依赖的 id 进行标准化处理
   2. 解析依赖路径，得到依赖入口文件路径
   3. 将满足条件的依赖放入 deps 对象

```ts
export async function addManuallyIncludedOptimizeDeps(
  deps: Record<string, string>,
  config: ResolvedConfig,
  ssr: boolean,
  extra: string[] = [],
  filter?: (id: string) => boolean
): Promise<void> {
  const { logger } = config
  // 获取配置文件中的 optimizeDeps 配置
  const optimizeDeps = getDepOptimizationConfig(config, ssr)
  const optimizeDepsInclude = optimizeDeps?.include ?? []

  if (optimizeDepsInclude.length || extra.length) {
    // 定义需要添加的依赖，排除不需要添加的依赖数组
    const includes = [...optimizeDepsInclude, ...extra]
    for (let i = 0; i < includes.length; i++) {
      const id = includes[i]
      if (glob.isDynamicPattern(id)) {
        const globIds = expandGlobIds(id, config)
        includes.splice(i, 1, ...globIds)
        i += globIds.length - 1
      }
    }

    // 创建路径解析函数
    const resolve = createOptimizeDepsIncludeResolver(config, ssr)

    // 遍历需要添加的依赖数组
    for (const id of includes) {
      // 对依赖的 id 进行标准化处理
      const normalizedId = normalizeId(id)

      if (!deps[normalizedId] && filter?.(normalizedId) !== false) {
        // 解析依赖路径，得到依赖入口文件路径
        const entry = await resolve(id)
        // 将满足条件的依赖放入 deps 对象
        if (entry) {
          if (isOptimizable(entry, optimizeDeps)) {
            if (!entry.endsWith('?__vite_skip_optimization')) {
              deps[normalizedId] = entry
            }
          }
        }
      }
    }
  }
}
```

接下来将 esbuild 扫描的依赖和配置中自定义添加的依赖通过 `toDiscoveredDependencies` 方法转化一个标准的优化列表

```ts
export function toDiscoveredDependencies(
  config: ResolvedConfig,
  deps: Record<string, string>,
  ssr: boolean,
  timestamp?: string
): Record<string, OptimizedDepInfo> {
  const browserHash = getOptimizedBrowserHash(getDepHash(config, ssr), deps, timestamp)

  const discovered: Record<string, OptimizedDepInfo> = {}

  // 遍历依赖列表，标准化为统一的对象
  for (const id in deps) {
    const src = deps[id]
    discovered[id] = {
      id,
      file: getOptimizedDepPath(id, config, ssr),
      src,
      browserHash: browserHash,
      exportsData: extractExportsData(src, config, ssr),
    }
  }
  return discovered
}
```

至此第三步将依赖添加到优化列表就结束了

### 第四步：执行依赖打包

接下来就到了最后一步，将上一步获取的依赖优化列表，通过 `runOptimizeDeps` 方法进行打包

打包过程首先通过 `prepareEsbuildOptimizerRun` 方法，准备 esbuild 的运行环境，主要步骤会遍历所有依赖，将扁平化依赖记录到 flatIdDeps。再通过 esbuild 的 `context` 方法，创建上下文，入口就是所有扁平化后的依赖路径

这里的扁平化路径的目的是用作对象的唯一 key，比如 `react/jsx-dev-runtime`，被重写为`react_jsx-dev-runtime`

```ts
async function prepareEsbuildOptimizerRun(
  resolvedConfig: ResolvedConfig,
  depsInfo: Record<string, OptimizedDepInfo>,
  ssr: boolean,
  processingCacheDir: string,
  optimizerContext: { cancelled: boolean },
): Promise<{
  context?: BuildContext
  idToExports: Record<string, ExportsData>
}> {

  // 扁平化路径依赖记录
  const flatIdDeps: Record<string, string> = {}

  // ...

  // 遍历所有依赖，将扁平化路径依赖记录到 flatIdDeps
  await Promise.all(
    Object.keys(depsInfo).map(async (id) => {
      const src = depsInfo[id].src!
      const exportsData = await(
        depsInfo[id].exportsData ?? extractExportsData(src, config, ssr),
      )
      if (exportsData.jsxLoader && !esbuildOptions.loader?.['.js']) {
        esbuildOptions.loader = {
          '.js': 'jsx',
          ...esbuildOptions.loader,
        }
      }
      // 扁平化路径，`react/jsx-dev-runtime`，被重写为`react_jsx-dev-runtime`
      const flatId = flattenId(id)
      flatIdDeps[flatId] = src
      idToExports[id] = exportsData
      flatIdToExports[flatId] = exportsData
    }),
  )

  // ...

  // 创建 esbuild 上下文，入口为所有扁平化的依赖路径
  const context = await esbuild.context({
    absWorkingDir: process.cwd(),
    entryPoints: Object.keys(flatIdDeps), // 入口
    bundle: true,
    platform,
    define,
    format: 'esm',
    target: isBuild ? config.build.target || undefined : ESBUILD_MODULES_TARGET,
    external,
    logLevel: 'error',
    splitting: true,
    sourcemap: true,
    outdir: processingCacheDir,
    ignoreAnnotations: !isBuild,
    metafile: true,
    plugins,
    charset: 'utf8',
    ...esbuildOptions,
    supported: {
      'dynamic-import': true,
      'import-meta': true,
      ...esbuildOptions.supported,
    },
  })
  return { context, idToExports }
}
```

在创建好 esbuild 上下文之后，会调用 `rebuild` 方法开始执行预构建过程，然后会经历两次遍历过程

- 首先会遍历 depsInfo 依赖信息，将重新构建的依赖信息添加到 metadata 的 optimized 部分
- 然后遍历 metadata 的文件输出路径，将非 js 文件添加到 metadata 的 chunk 部分

```ts
const runResult = preparedRun.then(({ context, idToExports }) => {
  return context.rebuild().then((result) => {
    // metadata
    const meta = result.metafile!

    // 遍历依赖信息，添加到 metadata 的 optimized 部分
    for (const id in depsInfo) {
      const output = esbuildOutputFromId(meta.outputs, id, processingCacheDir)

      const { exportsData, ...info } = depsInfo[id]
      addOptimizedDepInfo(metadata, 'optimized', {
        ...info,
        fileHash: getHash(metadata.hash + depsInfo[id].file + JSON.stringify(output.imports)),
        browserHash: metadata.browserHash,
        // 判断是否有要转换为 ESM 格式
        needsInterop: needsInterop(config, ssr, id, idToExports[id], output),
      })
    }

    // 遍历 metadata 的输出文件路径
    for (const o of Object.keys(meta.outputs)) {
      // 如果不是 js 文件
      if (!o.match(jsMapExtensionRE)) {
        const id = path.relative(processingCacheDirOutputPath, o).replace(jsExtensionRE, '')
        // 根据 id 获取构建依赖的文件路径
        const file = getOptimizedDepPath(id, resolvedConfig, ssr)
        // 如果不存在相同的文件，则将输出的文件信息放入 metadata 的 chunk 部分
        if (!findOptimizedDepInfoInRecord(metadata.optimized, (depInfo) => depInfo.file === file)) {
          addOptimizedDepInfo(metadata, 'chunks', {
            id,
            file,
            needsInterop: false,
            browserHash: metadata.browserHash,
          })
        }
      }
    }

    // ! 注意到此时返回的是 succesfulResult
    return succesfulResult
  })
})
```

在执行完成 rebuild 操作之后，会返回一个 succesfulResult 对象，主要包含三个属性

- metadata：优化后的依赖信息，包括每个依赖的文件路径、导出信息、构建输出文件
- cancel：取消依赖预构建操作
- commit：提交预构建的优化结果，将最后结果写入 \_metadata.json 文件

```ts
const succesfulResult: DepOptimizationResult = {
  metadata,
  cancel: cleanUp,
  commit: async () => {
    committed = true
    // meta 信息写入 _metadata.json 文件
    const dataPath = path.join(processingCacheDir, '_metadata.json')
    fs.writeFileSync(dataPath, stringifyDepsOptimizerMetadata(metadata, depsCacheDir))

    // 将临时文件夹中的优化结果，重命名为全局的依赖缓存文件夹
    const temporalPath = depsCacheDir + getTempSuffix()
    const depsCacheDirPresent = fs.existsSync(depsCacheDir)
    if (isWindows) {
      if (depsCacheDirPresent) await safeRename(depsCacheDir, temporalPath)
      await safeRename(processingCacheDir, depsCacheDir)
    } else {
      if (depsCacheDirPresent) fs.renameSync(depsCacheDir, temporalPath)
      fs.renameSync(processingCacheDir, depsCacheDir)
    }

    // 删除临时路径（旧的全局依赖缓存文件夹），确保临时文件夹的清理工作在后台进行
    if (depsCacheDirPresent) fsp.rm(temporalPath, { recursive: true, force: true })
  },
}
```

最后会执行 `commit` 方法，完成依赖预构建的全部过程

```ts
// 第四步：执行依赖打包
const result = await runOptimizeDeps(config, depsInfo).result

await result.commit()

// 返回打包 meta 信息，后续写入 _metadata.json
return result.metadata
```

## 总结

最后总结一下 vite 依赖预构建的实现步骤

1. **缓存判断**：根据文件生成的 hash 和 \_metadata.json 中的记录的缓存文件 hash 进行对比，如果相同说明命中缓存
2. **依赖扫描**：获取扫描入口，使用 esbuild 进行扫描
3. **添加依赖到优化列表**：将配置文件自定义的优化依赖和扫描依赖结果添加到优化列表
4. **依赖打包**：使用 esbuild 进行依赖打包，产物写入 \_metadata.json 文件

![1690684957714.png](http://notesimgs.oss-cn-shanghai.aliyuncs.com/2023-07/1690684957714.png)
