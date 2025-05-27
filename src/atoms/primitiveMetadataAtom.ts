import { atom } from "jotai"
import type { PrimitiveAtom } from "jotai"
import type { FixedColumnID, PrimitiveMetadata, SourceID } from "@shared/types"
import { verifyPrimitiveMetadata } from "@shared/verify"
import { typeSafeObjectEntries, typeSafeObjectFromEntries } from "@shared/type.util"
import { fixedColumnIds, metadata } from "@shared/metadata"
import { sources } from "@shared/sources"
import type { Update } from "./types"

// 本地存储键名
const STORAGE_KEY = "metadata"

// 初始化默认元数据，仅包含固定列的默认源
const initialMetadata = typeSafeObjectFromEntries(typeSafeObjectEntries(metadata)
  .filter(([id]) => fixedColumnIds.includes(id as FixedColumnID))
  .map(([id, val]) => [id, val.sources] as [FixedColumnID, SourceID[]]))

/**
 * 从本地存储恢复元数据
 * @returns 恢复的元数据或undefined（如果恢复失败）
 */
function recoverFromStorage(): PrimitiveMetadata | undefined {
  try {
    const item = localStorage.getItem(STORAGE_KEY)
    if (!item) return undefined

    const stored = JSON.parse(item) as PrimitiveMetadata
    verifyPrimitiveMetadata(stored)
    return {
      ...stored,
      action: "init", // 标记为初始化操作
    }
  } catch (error) {
    console.debug("恢复元数据失败:", error)
    return undefined
  }
}

/**
 * 处理源重定向
 * @param sourceId 源ID
 * @returns 处理重定向后的源ID
 */
function handleSourceRedirect(sourceId: SourceID): SourceID {
  return sources[sourceId]?.redirect ?? sourceId
}

/**
 * 预处理元数据函数。
 * 确保元数据包含所有必要的默认值，处理重定向源，并确保数据结构一致性。
 *
 * @param {PrimitiveMetadata} target - 需要预处理的元数据
 * @returns {PrimitiveMetadata} - 处理后的元数据
 */
export function preprocessMetadata(target: PrimitiveMetadata): PrimitiveMetadata {
  // 处理固定栏目数据
  const processedData = typeSafeObjectFromEntries(
    typeSafeObjectEntries(initialMetadata).map(([columnId, defaultSources]) => {
      const columnSources = target.data[columnId] || []

      // 特殊处理focus栏目，所有源都应用重定向
      if (columnId === "focus") {
        return [
          columnId,
          columnSources.filter(k => sources[k]).map(handleSourceRedirect),
        ]
      }

      // 处理其他栏目：合并现有有效源和新的默认源
      const validExistingSources = columnSources
        .filter(k => initialMetadata[columnId as FixedColumnID].includes(k))
        .map(handleSourceRedirect)

      const newDefaultSources = defaultSources
        .filter(k => !validExistingSources.includes(k))

      return [columnId, [...validExistingSources, ...newDefaultSources]]
    }),
  )

  // 返回处理后的完整元数据
  return {
    data: processedData,
    pinnedColumns: target.pinnedColumns ?? [], // 确保存在，默认为空数组
    aggregatedViews: target.aggregatedViews ?? [], // 确保存在，默认为空数组
    action: target.action, // 保留操作类型标识
    updatedTime: target.updatedTime, // 保留更新时间戳
  }
}

/**
 * 创建一个带持久化功能的原始元数据 atom。
 * 该 atom 会将数据存储在 localStorage 中，同时支持从 localStorage 恢复初始状态。
 */
function createPrimitiveMetadataAtom(): PrimitiveAtom<PrimitiveMetadata> {
  // 默认初始状态
  const defaultState: PrimitiveMetadata = {
    updatedTime: 0,
    data: initialMetadata,
    pinnedColumns: [], // 初始没有置顶的分栏
    aggregatedViews: [], // 初始没有聚合视图
    action: "init", // 标记为初始化操作
  }

  // 尝试从storage恢复，如果失败则使用默认状态
  const recoveredState = recoverFromStorage()
  const initialState = recoveredState ? preprocessMetadata(recoveredState) : defaultState

  // 创建基础atom
  const baseAtom = atom(initialState)

  // 创建派生atom，处理持久化逻辑
  const derivedAtom = atom(
    // 读取函数
    get => get(baseAtom),
    // 写入函数
    (get, set, update: Update<PrimitiveMetadata>) => {
      const nextValue = update instanceof Function ? update(get(baseAtom)) : update
      const currentValue = get(baseAtom)

      // 只有当更新时间更新时才应用更改
      if (nextValue.updatedTime > currentValue.updatedTime) {
        set(baseAtom, nextValue)

        // 持久化到localStorage，使用try-catch防止存储失败
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue))
        } catch (error) {
          console.error("保存元数据到本地存储失败:", error)
        }
      }
    },
  )

  return derivedAtom
}

// 创建并导出原始元数据 atom，用于全局状态管理
export const primitiveMetadataAtom = createPrimitiveMetadataAtom()
