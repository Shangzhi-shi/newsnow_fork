import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useAtomValue } from "jotai"
import { sources } from "@shared/sources"
import type { SourceID } from "@shared/types"
import { aggregatedViewsAtom } from "~/atoms"
import { useAggregatedViewsMutation } from "~/hooks/useAggregatedViewsMutation"

interface ConfigFormProps {
  viewId: string | null // 如果提供则为编辑模式，否则为创建模式
  onClose: () => void
}

/**
 * 聚合视图的配置表单组件
 * 用于创建新的聚合视图或编辑现有聚合视图
 */
export function ConfigForm({ viewId, onClose }: ConfigFormProps) {
  const aggregatedViews = useAtomValue(aggregatedViewsAtom)
  const { createView, updateView, isCreating, isUpdating } = useAggregatedViewsMutation()

  // 表单状态
  const [name, setName] = useState("")
  const [selectedSources, setSelectedSources] = useState<SourceID[]>([])
  const [nameError, setNameError] = useState("")
  const [sourcesError, setSourcesError] = useState("")

  // 如果是编辑模式，加载现有配置
  useEffect(() => {
    if (viewId) {
      const existingView = aggregatedViews.find(view => view.id === viewId)
      if (existingView) {
        setName(existingView.name)
        setSelectedSources(existingView.sources)
      }
    }
  }, [viewId, aggregatedViews])

  // 处理源选择
  const toggleSource = useCallback((sourceId: SourceID) => {
    setSelectedSources(prev =>
      prev.includes(sourceId)
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId],
    )
    // 当选择源时清除错误
    setSourcesError("")
  }, [])

  // 验证表单
  const validateForm = useCallback((): boolean => {
    let isValid = true

    // 验证名称
    if (!name.trim()) {
      setNameError("请输入聚合视图名称")
      isValid = false
    } else {
      setNameError("")
    }

    // 验证是否选择了源
    if (selectedSources.length === 0) {
      setSourcesError("请至少选择一个新闻源")
      isValid = false
    } else {
      setSourcesError("")
    }

    return isValid
  }, [name, selectedSources])

  // 提交表单
  const handleSubmit = useCallback(() => {
    if (!validateForm()) return

    if (viewId) {
      // 编辑模式
      updateView({
        id: viewId,
        data: {
          name,
          sources: selectedSources,
        },
      })
    } else {
      // 创建模式
      createView({
        name,
        sources: selectedSources,
      })
    }

    onClose()
  }, [viewId, name, selectedSources, validateForm, createView, updateView, onClose])

  // 处理名称输入变化
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
    if (nameError && e.target.value.trim()) setNameError("")
  }, [nameError])

  // 生成可选择的新闻源列表，按名称排序并排除子源的父源
  const availableSources = useMemo(() => {
    return Object.entries(sources)
      .filter(([id]) => !id.includes("-") || !Object.keys(sources).includes(id.split("-")[0]))
      .map(([id, source]) => ({ id: id as SourceID, source }))
      .sort((a, b) => a.source.name.localeCompare(b.source.name, "zh-CN"))
  }, [])

  const isSubmitDisabled = isCreating || isUpdating

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-base p-6 rounded-xl shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
      >
        <h2 className="text-xl font-bold mb-4">
          {viewId ? "编辑聚合视图" : "创建新聚合视图"}
        </h2>

        {/* 表单内容 */}
        <div className="flex flex-col space-y-4 flex-1 overflow-hidden">
          {/* 名称输入 */}
          <div>
            <label htmlFor="view-name" className="block mb-1 font-medium">
              聚合视图名称
            </label>
            <input
              id="view-name"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="例如：科技资讯聚合"
              className={$(
                "w-full px-3 py-2 rounded-md border bg-base",
                nameError
                  ? "border-red-500"
                  : "border-neutral-300 dark:border-neutral-700",
              )}
            />
            {nameError && (
              <p className="text-red-500 text-sm mt-1">{nameError}</p>
            )}
          </div>

          {/* 新闻源选择 */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <label className="block mb-1 font-medium">
              选择新闻源
              <span className="ml-2 text-sm font-normal text-neutral-500">
                已选择
                {" "}
                {selectedSources.length}
                {" "}
                个源
              </span>
            </label>
            {sourcesError && (
              <p className="text-red-500 text-sm mb-2">{sourcesError}</p>
            )}

            <div className="flex-1 overflow-y-auto border border-neutral-300 dark:border-neutral-700 rounded-md p-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 content-start">
                {availableSources.map(({ id, source }) => (
                  <SourceItem
                    key={id}
                    id={id}
                    source={source}
                    isSelected={selectedSources.includes(id)}
                    onToggle={toggleSource}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 表单操作按钮 */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            className="btn px-4 py-2 bg-neutral-200/50 dark:bg-neutral-800/50 hover:bg-neutral-300 dark:hover:bg-neutral-700 rounded-md"
            onClick={onClose}
            disabled={isSubmitDisabled}
          >
            取消
          </button>
          <button
            type="button"
            className={$(
              "btn px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md flex items-center",
              isSubmitDisabled && "opacity-70 cursor-wait",
            )}
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
          >
            {isSubmitDisabled
              ? (
                  <>
                    <span className="i-ph:spinner-gap-duotone animate-spin mr-1"></span>
                    处理中...
                  </>
                )
              : (
                  <>
                    <span className="i-ph:floppy-disk-duotone mr-1"></span>
                    {viewId ? "更新" : "创建"}
                  </>
                )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

/**
 * 单个新闻源选择项组件
 */
interface SourceItemProps {
  id: SourceID
  source: {
    name: string
    title?: string
  }
  isSelected: boolean
  onToggle: (id: SourceID) => void
}

function SourceItem({ id, source, isSelected, onToggle }: SourceItemProps) {
  const handleClick = useCallback(() => {
    onToggle(id)
  }, [id, onToggle])

  return (
    <div
      className={$(
        "flex items-center p-2 rounded-md border cursor-pointer transition-all",
        isSelected
          ? "bg-primary/10 border-primary/30"
          : "bg-neutral-100/50 dark:bg-neutral-800/50 border-transparent hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50",
      )}
      onClick={handleClick}
    >
      <div
        className="w-5 h-5 rounded-full bg-cover mr-2 flex-shrink-0"
        style={{
          backgroundImage: `url(/icons/${id.split("-")[0]}.png)`,
        }}
      />
      <div className="flex-1 truncate">
        <div className="text-sm font-medium truncate" title={source.name}>
          {source.name}
        </div>
        {source.title && (
          <div className="text-xs text-neutral-500 truncate" title={source.title}>
            {source.title}
          </div>
        )}
      </div>
      <div className="ml-1">
        {isSelected
          ? (
              <span className="i-ph:check-circle-fill text-primary"></span>
            )
          : (
              <span className="i-ph:circle-thin text-neutral-400"></span>
            )}
      </div>
    </div>
  )
}
