import type { ColumnID } from "@shared/types"
import { Command } from "cmdk"
import clsx from "clsx"
import type React from "react"
import { memo, useCallback, useMemo } from "react"
import { SourceItem, type SourceItemProps } from "./SourceItem.tsx"
import { useTextHighlight } from "~/hooks/useTextHighlight"

/**
 * 列分组显示组件的属性接口
 */
export interface ColumnGroupDisplayProps {
  /** 分栏中文名称 */
  column: string
  /** 分栏 ID */
  columnId?: ColumnID
  /** 该分栏下的新闻源条目数组 */
  groupSources: SourceItemProps[]
  /** 该分栏所有新闻源的关键词集合（用于搜索优化） */
  allGroupKeywords: string[]
  /** 当前分组是否展开 */
  isExpanded: boolean
  /** 经过处理的搜索查询词 (已 trim) */
  trimmedQuery: string
  /** 切换分组展开/折叠状态的函数 */
  toggleGroup: (columnName: string) => void
  /** 当前分组是否已置顶 */
  isPinned: boolean
  /** 切换置顶状态的函数 */
  onTogglePin: (columnId: ColumnID) => void
}

/**
 * 单个新闻源分组的显示组件。
 * 用于在搜索栏中展示一个分类（栏目）及其下的新闻源列表。
 * 支持展开/折叠，显示置顶状态，并高亮匹配搜索词的分类名称。
 *
 * @param {ColumnGroupDisplayProps} props - 组件属性
 * @returns {JSX.Element} 渲染的分组显示组件
 */
export const ColumnGroupDisplay = memo(({
  column,
  columnId,
  groupSources,
  allGroupKeywords,
  isExpanded,
  trimmedQuery,
  toggleGroup,
  isPinned,
  onTogglePin,
}: ColumnGroupDisplayProps) => {
  // 高亮显示匹配搜索词的分栏名称部分
  const columnSegments = useTextHighlight(column, trimmedQuery)

  // 判断当前分组是否包含搜索结果
  const groupIsSearchResult = useMemo(() => {
    if (!trimmedQuery) return false

    const lowerSearch = trimmedQuery.toLowerCase()
    return allGroupKeywords.some(keyword =>
      keyword.includes(lowerSearch),
    )
  }, [trimmedQuery, allGroupKeywords])

  // 处理点击置顶按钮事件
  const handlePinClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation() // 阻止事件冒泡，避免触发父级的点击事件（如折叠/展开分组）
    if (columnId) {
      onTogglePin(columnId)
    }
  }, [columnId, onTogglePin])

  // 处理点击分组标题事件（展开/折叠）
  const handleGroupHeadingClick = useCallback(() => {
    toggleGroup(column)
  }, [toggleGroup, column])

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { // 支持通过回车或空格键切换展开/折叠
      e.preventDefault()
      toggleGroup(column)
    }
  }, [toggleGroup, column])

  // 渲染高亮的列标题
  const renderHighlightedTitle = useMemo(() => (
    columnSegments.map((segment, i) => (
      <span
        key={`col-seg-${column}-${i}-${segment.text.slice(0, 5)}`}
        className={
          segment.isMatch
            ? "bg-yellow-300 dark:bg-yellow-500 text-black rounded-sm px-0.5 transition-colors duration-200" // 高亮匹配的文本
            : ""
        }
      >
        {segment.text}
      </span>
    ))
  ), [columnSegments, column])

  return (
    <Command.Group key={column}>
      <div
        className="flex items-center justify-between cursor-pointer p-2 cmdk-group-heading"
        onClick={handleGroupHeadingClick} // 点击分组标题切换展开/折叠
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={`group-${column}`}
        aria-label={`${column} 分类${isExpanded ? "，已展开" : "，已折叠"}`}
        onKeyDown={handleKeyDown}
      >
        <span>{renderHighlightedTitle}</span>
        <div className="flex items-center gap-x-2">
          {columnId && ( // 仅当 columnId 存在时（即非"未分类"等特殊情况）显示置顶按钮
            <button
              type="button"
              title={isPinned ? "取消置顶" : "置顶"}
              onClick={handlePinClick} // 点击置顶按钮
              className={clsx(
                "btn btn-icon-default btn-sm p-1 w-6 h-6 rounded transition-opacity flex items-center justify-center",
                isPinned ? "op-100" : "op-75", // 根据置顶状态调整透明度
              )}
              aria-pressed={isPinned}
            >
              <div
                className={clsx(
                  isPinned ? "i-ph:push-pin-fill" : "i-ph:push-pin-simple", // 根据置顶状态显示不同图标
                  "w-5 h-5",
                )}
                aria-hidden="true"
              />
            </button>
          )}
          {/* 展开/折叠指示器图标 */}
          <span
            cmdk-group-toggle-indicator=""
            data-expanded={isExpanded}
            className="i-ph:caret-right w-4 h-4"
            aria-hidden="true"
          />
        </div>
      </div>
      {/* 如果分组已展开，则渲染其下的新闻源条目 */}
      {isExpanded
      && groupSources.map(item => (
        <SourceItem item={item} key={item.id} query={trimmedQuery} />
      ))}
      {/*
        如果分组未展开，但其内部有搜索结果，则渲染一个不可见的 Command.Item。
        这允许 cmdk 在折叠状态下依然能通过键盘导航"选中"这个分组，
        并在用户回车时触发 onSelect，从而展开分组并显示实际的匹配项。
      */}
      {!isExpanded && groupIsSearchResult && (
        <Command.Item
          key={`${column}-ghost`}
          value={`${column}-ghost-placeholder`} // 提供一个唯一的值
          className="!hidden" // 使其在视觉上不可见
          keywords={allGroupKeywords} // 提供关键词以便 cmdk 内部匹配
          disabled // 禁用默认的 onSelect 行为，因为我们通过父级 div 的 onClick 处理
          onSelect={() => toggleGroup(column)} // 当通过键盘导航选中并回车时，展开该分组
        >
          {column}
        </Command.Item>
      )}
    </Command.Group>
  )
})
