import type BitSet from '../BitSet.ts'
import type Chunk from '../Chunk.ts'
import type { SourceMapOptions, SourceMapRangeMappings, SourceMapSegment } from '../SourceMap.ts'
import type { SourceLocation } from './getLocator.ts'

const NEWLINE_CHAR = 10

// equivalent to /\w/ without the `u` flag, which only matches ASCII word characters
function isWordCode(code: number): boolean {
  return (code >= 97 && code <= 122) || (code >= 65 && code <= 90) || (code >= 48 && code <= 57) || code === 95
}

export default class Mappings {
  declare hires: SourceMapOptions['hires']
  declare generatedCodeLine: number
  declare generatedCodeColumn: number
  declare raw: SourceMapSegment[][]
  declare rawSegments: SourceMapSegment[]
  declare rawRangeMappings: SourceMapRangeMappings
  declare rawRangeMappingsIndices: number[]
  declare pending: SourceMapSegment | null

  constructor(hires: SourceMapOptions['hires']) {
    this.hires = hires
    this.generatedCodeLine = 0
    this.generatedCodeColumn = 0
    this.raw = []
    this.rawSegments = this.raw[this.generatedCodeLine] = []
    this.rawRangeMappings = []
    this.rawRangeMappingsIndices = this.rawRangeMappings[this.generatedCodeLine] = []
    this.pending = null
  }

  addEdit(sourceIndex: number, content: string, loc: SourceLocation, nameIndex: number): void {
    if (content.length) {
      const contentLengthMinusOne = content.length - 1
      let contentLineEnd = content.indexOf('\n', 0)
      let previousContentLineEnd = -1
      // Loop through each line in the content and add a segment, but stop if the last line is empty,
      // else code afterwards would fill one line too many
      while (contentLineEnd >= 0 && contentLengthMinusOne > contentLineEnd) {
        const segment: SourceMapSegment = [
          this.generatedCodeColumn,
          sourceIndex,
          loc.line,
          loc.column,
        ]
        if (nameIndex >= 0) {
          segment.push(nameIndex)
        }
        this.rawSegments.push(segment)

        this.generatedCodeLine += 1
        this.raw[this.generatedCodeLine] = this.rawSegments = []
        this.rawRangeMappings[this.generatedCodeLine] = this.rawRangeMappingsIndices = []
        this.generatedCodeColumn = 0

        previousContentLineEnd = contentLineEnd
        contentLineEnd = content.indexOf('\n', contentLineEnd + 1)
      }

      const segment: SourceMapSegment = [
        this.generatedCodeColumn,
        sourceIndex,
        loc.line,
        loc.column,
      ]
      if (nameIndex >= 0) {
        segment.push(nameIndex)
      }
      this.rawSegments.push(segment)

      this.advance(content.slice(previousContentLineEnd + 1))
    }
    else if (this.pending) {
      this.rawSegments.push(this.pending)
      this.advance(content)
    }

    this.pending = null
  }

  addUneditedChunk(
    sourceIndex: number,
    chunk: Chunk,
    original: string,
    loc: SourceLocation,
    sourcemapLocations: BitSet,
  ): void {
    const end = chunk.end
    let i = chunk.start

    if (this.hires) {
      const boundary = this.hires === 'boundary'
      const experimentalRange = this.hires === 'experimental-range'
      // when iterating each char, check if it's in a word boundary
      let charInHiresBoundary = false
      while (i < end) {
        if (experimentalRange && i + 1 >= end) {
          this.rawSegments.push([this.generatedCodeColumn, sourceIndex, loc.line, loc.column])
        }
        const code = original.charCodeAt(i)
        if (code === NEWLINE_CHAR) {
          loc.line += 1
          loc.column = 0
          this.generatedCodeLine += 1
          this.raw[this.generatedCodeLine] = this.rawSegments = []
          this.rawRangeMappings[this.generatedCodeLine] = this.rawRangeMappingsIndices = []
          this.generatedCodeColumn = 0
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
        let newline = original.indexOf('\n', i)
        if (newline === -1 || newline > end)
          newline = end
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
        this.generatedCodeLine += 1
        this.raw[this.generatedCodeLine] = this.rawSegments = []
        this.rawRangeMappings[this.generatedCodeLine] = this.rawRangeMappingsIndices = []
        this.generatedCodeColumn = 0
        i = newline + 1
      }
    }

    this.pending = null
  }

  advance(str: string): void {
    if (!str)
      return

    const lastNewline = str.lastIndexOf('\n')

    if (lastNewline !== -1) {
      for (let i = str.indexOf('\n'); i !== -1; i = str.indexOf('\n', i + 1)) {
        this.generatedCodeLine++
        this.raw[this.generatedCodeLine] = this.rawSegments = []
        this.rawRangeMappings[this.generatedCodeLine] = this.rawRangeMappingsIndices = []
      }
      this.generatedCodeColumn = 0
    }

    this.generatedCodeColumn += str.length - lastNewline - 1
  }
}
