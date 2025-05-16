import { useCallback, useEffect, useMemo, useState } from "react"

/**
 * 带有 column 属性的项目接口，用于 toggleAllGroups 方法
 */
interface ItemWithColumn {
  /** 分栏名称 */
  column: string
  // sourceItems 的其他属性对于此钩子的 toggleAll 方法不是必需的
  [key: string]: unknown
}

/**
 * useGroupExpansion 钩子的返回值接口
 */
interface UseGroupExpansionOutput {
  /** 记录各分组展开状态的对象，键为分组名称，值为布尔值表示是否展开 */
  expandedGroups: Record<string, boolean>
  /** 切换单个分组展开/折叠状态的函数 */
  toggleGroup: (groupName: string) => void
  /** 展开或折叠所有分组的函数 */
  toggleAllGroups: (expand: boolean) => void
  /** 设置特定分组的展开状态 */
  setGroupExpanded: (groupName: string, isExpanded: boolean) => void
}

/**
 * 从localStorage读取存储的数据
 *
 * @param {string} key - localStorage键名
 * @returns {Record<string, boolean>} 解析的数据或空对象
 */
function getStoredExpansionState(key: string): Record<string, boolean> {
  if (typeof window === "undefined") return {} // 确保在SSR环境下不会出错

  try {
    const saved = localStorage.getItem(key)
    if (!saved) return {}

    const parsed = JSON.parse(saved)
    if (typeof parsed !== "object" || parsed === null) return {}

    return parsed
  } catch (error) {
    console.warn(`读取分组展开状态时出错: ${error instanceof Error ? error.message : String(error)}`)
    return {}
  }
}

/**
 * 自定义 Hook，用于管理分组的展开/折叠状态，并将其持久化到 localStorage。
 * 适用于需要记住用户展开/折叠偏好的分组列表界面。
 *
 * @param {string} localStorageKey - 用于在 localStorage 中存储展开状态的键名
 * @param {ReadonlyArray<ItemWithColumn>} sourceItemsForToggleAll - 用于 `toggleAllGroups` 方法确定所有分组名称的源数据
 * @returns {UseGroupExpansionOutput} 包含展开状态、切换单个分组和切换所有分组的方法的对象
 */
export function useGroupExpansion(
  localStorageKey: string,
  sourceItemsForToggleAll: ReadonlyArray<ItemWithColumn>, // 对于不会被修改的输入使用 ReadonlyArray
): UseGroupExpansionOutput {
  // 初始化展开状态，尝试从 localStorage 恢复，如果失败则使用空对象
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    getStoredExpansionState(localStorageKey),
  )

  // 预计算所有组名列表，用于toggleAllGroups
  const allGroupNames = useMemo(() => {
    return Array.from(new Set(sourceItemsForToggleAll.map(item => item.column)))
  }, [sourceItemsForToggleAll])

  // 当展开状态变化时，保存到 localStorage
  useEffect(() => {
    if (typeof window === "undefined") return // 确保在SSR环境下不会出错

    try {
      localStorage.setItem(localStorageKey, JSON.stringify(expandedGroups))
    } catch (error) {
      // 处理潜在错误，例如 localStorage 已满或不可用
      console.error(`无法将分组展开状态保存到 localStorage: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [expandedGroups, localStorageKey])

  // 切换单个分组的展开/折叠状态
  const toggleGroup = useCallback((groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !(prev[groupName] ?? false), // 如果组名不存在于 prev 中，则默认为 false
    }))
  }, []) // 无需依赖项，因为 useState 返回的 setExpandedGroups 是稳定的

  // 设置特定分组的展开状态
  const setGroupExpanded = useCallback((groupName: string, isExpanded: boolean) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: isExpanded,
    }))
  }, [])

  // 展开或折叠所有分组
  const toggleAllGroups = useCallback((expand: boolean) => {
    setExpandedGroups(
      allGroupNames.reduce((acc, groupName) => {
        acc[groupName] = expand
        return acc
      }, {} as Record<string, boolean>),
    )
  }, [allGroupNames]) // 依赖于预计算的组名列表

  return { expandedGroups, toggleGroup, toggleAllGroups, setGroupExpanded }
}
