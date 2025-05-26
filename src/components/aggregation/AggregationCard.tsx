import { memo, useCallback, useEffect, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { TEXT } from "./constants"
import type { AggregationView } from "./AggregationListItem"
import { useRefetch } from "~/hooks/useRefetch"
import { useToast } from "~/hooks/useToast"
import { NewsListTimeLine } from "~/components/column/card"
import { useAggregatedFeedQuery } from "~/hooks/useAggregatedFeedQuery"
import { OverlayScrollbar } from "~/components/common/overlay-scrollbar"

export interface AggregationCardProps {
  view: AggregationView
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

// 聚合卡片内部组件
function AggregationCardInner({
  view,
  onEdit,
  onDelete,
}: {
  view: AggregationView
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const { refresh } = useRefetch()
  const toast = useToast()
  const queryClient = useQueryClient()

  // 使用直接传递sourceIds的方式，与详细视图保持一致
  const { data, isLoading, isError, forceRefresh } = useAggregatedFeedQuery(view.sources)

  // 处理数据
  const newsItems = useMemo(() => {
    if (!data?.items?.length) return []
    return data.items.map(item => ({
      ...item,
      pubDate: item.timestamp,
    }))
  }, [data?.items])

  // 改进的刷新处理函数，使用forceRefresh
  const handleRefresh = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!view.sources || view.sources.length === 0) {
      toast(TEXT.NO_SOURCES_TO_REFRESH, { type: "warning" })
      return
    }

    // 使用强制刷新机制，与详细视图保持一致
    if (forceRefresh) {
      forceRefresh()
        .then(() => {
          toast(TEXT.REFRESH_SUCCESS, { type: "success" })
        })
        .catch((err) => {
          console.error("强制刷新聚合失败", err)
          toast(TEXT.REFRESH_ERROR, { type: "error" })
        })
    } else {
      // 作为后备方案保留原有逻辑
      refresh(...view.sources)
      queryClient.invalidateQueries({
        queryKey: ["aggregated-feed", view.sources],
      })
    }
  }, [refresh, queryClient, view, toast, forceRefresh])

  // 组件首次加载时自动执行一次强制刷新 - 移到useEffect中
  useEffect(() => {
    if (forceRefresh && view.sources.length > 0) {
      forceRefresh().catch((err) => {
        console.error("初始化强制刷新失败", err)
        // 初始化错误时不显示错误提示，避免用户体验不佳
      })
    }
  }, [forceRefresh, view.sources, view.id])

  // 是否有数据
  const hasItems = Boolean(data && data.items && data.items.length > 0)

  // 返回与普通NewsCard结构相似的JSX
  return (
    <>
      <div className="flex justify-between mx-2 mt-0 mb-2 items-center">
        <div className="flex gap-2 items-center">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="i-ph:newspaper-clipping-duotone text-lg"></span>
          </div>
          <span className="flex flex-col">
            <span className="flex items-center gap-2">
              <span className="text-xl font-bold" title={view.name}>
                {view.name}
              </span>
              <span className="text-sm bg-primary/10 px-1 rounded-md">
                {view.sources.length}
                {" "}
                {TEXT.SOURCES}
              </span>
            </span>
            <span className="text-xs op-70">
              {data?.updatedTime
                ? `${TEXT.LAST_UPDATE} ${new Date(data.updatedTime).toLocaleString()}`
                : isError ? "获取失败" : "加载中..."}
            </span>
          </span>
        </div>
        <div className="flex gap-2 text-lg color-primary">
          <button
            type="button"
            className={$(
              "btn",
              isLoading ? "animate-spin i-ph:circle-dashed-duotone" : "i-ph:arrow-counter-clockwise-duotone",
              "btn-icon-default",
            )}
            onClick={handleRefresh}
            title={TEXT.REFRESH}
          />
          <button
            type="button"
            className="btn i-ph:pencil-simple-duotone btn-icon-default"
            onClick={onEdit}
            title={TEXT.EDIT}
          />
          <button
            type="button"
            className="btn i-ph:trash-duotone btn-icon-default hover:text-red-500"
            onClick={onDelete}
            title={TEXT.DELETE}
          />
        </div>
      </div>

      <OverlayScrollbar
        className={$([
          "h-full p-2 overflow-y-auto rounded-2xl bg-base bg-op-70!",
          isLoading && "animate-pulse",
          "sprinkle-primary",
        ])}
        options={{
          overflow: { x: "hidden" },
        }}
        defer
      >
        <div className={$("transition-opacity-500", isLoading && "op-20")}>
          {hasItems
            ? (
                <NewsListTimeLine items={newsItems} />
              )
            : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="mb-2">{TEXT.NO_DATA}</div>
                  <div className="text-sm text-gray-500">
                    {view.sources.length === 0
                      ? TEXT.NO_SOURCES_ADDED
                      : TEXT.NO_SOURCE_DATA}
                  </div>
                </div>
              )}
        </div>
      </OverlayScrollbar>
    </>
  )
}

// 聚合卡片主组件
export const AggregationCard = memo(({ view, onSelect, onEdit, onDelete }: AggregationCardProps) => {
  // 阻止事件冒泡的按钮处理函数
  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit()
  }, [onEdit])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete()
  }, [onDelete])

  // 使用普通卡片样式包装，保持与普通卡片一致的外观
  return (
    <div
      className={$(
        "flex flex-col h-500px rounded-2xl p-4 cursor-default",
        "transition-opacity-300",
        "bg-primary-500 dark:bg-primary bg-op-40!",
      )}
      style={{
        transformOrigin: "50% 50%",
      }}
      onClick={onSelect}
    >
      <AggregationCardInner
        view={view}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  )
})
