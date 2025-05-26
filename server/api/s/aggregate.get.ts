import type { NewsItem, SourceID } from "@shared/types"
import { sources } from "@shared/sources"
import { getters } from "#/getters"
import { getCacheTable } from "#/database/cache"

// 常量配置
const TTL = 30 * 60 * 1000 // 默认TTL缓存时间：30分钟
const MAX_ITEMS_PER_SOURCE = 10 // 每个源最多返回的条目数
const MAX_AGGREGATED_ITEMS = 50 // 聚合后最多返回的条目数

// 响应状态类型定义，提高代码可读性
type ResponseStatus = "success" | "cache"

// 单个新闻源的处理结果接口
interface SourceResult {
  id: SourceID
  items: NewsItem[]
  updatedTime: number
  status: ResponseStatus
}

/**
 * 扩展的NewsItem类型，包含来源信息和处理后的时间戳
 */
interface AggregatedNewsItem extends NewsItem {
  originalSourceId: SourceID
  originalSourceName: string
  timestamp: number
}

/**
 * 更新缓存的辅助函数，减少代码重复
 */
function updateCache(cacheTable: any, sourceId: SourceID, items: NewsItem[], event: any) {
  if (!items.length) return

  const cachePromise = cacheTable.set(sourceId, items)
  if (event.context.waitUntil) {
    event.context.waitUntil(cachePromise)
  } else {
    cachePromise.catch((e: Error) => logger.error(`更新缓存失败 ${sourceId}: ${e}`))
  }
}

/**
 * 获取最新数据的通用处理函数，减少代码重复
 */
async function fetchLatestData(
  sourceId: SourceID,
  forceLatest: boolean,
  cache: any,
  cacheTable: any,
  event: any,
  now: number,
): Promise<SourceResult> {
  try {
    const newData = await getters[sourceId](forceLatest)
    const items = newData.slice(0, MAX_ITEMS_PER_SOURCE)

    // 异步更新缓存
    updateCache(cacheTable, sourceId, items, event)

    return {
      id: sourceId,
      items,
      updatedTime: now,
      status: "success",
    }
  } catch (e: unknown) {
    logger.error(`获取 ${sourceId} ${forceLatest ? "最新" : ""}数据失败: ${e instanceof Error ? e.message : String(e)}`)

    // 获取失败时，尝试使用旧缓存
    if (cache) {
      return {
        id: sourceId,
        items: cache.items,
        updatedTime: cache.updated,
        status: "cache",
      }
    }

    // 如果没有缓存，返回空数据
    return {
      id: sourceId,
      items: [],
      updatedTime: now,
      status: "success",
    }
  }
}

/**
 * 聚合多个新闻源的API
 * 接收sourceIds参数，并行获取指定新闻源数据，合并后按时间降序排序
 */
export default defineCachedEventHandler(async (event) => {
  try {
    // 1. 解析和验证参数
    const query = getQuery(event)
    const sourceIds = (query.sourceIds as string || "").split(",").filter(Boolean) as SourceID[]
    const forceLatest = query.latest === "true"

    // 输入验证
    if (!sourceIds?.length) {
      throw createError({
        statusCode: 400,
        message: "必须提供至少一个有效的sourceIds参数",
      })
    }

    const validSourceIds = sourceIds.filter(id => sources[id] && getters[id])
    if (!validSourceIds.length) {
      throw createError({
        statusCode: 400,
        message: "所有提供的sourceIds都无效",
      })
    }

    // 2. 获取缓存表
    const cacheTable = await getCacheTable()
    if (!cacheTable) {
      throw createError({
        statusCode: 500,
        message: "缓存表不可用",
      })
    }

    // 3. 获取并处理缓存数据
    const caches = await cacheTable.getEntire(validSourceIds)
    const now = Date.now()

    // 4. 准备数据获取promises
    const fetchPromises = validSourceIds.map((sourceId) => {
      const cache = caches.find(c => c.id === sourceId)

      // 如果强制获取最新数据，则始终调用getter
      if (forceLatest) {
        return fetchLatestData(sourceId, true, cache, cacheTable, event, now)
      }

      // 以下是原来的逻辑，当不需要强制刷新时使用
      // 如果在刷新间隔内，直接使用缓存
      if (cache && now - cache.updated < sources[sourceId].interval) {
        return Promise.resolve({
          id: sourceId,
          items: cache.items,
          updatedTime: now,
          status: "success" as ResponseStatus,
        })
      }

      // 如果有缓存但不在刷新间隔内，仍然使用缓存但标记为cache状态
      if (cache && now - cache.updated < TTL) {
        return Promise.resolve({
          id: sourceId,
          items: cache.items,
          updatedTime: cache.updated,
          status: "cache" as ResponseStatus,
        })
      }

      // 获取最新数据
      return fetchLatestData(sourceId, false, cache, cacheTable, event, now)
    })

    // 5. 并行获取所有源的数据
    const results = await Promise.all(fetchPromises)

    // 6. 合并并处理所有新闻条目
    const allNewsItems: AggregatedNewsItem[] = results.flatMap(({ id, items }) => {
      const sourceName = sources[id].name
      return items.map(item => ({
        ...item,
        originalSourceId: id,
        originalSourceName: sourceName,
        timestamp: getItemTimestamp(item),
      }))
    })

    // 7. 按时间戳降序排序并限制返回数量
    const sortedItems = allNewsItems
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_AGGREGATED_ITEMS)

    // 8. 返回聚合结果
    return {
      status: "success",
      sourceIds: validSourceIds,
      updatedTime: now,
      items: sortedItems,
      total: allNewsItems.length,
    }
  } catch (e: unknown) {
    // 使用错误对象获取堆栈信息以便更好地调试
    const errorMessage = e instanceof Error ? e.message : String(e)
    const errorStack = e instanceof Error ? e.stack : undefined

    logger.error(`聚合API错误: ${errorMessage}${errorStack ? `\n${errorStack}` : ""}`)

    throw createError({
      statusCode: (e as any).statusCode || 500,
      message: errorMessage,
      cause: e,
    })
  }
}, {
  // 缓存配置
  maxAge: 5 * 60, // 5分钟缓存
  getKey: (event) => {
    const query = getQuery(event)
    const sourceIds = ((query.sourceIds as string) || "").split(",").filter(Boolean).sort().join(",")
    // 修改getKey，在开启latest时返回唯一的key，保证绕过缓存
    const latestParam = query.latest === "true" ? `-latest-${Date.now()}` : ""
    return `aggregate:${sourceIds}${latestParam}`
  },
})

/**
 * 获取新闻条目的时间戳
 * 优先使用pubDate，其次是extra.date，如果都没有则使用当前时间
 */
function getItemTimestamp(item: NewsItem): number {
  if (item.pubDate) {
    return typeof item.pubDate === "number" ? item.pubDate : new Date(item.pubDate).getTime()
  }

  if (item.extra?.date) {
    return typeof item.extra.date === "number" ? item.extra.date : new Date(item.extra.date).getTime()
  }

  return Date.now()
}
