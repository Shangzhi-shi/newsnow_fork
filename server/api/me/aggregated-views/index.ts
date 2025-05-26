import z from "zod"
import type { AggregatedViewConfig, SourceID } from "@shared/types"
import { randomUUID } from "@shared/utils"
import { UserTable } from "#/database/user"

// API响应类型
interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  config?: T
}

// 创建Schema定义
const createAggregatedViewSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(50, "名称不能超过50个字符"),
  sources: z.array(z.string()).min(1, "至少需要选择一个新闻源").max(100, "最多支持100个新闻源"),
})

const updateAggregatedViewSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(50, "名称不能超过50个字符").optional(),
  sources: z.array(z.string()).min(1, "至少需要选择一个新闻源").max(100, "最多支持100个新闻源").optional(),
}).refine(data => data.name !== undefined || data.sources !== undefined, {
  message: "至少需要提供一个要更新的字段",
})

/**
 * 生成随机ID
 */
function generateId(): string {
  // 使用shared工具中的randomUUID，更可靠、安全
  return randomUUID()
}

/**
 * 聚合视图配置API - 处理所有CRUD操作
 *
 * GET /api/me/aggregated-views - 获取所有聚合视图配置
 * GET /api/me/aggregated-views/:id - 获取特定ID的聚合视图配置
 * POST /api/me/aggregated-views - 创建新聚合视图配置
 * PUT /api/me/aggregated-views/:id - 更新特定ID的聚合视图配置
 * DELETE /api/me/aggregated-views/:id - 删除特定ID的聚合视图配置
 *
 * @authentication 所有操作都需要用户登录
 */
export default defineEventHandler(async (event) => {
  try {
    // 1. 验证用户身份和获取用户ID
    const userId = event.context.user?.id
    if (!userId) {
      throw createError({
        statusCode: 401,
        message: "用户未登录或会话已过期",
      })
    }

    // 2. 获取数据库连接
    const db = useDatabase()
    if (!db) {
      throw createError({
        statusCode: 503,
        message: "数据库服务不可用",
      })
    }

    // 3. 初始化用户表
    const userTable = new UserTable(db)

    // 4. 根据HTTP方法处理不同请求
    switch (event.method) {
      case "GET":
        return await handleGetRequest(event, userTable, userId)

      case "POST":
        return await handlePostRequest(event, userTable, userId)

      case "PUT":
        return await handlePutRequest(event, userTable, userId)

      case "DELETE":
        return await handleDeleteRequest(event, userTable, userId)

      default:
        throw createError({
          statusCode: 405,
          message: "不支持的请求方法",
        })
    }
  } catch (error: any) {
    // 处理Zod验证错误
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        message: error.errors.map(e => e.message).join(", "),
      })
    }

    // 处理其他错误
    logger.error(`聚合视图配置操作失败: ${error instanceof Error ? error.message : String(error)}`)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error instanceof Error ? error.message : "服务器内部错误",
      cause: error,
    })
  }
})

/**
 * 处理GET请求 - 获取聚合视图配置
 */
async function handleGetRequest(
  event: any,
  userTable: UserTable,
  userId: string,
): Promise<AggregatedViewConfig | AggregatedViewConfig[]> {
  const configId = getRouterParam(event, "id")

  // 获取所有配置
  const configs = await userTable.getAggregatedViewsConfig(userId)

  // 如果有ID参数，获取特定配置
  if (configId) {
    const config = configs.find(config => config.id === configId)

    if (!config) {
      throw createError({
        statusCode: 404,
        message: "找不到指定ID的聚合视图配置",
      })
    }

    return config
  }

  // 否则返回所有配置
  return configs
}

/**
 * 处理POST请求 - 创建新配置
 */
async function handlePostRequest(
  event: any,
  userTable: UserTable,
  userId: string,
): Promise<ApiResponse<AggregatedViewConfig>> {
  const body = await readBody(event)
  const validated = createAggregatedViewSchema.parse(body)

  const existingConfigs = await userTable.getAggregatedViewsConfig(userId)

  // 检查重名
  if (existingConfigs.some(config => config.name === validated.name)) {
    throw createError({
      statusCode: 409,
      message: "已存在同名的聚合视图配置",
    })
  }

  const now = Date.now()
  const newConfig: AggregatedViewConfig = {
    id: generateId(),
    name: validated.name,
    sources: validated.sources as SourceID[],
    createdAt: now,
    updatedAt: now,
  }

  const updatedConfigs = [...existingConfigs, newConfig]
  const success = await userTable.setAggregatedViewsConfig(userId, updatedConfigs)

  if (!success) {
    throw createError({
      statusCode: 500,
      message: "保存聚合视图配置失败",
    })
  }

  return {
    success: true,
    config: newConfig,
  }
}

/**
 * 处理PUT请求 - 更新配置
 */
async function handlePutRequest(
  event: any,
  userTable: UserTable,
  userId: string,
): Promise<ApiResponse<AggregatedViewConfig>> {
  const configId = getRouterParam(event, "id")
  if (!configId) {
    throw createError({
      statusCode: 400,
      message: "缺少配置ID",
    })
  }

  const body = await readBody(event)
  const validated = updateAggregatedViewSchema.parse(body)

  const existingConfigs = await userTable.getAggregatedViewsConfig(userId)
  const configIndex = existingConfigs.findIndex(config => config.id === configId)

  if (configIndex === -1) {
    throw createError({
      statusCode: 404,
      message: "找不到指定ID的聚合视图配置",
    })
  }

  // 如果名称已更改，检查是否与其他配置冲突
  if (validated.name && validated.name !== existingConfigs[configIndex].name) {
    const nameExists = existingConfigs.some(
      (config, idx) => idx !== configIndex && config.name === validated.name,
    )

    if (nameExists) {
      throw createError({
        statusCode: 409,
        message: "已存在同名的聚合视图配置",
      })
    }
  }

  const now = Date.now()
  const updatedConfig: AggregatedViewConfig = {
    ...existingConfigs[configIndex],
    ...(validated.name !== undefined && { name: validated.name }),
    ...(validated.sources !== undefined && { sources: validated.sources as SourceID[] }),
    updatedAt: now,
  }

  existingConfigs[configIndex] = updatedConfig
  const success = await userTable.setAggregatedViewsConfig(userId, existingConfigs)

  if (!success) {
    throw createError({
      statusCode: 500,
      message: "保存聚合视图配置失败",
    })
  }

  return {
    success: true,
    config: updatedConfig,
  }
}

/**
 * 处理DELETE请求 - 删除配置
 */
async function handleDeleteRequest(
  event: any,
  userTable: UserTable,
  userId: string,
): Promise<ApiResponse> {
  const configId = getRouterParam(event, "id")
  if (!configId) {
    throw createError({
      statusCode: 400,
      message: "缺少配置ID",
    })
  }

  const existingConfigs = await userTable.getAggregatedViewsConfig(userId)
  const filteredConfigs = existingConfigs.filter(config => config.id !== configId)

  if (filteredConfigs.length === existingConfigs.length) {
    throw createError({
      statusCode: 404,
      message: "找不到指定ID的聚合视图配置",
    })
  }

  const success = await userTable.setAggregatedViewsConfig(userId, filteredConfigs)

  if (!success) {
    throw createError({
      statusCode: 500,
      message: "删除聚合视图配置失败",
    })
  }

  return {
    success: true,
    message: "聚合视图配置已成功删除",
  }
}
