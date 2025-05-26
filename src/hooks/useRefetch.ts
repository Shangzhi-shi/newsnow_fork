import type { SourceID } from "@shared/types"
import { useCallback } from "react"
import { useUpdateQuery } from "./query"
import { useLogin } from "./useLogin"
import { useToast } from "./useToast"
import { refetchSources } from "~/utils/data"

/**
 * 提供强制刷新数据源的钩子函数
 * @returns {object} refresh 刷新方法和 refetchSources 记录刷新状态的集合
 */
export function useRefetch() {
  const { enableLogin, loggedIn, login } = useLogin()
  const toaster = useToast()
  const updateQuery = useUpdateQuery()

  // 优化回调函数，减少不必要的重复计算
  const refresh = useCallback((...sources: SourceID[]) => {
    // 没有指定源时，不执行任何操作
    if (sources.length === 0) return

    // 登录检查条件
    if (enableLogin && !loggedIn) {
      toaster("登录后可以强制拉取最新数据", {
        type: "warning",
        action: {
          label: "登录",
          onClick: login,
        },
      })
      return // 提前返回，避免执行后续逻辑
    }

    // 批量操作，提高性能
    refetchSources.clear()
    // 使用 Set 构造函数直接添加多个元素，避免循环
    sources.forEach(id => refetchSources.add(id))
    // 执行更新查询
    updateQuery(...sources)
  }, [loggedIn, toaster, login, enableLogin, updateQuery])

  return {
    refresh,
    refetchSources,
  }
}
