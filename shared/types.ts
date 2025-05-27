import type { colors } from "unocss/preset-mini"
import type { columns, fixedColumnIds } from "./metadata"
import type { originSources } from "./pre-sources"

/**
 * 颜色类型，可以是 "primary" 或 UnoCSS 预设颜色（排除特定值）
 */
export type Color = "primary" | Exclude<keyof typeof colors, "current" | "inherit" | "transparent" | "black" | "white">

/**
 * 原始新闻源数据的类型
 */
type ConstSources = typeof originSources
/**
 * 主新闻源 ID 类型
 */
type MainSourceID = keyof(ConstSources)

/**
 * 新闻源 ID 类型，可以是主新闻源 ID 或子新闻源 ID（格式为 "主ID-子ID"）
 * 排除了被禁用的新闻源
 */
export type SourceID = {
  [Key in MainSourceID]: ConstSources[Key] extends { disable?: true } ? never :
    ConstSources[Key] extends { sub?: infer SubSource } ? {
    // @ts-expect-error 这里是类型系统的技术限制，可以忽略这个错误
      [SubKey in keyof SubSource]: SubSource[SubKey] extends { disable?: true } ? never : `${Key}-${SubKey}`
    }[keyof SubSource] | Key : Key;
}[MainSourceID]

/**
 * 所有新闻源 ID 类型，包括主新闻源和子新闻源
 * 不考虑禁用状态
 */
export type AllSourceID = {
  [Key in MainSourceID]: ConstSources[Key] extends { sub?: infer SubSource } ? keyof {
    // @ts-expect-error 这里是类型系统的技术限制，可以忽略这个错误
    [SubKey in keyof SubSource as `${Key}-${SubKey}`]: never
  } | Key : Key
}[MainSourceID]

// 栏目/分类 ID 类型
export type ColumnID = keyof typeof columns

/**
 *  栏目/分类接口，用于应用内部对栏目信息的统一表示。
 *  注意：这与 shared/metadata.ts 中 columns 常量的具体结构略有不同，
 *  前者（metadata.ts）主要用于定义原始配置数据，包含 `zh` 字段表示中文名；
 *  此处的 Column 接口使用 `name` 字段，通常在前端处理后，统一用 `name` 表示其显示名称。
 */
export interface Column {
  /** 栏目显示名称 */
  name: string
  /** 该栏目包含的新闻源 ID 数组 */
  sources: SourceID[]
}

/**
 * 元数据类型，记录每个栏目 ID 到其对应栏目信息（通常是经过处理的 Column 结构）的映射。
 */
export type Metadata = Record<ColumnID, Column>

/**
 * 原始元数据接口，用于存储用户配置的列数据和同步状态
 */
export interface PrimitiveMetadata {
  /** 最后更新时间戳 */
  updatedTime: number
  /** 固定栏目 ID 到新闻源 ID 数组的映射 */
  data: Record<FixedColumnID, SourceID[]>
  /** 用户置顶的栏目 ID 数组 */
  pinnedColumns?: ColumnID[]
  /** 数据操作类型：初始化、手动更新或同步 */
  action: "init" | "manual" | "sync"
  /** 用户自定义的聚合视图配置 */
  aggregatedViews?: AggregatedViewConfig[]
}

/**
 * 用户自定义聚合视图配置接口
 */
export interface AggregatedViewConfig {
  /** 聚合视图唯一标识 */
  id: string
  /** 聚合视图名称 */
  name: string
  /** 包含的新闻源ID数组 */
  sources: SourceID[]
  /** 创建时间戳 */
  createdAt: number
  /** 最后更新时间戳 */
  updatedAt: number
}

// 固定栏目 ID 类型（在顶部导航栏中固定显示的栏目）
export type FixedColumnID = (typeof fixedColumnIds)[number]
// 隐藏栏目 ID 类型（不在固定栏目中的其他栏目）
export type HiddenColumnID = Exclude<ColumnID, FixedColumnID>

/**
 * 原始子新闻源配置项接口
 */
interface OriginSubSourceItemConfig extends Partial<Omit<Source, "title" | "name" | "redirect">> {
  /**
   * 小标题，通常用于子新闻源的显示名称
   */
  title: string
  // 以下为可选属性，如果未来需要，可以取消注释并确保类型正确
  // type?: "hottest" | "realtime";
  // desc?: string;
  // column?: ColumnID; // 如果使用，确保 ColumnID 类型适用或定义 ManualColumnID
  // color?: Color;
  // home?: string;
  // disable?: boolean;
  // interval?: number;
}

/**
 * 原始新闻源配置接口，定义在 pre-sources 文件中的格式
 */
export interface OriginSource extends Partial<Omit<Source, "name" | "redirect">> {
  /** 新闻源名称 */
  name: string
  /** 子新闻源配置 */
  sub?: Record<string, OriginSubSourceItemConfig>
}

/**
 * 新闻源配置接口，处理后的完整新闻源信息
 */
export interface Source {
  /** 新闻源名称 */
  name: string
  /**
   * 刷新的间隔时间（单位：毫秒）
   */
  interval: number
  /** 新闻源颜色 */
  color: Color

  /**
   * 小标题，通常用于显示新闻源的补充信息
   */
  title?: string
  /** 描述信息 */
  desc?: string
  /**
   * 新闻源类型，默认为普通时间线
   * - hottest: 热门新闻
   * - realtime: 实时新闻
   */
  type?: "hottest" | "realtime"
  /** 所属的非固定栏目 */
  column?: HiddenColumnID
  /** 新闻源主页 URL */
  home?: string
  /**
   * 是否禁用
   * - false: 启用（默认）
   * - true: 完全禁用
   * - "cf": 在 Cloudflare 环境下禁用
   */
  disable?: boolean | "cf"
  /** 重定向到其他新闻源 */
  redirect?: SourceID
}

/**
 * 图标配置接口
 */
interface IconConfig {
  /** 图标 URL */
  url: string
  /** 图标缩放比例 */
  scale: number
}

/**
 * 新闻条目附加信息接口
 */
interface NewsItemExtra {
  /** 鼠标悬停时显示的信息 */
  hover?: string
  /** 日期信息 */
  date?: number | string
  /** 额外信息 */
  info?: false | string
  /** 时间差异（例如与当前时间的差异，具体单位取决于实现） */
  diff?: number
  /** 图标配置 */
  icon?: false | string | IconConfig
}

/**
 * 单个新闻条目接口
 */
export interface NewsItem {
  /** 唯一标识 */
  id: string | number
  /** 新闻标题 */
  title: string
  /** 新闻链接 */
  url: string
  /** 移动版链接 */
  mobileUrl?: string
  /** 发布日期 */
  pubDate?: number | string
  /** 额外信息对象 */
  extra?: NewsItemExtra
}

/**
 * 新闻源响应接口，API 返回的格式
 */
export interface SourceResponse {
  /** 响应状态：成功或使用缓存 */
  status: "success" | "cache"
  /** 新闻源 ID */
  id: SourceID
  /** 更新时间 */
  updatedTime: number | string
  /** 新闻条目数组 */
  items: NewsItem[]
}
