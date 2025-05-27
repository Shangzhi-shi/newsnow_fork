import { atom } from "jotai"
import type { AggregatedViewConfig, SourceID } from "@shared/types"
import { primitiveMetadataAtom } from "./primitiveMetadataAtom"

/**
 * 存储当前激活的聚合视图ID
 */
export const activeAggregatedViewIdAtom = atom<string | null>(null)

/**
 * 聚合视图配置atom，从primitiveMetadataAtom中读取和更新数据
 * 通过读/写分离模式实现与primitiveMetadata的同步
 */
export const aggregatedViewsAtom = atom(
  // 读取函数：从primitiveMetadata中获取聚合视图配置
  (get) => {
    const metadata = get(primitiveMetadataAtom)
    return metadata.aggregatedViews || []
  },
  // 写入函数：更新primitiveMetadata中的聚合视图配置并触发同步
  (get, set, update: AggregatedViewConfig[] | ((prev: AggregatedViewConfig[]) => AggregatedViewConfig[])) => {
    // 获取当前值
    const currentViews = get(aggregatedViewsAtom)

    // 计算新值，支持函数式更新和直接设置
    const newViews = typeof update === "function" ? update(currentViews) : update

    // 更新primitiveMetadata以触发同步机制
    const currentMetadata = get(primitiveMetadataAtom)
    set(primitiveMetadataAtom, {
      ...currentMetadata,
      aggregatedViews: newViews,
      updatedTime: Date.now(), // 更新时间戳
      action: "manual", // 标记为手动操作，触发同步
    })
  },
)

/**
 * 派生原子：根据activeAggregatedViewIdAtom获取当前激活的聚合视图配置
 * 使用memoization模式，只有在依赖的atom更新时才重新计算
 */
export const activeAggregatedViewConfigAtom = atom<AggregatedViewConfig | null>((get) => {
  const activeId = get(activeAggregatedViewIdAtom)
  if (!activeId) return null

  const views = get(aggregatedViewsAtom)
  return views.find(view => view.id === activeId) || null
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
 * 将数组转换为以ID为键的对象，优化查找性能
 */
export const aggregatedViewsByIdAtom = atom<Record<string, AggregatedViewConfig>>((get) => {
  const views = get(aggregatedViewsAtom)

  // 使用reduce高效构建映射对象
  return views.reduce<Record<string, AggregatedViewConfig>>((acc, view) => {
    // 确保view.id存在且有效
    if (view && view.id) {
      acc[view.id] = view
    }
    return acc
  }, {})
})
