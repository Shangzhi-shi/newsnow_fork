import { memo, useCallback, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { NewsItem as OriginalNewsItem, SourceID } from "@shared/types"
import { type AggregatedView, EmptyStateDisplay, ErrorState, LoadingState } from "./AggregationStates"
import { TEXT } from "./constants"
import type { AggregationView } from "./AggregationListItem"
import type { AggregatedNewsResponse } from "~/hooks/useAggregatedFeedQuery"
import { NewsListTimeLine } from "~/components/column/card"
import { OverlayScrollbar } from "~/components/common/overlay-scrollbar"
import { useRefetch } from "~/hooks/useRefetch"
import { useToast } from "~/hooks/useToast"

export interface ExtendedAggregationView extends Omit<AggregationView, "sources"> {
  sources: SourceID[]
  [key: string]: unknown // 添加索引签名使其兼容 AggregatedView
}

// 抽取常用样式
const CONTAINER_STYLE = "flex flex-col h-full bg-base bg-op-70! backdrop-blur-md p-4 rounded-xl shadow-md overflow-hidden"
const SCROLLBAR_BASE_STYLE = "absolute inset-0 p-2 overflow-y-auto rounded-2xl bg-base bg-op-70!"

// 刷新按钮组件
interface RefreshButtonProps {
  onClick: () => void
  isLoading?: boolean
}

const RefreshButton = memo(({ onClick, isLoading }: RefreshButtonProps) => (
  <button
    type="button"
    className={`btn btn-icon-default ${isLoading
      ? "animate-spin i-ph:circle-dashed-duotone"
      : "i-ph:arrow-counter-clockwise-duotone"}`}
    onClick={onClick}
    title={TEXT.REFRESH}
  />
))

// 视图头部组件
const ViewHeader = memo(({
  activeView,
  data,
  isLoading,
  handleRefresh,
}: {
  activeView: ExtendedAggregationView | null
  data?: AggregatedNewsResponse
  isLoading: boolean
  handleRefresh: () => void
}) => (
  <div className="flex items-center justify-between mb-4 flex-shrink-0">
    <div className="flex gap-2 items-center">
      <span className="flex flex-col">
        <span className="flex items-center gap-2">
          <span className="text-xl font-bold">
            {activeView?.name || TEXT.ALL_AGGREGATED_NEWS}
          </span>
          {activeView && (
            <span className="text-sm bg-primary/10 px-1 rounded-md">
              {activeView.sources.length}
              {" "}
              {TEXT.SOURCES}
            </span>
          )}
        </span>
        <span className="text-xs op-70">
          {data ? `${TEXT.LAST_UPDATE} ${new Date(data.updatedTime).toLocaleString()}` : TEXT.LOADING_TEXT}
        </span>
      </span>
    </div>
    <div className="flex gap-2 text-lg color-primary">
      <RefreshButton onClick={handleRefresh} isLoading={isLoading} />
    </div>
  </div>
))

// 内容区域组件
const ContentArea = memo(({
  isLoading,
  newsListItems,
  activeView,
  onRefresh,
}: {
  isLoading: boolean
  newsListItems: OriginalNewsItem[]
  activeView: ExtendedAggregationView | null
  onRefresh?: () => void
}) => (
  <div className="flex-1 relative">
    <OverlayScrollbar
      className={`${SCROLLBAR_BASE_STYLE} ${isLoading ? "animate-pulse" : ""} sprinkle-primary`}
      options={{
        overflow: { x: "hidden", y: "scroll" },
        scrollbars: {
          theme: "os-theme-dark",
          visibility: "auto",
          autoHide: "move",
          autoHideDelay: 1300,
        },
      }}
      defer
    >
      <div className={`transition-opacity-500 ${isLoading ? "op-20" : ""}`}>
        {newsListItems.length > 0
          ? (
              <NewsListTimeLine items={newsListItems} />
            )
          : (
              <EmptyStateDisplay
                activeView={activeView as AggregatedView | null}
                onRefresh={onRefresh}
              />
            )}
      </div>
    </OverlayScrollbar>
  </div>
))

export interface ActiveViewContentProps {
  activeView: ExtendedAggregationView | null
  data: AggregatedNewsResponse | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  // 当左侧面板被折叠且没有选择聚合视图时，是否显示所有聚合新闻
  showAllWhenNoActiveView?: boolean
  // 强制刷新聚合数据的方法
  forceRefresh?: () => Promise<unknown>
}

// 检查是否应该显示内容的辅助函数
function shouldShowContent(activeView: ExtendedAggregationView | null, showAllWhenNoActiveView = false): boolean {
  return Boolean(activeView || showAllWhenNoActiveView)
}

export const ActiveViewContent = memo(({
  activeView,
  data,
  isLoading,
  isError,
  error,
  showAllWhenNoActiveView = false,
  forceRefresh,
}: ActiveViewContentProps) => {
  const { refresh } = useRefetch()
  const toaster = useToast()
  const queryClient = useQueryClient()

  // 检查是否应该显示内容
  const shouldDisplay = shouldShowContent(activeView, showAllWhenNoActiveView)

  const handleRefresh = useCallback(() => {
    // 如果无效的视图或源，则显示警告
    if (!activeView || activeView.sources.length === 0) {
      toaster(TEXT.NO_SOURCES_TO_REFRESH, { type: "warning" })
      return
    }

    // 使用强制刷新机制或回退到传统方法
    if (forceRefresh) {
      forceRefresh()
        .then(() => toaster(TEXT.REFRESH_SUCCESS, { type: "success" }))
        .catch((err: Error) => {
          console.error("强制刷新聚合失败", err)
          toaster(TEXT.REFRESH_ERROR, { type: "error" })
        })
    } else {
      // 旧的刷新逻辑，作为后备方案
      refresh(...activeView.sources)
      queryClient.invalidateQueries({ queryKey: ["aggregated-feed", activeView.sources] })
    }
  }, [refresh, activeView, queryClient, toaster, forceRefresh])

  // 使用useMemo优化渲染状态计算，避免重复条件判断
  const renderState = useMemo(() => {
    // 如果不应该显示内容，返回空状态
    if (!shouldDisplay) return { type: "none" as const }

    // 检查加载状态
    if (isLoading) return { type: "loading" as const }

    // 检查错误状态
    if (isError && error) return { type: "error" as const }

    // 检查空数据状态
    const hasItems = Boolean(data?.items?.length)
    if (!hasItems) return { type: "empty" as const }

    // 正常显示内容
    return { type: "content" as const, hasItems }
  }, [shouldDisplay, isLoading, isError, error, data])

  // 优化新闻列表项目计算
  const newsListItems = useMemo(() => {
    if (!data?.items?.length) return []
    return data.items.map(item => ({
      ...item,
      pubDate: item.timestamp,
    })) as OriginalNewsItem[]
  }, [data?.items])

  // 根据渲染状态显示相应内容
  switch (renderState.type) {
    case "none":
      return null
    case "loading":
      return <LoadingState />
    case "error":
      return <ErrorState error={error} onRetry={handleRefresh} />
    case "empty":
      return (
        <EmptyStateDisplay
          activeView={activeView as AggregatedView | null}
          onRefresh={handleRefresh}
        />
      )
    case "content":
      return (
        <div className={CONTAINER_STYLE}>
          <ViewHeader
            activeView={activeView}
            data={data}
            isLoading={isLoading}
            handleRefresh={handleRefresh}
          />
          <ContentArea
            isLoading={isLoading}
            newsListItems={newsListItems}
            activeView={activeView}
            onRefresh={handleRefresh}
          />
        </div>
      )
  }
})
