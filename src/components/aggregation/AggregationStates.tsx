import { memo } from "react"
import { TEXT } from "./constants"

// 提取共用样式
const CENTERED_CONTAINER = "flex flex-col items-center justify-center h-full"
const SECONDARY_TEXT = "text-sm text-gray-500 dark:text-gray-400"
const ICON_BUTTON = "mt-4 btn i-ph:arrow-counter-clockwise-duotone btn-icon-default text-lg"

// 图标按钮组件
interface IconButtonProps {
  onClick: () => void
  title: string
}

const IconButton = memo(({ onClick, title }: IconButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={ICON_BUTTON}
    title={title}
  />
))

// 空聚合状态
export const EmptyAggregation = memo(() => (
  <div className="text-center py-8 text-neutral-400">
    <span className="i-ph:newspaper-clipping-duotone block mx-auto text-4xl mb-2"></span>
    <p>{TEXT.NO_AGGREGATION_YET}</p>
    <p className="text-sm">{TEXT.CLICK_TO_CREATE_FIRST}</p>
  </div>
))

// 选择提示组件
export interface SelectPromptProps {
  onCreateNew: () => void
}

export const SelectPrompt = memo(({ onCreateNew }: SelectPromptProps) => (
  <div className={`${CENTERED_CONTAINER} bg-base bg-op-70! backdrop-blur-md p-8 rounded-xl shadow-md`}>
    <span className="i-ph:selection-plus-duotone text-5xl mb-4 op-70"></span>
    <h2 className="text-xl font-bold mb-2">{TEXT.SELECT_OR_CREATE_TITLE}</h2>
    <p className="text-neutral-500 text-center max-w-md">
      {TEXT.SELECT_OR_CREATE_DESC}
    </p>
    <button
      type="button"
      className="mt-4 btn bg-primary/10 hover:bg-primary/20 px-4 py-2 rounded-md flex items-center"
      onClick={onCreateNew}
    >
      <span className="i-ph:plus-circle-duotone mr-1"></span>
      {TEXT.CREATE_AGGREGATION}
    </button>
  </div>
))

// 定义聚合视图类型，限制为必要字段
export interface AggregatedView {
  id: string
  name: string
  sources: string[]
  [key: string]: unknown // 将any改为unknown以增强类型安全性
}

// 获取适当的空状态消息
function getEmptyStateMessage(activeView: AggregatedView | null): string {
  if (!activeView) return TEXT.NO_VIEW_SELECTED
  if (activeView.sources.length === 0) return TEXT.NO_SOURCES_ADDED
  return TEXT.NO_SOURCE_DATA
}

// 空状态显示
export interface EmptyStateDisplayProps {
  activeView: AggregatedView | null
  onRefresh?: () => void
}

export const EmptyStateDisplay = memo(({
  activeView,
  onRefresh,
}: EmptyStateDisplayProps) => (
  <div className={CENTERED_CONTAINER}>
    <div className="mb-2">{TEXT.NO_DATA}</div>
    <div className={SECONDARY_TEXT}>
      {getEmptyStateMessage(activeView)}
    </div>
    {activeView && onRefresh && (
      <IconButton onClick={onRefresh} title={TEXT.REFRESH} />
    )}
  </div>
))

// 加载状态
export const LoadingState = memo(() => (
  <div className={CENTERED_CONTAINER}>
    <div className="flex flex-col items-center">
      <div className="i-ph-spinner animate-spin w-6 h-6"></div>
      <div className={`mt-2 ${SECONDARY_TEXT}`}>{TEXT.LOADING}</div>
    </div>
  </div>
))

// 错误状态
export interface ErrorStateProps {
  error: Error | null
  onRetry: () => void
}

export const ErrorState = memo(({
  error,
  onRetry,
}: ErrorStateProps) => (
  <div className={CENTERED_CONTAINER}>
    <div className="text-red-500 mb-2">{TEXT.LOAD_FAILED}</div>
    <div className={SECONDARY_TEXT}>{error?.message || TEXT.UNKNOWN_ERROR}</div>
    <IconButton onClick={onRetry} title={TEXT.RETRY} />
  </div>
))
