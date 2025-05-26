import type { Database } from "db0"
import type { AggregatedViewConfig } from "@shared/types"
import type { UserInfo } from "#/types"

export class UserTable {
  private db
  constructor(db: Database) {
    this.db = db
  }

  async init() {
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS user (
        id TEXT PRIMARY KEY,
        email TEXT,
        data TEXT,
        type TEXT,
        created INTEGER,
        updated INTEGER
      );
    `).run()
    await this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_user_id ON user(id);
    `).run()
    logger.success(`init user table`)
  }

  async addUser(id: string, email: string, type: "github") {
    const u = await this.getUser(id)
    const now = Date.now()
    if (!u) {
      await this.db.prepare(`INSERT INTO user (id, email, data, type, created, updated) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(id, email, "", type, now, now)
      logger.success(`add user ${id}`)
    } else if (u.email !== email && u.type !== type) {
      await this.db.prepare(`UPDATE user SET email = ?, updated = ? WHERE id = ?`).run(email, now, id)
      logger.success(`update user ${id} email`)
    } else {
      logger.info(`user ${id} already exists`)
    }
  }

  async getUser(id: string) {
    return (await this.db.prepare(`SELECT id, email, data, created, updated FROM user WHERE id = ?`).get(id)) as UserInfo
  }

  async setData(key: string, value: string, updatedTime = Date.now()) {
    const state = await this.db.prepare(
      `UPDATE user SET data = ?, updated = ? WHERE id = ?`,
    ).run(value, updatedTime, key)
    if (!state.success) throw new Error(`set user ${key} data failed`)
    logger.success(`set ${key} data`)
  }

  async getData(id: string) {
    const row: any = await this.db.prepare(`SELECT data, updated FROM user WHERE id = ?`).get(id)
    if (!row) throw new Error(`user ${id} not found`)
    logger.success(`get ${id} data`)
    return row as {
      data: string
      updated: number
    }
  }

  /**
   * 获取用户特定键名下的数据
   * @param userId 用户ID
   * @param dataKey 数据键名
   * @returns 指定键名下的数据，如果不存在则返回null
   */
  async getDataByKey<T>(userId: string, dataKey: string): Promise<T | null> {
    try {
      const { data } = await this.getData(userId)
      if (!data) return null

      // 尝试解析现有JSON数据
      const jsonData = data ? JSON.parse(data) : {}
      return (jsonData[dataKey] as T) || null
    } catch (error) {
      logger.error(`Failed to get ${dataKey} for user ${userId}: ${error}`)
      return null
    }
  }

  /**
   * 设置用户特定键名下的数据
   * @param userId 用户ID
   * @param dataKey 数据键名
   * @param value 要设置的数据
   * @returns 成功返回true，失败返回false
   */
  async setDataByKey<T>(userId: string, dataKey: string, value: T): Promise<boolean> {
    try {
      // 获取现有数据
      let existingData: Record<string, any> = {}
      try {
        const { data } = await this.getData(userId)
        existingData = data ? JSON.parse(data) : {}
      } catch (error) {
        // 如果获取失败或解析失败，使用空对象
        logger.warn(`Failed to get existing data for user ${userId}, using empty object: ${error}`)
      }

      // 更新特定键的数据
      existingData[dataKey] = value

      // 保存更新后的数据
      await this.setData(userId, JSON.stringify(existingData))
      logger.success(`Set ${dataKey} for user ${userId}`)
      return true
    } catch (error) {
      logger.error(`Failed to set ${dataKey} for user ${userId}: ${error}`)
      return false
    }
  }

  /**
   * 获取用户的聚合视图配置列表
   * @param userId 用户ID
   * @returns 聚合视图配置数组，如果不存在则返回空数组
   */
  async getAggregatedViewsConfig(userId: string): Promise<AggregatedViewConfig[]> {
    const config = await this.getDataByKey<AggregatedViewConfig[]>(userId, "aggregated_views_config")
    return config || []
  }

  /**
   * 设置用户的聚合视图配置列表
   * @param userId 用户ID
   * @param config 聚合视图配置数组
   * @returns 成功返回true，失败返回false
   */
  async setAggregatedViewsConfig(userId: string, config: AggregatedViewConfig[]): Promise<boolean> {
    return this.setDataByKey(userId, "aggregated_views_config", config)
  }

  async deleteUser(key: string) {
    const state = await this.db.prepare(`DELETE FROM user WHERE id = ?`).run(key)
    if (!state.success) throw new Error(`delete user ${key} failed`)
    logger.success(`delete user ${key}`)
  }
}
