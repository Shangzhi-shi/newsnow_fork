import { useMemo } from "react"

interface TextSegment {
  text: string
  isMatch: boolean
}

// 简单的 RegExp 转义函数
function escapeRegExp(string: string): string {
  // Escapes special characters for use in a regular expression.
  return string.replace(/[.*+?^${}()|[\\\]]/g, "\\$&") // $& means the whole matched string
}

export function useTextHighlight(text: string | undefined, searchTerm: string): TextSegment[] {
  return useMemo(() => {
    const trimmedSearchTerm = searchTerm.trim()

    if (!trimmedSearchTerm || !text) {
      return [{ text: text || "", isMatch: false }]
    }

    const lowerText = text.toLowerCase()
    const lowerCleanSearchTerm = escapeRegExp(trimmedSearchTerm.toLowerCase())
    const parts: TextSegment[] = []
    let lastIndex = 0

    // No need for an explicit check for lowerCleanSearchTerm === "" here,
    // because the initial `!trimmedSearchTerm` check covers it.

    try {
      const regex = new RegExp(lowerCleanSearchTerm, "g")
      let currentMatch

      while (true) {
        currentMatch = regex.exec(lowerText)
        if (currentMatch === null) {
          break
        }
        if (currentMatch.index > lastIndex) {
          parts.push({ text: text.substring(lastIndex, currentMatch.index), isMatch: false })
        }
        parts.push({ text: text.substring(currentMatch.index, regex.lastIndex), isMatch: true })
        lastIndex = regex.lastIndex
      }

      if (lastIndex < text.length) {
        parts.push({ text: text.substring(lastIndex), isMatch: false })
      }

      // If parts is still empty here, it means text was effectively empty or matched nothing
      // in a way that didn't add to parts (highly unlikely with current logic if text had content).
      // However, the initial check `!trimmedSearchTerm || !text` and the subsequent logic ensures
      // that `parts` will contain at least one segment representing the original text if no matches are found.
      // Thus, the complex checks for parts.length === 0 at the end are not needed.
      return parts.length > 0 ? parts : [{ text: text || "", isMatch: false }]
      // A simpler return `parts` would also work if we trust the logic to always populate parts
      // if `text` has content. The line above is a bit safer if `text` could be empty string and somehow bypass earlier checks
      // leading to an empty `parts` array (which should not happen).
      // For maximum safety and to ensure an array is always returned:
      // If `text` is an empty string and `trimmedSearchTerm` is not, `parts` might be empty.
      // The initial `!text` check returns `[{text: "", isMatch: false}]` if text is empty string.
      // So `return parts;` should be fine here as `parts` will be populated by the `if(lastIndex < text.length)` for non-matching text.
    } catch (e) {
      console.error("Error in useTextHighlight:", e)
      return [{ text, isMatch: false }] // Fallback on error
    }
  }, [text, searchTerm])
}
