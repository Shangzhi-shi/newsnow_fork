import z from "zod"

/**
 * 聚合视图配置对象的验证模式
 */
const aggregatedViewConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  sources: z.array(z.string()),
  createdAt: z.number(),
  updatedAt: z.number(),
})

/**
 * 原始元数据对象的验证模式
 * 使用 zod 库定义的数据结构验证模式
 */
const primitiveMetadataSchema = z.object({
  data: z.record(z.string(), z.array(z.string())), // 验证 data 字段格式：键为字符串，值为字符串数组
  updatedTime: z.number(), // 验证 updatedTime 字段为数字
  pinnedColumns: z.array(z.string()).optional(), // 验证 pinnedColumns 字段为可选的字符串数组
  aggregatedViews: z.array(aggregatedViewConfigSchema).optional(), // 验证 aggregatedViews 字段为可选的聚合视图配置数组
})

/**
 * 验证原始元数据对象格式是否符合要求。
 * 使用 zod 库进行运行时类型检查，确保数据结构满足预期格式。
 *
 * @param {unknown} target - 需要验证的元数据对象
 * @returns {object} - 返回经过验证的元数据对象（如果验证失败则抛出异常）
 */
export function verifyPrimitiveMetadata(target: unknown) {
  return primitiveMetadataSchema.parse(target)
}
