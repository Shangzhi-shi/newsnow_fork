import { createFileRoute, redirect } from "@tanstack/react-router"
import { useSetAtom } from "jotai"
import { Suspense, lazy, memo, useEffect } from "react"
import { fixedColumnIds } from "@shared/metadata"
import type { ColumnID } from "@shared/types"
import { currentColumnIDAtom } from "~/atoms"
import { Column } from "~/components/column"

// 1. 定义 LazyMyAggregations，因为它被 SectionComponent 使用
const LazyMyAggregations = lazy(() =>
  import("~/components/aggregation/MyAggregations").then(module => ({
    default: module.MyAggregations,
  })),
)

// 2. 定义 SectionComponent
// 它内部会用到 Route.useParams()，但这将在 Route 定义之后安全调用
/**
 * 根据路由参数渲染对应的内容组件
 * 当参数为"my-aggregations"时渲染聚合视图，否则渲染普通Column组件
 */
const SectionComponent = memo(() => {
  // 使用 ESLint 注释禁用特定行的规则检查
  // eslint-disable-next-line ts/no-use-before-define
  const { column } = Route.useParams()
  const setCurrentColumnID = useSetAtom(currentColumnIDAtom)

  useEffect(() => {
    setCurrentColumnID(column as ColumnID)
  }, [column, setCurrentColumnID])

  if (column === "my-aggregations") {
    return (
      <Suspense fallback={<div className="p-4 text-center">加载中...</div>}>
        <LazyMyAggregations />
      </Suspense>
    )
  }

  return <Column id={column as ColumnID} />
})

// 3. 定义 Route，此时 SectionComponent 已经定义
export const Route = createFileRoute("/c/$column")({
  component: SectionComponent,
  params: {
    parse: (params) => {
      const column = params.column.toLowerCase() as string
      const validColumn = fixedColumnIds.find(x => x === column)
      if (!validColumn) throw new Error(`"${params.column}" is not a valid column.`)
      return {
        column: validColumn,
      }
    },
    stringify: params => params,
  },
  onError: (error) => {
    if (error?.routerCode === "PARSE_PARAMS") {
      throw redirect({ to: "/" })
    }
  },
})
