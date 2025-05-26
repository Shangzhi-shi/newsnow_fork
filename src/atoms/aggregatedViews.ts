import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import type { AggregatedViewConfig, SourceID } from "@shared/types"

/**
 * 存储用户的聚合视图配置列表
 * 使用atomWithStorage持久化到localStorage
 */
export const aggregatedViewsAtom = atomWithStorage<AggregatedViewConfig[]>("aggregated-views-config", [])

/**
 * 存储当前激活的聚合视图ID
 * 激活的视图将在"我的聚合"页面中显示其内容
 */
export const activeAggregatedViewIdAtom = atom<string | null>(null)

/**
 * 派生原子：根据activeAggregatedViewIdAtom获取当前激活的聚合视图配置
 * 如果没有激活的视图，返回null
 */
export const activeAggregatedViewConfigAtom = atom<AggregatedViewConfig | null>((get) => {
  const activeId = get(activeAggregatedViewIdAtom)
  if (!activeId) return null

  const views = get(aggregatedViewsAtom)
  return views.find((view: AggregatedViewConfig) => view.id === activeId) || null
})

/**
 * 派生原子：获取当前用于聚合的新闻源ID列表
 * 从activeAggregatedViewConfigAtom中提取sources
 */
export const currentSelectedSourcesForAggregationAtom = atom<SourceID[]>((get) => {
  const activeConfig = get(activeAggregatedViewConfigAtom)
  return activeConfig?.sources || []
})

/**
 * 派生原子：按ID索引的聚合视图配置映射
 * 优化查找性能
 */
export const aggregatedViewsByIdAtom = atom<Record<string, AggregatedViewConfig>>((get) => {
  const views = get(aggregatedViewsAtom)
  return views.reduce<Record<string, AggregatedViewConfig>>((acc, view) => {
    acc[view.id] = view
    return acc
  }, {})
})

// 优化大型聚合配置列表的初始化
aggregatedViewsAtom.onMount = (setValue) => {
  try {
    const storedValue = localStorage.getItem("aggregated-views-config")
    if (storedValue) {
      const parsedValue = JSON.parse(storedValue)
      if (Array.isArray(parsedValue)) {
        setValue(parsedValue)
      }
    }
  } catch (error) {
    console.error("加载聚合视图配置失败:", error)
    // 出现错误时不修改状态，使用默认空数组
  }
}
