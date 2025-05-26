import type { AggregatedViewConfig, PrimitiveMetadata } from "@shared/types"
import { useDebounce, useMount } from "react-use"
import { useLogin } from "./useLogin"
import { useToast } from "./useToast"
import { safeParseString } from "~/utils"

async function uploadMetadata(metadata: PrimitiveMetadata) {
  const jwt = safeParseString(localStorage.getItem("jwt"))
  if (!jwt) return
  await myFetch("/me/sync", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: {
      data: metadata.data,
      updatedTime: metadata.updatedTime,
    },
  })

  // 同步聚合视图配置
  // 从localStorage获取聚合视图配置
  const aggregatedViewsConfig = safeParseString(localStorage.getItem("aggregated-views-config"))
  if (aggregatedViewsConfig) {
    try {
      await myFetch("/me/aggregated-views", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })

      // 针对每个本地聚合视图配置，检查是否需要在服务器上创建或更新
      for (const config of aggregatedViewsConfig) {
        try {
          // 尝试更新或创建配置
          await myFetch(`/me/aggregated-views${config.id ? `/${config.id}` : ""}`, {
            method: config.id ? "PUT" : "POST",
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
            body: {
              name: config.name,
              sources: config.sources,
            },
          })
        } catch (error) {
          console.error(`同步聚合视图配置失败: ${config.id || "new"}`, error)
        }
      }
    } catch (error) {
      console.error("获取远程聚合视图配置失败", error)
    }
  }
}

async function downloadMetadata(): Promise<PrimitiveMetadata | undefined> {
  const jwt = safeParseString(localStorage.getItem("jwt"))
  if (!jwt) return
  const { data, updatedTime } = await myFetch("/me/sync", {
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  }) as PrimitiveMetadata
  // 不用同步 action 字段
  if (data) {
    // 下载聚合视图配置
    try {
      const serverAggregatedViewsConfig = await myFetch("/me/aggregated-views", {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }) as AggregatedViewConfig[]

      // "本地优先"的合并逻辑
      if (Array.isArray(serverAggregatedViewsConfig)) {
        const localConfigString = localStorage.getItem("aggregated-views-config")
        let localConfigs: AggregatedViewConfig[] = []
        if (localConfigString) {
          try {
            localConfigs = JSON.parse(localConfigString)
            if (!Array.isArray(localConfigs)) {
              localConfigs = [] // 如果解析结果不是数组，则重置
            }
          } catch (e) {
            console.error("解析本地聚合视图配置失败", e)
            localConfigs = [] // 解析失败则重置
          }
        }

        const localConfigIds = new Set(localConfigs.map(c => c.id))
        const configsToAdd = serverAggregatedViewsConfig.filter(serverConfig => !localConfigIds.has(serverConfig.id))

        if (configsToAdd.length > 0) {
          const mergedConfigs = [...localConfigs, ...configsToAdd]
          localStorage.setItem("aggregated-views-config", JSON.stringify(mergedConfigs))
          // 注意：这里直接修改了localStorage，Jotai的atomWithStorage可能需要重新初始化或手动更新其状态
          // 一个更健壮的方法是更新Jotai atom，让它来处理localStorage的更新。
          // 但基于当前代码结构，我们先直接修改localStorage。后续可以优化。
        }
      }
    } catch (error) {
      console.error("下载或合并聚合视图配置失败", error)
    }

    return {
      action: "sync",
      data,
      updatedTime,
    }
  }
}

export function useSync() {
  const [primitiveMetadata, setPrimitiveMetadata] = useAtom(primitiveMetadataAtom)
  const { logout, login } = useLogin()
  const toaster = useToast()

  useDebounce(async () => {
    const fn = async () => {
      try {
        await uploadMetadata(primitiveMetadata)
      } catch (e: any) {
        if (e.statusCode !== 506) {
          toaster("身份校验失败，无法同步，请重新登录", {
            type: "error",
            action: {
              label: "登录",
              onClick: login,
            },
          })
          logout()
        }
      }
    }

    if (primitiveMetadata.action === "manual") {
      fn()
    }
  }, 10000, [primitiveMetadata])
  useMount(() => {
    const fn = async () => {
      try {
        const metadata = await downloadMetadata()
        if (metadata) {
          setPrimitiveMetadata(preprocessMetadata(metadata))
        }
      } catch (e: any) {
        if (e.statusCode !== 506) {
          toaster("身份校验失败，无法同步，请重新登录", {
            type: "error",
            action: {
              label: "登录",
              onClick: login,
            },
          })
          logout()
        }
      }
    }
    fn()
  })
}
