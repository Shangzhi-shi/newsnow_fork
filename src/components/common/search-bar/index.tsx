import { Command } from "cmdk"
import type { ColumnID, SourceID } from "@shared/types"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAtom } from "jotai"
import { OverlayScrollbar } from "../overlay-scrollbar"
import { ColumnGroupDisplay } from "./ColumnGroupDisplay.tsx"
import { CardWrapper } from "~/components/column/card"
import { useSearchBar } from "~/hooks/useSearch"
import { primitiveMetadataAtom } from "~/atoms/primitiveMetadataAtom"

import "./cmdk.css"

import { useProcessedSourceItems } from "~/hooks/useProcessedSourceItems.ts"
import { useGroupExpansion } from "~/hooks/useGroupExpansion.ts"
import { useSearchInput } from "~/hooks/useSearchInput.ts"

const LOCAL_STORAGE_EXPANDED_GROUPS_KEY = "searchBarExpandedGroups"

/**
 * 搜索栏组件。
 * 提供一个命令面板式的界面 (cmdk)，用于搜索新闻源和分类。
 * 功能包括：
 * - 显示新闻源，按分类组织，支持置顶。
 * - 实时搜索过滤新闻源和分类。
 * - 管理分类的展开/折叠状态，并持久化到 localStorage。
 * - 允许用户通过点击或键盘快捷键 (Cmd/Ctrl + K) 打开/关闭。
 * - 在右侧（桌面视图）显示当前选中新闻源的预览卡片。
 */
export function SearchBar() {
  const { opened, toggle } = useSearchBar()
  const [primitiveMetadata, setPrimitiveMetadata] = useAtom(primitiveMetadataAtom)
  const pinnedColumns = primitiveMetadata.pinnedColumns ?? []

  // 处理分类置顶/取消置顶的回调函数
  const handleTogglePin = useCallback((columnIdToToggle: ColumnID) => {
    setPrimitiveMetadata((currentMetadata) => {
      const currentPinned = currentMetadata.pinnedColumns ?? []
      let newPinnedColumns
      if (currentPinned.includes(columnIdToToggle)) {
        newPinnedColumns = currentPinned.filter(id => id !== columnIdToToggle)
      } else {
        newPinnedColumns = [columnIdToToggle, ...currentPinned]
      }
      return {
        ...currentMetadata,
        pinnedColumns: newPinnedColumns,
        updatedTime: Date.now(),
        action: "manual",
      }
    })
  }, [setPrimitiveMetadata])

  // 获取处理后的新闻源项目，按分类分组并考虑置顶状态
  const sourceItems = useProcessedSourceItems(pinnedColumns)

  // 搜索输入框引用
  const inputRef = useRef<HTMLInputElement | null>(null)

  // 当前选中的新闻源ID
  const [value, setValue] = useState<SourceID>("github-trending-today")

  // 搜索输入与防抖处理
  const {
    inputValue: currentInputValue,
    setInputValue: setCurrentInputValue,
    debouncedValue: debouncedQuery,
    resetInput,
  } = useSearchInput()

  // 为了类型兼容性，创建一个仅包含column属性的数组
  const sourceItemsForExpansion = useMemo(() =>
    sourceItems.map(item => ({ column: item.column })), [sourceItems])

  // 管理分组的展开/折叠状态
  const { expandedGroups, toggleGroup, toggleAllGroups } = useGroupExpansion(
    LOCAL_STORAGE_EXPANDED_GROUPS_KEY,
    sourceItemsForExpansion,
  )

  // 缓存所有源ID列表，避免在onValueChange中重复计算
  const allSourceIds = useMemo(() =>
    sourceItems.flatMap(group => group.sources.map(s => s.id)), [sourceItems])

  // 处理源选择变更
  const handleValueChange = useCallback((v: string) => {
    if (allSourceIds.includes(v as SourceID)) {
      setValue(v as SourceID)
    }
  }, [allSourceIds])

  // 当对话框关闭时重置搜索输入
  useEffect(() => {
    if (!opened) {
      resetInput()
    }
  }, [opened, resetInput])

  // 处理键盘快捷键
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      toggle()
    }
  }, [toggle])

  // 挂载时自动聚焦搜索框，并设置键盘快捷键
  useEffect(() => {
    if (opened && inputRef?.current) {
      inputRef.current.focus()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [opened, handleKeyDown])

  return (
    <Command.Dialog
      open={opened}
      onOpenChange={toggle}
      value={value}
      onValueChange={handleValueChange}
    >
      <Command.Input
        ref={inputRef}
        autoFocus
        placeholder="搜索你想要的 (没有找到，可以前往 Github 提 issue)"
        value={currentInputValue}
        onValueChange={setCurrentInputValue}
      />
      <div className="md:flex pt-2">
        <OverlayScrollbar defer className="overflow-y-auto md:min-w-275px">
          <Command.List>
            <div className="flex justify-between items-center px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 mb-2">
              <span className="text-sm font-bold op-70">分类</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded hover:bg-neutral-400/10"
                  onClick={() => toggleAllGroups(true)}
                >
                  展开全部
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded hover:bg-neutral-400/10"
                  onClick={() => toggleAllGroups(false)}
                >
                  折叠全部
                </button>
              </div>
            </div>
            {debouncedQuery !== "" && (
              <Command.Empty>无匹配分类或新闻源</Command.Empty>
            )}
            {
              sourceItems.map(groupData => (
                <ColumnGroupDisplay
                  key={groupData.column}
                  column={groupData.column}
                  columnId={groupData.columnId}
                  groupSources={groupData.sources}
                  allGroupKeywords={groupData.allGroupKeywords}
                  isExpanded={expandedGroups[groupData.column] ?? false}
                  trimmedQuery={debouncedQuery}
                  toggleGroup={toggleGroup}
                  isPinned={groupData.columnId ? pinnedColumns.includes(groupData.columnId) : false}
                  onTogglePin={handleTogglePin}
                />
              ))
            }
          </Command.List>
        </OverlayScrollbar>
        <div className="flex-1 pt-2 px-4 min-w-350px max-md:hidden">
          <CardWrapper id={value} />
        </div>
      </div>
    </Command.Dialog>
  )
}
