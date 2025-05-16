import { memo, useCallback, useMemo } from "react"
import type { ColumnID, SourceID } from "@shared/types"
import { Command } from "cmdk"
import clsx from "clsx" // 使用 clsx 拼接类名
import { useFocusWith } from "~/hooks/useFocus"
import { useTextHighlight } from "~/hooks/useTextHighlight"

/**
 * 新闻源条目属性接口
 */
export interface SourceItemProps {
  /** 新闻源 ID */
  id: SourceID
  /** 新闻源名称 */
  name: string
  /** 新闻源副标题 */
  title?: string
  /** 所属分栏的中文名称 */
  column: string
  /** 所属分栏的 ID */
  columnId?: ColumnID
  /** 新闻源名称的拼音 */
  pinyin: string
  /** 用于搜索的关键词数组 */
  keywords: string[]
}

/**
 * 渲染高亮的文本段落
 */
const HighlightedText = memo(({
  segments,
  itemId,
  prefix,
}: {
  segments: ReturnType<typeof useTextHighlight>
  itemId: string
  prefix: string
}) => (
  <>
    {segments.map((segment, i) => (
      <span
        key={`${prefix}-seg-${itemId}-${i}`}
        className={
          segment.isMatch
            ? "bg-yellow-300 dark:bg-yellow-500 text-black rounded-sm px-0.5 transition-colors duration-200"
            : ""
        }
      >
        {segment.text}
      </span>
    ))}
  </>
))

/**
 * 单个新闻源条目组件。
 * 在搜索结果列表中显示一个新闻源，包括其图标、名称、副标题，并高亮匹配的搜索词。
 * 同时显示一个星标，指示其是否为当前焦点项（在右侧预览区显示的项）。
 *
 * @param {object} props - 组件属性
 * @param {SourceItemProps} props.item - 新闻源条目数据
 * @param {string} props.query - 当前搜索查询词，用于高亮显示
 * @returns {JSX.Element} 渲染的新闻源条目组件
 */
export const SourceItem = memo(({ item, query }: {
  item: SourceItemProps
  query: string
}) => {
  const { isFocused, toggleFocus } = useFocusWith(item.id)
  const nameSegments = useTextHighlight(item.name, query)
  const titleSegments = useTextHighlight(item.title ?? "", query)

  // 使用 useCallback 优化 onSelect 回调
  const handleSelect = useCallback(() => {
    toggleFocus()
  }, [toggleFocus])

  // 使用 useMemo 计算图标URL，避免每次渲染重新计算
  const iconUrl = useMemo(() => {
    return `/icons/${item.id.split("-")[0]}.png`
  }, [item.id])

  return (
    <Command.Item
      keywords={item.keywords} // 提供给 cmdk 组件用于内部搜索匹配的关键词
      value={item.id} // 条目的唯一值，通常是其 ID
      className="flex justify-between items-center p-2"
      onSelect={handleSelect} // 选中时（例如回车），切换其焦点状态
    >
      <span className="flex gap-2 items-center">
        <span
          className="w-4 h-4 rounded-md bg-cover"
          style={{ backgroundImage: `url(${iconUrl})` }}
          role="img"
          aria-label={`${item.name} 图标`}
        />
        <span>
          <HighlightedText
            segments={nameSegments}
            itemId={item.id}
            prefix="name"
          />
        </span>
        {item.title && (
          <span className="text-xs text-neutral-400/80 self-end mb-3px">
            <HighlightedText
              segments={titleSegments}
              itemId={item.id}
              prefix="title"
            />
          </span>
        )}
      </span>
      {/* 根据焦点状态显示不同的星标图标 */}
      <span
        className={clsx(
          isFocused
            ? "i-ph:star-fill text-red-600 dark:text-yellow-400 opacity-100"
            : "i-ph:star-duotone bg-primary op-40",
        )}
        role="img"
        aria-hidden="true"
        title={isFocused ? "已关注" : "点击关注"}
      />
    </Command.Item>
  )
})
