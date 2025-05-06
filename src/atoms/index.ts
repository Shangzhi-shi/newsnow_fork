import type { FixedColumnID, SourceID } from "@shared/types"
import { sources } from "@shared/sources"
import { atom } from "jotai"
import type { Update } from "./types"
import { primitiveMetadataAtom } from "./primitiveMetadataAtom"

export const focusSourcesAtom = atom((get) => {
  return get(primitiveMetadataAtom).data.focus
}, (get, set, update: Update<SourceID[]>) => {
  const _ = update instanceof Function ? update(get(focusSourcesAtom)) : update
  set(primitiveMetadataAtom, {
    updatedTime: Date.now(),
    action: "manual",
    data: {
      ...get(primitiveMetadataAtom).data,
      focus: _,
    },
  })
})

export const currentColumnIDAtom = atom<FixedColumnID>("focus")

export const currentSourcesAtom = atom((get) => {
  const id = get(currentColumnIDAtom)
  const metadataData = get(primitiveMetadataAtom).data

  // 如果是关注列表，直接返回收藏的源
  if (id === "focus") {
    return metadataData[id] || []
  }

  // 获取当前分类的所有源，确保存在
  const categorySourcesList = metadataData[id] || []
  // 获取收藏的源
  const focusSources = get(focusSourcesAtom)

  // 如果没有收藏的源，直接返回当前分类所有源
  if (!focusSources.length) {
    return categorySourcesList
  }

  /**
   * 判断信息源是否属于指定分类
   */
  const isSourceInCategory = (sourceId: SourceID, categoryId: FixedColumnID): boolean => {
    const source = sources[sourceId]
    if (!source) return false

    return (
      (categoryId === "hottest" && source.type === "hottest")
      || (categoryId === "realtime" && source.type === "realtime")
      || source.column === categoryId
    )
  }

  // 创建一个收藏源的Set，提高查找效率
  const focusSourcesSet = new Set(focusSources)

  // 找出当前分类中被收藏的源
  const focusedSourcesInCategory = focusSources.filter(
    sourceId => isSourceInCategory(sourceId, id),
  )

  // 从当前分类列表中移除被收藏的源，避免重复
  const restSources = categorySourcesList.filter(
    sourceId => !focusSourcesSet.has(sourceId),
  )

  // 收藏的源放在前面，其他源放在后面
  return [...focusedSourcesInCategory, ...restSources]
}, (get, set, update: Update<SourceID[]>) => {
  const _ = update instanceof Function ? update(get(currentSourcesAtom)) : update
  set(primitiveMetadataAtom, {
    updatedTime: Date.now(),
    action: "manual",
    data: {
      ...get(primitiveMetadataAtom).data,
      [get(currentColumnIDAtom)]: _,
    },
  })
})

export const goToTopAtom = atom({
  ok: false,
  el: undefined as HTMLElement | undefined,
  fn: undefined as (() => void) | undefined,
})
