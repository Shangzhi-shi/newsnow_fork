import { useCallback, useEffect, useState } from "react"

/**
 * 搜索输入钩子的配置选项接口
 */
interface UseSearchInputOptions {
  /** 输入框的初始值 */
  initialValue?: string
  /** 防抖延迟时间（毫秒） */
  debounceTimeout?: number
  /** 处理输入值的函数，默认为trim */
  valueProcessor?: (value: string) => string
}

/**
 * 搜索输入钩子的返回值接口
 */
interface UseSearchInputOutput {
  /** 当前输入框的实时值 */
  inputValue: string
  /** 设置输入框值的函数 */
  setInputValue: (value: string) => void
  /** 经过防抖处理后的值，用于实际搜索操作 */
  debouncedValue: string
  /** 重置输入值的函数 */
  resetInput: () => void
}

/**
 * 自定义 Hook，用于管理搜索输入框的值及其防抖处理后的版本。
 * 避免在用户快速输入时频繁触发搜索操作，提高性能和用户体验。
 *
 * @param {UseSearchInputOptions} options - 配置选项，包括初始值和防抖超时时间
 * @returns {UseSearchInputOutput} 包含输入值、设置函数和防抖后值的对象
 */
export function useSearchInput({
  initialValue = "",
  debounceTimeout = 300,
  valueProcessor = (value: string) => value.trim(),
}: UseSearchInputOptions = {}): UseSearchInputOutput {
  // 确保初始值经过处理
  const processedInitialValue = valueProcessor(initialValue)

  const [inputValue, setInputValueState] = useState<string>(initialValue)
  const [debouncedValue, setDebouncedValue] = useState<string>(processedInitialValue)

  // 使用useCallback包装setInputValue以保持函数引用稳定
  const setInputValue = useCallback((value: string) => {
    setInputValueState(value)
  }, [])

  // 提供重置函数
  const resetInput = useCallback(() => {
    setInputValueState("")
    setDebouncedValue("")
  }, [])

  useEffect(() => {
    // 避免SSR问题
    if (typeof window === "undefined") return undefined

    // 处理输入值
    const processedValue = valueProcessor(inputValue)

    // 只有当处理后的值不同时才更新，避免不必要的状态更新
    if (processedValue === debouncedValue) return undefined

    // 创建一个定时器，在 debounceTimeout 毫秒后更新 debouncedValue
    const handler = setTimeout(() => {
      setDebouncedValue(processedValue)
    }, debounceTimeout)

    // 清理函数：在下次 effect 运行前或组件卸载时清除定时器
    return () => {
      clearTimeout(handler)
    }
  }, [inputValue, debounceTimeout, debouncedValue, valueProcessor])

  return { inputValue, setInputValue, debouncedValue, resetInput }
}
