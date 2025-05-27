import process from "node:process"
import type { PrimitiveMetadata } from "@shared/types"
import { ZodError } from "zod"
import { UserTable } from "#/database/user"

/**
 * 解析用户数据到标准格式
 * @param data 从数据库获取的JSON字符串数据
 * @param userId 用户ID，用于错误日志
 * @returns 解析后的对象
 */
function parseUserData(data: string | null, userId: string): Record<string, any> {
  if (!data) return {}

  try {
    return JSON.parse(data)
  } catch (error: any) {
    console.error(`JSON解析错误: ${error.message}`, { userId })
    // 返回空对象作为默认值，确保API不会因格式错误而完全失败
    return {}
  }
}

export default defineEventHandler(async (event) => {
  try {
    const { id } = event.context.user
    const db = useDatabase()
    if (!db) throw new Error("数据库连接失败")

    const userTable = new UserTable(db)
    if (process.env.INIT_TABLE !== "false") await userTable.init()

    // 根据HTTP方法处理不同请求
    if (event.method === "GET") {
      // 获取用户数据
      const { data, updated } = await userTable.getData(id)
      const parsedData = parseUserData(data, id)

      return {
        data: parsedData.data || undefined,
        updatedTime: updated,
        aggregatedViews: parsedData.aggregated_views_config || [],
        pinnedColumns: parsedData.pinnedColumns || [],
      }
    } else if (event.method === "POST") {
      // 保存用户数据
      const body = await readBody(event) as PrimitiveMetadata
      verifyPrimitiveMetadata(body)

      const { updatedTime, data, aggregatedViews, pinnedColumns } = body

      const completeData = {
        data,
        aggregated_views_config: aggregatedViews || [],
        pinnedColumns: pinnedColumns || [],
      }

      await userTable.setData(id, JSON.stringify(completeData), updatedTime)

      return {
        success: true,
        updatedTime,
      }
    } else {
      // 处理不支持的方法
      throw createError({
        statusCode: 405,
        message: "Method Not Allowed",
      })
    }
  } catch (error: unknown) {
    logger.error(error)

    // 更友好的错误处理
    if (error instanceof ZodError) {
      throw createError({
        statusCode: 400,
        message: "Invalid data format",
        data: error.errors,
      })
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Internal Server Error",
    })
  }
})
