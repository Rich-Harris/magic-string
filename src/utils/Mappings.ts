import type { BitSet } from '../BitSet.ts'
import type { Chunk } from '../Chunk.ts'
import type { MagicString } from '../MagicString.ts'
import type { SourceMapOptions, SourceMapRangeMappings } from '../SourceMap.ts'
import type { SourceLocation } from './getLocator.ts'
import type { FullSegment, MappingsEncoder } from './MappingsEncoder.ts'
import { getLineOffsets, getLocator, LINE_TERMINATOR } from './getLocator.ts'
import { SEGMENTS_PER_FLUSH } from './MappingsEncoder.ts'

const LF = 10
const CR = 13

function isLineTerminator(code: number): boolean {
  return code === LF || code === CR || code === 0x2028 || code === 0x2029
}

// equivalent to /\w/ without the `u` flag, which only matches ASCII word characters
function isWordCode(code: number): boolean {
  return (code >= 97 && code <= 122) || (code >= 65 && code <= 90) || (code >= 48 && code <= 57) || code === 95
}

export class Mappings {
  declare hires: SourceMapOptions['hires']
  declare generatedCodeLine: number
  declare generatedCodeColumn: number
  declare raw: FullSegment[][]
  declare rawSegments: FullSegment[]
  declare rawRangeMappings: SourceMapRangeMappings | undefined
  declare rawRangeMappingsIndices: number[]
  declare encoder: MappingsEncoder | null
  // whether the generated code so far ends with a CR, so a leading LF of the
  // next piece completes that CRLF instead of starting another line
  declare afterCR: boolean

  constructor(hires: SourceMapOptions['hires'], encoder: MappingsEncoder | null = null) {
    this.hires = hires
    this.generatedCodeLine = 0
    this.generatedCodeColumn = 0
    this.raw = []
    this.rawSegments = this.raw[this.generatedCodeLine] = []
    this.rawRangeMappingsIndices = []
    // only the experimental-range mode produces range mappings; the other modes
    // must not pay for a per-line array nor advertise an empty `rangeMappings`
    this.rawRangeMappings = hires === 'experimental-range' ? [this.rawRangeMappingsIndices] : undefined
    this.encoder = encoder
    this.afterCR = false
  }

  /** Whether `code` is the LF of a CRLF whose generated line already ended. */
  private completesCRLF(code: number): boolean {
    return this.afterCR && code === LF
  }

  private nextLine(): void {
    if (this.encoder === null) {
      this.generatedCodeLine += 1
      this.raw[this.generatedCodeLine] = this.rawSegments = []
    }
    else {
      // hand the finished line to the encoder, which releases it once drained
      this.encoder.endLine(this.rawSegments)
      this.rawSegments = []
      this.generatedCodeLine += 1
    }
    this.generatedCodeColumn = 0
    if (this.rawRangeMappings)
      this.rawRangeMappings[this.generatedCodeLine] = this.rawRangeMappingsIndices = []
  }

  /**
   * Emits the mappings for one MagicString: its intro, every chunk (with the
   * chunk's own intro/outro) and its outro. `sourceIndex === -1` means the
   * string has no source of its own, so its content only advances the
   * generated position without mapping anything.
   */
  addMagicString(magicString: MagicString, sourceIndex: number, nameIndex: Map<string, number>): void {
    const { original } = magicString
    const lineOffsets = getLineOffsets(original)
    const locate = getLocator(lineOffsets)

    if (magicString.intro)
      this.advance(magicString.intro)

    magicString.firstChunk.eachNext((chunk) => {
      if (chunk.intro.length)
        this.advance(chunk.intro)

      if (sourceIndex === -1) {
        this.advance(chunk.content)
      }
      else if (chunk.edited) {
        const name = chunk.storeName ? nameIndex.get(original.slice(chunk.start, chunk.replacesUntil)) : undefined
        this.addEdit(sourceIndex, chunk.content, locate(chunk.start), name ?? -1)
      }
      else {
        this.addUneditedChunk(sourceIndex, chunk, original, lineOffsets, locate(chunk.start), magicString.sourcemapLocations)
      }

      if (chunk.outro.length)
        this.advance(chunk.outro)
    })

    if (magicString.outro)
      this.advance(magicString.outro)
  }

  addEdit(sourceIndex: number, content: string, loc: SourceLocation, nameIndex: number): void {
    if (!content.length)
      return

    let lineStart = this.completesCRLF(content.charCodeAt(0)) ? 1 : 0
    LINE_TERMINATOR.lastIndex = lineStart
    // add a segment for each line in the content, except the empty one after a
    // trailing line terminator, else code afterwards would fill one line too many
    do {
      const segment: FullSegment = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column]
      if (nameIndex >= 0)
        segment.push(nameIndex)
      this.rawSegments.push(segment)

      if (!LINE_TERMINATOR.test(content))
        break
      this.nextLine()
      lineStart = LINE_TERMINATOR.lastIndex
    } while (lineStart < content.length)

    this.generatedCodeColumn += content.length - lineStart
    this.afterCR = content.charCodeAt(content.length - 1) === CR
  }

  addUneditedChunk(
    sourceIndex: number,
    chunk: Chunk,
    original: string,
    lineOffsets: number[],
    loc: SourceLocation,
    sourcemapLocations: BitSet,
  ): void {
    const end = chunk.end
    let i = chunk.start

    if (i < end && this.completesCRLF(original.charCodeAt(i))) {
      loc.line += 1
      loc.column = 0
      i += 1
    }

    if (this.hires) {
      const boundary = this.hires === 'boundary'
      const experimentalRange = this.hires === 'experimental-range'
      const encoder = experimentalRange ? null : this.encoder
      // when iterating each char, check if it's in a word boundary
      let charInHiresBoundary = false
      while (i < end) {
        if (encoder !== null && this.rawSegments.length >= SEGMENTS_PER_FLUSH) {
          // cap how many decoded segments a single (possibly very long) line buffers
          encoder.segments(this.rawSegments)
          this.rawSegments.length = 0
        }
        if (experimentalRange && i + 1 >= end) {
          this.rawSegments.push([this.generatedCodeColumn, sourceIndex, loc.line, loc.column])
        }
        const code = original.charCodeAt(i)
        if (isLineTerminator(code)) {
          // the LF of a CRLF: the CR already ended the line
          if (code !== LF || i === chunk.start || original.charCodeAt(i - 1) !== CR) {
            loc.line += 1
            loc.column = 0
            this.nextLine()
          }
          charInHiresBoundary = false
        }
        else {
          if (boundary) {
            // in hires "boundary", group segments per word boundary than per char
            if (isWordCode(code)) {
              // for first char in the boundary found, start the boundary by pushing a segment
              if (!charInHiresBoundary) {
                this.rawSegments.push([this.generatedCodeColumn, sourceIndex, loc.line, loc.column])
                charInHiresBoundary = true
              }
            }
            else {
              // for non-word char, end the boundary by pushing a segment
              this.rawSegments.push([this.generatedCodeColumn, sourceIndex, loc.line, loc.column])
              charInHiresBoundary = false
            }
          }
          else if (experimentalRange) {
            if (i === chunk.start) {
              this.rawRangeMappingsIndices.push(this.rawSegments.length)
              this.rawSegments.push([this.generatedCodeColumn, sourceIndex, loc.line, loc.column])
            }
          }
          else {
            this.rawSegments.push([this.generatedCodeColumn, sourceIndex, loc.line, loc.column])
          }
          loc.column += 1
          this.generatedCodeColumn += 1
        }
        i += 1
      }
    }
    else {
      // without hires only the first character of each line and the explicitly
      // added sourcemap locations get a segment, so walk line by line instead of
      // char by char
      const bits = sourcemapLocations.bits
      while (i < end) {
        const nextLineStart = loc.line + 1 < lineOffsets.length ? lineOffsets[loc.line + 1] : Infinity
        const terminatorLength = original.charCodeAt(nextLineStart - 1) === LF && original.charCodeAt(nextLineStart - 2) === CR ? 2 : 1
        const newline = Math.min(nextLineStart - terminatorLength, end)
        if (newline > i) {
          this.rawSegments.push([this.generatedCodeColumn, sourceIndex, loc.line, loc.column])
          for (let w = (i + 1) >> 5, last = (newline - 1) >> 5; w <= last; w++) {
            let word = bits[w]
            if (!word)
              continue
            const base = w << 5
            while (word) {
              const lowest = word & -word
              const index = base + 31 - Math.clz32(lowest)
              if (index > i && index < newline) {
                const offset = index - i
                this.rawSegments.push([this.generatedCodeColumn + offset, sourceIndex, loc.line, loc.column + offset])
              }
              word ^= lowest
            }
          }
          loc.column += newline - i
          this.generatedCodeColumn += newline - i
        }
        if (newline === end)
          break
        loc.line += 1
        loc.column = 0
        this.nextLine()
        i = nextLineStart
      }
    }

    if (end > chunk.start)
      this.afterCR = original.charCodeAt(end - 1) === CR
  }

  advance(str: string): void {
    let lineStart = this.completesCRLF(str.charCodeAt(0)) ? 1 : 0
    LINE_TERMINATOR.lastIndex = lineStart
    while (LINE_TERMINATOR.test(str)) {
      this.nextLine()
      lineStart = LINE_TERMINATOR.lastIndex
    }

    this.generatedCodeColumn += str.length - lineStart
    if (str.length)
      this.afterCR = str.charCodeAt(str.length - 1) === CR
  }
}
