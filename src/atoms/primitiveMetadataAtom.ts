import { atom } from "jotai"
import type { PrimitiveAtom } from "jotai"
import type { FixedColumnID, PrimitiveMetadata, SourceID } from "@shared/types"
import { verifyPrimitiveMetadata } from "@shared/verify"
import { typeSafeObjectEntries, typeSafeObjectFromEntries } from "@shared/type.util"
import { fixedColumnIds, metadata } from "@shared/metadata"
import { sources } from "@shared/sources"
import type { Update } from "./types"

/**
 * 创建一个带持久化功能的原始元数据 atom。
 * 该 atom 会将数据存储在 localStorage 中，同时支持从 localStorage 恢复初始状态。
 * 还包含对存储数据进行预处理的能力。
 *
 * @param {string} key - 用于在 localStorage 中存储数据的键名
 * @param {PrimitiveMetadata} initialValue - 当无法从 localStorage 恢复时使用的初始值
 * @param {Function} preprocess - 对存储或初始化的元数据进行处理的函数
 * @returns {PrimitiveAtom<PrimitiveMetadata>} - 返回创建的 Jotai atom
 */
function createPrimitiveMetadataAtom(
  key: string,
  initialValue: PrimitiveMetadata,
  preprocess: ((stored: PrimitiveMetadata) => PrimitiveMetadata),
): PrimitiveAtom<PrimitiveMetadata> {
  // 获取初始值：尝试从 localStorage 恢复，如果失败则使用默认初始值
  const getInitialValue = (): PrimitiveMetadata => {
    const item = localStorage.getItem(key)
    try {
      if (item) {
        const stored = JSON.parse(item) as PrimitiveMetadata
        verifyPrimitiveMetadata(stored) // 验证恢复的数据格式是否正确
        return preprocess({
          ...stored,
          action: "init", // 标记为初始化操作
        })
      }
    } catch { }
    return initialValue
  }
  const baseAtom = atom(getInitialValue())
  // 创建一个派生 atom，它在更新时会同步到 localStorage
  const derivedAtom = atom(get => get(baseAtom), (get, set, update: Update<PrimitiveMetadata>) => {
    const nextValue = update instanceof Function ? update(get(baseAtom)) : update
    if (nextValue.updatedTime > get(baseAtom).updatedTime) {
      set(baseAtom, nextValue)
      localStorage.setItem(key, JSON.stringify(nextValue)) // 持久化到 localStorage
    }
  })
  return derivedAtom
}

// 初始化默认元数据，仅包含固定列的默认源
const initialMetadata = typeSafeObjectFromEntries(typeSafeObjectEntries(metadata)
  .filter(([id]) => fixedColumnIds.includes(id as FixedColumnID))
  .map(([id, val]) => [id, val.sources] as [FixedColumnID, SourceID[]]))

/**
 * 预处理元数据函数。
 * 确保元数据包含所有必要的默认值，处理重定向源，并确保数据结构一致性。
 *
 * @param {PrimitiveMetadata} target - 需要预处理的元数据
 * @returns {PrimitiveMetadata} - 处理后的元数据
 */
export function preprocessMetadata(target: PrimitiveMetadata): PrimitiveMetadata {
  return {
    data: {
      ...initialMetadata, // 首先包含所有默认元数据
      ...typeSafeObjectFromEntries(
        typeSafeObjectEntries(target.data)
          .filter(([id]) => initialMetadata[id as FixedColumnID]) // 仅保留匹配 initialMetadata 中的列
          .map(([id, s]) => {
            if (id === "focus") return [id, s.filter(k => sources[k]).map(k => sources[k].redirect ?? k)]
            // 合并现有源（过滤无效源并处理重定向）和默认源（排除已有源）
            const oldS = s.filter(k => initialMetadata[id as FixedColumnID].includes(k)).map(k => sources[k].redirect ?? k)
            const newS = initialMetadata[id as FixedColumnID].filter(k => !oldS.includes(k))
            return [id, [...oldS, ...newS]]
          }),
      ),
    },
    pinnedColumns: target.pinnedColumns ?? [], // 确保 pinnedColumns 存在，默认为空数组
    action: target.action, // 保留操作类型标识
    updatedTime: target.updatedTime, // 保留更新时间戳
  }
}

// 创建并导出原始元数据 atom，用于全局状态管理
export const primitiveMetadataAtom = createPrimitiveMetadataAtom("metadata", {
  updatedTime: 0,
  data: initialMetadata,
  pinnedColumns: [], // 初始没有置顶的分栏
  action: "init", // 标记为初始化操作
}, preprocessMetadata)
