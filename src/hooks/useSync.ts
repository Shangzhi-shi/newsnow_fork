import type { PrimitiveMetadata } from "@shared/types"
import { useDebounce, useMount } from "react-use"
import { useRef } from "react"
import { useAtom } from "jotai"
import { useLogin } from "./useLogin"
import { useToast } from "./useToast"
import { myFetch, safeParseString } from "~/utils"
import { primitiveMetadataAtom } from "~/atoms"
import { preprocessMetadata } from "~/atoms/primitiveMetadataAtom"

/**
 * 从本地存储获取JWT令牌
 * @returns JWT令牌或undefined
 */
function getJWT(): string | undefined {
  return safeParseString(localStorage.getItem("jwt"))
}

/**
 * 处理同步过程中的错误
 * @param error 捕获的错误
 * @param logout 登出函数
 * @param login 登录函数
 * @param toaster 提示函数
 * @returns true表示错误已处理，false表示是状态码506（忽略处理）
 */
function handleSyncError(error: any, logout: () => void, login: () => void, toaster: any): boolean {
  if (error.statusCode === 506) {
    return false
  }

  toaster("身份校验失败，无法同步，请重新登录", {
    type: "error",
    action: {
      label: "登录",
      onClick: login,
    },
  })
  logout()
  return true
}

/**
 * 上传完整的元数据到服务器
 * 通过单一API请求同步所有数据，包括聚合视图配置
 */
async function uploadMetadata(metadata: PrimitiveMetadata, logout: () => void, login: () => void, toaster: any) {
  const jwt = getJWT()
  if (!jwt) return

  try {
    // 上传完整元数据，包括聚合视图配置
    await myFetch("/me/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: {
        data: metadata.data,
        updatedTime: metadata.updatedTime,
        aggregatedViews: metadata.aggregatedViews || [],
        pinnedColumns: metadata.pinnedColumns || [],
      },
    })
  } catch (e: any) {
    handleSyncError(e, logout, login, toaster)
  }
}

/**
 * 从服务器下载完整的元数据
 * 包括聚合视图配置和其他用户设置
 */
async function downloadMetadata(logout: () => void, login: () => void, toaster: any): Promise<PrimitiveMetadata | undefined> {
  const jwt = getJWT()
  if (!jwt) return

  try {
    // 下载完整元数据
    const response = await myFetch("/me/sync", {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    })

    const { data, updatedTime, aggregatedViews, pinnedColumns } = response

    // 不用同步 action 字段
    if (data) {
      return {
        action: "sync",
        data,
        updatedTime,
        aggregatedViews: Array.isArray(aggregatedViews) ? aggregatedViews : [],
        pinnedColumns: Array.isArray(pinnedColumns) ? pinnedColumns : [],
      }
    }
  } catch (e: any) {
    handleSyncError(e, logout, login, toaster)
  }
}

export function useSync() {
  const [primitiveMetadata, setPrimitiveMetadata] = useAtom(primitiveMetadataAtom)
  const { logout, login } = useLogin()
  const toaster = useToast()
  const lastSyncedRef = useRef<string>("")

  // 将当前元数据转换为字符串，用于比较是否变化
  const metadataString = JSON.stringify({
    data: primitiveMetadata.data,
    aggregatedViews: primitiveMetadata.aggregatedViews,
    pinnedColumns: primitiveMetadata.pinnedColumns,
  })

  useDebounce(async () => {
    // 仅在手动触发同步且数据发生变化时上传
    if (primitiveMetadata.action === "manual" && metadataString !== lastSyncedRef.current) {
      await uploadMetadata(primitiveMetadata, logout, login, toaster)
      lastSyncedRef.current = metadataString
    }
  }, 10000, [primitiveMetadata, metadataString])

  useMount(() => {
    const loadInitialData = async () => {
      try {
        const metadata = await downloadMetadata(logout, login, toaster)
        if (metadata) {
          setPrimitiveMetadata(preprocessMetadata(metadata))
          // 初始化同步标记
          lastSyncedRef.current = JSON.stringify({
            data: metadata.data,
            aggregatedViews: metadata.aggregatedViews,
            pinnedColumns: metadata.pinnedColumns,
          })
        }
      } catch (e) {
        console.error("初始数据加载失败", e)
      }
    }

    loadInitialData()
  })
}
