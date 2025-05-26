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

/**
 * 同步操作类型
 */
enum SyncAction {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
}

/**
 * 同步状态类型
 */
enum SyncStatus {
  NONE = "none",
  PENDING = "pending",
  SUCCESS = "success",
  ERROR = "error",
}

/**
 * 提供聚合视图配置的CRUD操作的Hook
 * 采用"本地优先，可选同步"模式
 */
export function useAggregatedViewsMutation() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const setAggregatedViews = useSetAtom(aggregatedViewsAtom)

  /**
   * 查询失效函数 - 提取重复代码
   */
  const invalidateAggregatedFeedQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["aggregatedFeed"] })
  }, [queryClient])

  /**
   * 检查用户是否可能已登录
   * 这只是一个简单的前端检查，不是真正的身份验证
   */
  const canSyncToServer = useCallback((): boolean => {
    // 检查本地存储中是否有 token，作为登录状态的简单指示
    const token = localStorage.getItem("token") || sessionStorage.getItem("token")
    return !!token
  }, [])

  /**
   * 尝试与服务器同步数据
   * 仅在用户可能已登录时执行
   */
  const syncToServer = useCallback(async (
    action: SyncAction,
    viewId?: string,
    viewData?: AggregatedViewRequest,
  ): Promise<SyncStatus> => {
    // 如果用户未登录，直接跳过同步
    if (!canSyncToServer()) {
      return SyncStatus.NONE
    }

    try {
      // 构建基础URL和请求配置
      const baseUrl = "/api/me/aggregated-views"
      const url = viewId ? `${baseUrl}/${viewId}` : baseUrl

      const config: RequestInit = {
        method: action === SyncAction.CREATE
          ? "POST"
          : action === SyncAction.UPDATE ? "PUT" : "DELETE",
        headers: { "Content-Type": "application/json" },
      }

      // 只有非DELETE请求且有数据时才添加请求体
      if (action !== SyncAction.DELETE && viewData) {
        config.body = JSON.stringify(viewData)
      }

      // 发送请求
      const response = await fetch(url, config)

      // 错误处理
      if (!response.ok) {
        const responseText = await response.text()
        if (response.status === 506 && responseText.includes("Server not configured")) {
          console.warn(TEXT.SERVER_NOT_CONFIGURED)
          return SyncStatus.NONE // 特殊状态：服务器未配置，不视为错误
        }
        throw new Error(`${TEXT.SERVER_ERROR}${response.status} - ${responseText || TEXT.UNKNOWN_ERROR}`)
      }

      return SyncStatus.SUCCESS
    } catch (error) {
      console.error("同步操作失败:", error)
      return SyncStatus.ERROR
    }
  }, [canSyncToServer])

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

      // 先更新本地状态（乐观更新）
      setAggregatedViews(prev => [...prev, newConfig])

      return newConfig
    },
    onSuccess: () => {
      toast(TEXT.VIEW_CREATED, { type: "success" })
      invalidateAggregatedFeedQueries()
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error
        ? error.message
        : TEXT.UNKNOWN_ERROR
      toast(`${TEXT.CREATE_FAILED}${errorMessage}`, { type: "error" })
    },
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

      // 尝试同步到服务器（仅已登录用户）
      const syncStatus = await syncToServer(SyncAction.UPDATE, id, data)

      if (syncStatus === SyncStatus.ERROR) {
        console.warn(TEXT.SYNC_FAILED)
      }

      return updatedConfig
    },
    onSuccess: () => {
      toast(TEXT.VIEW_UPDATED, { type: "success" })
      invalidateAggregatedFeedQueries()
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error
        ? error.message
        : TEXT.UNKNOWN_ERROR
      toast(`${TEXT.UPDATE_FAILED}${errorMessage}`, { type: "error" })
    },
  })

  /**
   * 删除聚合视图配置
   */
  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // 先更新本地状态（乐观更新）
      setAggregatedViews(prev => prev.filter(view => view.id !== id))

      // 尝试同步到服务器（仅已登录用户）
      const syncStatus = await syncToServer(SyncAction.DELETE, id)

      // 如果同步失败且是真正的错误（非配置缺失），记录错误，但不再恢复本地状态
      if (syncStatus === SyncStatus.ERROR) {
        console.error(`${TEXT.SYNC_FAILED} 视图ID:`, id)
        // 可选：向用户显示一个非阻塞的通知，告知同步问题
      }
    },
    onSuccess: () => {
      toast(TEXT.VIEW_DELETED, { type: "success" })
      invalidateAggregatedFeedQueries()
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof Error
        ? error.message
        : TEXT.UNKNOWN_ERROR
      toast(`${TEXT.DELETE_FAILED}${errorMessage}`, { type: "error" })
    },
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
