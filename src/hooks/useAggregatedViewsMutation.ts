import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { AggregatedViewConfig, SourceID } from "@shared/types"
import { useSetAtom } from "jotai"
import { randomUUID } from "@shared/utils"
import { useCallback } from "react"
import { useToast } from "./useToast"
import { aggregatedViewsAtom } from "~/atoms"
import { TEXT } from "~/components/aggregation/constants"

/**
 * 聚合视图配置通用请求体
 */
interface AggregatedViewRequest {
  name?: string
  sources?: SourceID[]
}

/**
 * 创建聚合视图配置的请求体
 */
interface CreateViewRequest extends Required<AggregatedViewRequest> {}

// 错误处理函数类型定义
type ErrorHandler = (error: unknown) => void

/**
 * 提供聚合视图配置的CRUD操作的Hook
 * 本地状态优先，使用项目原有的同步机制
 */
export function useAggregatedViewsMutation() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const setAggregatedViews = useSetAtom(aggregatedViewsAtom)

  /**
   * 查询失效函数 - 让React Query重新获取聚合数据
   */
  const invalidateAggregatedFeedQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["aggregatedFeed"] })
  }, [queryClient])

  /**
   * 统一错误处理函数
   */
  const createErrorHandler = useCallback((errorPrefix: string): ErrorHandler => {
    return (error: unknown) => {
      const errorMessage = error instanceof Error
        ? error.message
        : TEXT.UNKNOWN_ERROR
      toast(`${errorPrefix}${errorMessage}`, { type: "error" })
    }
  }, [toast])

  /**
   * 创建新的聚合视图配置
   */
  const createMutation = useMutation({
    mutationFn: async (newView: CreateViewRequest): Promise<AggregatedViewConfig> => {
      // 首先创建本地视图配置对象
      const now = Date.now()
      const newConfig: AggregatedViewConfig = {
        id: randomUUID(),
        name: newView.name,
        sources: newView.sources,
        createdAt: now,
        updatedAt: now,
      }

      // 使用aggregatedViewsAtom的内置更新机制（会触发同步）
      setAggregatedViews(prev => [...prev, newConfig])

      return newConfig
    },
    onSuccess: () => {
      toast(TEXT.VIEW_CREATED, { type: "success" })
      invalidateAggregatedFeedQueries()
    },
    onError: createErrorHandler(TEXT.CREATE_FAILED),
  })

  /**
   * 更新已有的聚合视图配置
   */
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: AggregatedViewRequest }): Promise<AggregatedViewConfig> => {
      // 先更新本地状态（乐观更新）
      let updatedConfig: AggregatedViewConfig | undefined

      setAggregatedViews((prev) => {
        const updated = prev.map((view) => {
          if (view.id === id) {
            // 仅更新提供的字段
            updatedConfig = {
              ...view,
              ...(data.name !== undefined && { name: data.name }),
              ...(data.sources !== undefined && { sources: data.sources }),
              updatedAt: Date.now(),
            }
            return updatedConfig
          }
          return view
        })
        return updated
      })

      if (!updatedConfig) {
        throw new Error(`找不到ID为${id}的视图配置`)
      }

      return updatedConfig
    },
    onSuccess: () => {
      toast(TEXT.VIEW_UPDATED, { type: "success" })
      invalidateAggregatedFeedQueries()
    },
    onError: createErrorHandler(TEXT.UPDATE_FAILED),
  })

  /**
   * 删除聚合视图配置
   */
  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // 更新本地状态（乐观更新），aggregatedViewsAtom会负责触发同步
      setAggregatedViews(prev => prev.filter(view => view.id !== id))
    },
    onSuccess: () => {
      toast(TEXT.VIEW_DELETED, { type: "success" })
      invalidateAggregatedFeedQueries()
    },
    onError: createErrorHandler(TEXT.DELETE_FAILED),
  })

  return {
    createView: createMutation.mutate,
    updateView: updateMutation.mutate,
    deleteView: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
