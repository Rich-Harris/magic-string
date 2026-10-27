export interface SourceLocation {
  line: number
  column: number
}

// ECMAScript LineTerminatorSequence: LF, CR, CRLF, LS (U+2028) and PS (U+2029)
export const LINE_TERMINATOR = /\r\n?|[\n\u2028\u2029]/g

/** The index at which each line of `source` starts. */
export function getLineOffsets(source: string): number[] {
  const lineOffsets = [0]
  LINE_TERMINATOR.lastIndex = 0
  while (LINE_TERMINATOR.test(source)) {
    lineOffsets.push(LINE_TERMINATOR.lastIndex)
  }
  return lineOffsets
}

export function getLocator(lineOffsets: number[]): (index: number) => SourceLocation {
  return function locate(index: number): SourceLocation {
    let i = 0
    let j = lineOffsets.length
    while (i < j) {
      const m = (i + j) >> 1
      if (index < lineOffsets[m]) {
        j = m
      }
      else {
        i = m + 1
      }
    }
    const line = i - 1
    const column = index - lineOffsets[line]
    return { line, column }
  }
}
