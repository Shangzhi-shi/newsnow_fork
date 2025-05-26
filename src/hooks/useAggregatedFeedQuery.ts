import { type UseQueryOptions, useQuery } from "@tanstack/react-query"
import type { NewsItem, SourceID } from "@shared/types"
import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { safeParseString } from "~/utils"

/**
 * 聚合新闻源数据的响应类型
 */
export interface AggregatedNewsResponse {
  /** API响应状态 */
  status: "success"
  /** 查询的源ID列表 */
  sourceIds: SourceID[]
  /** 数据最后更新时间戳 */
  updatedTime: number
  /** 聚合后的新闻条目，包含原始来源信息 */
  items: (NewsItem & {
    /** 原始新闻源ID */
    originalSourceId: SourceID
    /** 原始新闻源名称 */
    originalSourceName: string
    /** 时间戳 */
    timestamp: number
  })[]
  /** 总条目数 */
  total: number
}

/**
 * 聚合新闻数据查询错误类型
 */
export enum AggregatedFeedErrorType {
  NO_SOURCES = "NO_SOURCES",
  NETWORK_ERROR = "NETWORK_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * 聚合新闻数据查询错误
 */
export class AggregatedFeedError extends Error {
  constructor(
    public readonly type: AggregatedFeedErrorType,
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: unknown,
  ) {
    super(message)
    this.name = "AggregatedFeedError"
  }
}

/**
 * 从API获取聚合新闻数据
 *
 * @param sourceIds 要获取的新闻源ID数组
 * @param forceRefresh 是否强制刷新，忽略缓存
 * @returns 聚合的新闻数据响应
 * @throws {AggregatedFeedError} 如果获取失败
 */
async function fetchAggregatedFeed(sourceIds: SourceID[], forceRefresh = false): Promise<AggregatedNewsResponse> {
  // 参数验证更加明确
  if (!sourceIds || sourceIds.length === 0) {
    throw new AggregatedFeedError(
      AggregatedFeedErrorType.NO_SOURCES,
      "未选择任何新闻源",
    )
  }

  // 构建请求URL和参数
  const params = new URLSearchParams({
    sourceIds: sourceIds.join(","),
  })

  // 如果是强制刷新，添加latest参数
  if (forceRefresh) {
    params.append("latest", "true")
  }

  const url = `/api/s/aggregate?${params.toString()}`

  // 配置请求选项
  const options: RequestInit = {}

  // 如果用户已登录且需要强制刷新，添加JWT授权头
  if (forceRefresh) {
    const jwt = safeParseString(localStorage.getItem("jwt"))
    if (jwt) {
      options.headers = {
        Authorization: `Bearer ${jwt}`,
      }
    }
  }

  try {
    const response = await fetch(url, options)

    if (!response.ok) {
      const errorText = await response.text()
      throw new AggregatedFeedError(
        AggregatedFeedErrorType.SERVER_ERROR,
        `获取聚合新闻失败: ${response.status} ${errorText}`,
        response.status,
      )
    }

    return await response.json()
  } catch (error) {
    // 错误处理逻辑优化
    if (error instanceof AggregatedFeedError) {
      throw error
    }

    // 将其他错误转换为AggregatedFeedError
    throw new AggregatedFeedError(
      AggregatedFeedErrorType.NETWORK_ERROR,
      `网络错误: ${(error as Error)?.message || "未知错误"}`,
      undefined,
      error,
    )
  }
}

/**
 * 聚合新闻查询选项
 */
export interface AggregatedFeedQueryOptions {
  /** 是否启用查询，默认为true */
  enabled?: boolean
  /** 重试次数，默认为3 */
  retry?: number
  /** 数据过期时间(毫秒)，默认为5分钟 */
  staleTime?: number
  /** 自定义查询选项，将覆盖默认选项 */
  queryOptions?: Partial<UseQueryOptions<AggregatedNewsResponse, Error>>
}

/**
 * 获取聚合新闻数据的Hook
 *
 * @param sourceIds 新闻源ID数组
 * @returns 包含查询结果和强制刷新方法的对象
 */
export function useAggregatedFeedQuery(sourceIds: SourceID[]) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["aggregated-feed", sourceIds],
    queryFn: () => fetchAggregatedFeed(sourceIds),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 1000 * 60 * 5,
  })

  // 添加一个自定义的刷新方法，传递force参数
  const forceRefresh = useCallback(async () => {
    try {
      const freshData = await fetchAggregatedFeed(sourceIds, true)
      // 使用新数据更新缓存
      queryClient.setQueryData(["aggregated-feed", sourceIds], freshData)
      return freshData
    } catch (error) {
      console.error("强制刷新聚合新闻失败", error)
      throw error
    }
  }, [sourceIds, queryClient])

  return {
    ...query,
    forceRefresh,
  }
}
