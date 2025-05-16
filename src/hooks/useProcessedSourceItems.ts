import { useMemo } from "react"
import type { ColumnID, FixedColumnID, SourceID } from "@shared/types"
import { sources } from "@shared/sources"
import { columns, fixedColumnIds } from "@shared/metadata"
import { typeSafeObjectEntries } from "@shared/type.util"
import pinyin from "@shared/pinyin.json"
import categoryPinyinData from "@shared/category-pinyin.json"
import type { SourceItemProps } from "../components/common/search-bar/SourceItem.tsx"

/**
 * 处理后的分组数据接口，用于搜索栏展示
 */
export interface ProcessedGroupData {
  /** 分栏中文名称 */
  column: string
  /** 分栏 ID（可选） */
  columnId?: ColumnID
  /** 该分栏下的新闻源条目数组 */
  sources: SourceItemProps[]
  /** 该分栏所有新闻源的关键词集合（去重） */
  allGroupKeywords: string[]
}

/**
 * 将新闻源条目按分栏名称分组，使用Map实现更高效率
 * @param {SourceItemProps[]} items - 需要分组的新闻源条目数组
 * @returns {ProcessedGroupData[]} 按分栏分组后的数据
 */
function groupByColumn(items: SourceItemProps[]): ProcessedGroupData[] {
  // 使用Map来提高查找和分组效率
  const groupMap = new Map<string, ProcessedGroupData>()

  for (const item of items) {
    const key = item.column

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        column: key,
        columnId: item.columnId,
        sources: [],
        allGroupKeywords: [],
      })
    }

    const group = groupMap.get(key)!
    group.sources.push(item)
  }

  // 为每个分组生成所有关键词的集合
  for (const group of groupMap.values()) {
    const allKeywords = new Set<string>()
    for (const item of group.sources) {
      for (const keyword of item.keywords) {
        allKeywords.add(keyword)
      }
    }
    group.allGroupKeywords = Array.from(allKeywords)
  }

  return Array.from(groupMap.values())
}

/**
 * 获取分栏的排序优先级，用于排序函数
 * @param columnId 分栏ID
 * @param columnName 分栏名称
 * @param pinnedColumns 置顶分栏数组
 * @returns 排序权重（数字越小越靠前）
 */
function getColumnSortPriority(
  columnId: ColumnID | undefined,
  columnName: string,
  pinnedColumns: ColumnID[],
): [number, number, string] {
  // 如果是置顶项
  if (columnId && pinnedColumns.includes(columnId)) {
    return [0, pinnedColumns.indexOf(columnId), columnName]
  }

  // 如果是固定分栏
  if (columnId) {
    const fixedIndex = fixedColumnIds.indexOf(columnId as FixedColumnID)
    if (fixedIndex !== -1) {
      return [1, fixedIndex, columnName]
    }
  }

  // "未分类"放最后
  if (columnName === "未分类") {
    return [3, 0, columnName]
  }

  // 其他普通分栏
  return [2, 0, columnName]
}

/**
 * 自定义 Hook，用于处理和转换新闻源条目数据。
 * 它将原始新闻源数据进行分组、排序（基于置顶、固定和默认顺序），并为每个条目和分组生成关键词。
 * 排序优先级：
 * 1. 用户置顶的分栏（按置顶顺序）
 * 2. 固定分栏（按 fixedColumnIds 中的顺序）
 * 3. 其他分栏（按名称字母顺序）
 * 4. "未分类"分栏（始终最后）
 *
 * @param {ColumnID[] | undefined} pinnedColumns - 用户置顶的分栏 ID 数组
 * @returns {ProcessedGroupData[]} 处理后的新闻源分组数据，可直接用于搜索栏列表的渲染
 */
export function useProcessedSourceItems(pinnedColumns: ColumnID[] | undefined): ProcessedGroupData[] {
  return useMemo(() => {
    const currentPinnedColumns = pinnedColumns ?? [] // 当前置顶的分栏，如果未定义则为空数组

    // 将原始新闻源数据转换为组件所需的格式
    const rawMappedItems: SourceItemProps[] = typeSafeObjectEntries(sources)
      .filter(([_, source]) => !source.redirect) // 过滤掉重定向的源
      .map(([k, source]) => {
        const originalColumnId = source.column as keyof typeof columns | undefined
        let columnName = "未分类"
        let resolvedColumnId: ColumnID | undefined

        // 解析分栏信息
        if (originalColumnId && columns[originalColumnId]) {
          columnName = columns[originalColumnId].zh
          resolvedColumnId = originalColumnId as ColumnID
        }

        // 获取分栏拼音
        const columnPinyin = (resolvedColumnId && resolvedColumnId in categoryPinyinData)
          ? categoryPinyinData[resolvedColumnId as keyof typeof categoryPinyinData]
          : ""

        const sourcePinyin = k in pinyin ? pinyin[k as keyof typeof pinyin] : ""

        // 生成关键词列表，包括分栏名、分栏拼音、源名称、源标题、源拼音
        const keywords = [
          columnName.toLowerCase(),
          columnPinyin.toLowerCase(),
          source.name.toLowerCase(),
          source.title ? source.title.toLowerCase() : "",
          sourcePinyin.toLowerCase(),
        ].filter(Boolean) as string[]

        return {
          id: k as SourceID,
          title: source.title,
          column: columnName,
          columnId: resolvedColumnId,
          name: source.name,
          pinyin: sourcePinyin,
          keywords,
        }
      })

    // 按分栏名分组
    const groupedByColumnData = groupByColumn(rawMappedItems)

    // 对分栏进行排序 - 使用提取的排序优先级函数
    return groupedByColumnData.sort((a, b) => {
      const aScore = getColumnSortPriority(a.columnId, a.column, currentPinnedColumns)
      const bScore = getColumnSortPriority(b.columnId, b.column, currentPinnedColumns)

      // 首先比较主分类（置顶、固定、普通、未分类）
      if (aScore[0] !== bScore[0]) {
        return aScore[0] - bScore[0]
      }

      // 然后比较子索引（在置顶数组或固定数组中的位置）
      if (aScore[1] !== bScore[1]) {
        return aScore[1] - bScore[1]
      }

      // 最后按名称字母顺序
      return aScore[2].localeCompare(bScore[2])
    })
  }, [pinnedColumns])
}
