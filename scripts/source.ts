import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { pinyin } from "@napi-rs/pinyin"
import { consola } from "consola"
import { projectDir } from "../shared/dir"
import { genSources } from "../shared/pre-sources"
import { columns } from "../shared/metadata"

// 辅助函数：获取新闻源用于生成拼音的显示字符串
function getSourceTextForPinyin(source: { name: string, title?: string }): string {
  return source.title ? `${source.name}-${source.title}` : source.name
}

// 辅助函数：写入 JSON 文件并处理日志
function writeJsonOutput(
  filename: string,
  data: object,
  successMessage: string,
  errorMessage: string,
) {
  try {
    writeFileSync(
      join(projectDir, `./shared/${filename}`),
      JSON.stringify(data, undefined, 2),
    )
    consola.info(successMessage)
  } catch (error) {
    consola.error(errorMessage, error)
  }
}

const sources = genSources()

// 生成 pinyin.json
const pinyinMap = Object.fromEntries(
  Object.entries(sources)
    .filter(([, v]) => !v.redirect)
    .map(([k, v]) => {
      return [k, pinyin(getSourceTextForPinyin(v)).join("")]
    }),
)
writeJsonOutput(
  "pinyin.json",
  pinyinMap,
  "Generated pinyin.json",
  "Failed to generate pinyin.json",
)

// 生成 sources.json
// 假设 genSources() 返回的 sources 对象结构可能不是直接的 { id: data } 形式，
// 或者需要确保只包含特定处理后的数据，因此保留 Object.fromEntries(Object.entries(sources))
// 如果 sources 已经是最终的 JSON 结构，这里可以简化为直接传递 sources。
writeJsonOutput(
  "sources.json",
  Object.fromEntries(Object.entries(sources)),
  "Generated sources.json",
  "Failed to generate sources.json",
)

// 生成 category-pinyin.json
const categoryPinyinMap = Object.fromEntries(
  Object.entries(columns)
    .filter(([_, columnData]) => columnData && columnData.zh)
    .map(([columnId, columnData]) => [
      columnId,
      pinyin(columnData.zh).join(""),
    ]),
)
writeJsonOutput(
  "category-pinyin.json",
  categoryPinyinMap,
  "Generated category-pinyin.json",
  "Failed to generate category-pinyin.json",
)
