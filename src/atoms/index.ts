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

  const focusSources = get(focusSourcesAtom)
  const focusSourcesSet = new Set(focusSources)
  const savedOrderForCurrentCategory = metadataData[id] || []

  // 主要逻辑：有已保存顺序，也有收藏源
  const orderedFocusedSources: SourceID[] = []
  const orderedRestSources: SourceID[] = []

  for (const sourceId of savedOrderForCurrentCategory) {
    if (!isSourceInCategory(sourceId, id)) {
      continue // 如果不是当前分类的，就跳过
    }

    if (focusSourcesSet.has(sourceId)) {
      orderedFocusedSources.push(sourceId)
    } else {
      orderedRestSources.push(sourceId)
    }
  }

  // 处理那些已收藏、属于当前分类，但可能还未出现在 savedOrderForCurrentCategory 中的源 (例如新收藏的)
  // 这些新收藏的源应该被添加到 orderedFocusedSources 的末尾 (或头部，或根据 focusSources 顺序插入)
  // 为了简单起见，并保持与 focusSourcesAtom 顺序的一致性，我们将它们按 focusSourcesAtom 的顺序加入
  const currentSavedFocusedSet = new Set(orderedFocusedSources) // 已在 savedOrder 中找到的收藏源
  const newFocusedSourcesInThisCategory = focusSources.filter(
    focusedSourceId =>
      isSourceInCategory(focusedSourceId, id)
      && !currentSavedFocusedSet.has(focusedSourceId),
  )

  // 组合：已保存顺序中的收藏源 + 新加入的收藏源 + 已保存顺序中的非收藏源
  return [...orderedFocusedSources, ...newFocusedSourcesInThisCategory, ...orderedRestSources]
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
