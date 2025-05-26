import { memo, useCallback } from "react"
import type { SourceID } from "@shared/types"
import { TEXT } from "./constants"

// 导出 AggregationView 类型，便于其他组件复用
export interface AggregationView {
  id: string
  name: string
  sources: SourceID[]
  updatedAt: number
}

export interface AggregationListItemProps {
  view: AggregationView
  isActive: boolean
  onSelect: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

// 共用按钮组件
interface ActionButtonProps {
  onClick: (e: React.MouseEvent) => void
  label: string
  icon: string
  color?: string
  title?: string
}

const ActionButton = memo(({
  onClick,
  label,
  icon,
  color = "text-primary",
  title,
}: ActionButtonProps) => (
  <button
    type="button"
    className={`btn text-neutral-500 hover:${color} p-1 flex items-center gap-1 text-xs`}
    onClick={onClick}
    title={title || label}
  >
    <span className={`${icon} text-base md:text-lg`}></span>
    <span className="hidden md:inline">{label}</span>
  </button>
))

export const AggregationListItem = memo(({
  view,
  isActive,
  onSelect,
  onEdit,
  onDelete,
}: AggregationListItemProps) => {
  // 阻止事件冒泡的处理函数
  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(view.id)
  }, [view.id, onEdit])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(view.id)
  }, [view.id, onDelete])

  return (
    <li
      className={$(
        "p-3 rounded-lg transition-all cursor-pointer",
        isActive
          ? "bg-primary/15 shadow-sm"
          : "bg-neutral-200/10 hover:bg-neutral-200/20 dark:bg-neutral-800/20 dark:hover:bg-neutral-700/30",
      )}
      onClick={onSelect} // Allow clicking the whole item to select
    >
      <div className="flex justify-between items-center">
        <span className="flex-1 font-medium">
          {view.name}
        </span>
        <div className="flex gap-1">
          <ActionButton
            onClick={handleEdit}
            label={TEXT.EDIT}
            icon="i-ph:pencil-simple-duotone"
            title={TEXT.EDIT}
          />
          <ActionButton
            onClick={handleDelete}
            label={TEXT.DELETE}
            icon="i-ph:trash-duotone"
            color="text-red-500"
            title={TEXT.DELETE}
          />
        </div>
      </div>
      <div className="text-xs text-neutral-500 mt-1">
        {view.sources.length}
        {" "}
        {TEXT.SOURCES}
        {" "}
        ·
        {" "}
        {new Date(view.updatedAt).toLocaleDateString()}
      </div>
    </li>
  )
})
