import { useAtom, useAtomValue } from "jotai"
import { useTitle, useWindowSize } from "react-use"
import { AnimatePresence, motion } from "framer-motion"
import { memo, useCallback, useMemo, useState } from "react"
import { useAutoAnimate } from "@formkit/auto-animate/react"
import { ConfigForm } from "./ConfigForm"
import { TEXT } from "./constants"
import { EmptyAggregation } from "./AggregationStates"
import { ActiveViewContent } from "./ActiveViewContent"
import { AggregationListItem } from "./AggregationListItem"
import { AggregationCard } from "./AggregationCard"
import { OverlayScrollbar } from "~/components/common/overlay-scrollbar"
import { NavBar } from "~/components/navbar"
import { useAggregatedViewsMutation } from "~/hooks/useAggregatedViewsMutation"
import { useAggregatedFeedQuery } from "~/hooks/useAggregatedFeedQuery"
import { activeAggregatedViewConfigAtom, activeAggregatedViewIdAtom, aggregatedViewsAtom } from "~/atoms"

// 样式常量
const CONTENT_HEIGHT = "h-[calc(100vh-180px)] md:h-[calc(100vh-120px)]"
const BUTTON_BASE_CLASS = "btn btn-icon-default text-lg p-1.5 bg-base bg-op-80! hover:bg-op-100! backdrop-blur-md shadow-lg rounded-full"
const CARD_WIDTH = 350 // 卡片宽度，与主页卡片保持一致
const ANIMATION_DURATION = 200 // 动画持续时间

// 提取可复用的创建按钮组件
const CreateButton = memo(({ onClick, className = "" }: { onClick: () => void, className?: string }) => (
  <button
    type="button"
    className={`btn bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-md flex items-center ${className}`}
    onClick={onClick}
  >
    <span className="i-ph:plus-circle-duotone mr-1"></span>
    {TEXT.CREATE_AGGREGATION}
  </button>
))

// 空状态卡片组件
const EmptyStateCard = memo(({ onCreateClick }: { onCreateClick: () => void }) => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center p-8 bg-base bg-op-70! backdrop-blur-md rounded-xl shadow-md max-w-md">
      <span className="i-ph:selection-plus-duotone text-5xl mb-4 block op-70"></span>
      <h2 className="text-xl font-bold mb-2">{TEXT.SELECT_OR_CREATE_TITLE}</h2>
      <p className="text-neutral-500 mb-4">
        {TEXT.SELECT_OR_CREATE_DESC}
      </p>
      <CreateButton onClick={onCreateClick} className="mx-auto" />
    </div>
  </div>
))

// 折叠/展开按钮组件
const SidebarToggleButton = memo(({
  isCollapsed,
  onClick,
}: {
  isCollapsed: boolean
  onClick: () => void
}) => isCollapsed
  ? (
      <button
        type="button"
        className={`${BUTTON_BASE_CLASS} hidden md:flex fixed left-1 top-1/2 transform -translate-y-1/2 z-30`}
        onClick={onClick}
        title={TEXT.EXPAND_LIST}
      >
        <span className="i-ph:arrow-line-right-duotone"></span>
      </button>
    )
  : (
      <button
        type="button"
        className={`${BUTTON_BASE_CLASS} hidden md:flex absolute z-30 top-1/2 right-[-15px] transform -translate-y-1/2`}
        onClick={onClick}
        title={TEXT.COLLAPSE_LIST}
      >
        <span className="i-ph:arrow-line-left-duotone"></span>
      </button>
    ))

// 聚合视图组件
export function MyAggregations() {
  useTitle("NewsNow | 我的聚合")
  const [activeViewId, setActiveViewId] = useAtom(activeAggregatedViewIdAtom)
  const aggregatedViews = useAtomValue(aggregatedViewsAtom)
  const activeView = useAtomValue(activeAggregatedViewConfigAtom)
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false)

  // 获取聚合数据
  const { data, isLoading, isError, error, forceRefresh } = useAggregatedFeedQuery(
    activeView ? activeView.sources : aggregatedViews.flatMap(view => view.sources),
  )

  const { deleteView } = useAggregatedViewsMutation()

  // 优化表单状态管理
  const [formState, setFormState] = useState<{ isOpen: boolean, editingId: string | null }>({
    isOpen: false,
    editingId: null,
  })

  // 自动动画参考
  const [parent] = useAutoAnimate({ duration: ANIMATION_DURATION })

  // 窗口大小
  const { width } = useWindowSize()

  // 计算卡片Grid布局的最小宽度
  const minCardWidth = useMemo(() => Math.min(width - 32, CARD_WIDTH), [width])

  // 表单处理方法
  const openCreateForm = useCallback(() => setFormState({ isOpen: true, editingId: null }), [])
  const openEditForm = useCallback((viewId: string) => setFormState({ isOpen: true, editingId: viewId }), [])
  const closeForm = useCallback(() => setFormState(prev => ({ ...prev, isOpen: false })), [])

  // 删除视图处理
  const handleDeleteView = useCallback((viewId: string) => {
    deleteView(viewId)
    if (activeViewId === viewId) {
      setActiveViewId(null)
    }
  }, [deleteView, activeViewId, setActiveViewId])

  // 视图选择处理
  const handleViewSelection = useCallback((viewId: string) => {
    setActiveViewId(activeViewId === viewId ? null : viewId)
  }, [activeViewId, setActiveViewId])

  // 切换左侧边栏状态
  const toggleLeftSidebar = useCallback(() => setIsLeftSidebarCollapsed(prev => !prev), [])

  // 计算左侧栏样式
  const sidebarClasses = useMemo(() => {
    const baseClasses = "flex-shrink-0 bg-base bg-op-70! backdrop-blur-md rounded-xl shadow-md transition-all duration-300 ease-in-out relative"
    const displayClasses = isLeftSidebarCollapsed
      ? "md:w-0 md:opacity-0 md:invisible md:p-0 md:border-0 overflow-hidden"
      : "md:w-[calc(25%-1rem)] p-4 md:mr-4 overflow-visible"

    return `${baseClasses} ${displayClasses}`
  }, [isLeftSidebarCollapsed])

  // 使用useMemo优化渲染状态判断
  const renderState = useMemo(() => ({
    showLeftSidebarContent: !isLeftSidebarCollapsed,
    showExpandButton: isLeftSidebarCollapsed,
    showListView: !!activeViewId,
    showCardView: !activeViewId,
    hasAggregatedViews: aggregatedViews.length > 0,
  }), [isLeftSidebarCollapsed, activeViewId, aggregatedViews.length])

  // 使用memo缓存聚合视图列表
  const aggregatedViewsList = useMemo(() => (
    aggregatedViews.map(view => (
      <AggregationListItem
        key={view.id}
        view={view}
        isActive={activeViewId === view.id}
        onSelect={() => handleViewSelection(view.id)}
        onEdit={() => openEditForm(view.id)}
        onDelete={() => handleDeleteView(view.id)}
      />
    ))
  ), [aggregatedViews, activeViewId, handleViewSelection, openEditForm, handleDeleteView])

  // 渲染网格布局的聚合视图卡片
  const renderAggregationCards = useMemo(() => {
    if (!renderState.hasAggregatedViews) {
      return <EmptyStateCard onCreateClick={openCreateForm} />
    }

    return (
      <OverlayScrollbar
        className="h-full p-2 overflow-y-auto"
        options={{
          overflow: { x: "hidden", y: "scroll" },
          scrollbars: {
            theme: "os-theme-dark",
            visibility: "auto",
            autoHide: "move",
            autoHideDelay: 1300,
          },
        }}
        defer
      >
        {/* 卡片网格布局 */}
        <motion.ol
          className="grid w-full gap-6"
          ref={parent}
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}px, 1fr))`,
          }}
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                delayChildren: 0.1,
                staggerChildren: 0.1,
              },
            },
          }}
        >
          {aggregatedViews.map(view => (
            <motion.li
              key={view.id}
              transition={{
                type: "tween",
                duration: ANIMATION_DURATION / 1000,
              }}
              variants={{
                hidden: { y: 20, opacity: 0 },
                visible: { y: 0, opacity: 1 },
              }}
            >
              <AggregationCard
                view={view}
                onSelect={() => handleViewSelection(view.id)}
                onEdit={() => openEditForm(view.id)}
                onDelete={() => handleDeleteView(view.id)}
              />
            </motion.li>
          ))}
        </motion.ol>
      </OverlayScrollbar>
    )
  }, [renderState.hasAggregatedViews, aggregatedViews, minCardWidth, parent, handleViewSelection, openCreateForm, openEditForm, handleDeleteView])

  return (
    <>
      {/* 移动端导航 */}
      <div className="flex justify-center md:hidden mb-6">
        <NavBar />
      </div>

      <div className="flex relative">
        {/* 聚合配置管理区 - 左侧面板 */}
        <div className={sidebarClasses}>
          {renderState.showLeftSidebarContent && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">我的聚合视图</h2>
                <CreateButton onClick={openCreateForm} />
              </div>

              {!renderState.hasAggregatedViews
                ? (
                    <EmptyAggregation />
                  )
                : (
                    <ul className="space-y-2 overflow-y-auto max-h-[calc(100vh-220px)]">
                      {aggregatedViewsList}
                    </ul>
                  )}

              {/* 折叠按钮 - 只在面板展开时显示 */}
              <SidebarToggleButton isCollapsed={false} onClick={toggleLeftSidebar} />
            </>
          )}
        </div>

        {/* 折叠状态下的展开按钮 */}
        {renderState.showExpandButton && (
          <SidebarToggleButton isCollapsed onClick={toggleLeftSidebar} />
        )}

        {/* 聚合新闻展示区 - 右侧面板 */}
        <div className="flex-1 min-w-0">
          <div className={CONTENT_HEIGHT}>
            {renderState.showListView
              ? (
                  <ActiveViewContent
                    activeView={activeView}
                    data={data}
                    isLoading={isLoading}
                    isError={isError}
                    error={error}
                    forceRefresh={forceRefresh}
                  />
                )
              : (
                  renderAggregationCards
                )}
          </div>
        </div>
      </div>

      {/* 配置表单模态框 */}
      <AnimatePresence>
        {formState.isOpen && (
          <ConfigForm
            viewId={formState.editingId}
            onClose={closeForm}
          />
        )}
      </AnimatePresence>
    </>
  )
}
