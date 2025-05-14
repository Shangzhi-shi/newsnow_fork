import { Command } from "cmdk"
import { useMount } from "react-use"
import type { SourceID } from "@shared/types"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import pinyin from "@shared/pinyin.json"
import { sources } from "@shared/sources"
import { columns } from "@shared/metadata"
import { typeSafeObjectEntries } from "@shared/type.util"
import { OverlayScrollbar } from "../overlay-scrollbar"
import { CardWrapper } from "~/components/column/card"
import { useSearchBar } from "~/hooks/useSearch"
import { useFocusWith } from "~/hooks/useFocus"
import { useTextHighlight } from "~/hooks/useTextHighlight"

import "./cmdk.css"

interface SourceItemProps {
  id: SourceID
  name: string
  title?: string
  column: any
  pinyin: string
}

interface ProcessedGroupData {
  column: string
  sources: SourceItemProps[]
  allGroupKeywords: string[]
}

function groupByColumn(items: SourceItemProps[]) {
  return items.reduce((acc, item) => {
    const k = acc.find(i => i.column === item.column)
    if (k) k.sources = [...k.sources, item]
    else acc.push({ column: item.column, sources: [item] })
    return acc
  }, [] as {
    column: string
    sources: SourceItemProps[]
  }[]).sort((m, n) => {
    if (m.column === "科技") return -1
    if (n.column === "科技") return 1
    if (m.column === "未分类") return 1
    if (n.column === "未分类") return -1
    return m.column < n.column ? -1 : 1
  })
}

const LOCAL_STORAGE_EXPANDED_GROUPS_KEY = "searchBarExpandedGroups"

interface ColumnGroupDisplayProps {
  column: string
  groupSources: SourceItemProps[]
  allGroupKeywords: string[]
  isExpanded: boolean
  trimmedQuery: string
  toggleGroup: (columnName: string) => void
}

function ColumnGroupDisplay({
  column,
  groupSources,
  allGroupKeywords,
  isExpanded,
  trimmedQuery,
  toggleGroup,
}: ColumnGroupDisplayProps) {
  const columnSegments = useTextHighlight(column, trimmedQuery)

  let groupIsSearchResult = false
  if (trimmedQuery) {
    const lowerSearch = trimmedQuery.toLowerCase()
    groupIsSearchResult
      = column.toLowerCase().includes(lowerSearch)
        || groupSources.some(
          item =>
            item.name.toLowerCase().includes(lowerSearch)
            || (item.title && item.title.toLowerCase().includes(lowerSearch))
            || (item.pinyin && item.pinyin.toLowerCase().includes(lowerSearch)),
        )
  }

  return (
    <Command.Group key={column}>
      <div
        className="flex items-center justify-between cursor-pointer p-2 cmdk-group-heading"
        onClick={() => toggleGroup(column)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={`group-${column}`}
        aria-label={`${column} 分类${isExpanded ? "，已展开" : "，已折叠"}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            toggleGroup(column)
          }
        }}
      >
        <span>
          {columnSegments.map((segment, i) => (
            <span
              key={`col-seg-${column}-${i}-${segment.text.slice(0, 5)}`}
              className={segment.isMatch ? "bg-yellow-300 dark:bg-yellow-500 text-black rounded-sm px-0.5 transition-colors duration-200" : ""}
            >
              {segment.text}
            </span>
          ))}
        </span>
        <span
          cmdk-group-toggle-indicator=""
          data-expanded={isExpanded}
          className="i-ph:caret-right w-4 h-4"
        />
      </div>
      {isExpanded && groupSources.map(item => (
        <SourceItem item={item} key={item.id} query={trimmedQuery} />
      ))}
      {!isExpanded && groupIsSearchResult && (
        <Command.Item
          key={`${column}-ghost`}
          value={`${column}-ghost-placeholder`}
          className="!hidden"
          keywords={allGroupKeywords}
          disabled
          onSelect={() => toggleGroup(column)}
        >
          {column}
        </Command.Item>
      )}
    </Command.Group>
  )
}

export function SearchBar() {
  const { opened, toggle } = useSearchBar()
  const sourceItems = useMemo((): ProcessedGroupData[] => {
    const rawMappedItems = typeSafeObjectEntries(sources)
      .filter(([_, source]) => !source.redirect)
      .map(([k, source]) => {
        const columnId = source.column as keyof typeof columns | undefined
        let columnName = "未分类"
        if (columnId && columns[columnId]) {
          columnName = columns[columnId].zh
        }
        return {
          id: k,
          title: source.title,
          column: columnName,
          name: source.name,
          pinyin: pinyin?.[k as keyof typeof pinyin] ?? "",
        }
      })

    const groupedByColumnData = groupByColumn(rawMappedItems)

    return groupedByColumnData.map(group => ({
      ...group,
      allGroupKeywords: [
        group.column,
        ...group.sources.flatMap(item => [
          item.name,
          item.title ?? "",
          item.pinyin,
        ]).filter(Boolean),
      ] as string[],
    }))
  }, [])

  const inputRef = useRef<HTMLInputElement | null>(null)

  const [value, setValue] = useState<SourceID>("github-trending-today")
  const [currentInputValue, setCurrentInputValue] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(currentInputValue.trim())
    }, 300)

    return () => {
      clearTimeout(handler)
    }
  }, [currentInputValue])

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_EXPANDED_GROUPS_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_EXPANDED_GROUPS_KEY, JSON.stringify(expandedGroups))
    } catch (error) {
      console.error("Failed to save expandedGroups to localStorage", error)
    }
  }, [expandedGroups])

  const toggleGroup = useCallback((groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !(prev[groupName] ?? false),
    }))
  }, [])

  const toggleAllGroups = useCallback((expand: boolean) => {
    const allGroups = sourceItems.reduce((acc, { column }) => {
      acc[column] = expand
      return acc
    }, {} as Record<string, boolean>)
    setExpandedGroups(allGroups)
  }, [sourceItems])

  useMount(() => {
    inputRef?.current?.focus()
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggle()
      }
    }
    document.addEventListener("keydown", keydown)
    return () => {
      document.removeEventListener("keydown", keydown)
    }
  })

  return (
    <Command.Dialog
      open={opened}
      onOpenChange={toggle}
      value={value}
      onValueChange={(v) => {
        if (v in sources) {
          setValue(v as SourceID)
        }
      }}
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
                  groupSources={groupData.sources}
                  allGroupKeywords={groupData.allGroupKeywords}
                  isExpanded={expandedGroups[groupData.column] ?? false}
                  trimmedQuery={debouncedQuery}
                  toggleGroup={toggleGroup}
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

function SourceItem({ item, query }: {
  item: SourceItemProps
  query: string
}) {
  const { isFocused, toggleFocus } = useFocusWith(item.id)
  const nameSegments = useTextHighlight(item.name, query)
  const titleSegments = useTextHighlight(item.title, query)

  return (
    <Command.Item
      keywords={[item.name, item.title ?? "", item.pinyin, item.column].filter(Boolean) as string[]}
      value={item.id}
      className="flex justify-between items-center p-2"
      onSelect={toggleFocus}
    >
      <span className="flex gap-2 items-center">
        <span
          className={$("w-4 h-4 rounded-md bg-cover")}
          style={{
            backgroundImage: `url(/icons/${item.id.split("-")[0]}.png)`,
          }}
        />
        <span>
          {nameSegments.map((segment, i) => (
            <span
              key={`name-seg-${item.id}-${i}-${segment.text.slice(0, 5)}`}
              className={segment.isMatch ? "bg-yellow-300 dark:bg-yellow-500 text-black rounded-sm px-0.5 transition-colors duration-200" : ""}
            >
              {segment.text}
            </span>
          ))}
        </span>
        <span className="text-xs text-neutral-400/80 self-end mb-3px">
          {item.title && titleSegments.map((segment, i) => (
            <span
              key={`title-seg-${item.id}-${i}-${segment.text.slice(0, 5)}`}
              className={segment.isMatch ? "bg-yellow-300 dark:bg-yellow-500 text-black rounded-sm px-0.5 transition-colors duration-200" : ""}
            >
              {segment.text}
            </span>
          ))}
        </span>
      </span>
      <span
        className={$(
          isFocused
            ? "i-ph:star-fill text-red-600 dark:text-yellow-400 opacity-100"
            : "i-ph:star-duotone bg-primary op-40",
        )}
      />
    </Command.Item>
  )
}
