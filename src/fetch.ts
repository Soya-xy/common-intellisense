import { existsSync } from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { createFakeProgress, getConfiguration, getLocale, getRootPath, message } from '@vscode-use/utils'
import { ofetch } from 'ofetch'
import { latestVersion } from '@simon_he/latest-version'
import { fetchFromCjs } from '@simon_he/fetch-npm-cjs'
import { componentsReducer, propsReducer } from './ui/utils'
import { logger } from './ui-find'

const prefix = '@common-intellisense/'

export const cacheFetch = new Map()
export const localCacheUri = path.resolve(__dirname, 'mapping.json')
let isCommonIntellisenseInProgress = false
let isRemoteUrisInProgress = false
let isLocalUrisInProgress = false
const retry = 3
const timeout = 600000 // 如果 10 分钟拿不到就认为是 proxy 问题
const isZh = getLocale()?.includes('zh')
const { fetch } = fetchFromCjs(cacheFetch)
export const getLocalCache = new Promise((resolve) => {
  if (existsSync(localCacheUri)) {
    fsp.readFile(localCacheUri, 'utf-8').then((res) => {
      logger.info(isZh ? `正在读取 ${localCacheUri} 中的数据` : `Reading data from ${localCacheUri}`)
      try {
        const oldMap = JSON.parse(res) as [string, string][]
        oldMap.forEach(([key, value]) => {
          if (value)
            cacheFetch.set(key, value)
        })
      }
      catch (error) {
        logger.error(String(error))
      }
      resolve('done reading')
      // 列出已有的 key
      const cacheKey = Array.from(cacheFetch.keys()).join(' | ')
      logger.info(isZh ? `缓存读取完毕, 已缓存的 key: ${cacheKey}` : `Cache read complete, cached keys: ${cacheKey}`)
    })
  }
  else {
    resolve('done reading')
  }
})

// todo: add result type replace any
export async function fetchFromCommonIntellisense(tag: string) {
  const name = prefix + tag
  let version = ''
  logger.info(isZh ? `正在查找 ${name} 的最新版本...` : `Looking for the latest version of ${name}...`)
  try {
    version = await latestVersion(name, { cwd: getRootPath(), timeout: 5000, concurrency: 3 })
  }
  catch (error: any) {
    if (error.message.includes('404 Not Found')) {
      // 说明这个版本还未支持, 可以通过 issue 提出
      logger.error(isZh ? `当前版本并未支持` : `The current version is not supported`)
    }
    else {
      logger.error(String(error))
    }
    return
  }

  logger.info(isZh ? `找到 ${name} 的最新版本: ${version}` : `Found the latest version of ${name}: ${version}`)
  const key = `${name}@${version}`
  // 当版本修改是否要删除相同 name 下的其它版本缓存？
  if (isCommonIntellisenseInProgress)
    return

  let resolver: () => void = () => { }
  let rejecter: (msg?: string) => void = () => { }
  isCommonIntellisenseInProgress = true
  if (!cacheFetch.has(key)) {
    createFakeProgress({
      title: isZh ? `正在拉取远程的 ${tag}` : `Pulling remote ${tag}`,
      message: v => isZh ? `已完成 ${v}%` : `Completed ${v}%`,
      callback: (resolve, reject) => {
        resolver = resolve
        rejecter = reject
      },
    })
  }

  try {
    if (cacheFetch.has(key)) {
      logger.info(isZh ? `已缓存的 ${key}` : `cachedKey: ${key}`)
    }
    else {
      logger.info(isZh ? `准备拉取的资源: ${key}` : `ready fetchingKey: ${key}`)
    }

    const moduleExports = await fetch({
      name,
      retry,
      timeout,
      version,
    })

    const result: any = {}
    for (const key in moduleExports) {
      const v = moduleExports[key]
      if (key.endsWith('Components')) {
        result[key] = () => componentsReducer(v(isZh))
      }
      else {
        result[key] = () => propsReducer(v())
      }
    }
    resolver()
    isCommonIntellisenseInProgress = false
    return result
  }
  catch (error) {
    rejecter(String(error))
    logger.error(String(error))
    isCommonIntellisenseInProgress = false
    // 尝试从本地获取
    message.error(isZh ? `从远程拉取 UI 包失败 ☹️，请检查代理` : `Failed to pull UI package from remote ☹️, please check the proxy`)
    return fetchFromLocalUris()
    // todo：增加重试机制
  }
}

const tempCache = new Map()
export async function fetchFromRemoteUrls() {
  // 读取 urls
  const uris = getConfiguration('common-intellisense.remoteUris') as string[]
  if (!uris.length)
    return

  const result: any = {}

  if (isRemoteUrisInProgress)
    return

  const fixedUris = (await Promise.all(uris.map(async (name) => {
    const key = `remote-uri:${name}`
    if (tempCache.has(key))
      return ''
    tempCache.set(key, true)
    return name
  }))).filter(Boolean)

  if (!fixedUris.length)
    return

  let resolver: () => void = () => { }
  let rejecter: (msg?: string) => void = () => { }
  isRemoteUrisInProgress = true
  createFakeProgress({
    title: isZh ? `正在拉取远程文件` : 'Pulling remote files',
    message: v => isZh ? `已完成 ${v}%` : `Completed ${v}%`,
    callback(resolve, reject) {
      resolver = resolve
      rejecter = reject
    },
  })
  logger.info(isZh ? '从 remoteUris 中拉取数据...' : 'Fetching data from remoteUris...')
  try {
    const scriptContents = await Promise.all(fixedUris.map(async (uri) => {
      logger.info(isZh ? `正在加载 ${uri}` : `Loading ${uri}`)
      return [uri, cacheFetch.has(uri) ? cacheFetch.get(uri) : await ofetch(uri, { responseType: 'text', retry, timeout })]
    }))
    scriptContents.forEach(([uri, scriptContent]) => {
      const module: any = {}
      const runModule = new Function('module', scriptContent)
      if (scriptContent)
        cacheFetch.set(uri, scriptContent)
      runModule(module)
      const moduleExports = module.exports
      const temp: any = {}
      const isZh = getLocale()!.includes('zh')
      for (const key in moduleExports) {
        const v = moduleExports[key]
        if (key.endsWith('Components')) {
          temp[key] = () => componentsReducer(v(isZh))
        }
        else {
          temp[key] = () => propsReducer(v())
        }
      }
      Object.assign(result, temp)
    })
    resolver()
  }
  catch (error) {
    rejecter(String(error))
    logger.error(String(error))
  }
  isRemoteUrisInProgress = false

  return result
}

export async function fetchFromRemoteNpmUrls() {
  // 读区 urls
  const uris = getConfiguration('common-intellisense.remoteNpmUris') as ({ name: string, resource?: string } | string)[]
  if (!uris.length)
    return

  const result: any = {}

  if (isRemoteUrisInProgress)
    return

  const fixedUris = (await Promise.all(uris.map(async (item) => {
    let name = ''
    let resource = ''
    if (typeof item === 'string') {
      name = item
    }
    else {
      name = item.name
      resource = item.resource || ''
    }
    let version = ''
    logger.info(isZh ? `正在查找 ${name} 的最新版本...` : `Looking for the latest version of ${name}...`)
    try {
      version = await latestVersion(name, { cwd: getRootPath(), timeout: 5000, concurrency: 3 })
    }
    catch (error: any) {
      if (error.message.includes('404 Not Found')) {
        // 说明这个版本还未支持, 可以通过 issue 提出
        logger.error(isZh ? `当前版本并未支持` : `The current version is not supported`)
      }
      else {
        logger.error(String(error))
      }
    }
    const key = `remote-npm-uri:${name}`
    const cachedVersion = tempCache.get(key)
    if (cachedVersion === version)
      return ''
    tempCache.set(key, version)
    return [name, version, resource]
  }))).filter(Boolean) as [string, string, undefined | string][]

  if (!fixedUris.length)
    return

  let resolver: () => void = () => { }
  let rejecter: (msg?: string) => void = () => { }
  isRemoteUrisInProgress = true

  createFakeProgress({
    title: isZh ? `正在拉取远程 NPM 文件` : 'Pulling remote NPM files',
    message: v => isZh ? `已完成 ${v}%` : `Completed ${v}%`,
    callback(resolve, reject) {
      resolver = resolve
      rejecter = reject
    },
  })
  logger.info(isZh ? '从 remoteNpmUris 中拉取数据...' : 'Fetching data from remoteNpmUris...')

  try {
    (await Promise.all(fixedUris.map(([name, version, privateResource]) => {
      const key = `${name}@${version}`
      if (cacheFetch.has(key)) {
        const scriptContent = cacheFetch.get(key)
        const module: any = {}
        const runModule = new Function('module', scriptContent)
        runModule(module)
        return module.exports
      }
      return fetch({ name, version, privateResource })
    }))).forEach((moduleExports) => {
      const temp: any = {}
      const isZh = getLocale()!.includes('zh')
      for (const key in moduleExports) {
        const v = moduleExports[key]
        if (key.endsWith('Components')) {
          temp[key] = () => componentsReducer(v(isZh))
        }
        else {
          temp[key] = () => propsReducer(v())
        }
      }
      Object.assign(result, temp)
    })
    resolver()
  }
  catch (error) {
    rejecter(String(error))
    logger.error(String(error))
  }
  isRemoteUrisInProgress = false

  return result
}

export async function fetchFromLocalUris() {
  let uris = getConfiguration('common-intellisense.localUris') as string[]
  if (!uris.length)
    return
  logger.info(`localUris: ${uris}`)
  // 查找本地文件 是否存在
  uris = uris.map((uri) => {
    // 如果是相对路径，转换为绝对路径，否则直接用
    if (uri.startsWith('./'))
      uri = path.resolve(getRootPath()!, uri)

    if (cacheFetch.has(uri) || existsSync(uri)) {
      return uri
    }
    else {
      logger.error(isZh ? `加载本地文件不存在: [${uri}]` : `Local file does not exist: [${uri}]`)
      return false
    }
  }).filter(Boolean) as string[]

  if (!uris.length)
    return

  const result: any = {}
  if (isLocalUrisInProgress)
    return
  let resolver!: () => void
  let rejecter!: (msg?: string) => void
  isLocalUrisInProgress = true
  createFakeProgress({
    title: isZh ? `正在加载本地文件` : 'Loading local files',
    message: v => isZh ? `已完成 ${v}%` : `Completed ${v}%`,
    callback(resolve, reject) {
      resolver = resolve
      rejecter = reject
    },
  })
  try {
    await Promise.all(uris.map(async (uri) => {
      if (cacheFetch.has(uri)) {
        Object.assign(result, cacheFetch.get(uri))
        return
      }
      const module: any = {}
      const scriptContent = await fsp.readFile(uri, 'utf-8')
      if (scriptContent)
        cacheFetch.set(uri, scriptContent)
      const runModule = new Function('module', scriptContent)
      runModule(module)
      const moduleExports = module.exports
      const temp: any = {}
      const isZh = getLocale()!.includes('zh')
      for (const key in moduleExports) {
        const v = moduleExports[key]
        if (key.endsWith('Components')) {
          temp[key] = () => componentsReducer(v(isZh))
        }
        else {
          temp[key] = () => propsReducer(v())
        }
      }
      Object.assign(result, temp)
    }))
    resolver()
  }
  catch (error) {
    rejecter(String(error))
    logger.error(String(error))
  }

  isLocalUrisInProgress = false
  return result
}
