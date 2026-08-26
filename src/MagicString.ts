import type { DecodedSourceMap, SourceMapOptions } from './SourceMap.ts'
import BitSet from './BitSet.ts'
import Chunk from './Chunk.ts'
import MagicStringError from './MagicStringError.ts'
import SourceMap from './SourceMap.ts'
import getLocator from './utils/getLocator.ts'
import getRelativePath from './utils/getRelativePath.ts'
import guessIndent from './utils/guessIndent.ts'
import isObject from './utils/isObject.ts'
import Mappings from './utils/Mappings.ts'
import Stats from './utils/Stats.ts'

export type ExclusionRange = [number, number]

export interface MagicStringOptions {
  filename?: string
  ignoreList?: boolean
  indentExclusionRanges?: ExclusionRange | ExclusionRange[]
  offset?: number
}

export interface IndentOptions {
  exclude?: ExclusionRange | ExclusionRange[]
  indentStart?: boolean
}

export interface OverwriteOptions {
  storeName?: boolean
  contentOnly?: boolean
}

export interface UpdateOptions {
  storeName?: boolean
  overwrite?: boolean
}

export type ReplacementFunction = (substring: string, ...args: any[]) => string

declare const DEBUG: boolean

const n = '\n'
const NEWLINE_CHAR = '\n'.charCodeAt(0)
const CR_CHAR = '\r'.charCodeAt(0)

const warned = {
  insertLeft: false,
  insertRight: false,
  storeName: false,
}

export default class MagicString {
  declare original: string
  /** @internal */
  declare outro: string
  /** @internal */
  declare intro: string
  /** @internal */
  declare filename: string | undefined
  declare indentExclusionRanges: MagicStringOptions['indentExclusionRanges']
  /** @internal */
  declare ignoreList: boolean | undefined
  declare offset: number
  /** @internal */
  declare firstChunk: Chunk
  /** @internal */
  declare lastChunk: Chunk
  /** @internal */
  declare lastSearchedChunk: Chunk
  /** @internal */
  declare byStart: Map<number, Chunk>
  /** @internal */
  declare byEnd: Map<number, Chunk>
  /** @internal */
  declare sourcemapLocations: BitSet
  /** @internal */
  declare storedNames: Record<string, true>
  /** @internal */
  declare indentStr: string | null | undefined
  /** @internal */
  declare stats: Stats
  /** @internal */
  declare hasMovedChunks: boolean

  constructor(string: string, options: MagicStringOptions = {}) {
    const chunk = new Chunk(0, string.length, string)

    Object.defineProperties(this, {
      original: { writable: true, value: string },
      outro: { writable: true, value: '' },
      intro: { writable: true, value: '' },
      firstChunk: { writable: true, value: chunk },
      lastChunk: { writable: true, value: chunk },
      lastSearchedChunk: { writable: true, value: chunk },
      byStart: { writable: true, value: new Map<number, Chunk>([[0, chunk]]) },
      byEnd: { writable: true, value: new Map<number, Chunk>([[string.length, chunk]]) },
      filename: { writable: true, value: options.filename },
      indentExclusionRanges: { writable: true, value: options.indentExclusionRanges },
      sourcemapLocations: { writable: true, value: new BitSet() },
      storedNames: { writable: true, value: {} },
      indentStr: { writable: true, value: undefined },
      ignoreList: { writable: true, value: options.ignoreList },
      offset: { writable: true, value: options.offset || 0 },
      hasMovedChunks: { writable: true, value: false },
    })

    if (DEBUG) {
      Object.defineProperty(this, 'stats', { value: new Stats() })
    }
  }

  /**
   * Adds the specified character index (with respect to the original string) to sourcemap mappings, if `hires` is false.
   */
  addSourcemapLocation(char: number): void {
    this.sourcemapLocations.add(char)
  }

  /**
   * Appends the specified content to the end of the string.
   */
  append(content: string): this {
    if (typeof content !== 'string') {
      throw new MagicStringError(`content must be a string, got ${typeof content}`)
    }

    this.outro += content
    return this
  }

  /**
   * Appends the specified content at the index in the original string.
   * If a range *ending* with index is subsequently moved, the insert will be moved with it.
   * See also `s.prependLeft(...)`.
   */
  appendLeft(index: number, content: string): this {
    index = index + this.offset

    if (typeof content !== 'string') {
      throw new MagicStringError(`content must be a string, got ${typeof content}`)
    }

    if (DEBUG)
      this.stats.time('appendLeft')

    this._split(index)

    const chunk = this.byEnd.get(index)

    if (chunk) {
      chunk.appendLeft(content)
    }
    else {
      this.intro += content
    }

    if (DEBUG)
      this.stats.timeEnd('appendLeft')
    return this
  }

  /**
   * Appends the specified content at the index in the original string.
   * If a range *starting* with index is subsequently moved, the insert will be moved with it.
   * See also `s.prependRight(...)`.
   */
  appendRight(index: number, content: string): this {
    index = index + this.offset

    if (typeof content !== 'string') {
      throw new MagicStringError(`content must be a string, got ${typeof content}`)
    }

    if (DEBUG)
      this.stats.time('appendRight')

    this._split(index)

    const chunk = this.byStart.get(index)

    if (chunk) {
      chunk.appendRight(content)
    }
    else {
      this.outro += content
    }

    if (DEBUG)
      this.stats.timeEnd('appendRight')
    return this
  }

  /**
   * Does what you'd expect.
   */
  clone(): this {
    const cloned = new MagicString(this.original, {
      filename: this.filename,
      ignoreList: this.ignoreList,
      offset: this.offset,
    })

    let originalChunk = this.firstChunk
    let clonedChunk = (cloned.firstChunk = cloned.lastSearchedChunk = originalChunk.clone())

    while (originalChunk) {
      cloned.byStart.set(clonedChunk.start, clonedChunk)
      cloned.byEnd.set(clonedChunk.end, clonedChunk)

      const nextOriginalChunk = originalChunk.next
      const nextClonedChunk = nextOriginalChunk && nextOriginalChunk.clone()

      if (nextClonedChunk) {
        clonedChunk.next = nextClonedChunk
        nextClonedChunk.previous = clonedChunk

        clonedChunk = nextClonedChunk
      }

      originalChunk = nextOriginalChunk
    }

    cloned.lastChunk = clonedChunk

    if (this.indentExclusionRanges) {
      cloned.indentExclusionRanges = this.indentExclusionRanges.slice() as
      | ExclusionRange
      | ExclusionRange[]
    }

    cloned.sourcemapLocations = new BitSet(this.sourcemapLocations)
    cloned.storedNames = { ...this.storedNames }

    cloned.intro = this.intro
    cloned.outro = this.outro
    cloned.hasMovedChunks = this.hasMovedChunks

    return cloned as this
  }

  /**
   * Generates a sourcemap object with raw mappings in array form, rather than encoded as a string.
   * Useful if you need to manipulate the sourcemap further, but most of the time you will use `generateMap` instead.
   */
  generateDecodedMap(options?: SourceMapOptions): DecodedSourceMap {
    options = options || {}

    const sourceIndex = 0
    const names = Object.keys(this.storedNames)
    const mappings = new Mappings(options.hires)

    const locate = getLocator(this.original)

    if (this.intro) {
      mappings.advance(this.intro)
    }

    this.firstChunk.eachNext((chunk) => {
      const loc = locate(chunk.start)

      if (chunk.intro.length)
        mappings.advance(chunk.intro)

      if (chunk.edited) {
        mappings.addEdit(
          sourceIndex,
          chunk.content,
          loc,
          chunk.storeName ? names.indexOf(chunk.original) : -1,
        )
      }
      else {
        mappings.addUneditedChunk(sourceIndex, chunk, this.original, loc, this.sourcemapLocations)
      }

      if (chunk.outro.length)
        mappings.advance(chunk.outro)
    })

    if (this.outro) {
      mappings.advance(this.outro)
    }

    return {
      file: options.file ? options.file.split(/[/\\]/).pop() : undefined,
      sources: [
        options.source ? getRelativePath(options.file || '', options.source) : options.file || '',
      ],
      sourcesContent: options.includeContent ? [this.original] : undefined,
      names,
      mappings: mappings.raw,
      x_google_ignoreList: this.ignoreList ? [sourceIndex] : undefined,
    }
  }

  /**
   * Generates a version 3 sourcemap.
   */
  generateMap(options?: SourceMapOptions): SourceMap {
    return new SourceMap(this.generateDecodedMap(options))
  }

  /** @internal */
  _ensureindentStr(): void {
    if (this.indentStr === undefined) {
      this.indentStr = guessIndent(this.original)
    }
  }

  /** @internal */
  _getRawIndentString(): string | null | undefined {
    this._ensureindentStr()
    return this.indentStr
  }

  getIndentString(): string {
    this._ensureindentStr()
    return this.indentStr === null ? '\t' : this.indentStr
  }

  /**
   * Prefixes each line of the string with prefix.
   * If prefix is not supplied, the indentation will be guessed from the original content, falling back to a single tab character.
   */
  indent(options?: IndentOptions): this
  /**
   * Prefixes each line of the string with prefix.
   * If prefix is not supplied, the indentation will be guessed from the original content, falling back to a single tab character.
   *
   * The options argument can have an exclude property, which is an array of [start, end] character ranges.
   * These ranges will be excluded from the indentation - useful for (e.g.) multiline strings.
   */
  indent(indentStr?: string, options?: IndentOptions): this
  indent(indentStr?: string | IndentOptions, options?: IndentOptions): this {
    const pattern = /^[^\r\n]/gm

    if (isObject(indentStr)) {
      options = indentStr
      indentStr = undefined
    }

    if (indentStr === undefined) {
      this._ensureindentStr()
      indentStr = this.indentStr || '\t'
    }

    if (indentStr === '')
      return this // noop
    const resolvedIndentStr = indentStr as string

    options = options || {}

    // Process exclusion ranges
    const isExcluded: Record<number, boolean> = {}

    if (options.exclude) {
      const exclusions
        = typeof options.exclude[0] === 'number'
          ? [options.exclude as ExclusionRange]
          : (options.exclude as ExclusionRange[])
      exclusions.forEach((exclusion) => {
        for (let i = exclusion[0]; i < exclusion[1]; i += 1) {
          isExcluded[i] = true
        }
      })
    }

    let shouldIndentNextCharacter = options.indentStart !== false
    const replacer = (match: string) => {
      if (shouldIndentNextCharacter)
        return `${resolvedIndentStr}${match}`
      shouldIndentNextCharacter = true
      return match
    }

    this.intro = this.intro.replace(pattern, replacer)

    let charIndex = 0
    let chunk = this.firstChunk

    const indentAt = (index: number) => {
      shouldIndentNextCharacter = false

      if (index === chunk!.start) {
        chunk!.prependRight(resolvedIndentStr)
      }
      else {
        this._splitChunk(chunk!, index)
        chunk = chunk!.next
        chunk!.prependRight(resolvedIndentStr)
      }
    }

    while (chunk) {
      const end = chunk.end

      if (chunk.edited) {
        if (!isExcluded[charIndex]) {
          chunk.content = chunk.content.replace(pattern, replacer)

          if (chunk.content.length) {
            shouldIndentNextCharacter = chunk.content[chunk.content.length - 1] === '\n'
          }
        }
      }
      else if (options.exclude) {
        charIndex = chunk.start

        while (charIndex < end) {
          if (!isExcluded[charIndex]) {
            const char = this.original.charCodeAt(charIndex)

            if (char === NEWLINE_CHAR) {
              shouldIndentNextCharacter = true
            }
            else if (char !== CR_CHAR && shouldIndentNextCharacter) {
              indentAt(charIndex)
            }
          }

          charIndex += 1
        }
      }
      else {
        charIndex = chunk.start

        while (charIndex < end) {
          if (!shouldIndentNextCharacter) {
            const nextLine = this.original.indexOf(n, charIndex)
            if (nextLine === -1 || nextLine >= end)
              break

            shouldIndentNextCharacter = true
            charIndex = nextLine + 1
            continue
          }

          const char = this.original.charCodeAt(charIndex)

          if (char === NEWLINE_CHAR || char === CR_CHAR) {
            charIndex += 1
            continue
          }

          indentAt(charIndex)
          charIndex += 1
        }
      }

      charIndex = chunk.end
      chunk = chunk.next
    }

    this.outro = this.outro.replace(pattern, replacer)

    return this
  }

  /** @internal */
  insert(): never {
    throw new MagicStringError('insert() is deprecated, use appendLeft() or prependRight()')
  }

  /** @internal */
  insertLeft(index: number, content: string): this {
    if (!warned.insertLeft) {
      console.warn(
        'magicString.insertLeft(...) is deprecated. Use magicString.appendLeft(...) instead',
      )
      warned.insertLeft = true
    }

    return this.appendLeft(index, content)
  }

  /** @internal */
  insertRight(index: number, content: string): this {
    if (!warned.insertRight) {
      console.warn(
        'magicString.insertRight(...) is deprecated. Use magicString.prependRight(...) instead',
      )
      warned.insertRight = true
    }

    return this.prependRight(index, content)
  }

  /**
   * Moves the characters from `start` and `end` to `index`.
   */
  move(start: number, end: number, index: number): this {
    start = start + this.offset
    end = end + this.offset
    index = index + this.offset

    if (start === end)
      return this

    if (index >= start && index <= end) {
      throw new MagicStringError('cannot move a selection inside itself')
    }

    if (DEBUG)
      this.stats.time('move')

    this._split(start)
    this._split(end)
    this._split(index)

    const first = this.byStart.get(start)
    const last = this.byEnd.get(end)

    // The splicing below assumes the chunks spanning [start, end) are still a
    // forward run in the current list. An earlier move can have interleaved a
    // chunk from outside the range, or put `last` before `first`, and then the
    // pointer rewrites produce a cycle rather than an error, so toString() and
    // generateMap() loop forever.
    //
    // Only move() reorders chunks, so this is skipped until one has run, which
    // keeps the common single-move case free of the walk.
    if (this.hasMovedChunks) {
      let cursor = first
      while (cursor !== last) {
        cursor = cursor.next
        if (!cursor || cursor.start < start || cursor.end > end) {
          throw new MagicStringError(
            `cannot move ${start} to ${end} because an earlier move split that range`,
          )
        }
      }
    }

    const oldLeft = first.previous
    const oldRight = last.next

    const newRight = this.byStart.get(index)
    if (!newRight && last === this.lastChunk)
      return this
    const newLeft = newRight ? newRight.previous : this.lastChunk

    if (oldLeft)
      oldLeft.next = oldRight
    if (oldRight)
      oldRight.previous = oldLeft

    if (newLeft)
      newLeft.next = first
    if (newRight)
      newRight.previous = last

    if (!first.previous)
      this.firstChunk = last.next
    if (!last.next) {
      this.lastChunk = first.previous
      this.lastChunk.next = null
    }

    first.previous = newLeft
    last.next = newRight || null

    if (!newLeft)
      this.firstChunk = first
    if (!newRight)
      this.lastChunk = last

    this.hasMovedChunks = true

    if (DEBUG)
      this.stats.timeEnd('move')
    return this
  }

  /**
   * Replaces the characters from `start` to `end` with `content`, along with the appended/prepended content in
   * that range. The same restrictions as `s.remove()` apply.
   *
   * The fourth argument is optional. It can have a storeName property - if true, the original name will be stored
   * for later inclusion in a sourcemap's names array - and a contentOnly property which determines whether only
   * the content is overwritten, or anything that was appended/prepended to the range as well.
   *
   * It may be preferred to use `s.update(...)` instead if you wish to avoid overwriting the appended/prepended content.
   */
  overwrite(
    start: number,
    end: number,
    content: string,
    options?: boolean | OverwriteOptions,
  ): this {
    const optionObject = typeof options === 'object' && options ? options : {}
    return this.update(start, end, content, {
      ...optionObject,
      overwrite: !optionObject.contentOnly,
    })
  }

  /**
   * Replaces the characters from `start` to `end` with `content`. The same restrictions as `s.remove()` apply.
   *
   * The fourth argument is optional. It can have a storeName property - if true, the original name will be stored
   * for later inclusion in a sourcemap's names array - and an overwrite property which determines whether only
   * the content is overwritten, or anything that was appended/prepended to the range as well.
   */
  update(start: number, end: number, content: string, options?: boolean | UpdateOptions): this {
    start = start + this.offset
    end = end + this.offset

    if (typeof content !== 'string') {
      throw new MagicStringError(`content must be a string, got ${typeof content}`)
    }

    if (this.original.length !== 0) {
      if (start < 0)
        start = Math.max(0, start + this.original.length)
      if (end < 0)
        end = Math.max(0, end + this.original.length)
    }

    if (start < 0) {
      throw new MagicStringError(`start ${start} is out of bounds`)
    }
    if (end > this.original.length) {
      throw new MagicStringError(`end ${end} is out of bounds`)
    }
    if (start === end) {
      throw new MagicStringError(
        `cannot overwrite a zero-length range at ${start}, use appendLeft() or prependRight()`,
      )
    }
    if (start > end) {
      throw new MagicStringError(`end must be greater than start (start: ${start}, end: ${end})`)
    }

    if (DEBUG)
      this.stats.time('overwrite')

    this._split(start)
    this._split(end)

    if (options === true) {
      if (!warned.storeName) {
        console.warn(
          'The final argument to magicString.overwrite(...) should be an options object. See https://github.com/rich-harris/magic-string',
        )
        warned.storeName = true
      }

      options = { storeName: true }
    }
    const optionObject = typeof options === 'object' && options ? options : {}
    const storeName = optionObject.storeName || false
    const overwrite = optionObject.overwrite || false

    if (storeName) {
      const original = this.original.slice(start, end)
      Object.defineProperty(this.storedNames, original, {
        writable: true,
        value: true,
        enumerable: true,
      })
    }

    const first = this.byStart.get(start)
    const last = this.byEnd.get(end)

    if (first) {
      let chunk = first
      while (chunk !== last) {
        if (chunk.next !== this.byStart.get(chunk.end)) {
          throw new MagicStringError('cannot overwrite across a split point')
        }
        chunk = chunk.next
        chunk.edit('', false)
      }

      first.edit(content, storeName, !overwrite)
    }
    else {
      // must be inserting at the end
      const newChunk = new Chunk(start, end, '').edit(content, storeName)

      // TODO last chunk in the array may not be the last chunk, if it's moved...
      last.next = newChunk
      newChunk.previous = last
    }

    if (DEBUG)
      this.stats.timeEnd('overwrite')
    return this
  }

  /**
   * Prepends the string with the specified content.
   */
  prepend(content: string): this {
    if (typeof content !== 'string') {
      throw new MagicStringError(`content must be a string, got ${typeof content}`)
    }

    this.intro = content + this.intro
    return this
  }

  /**
   * Same as `s.appendLeft(...)`, except that the inserted content will go *before* any previous appends or prepends at index
   */
  prependLeft(index: number, content: string): this {
    index = index + this.offset

    if (typeof content !== 'string') {
      throw new MagicStringError(`content must be a string, got ${typeof content}`)
    }

    if (DEBUG)
      this.stats.time('insertRight')

    this._split(index)

    const chunk = this.byEnd.get(index)

    if (chunk) {
      chunk.prependLeft(content)
    }
    else {
      this.intro = content + this.intro
    }

    if (DEBUG)
      this.stats.timeEnd('insertRight')
    return this
  }

  /**
   * Same as `s.appendRight(...)`, except that the inserted content will go *before* any previous appends or prepends at `index`
   */
  prependRight(index: number, content: string): this {
    index = index + this.offset

    if (typeof content !== 'string') {
      throw new MagicStringError(`content must be a string, got ${typeof content}`)
    }

    if (DEBUG)
      this.stats.time('insertRight')

    this._split(index)

    const chunk = this.byStart.get(index)

    if (chunk) {
      chunk.prependRight(content)
    }
    else {
      this.outro = content + this.outro
    }

    if (DEBUG)
      this.stats.timeEnd('insertRight')
    return this
  }

  /**
   * Removes the characters from `start` to `end` (of the original string, **not** the generated string).
   * Removing the same content twice, or making removals that partially overlap, will cause an error.
   */
  remove(start: number, end: number): this {
    start = start + this.offset
    end = end + this.offset

    if (this.original.length !== 0) {
      if (start < 0)
        start = Math.max(0, start + this.original.length)
      if (end < 0)
        end = Math.max(0, end + this.original.length)
    }

    if (start === end)
      return this

    if (start < 0 || end > this.original.length) {
      throw new MagicStringError(`range ${start}–${end} is out of bounds`)
    }
    if (start > end) {
      throw new MagicStringError(`end must be greater than start (start: ${start}, end: ${end})`)
    }

    if (DEBUG)
      this.stats.time('remove')

    this._split(start)
    this._split(end)

    let chunk = this.byStart.get(start)

    while (chunk) {
      chunk.intro = ''
      chunk.outro = ''
      chunk.edit('')

      chunk = end > chunk.end ? this.byStart.get(chunk.end) : null
    }

    if (DEBUG)
      this.stats.timeEnd('remove')
    return this
  }

  /**
   * Reset the modified characters from `start` to `end` (of the original string, **not** the generated string).
   */
  reset(start: number, end: number): this {
    start = start + this.offset
    end = end + this.offset

    if (this.original.length !== 0) {
      if (start < 0)
        start = Math.max(0, start + this.original.length)
      if (end < 0)
        end = Math.max(0, end + this.original.length)
    }

    if (start === end)
      return this

    if (start < 0 || end > this.original.length) {
      throw new MagicStringError(`range ${start}–${end} is out of bounds`)
    }
    if (start > end) {
      throw new MagicStringError(`end must be greater than start (start: ${start}, end: ${end})`)
    }

    if (DEBUG)
      this.stats.time('reset')

    this._split(start)
    this._split(end)

    let chunk = this.byStart.get(start)

    while (chunk) {
      chunk.reset()

      chunk = end > chunk.end ? this.byStart.get(chunk.end) : null
    }

    if (DEBUG)
      this.stats.timeEnd('reset')
    return this
  }

  lastChar(): string {
    if (this.outro.length)
      return this.outro[this.outro.length - 1]
    let chunk: Chunk | null = this.lastChunk
    while (chunk) {
      if (chunk.outro.length)
        return chunk.outro[chunk.outro.length - 1]
      if (chunk.content.length)
        return chunk.content[chunk.content.length - 1]
      if (chunk.intro.length)
        return chunk.intro[chunk.intro.length - 1]
      chunk = chunk.previous
    }
    if (this.intro.length)
      return this.intro[this.intro.length - 1]
    return ''
  }

  lastLine(): string {
    let lineIndex = this.outro.lastIndexOf(n)
    if (lineIndex !== -1)
      return this.outro.substr(lineIndex + 1)
    let lineStr = this.outro
    let chunk: Chunk | null = this.lastChunk
    while (chunk) {
      if (chunk.outro.length > 0) {
        lineIndex = chunk.outro.lastIndexOf(n)
        if (lineIndex !== -1)
          return chunk.outro.substr(lineIndex + 1) + lineStr
        lineStr = chunk.outro + lineStr
      }

      if (chunk.content.length > 0) {
        lineIndex = chunk.content.lastIndexOf(n)
        if (lineIndex !== -1)
          return chunk.content.substr(lineIndex + 1) + lineStr
        lineStr = chunk.content + lineStr
      }

      if (chunk.intro.length > 0) {
        lineIndex = chunk.intro.lastIndexOf(n)
        if (lineIndex !== -1)
          return chunk.intro.substr(lineIndex + 1) + lineStr
        lineStr = chunk.intro + lineStr
      }
      chunk = chunk.previous
    }
    lineIndex = this.intro.lastIndexOf(n)
    if (lineIndex !== -1)
      return this.intro.substr(lineIndex + 1) + lineStr
    return this.intro + lineStr
  }

  /**
   * Returns the content of the generated string that corresponds to the slice between `start` and `end` of the original string.
   * Throws error if the indices are for characters that were already removed.
   */
  slice(start: number = 0, end: number = this.original.length - this.offset): string {
    start = start + this.offset
    end = end + this.offset

    if (this.original.length !== 0) {
      if (start < 0)
        start = Math.max(0, start + this.original.length)
      if (end < 0)
        end = Math.max(0, end + this.original.length)
    }

    let result = ''

    // find start chunk
    let chunk = this.firstChunk
    while (chunk && (chunk.start > start || chunk.end <= start)) {
      // found end chunk before start
      if (chunk.start < end && chunk.end >= end) {
        return result
      }

      chunk = chunk.next
    }

    if (chunk && chunk.edited && chunk.start !== start) {
      throw new MagicStringError(`cannot use edited character ${start} as slice start anchor`)
    }

    const startChunk = chunk
    while (chunk) {
      if (chunk.intro && (startChunk !== chunk || chunk.start === start)) {
        result += chunk.intro
      }

      const containsEnd = chunk.start < end && chunk.end >= end
      if (containsEnd && chunk.edited && chunk.end !== end) {
        throw new MagicStringError(`cannot use edited character ${end} as slice end anchor`)
      }

      const sliceStart = startChunk === chunk ? start - chunk.start : 0
      const sliceEnd = containsEnd ? chunk.content.length + end - chunk.end : chunk.content.length

      result += chunk.content.slice(sliceStart, sliceEnd)

      if (chunk.outro && (!containsEnd || chunk.end === end)) {
        result += chunk.outro
      }

      if (containsEnd) {
        break
      }

      chunk = chunk.next
    }

    return result
  }

  // TODO deprecate this? not really very useful
  /**
   * Returns a clone of `s`, with all content before the `start` and `end` characters of the original string removed.
   */
  snip(start: number, end: number): this {
    const clone = this.clone()
    clone.remove(0, start)
    clone.remove(end, clone.original.length)

    return clone
  }

  /** @internal */
  _split(index: number): boolean | void {
    if (this.byStart.get(index) || this.byEnd.get(index))
      return

    if (DEBUG)
      this.stats.time('_split')

    let chunk = this.lastSearchedChunk
    let previousChunk = chunk
    const searchForward = index > chunk.end

    while (chunk) {
      if (chunk.contains(index))
        return this._splitChunk(chunk, index)

      chunk = searchForward ? this.byStart.get(chunk.end) : this.byEnd.get(chunk.start)

      // Prevent infinite loop (e.g. via empty chunks, where start === end)
      if (chunk === previousChunk)
        return

      previousChunk = chunk
    }
  }

  /** @internal */
  _splitChunk(chunk: Chunk, index: number): true {
    if (chunk.edited && chunk.content.length) {
      // zero-length edited chunks are a special case (overlapping replacements)
      const loc = getLocator(this.original)(index)
      throw new MagicStringError(
        `cannot split a chunk that has already been edited (${loc.line}:${loc.column} – "${chunk.original}")`,
      )
    }

    const newChunk = chunk.split(index)

    this.byEnd.set(index, chunk)
    this.byStart.set(index, newChunk)
    this.byEnd.set(newChunk.end, newChunk)

    if (chunk === this.lastChunk)
      this.lastChunk = newChunk

    this.lastSearchedChunk = chunk
    if (DEBUG)
      this.stats.timeEnd('_split')
    return true
  }

  /**
   * Returns the generated string.
   */
  toString(): string {
    let str = this.intro

    let chunk = this.firstChunk
    while (chunk) {
      str += chunk.toString()
      chunk = chunk.next
    }

    return str + this.outro
  }

  /**
   * Returns true if the resulting source is empty (disregarding white space).
   */
  isEmpty(): boolean {
    let chunk: Chunk | null = this.firstChunk
    while (chunk) {
      if (
        (chunk.intro.length && chunk.intro.trim())
        || (chunk.content.length && chunk.content.trim())
        || (chunk.outro.length && chunk.outro.trim())
      ) {
        return false
      }
      chunk = chunk.next
    }
    return true
  }

  length(): number {
    let chunk: Chunk | null = this.firstChunk
    let length = 0
    while (chunk) {
      length += chunk.intro.length + chunk.content.length + chunk.outro.length
      chunk = chunk.next
    }
    return length
  }

  /**
   * Removes empty lines from the start and end.
   */
  trimLines(): this {
    return this.trim('[\\r\\n]')
  }

  /**
   * Trims content matching `charType` (defaults to `\s`, i.e. whitespace) from the start and end.
   */
  trim(charType?: string): this {
    return this.trimStart(charType).trimEnd(charType)
  }

  /** @internal */
  trimEndAborted(charType?: string): boolean {
    const rx = new RegExp(`${charType || '\\s'}+$`)

    this.outro = this.outro.replace(rx, '')
    if (this.outro.length)
      return true

    let chunk = this.lastChunk

    do {
      const end = chunk.end
      const aborted = chunk.trimEnd(rx)

      // if chunk was trimmed, we have a new lastChunk
      if (chunk.end !== end) {
        if (this.lastChunk === chunk) {
          this.lastChunk = chunk.next
        }

        this.byEnd.set(chunk.end, chunk)
        this.byStart.set(chunk.next.start, chunk.next)
        this.byEnd.set(chunk.next.end, chunk.next)
      }

      if (aborted)
        return true
      chunk = chunk.previous
    } while (chunk)

    return false
  }

  /**
   * Trims content matching `charType` (defaults to `\s`, i.e. whitespace) from the end.
   */
  trimEnd(charType?: string): this {
    this.trimEndAborted(charType)
    return this
  }

  /** @internal */
  trimStartAborted(charType?: string): boolean {
    const rx = new RegExp(`^${charType || '\\s'}+`)

    this.intro = this.intro.replace(rx, '')
    if (this.intro.length)
      return true

    let chunk = this.firstChunk

    do {
      const end = chunk.end
      const aborted = chunk.trimStart(rx)

      if (chunk.end !== end) {
        // special case...
        if (chunk === this.lastChunk)
          this.lastChunk = chunk.next

        this.byEnd.set(chunk.end, chunk)
        this.byStart.set(chunk.next.start, chunk.next)
        this.byEnd.set(chunk.next.end, chunk.next)
      }

      if (aborted)
        return true
      chunk = chunk.next
    } while (chunk)

    return false
  }

  /**
   * Trims content matching `charType` (defaults to `\s`, i.e. whitespace) from the start.
   */
  trimStart(charType?: string): this {
    this.trimStartAborted(charType)
    return this
  }

  /**
   * Indicates if the string has been changed.
   */
  hasChanged(): boolean {
    if (this.intro || this.outro)
      return true

    // How much of `original` the chunks visited so far reproduce, which is not
    // the same as how much of it they span: an overwrite covering several
    // chunks stores the whole replacement on the first of them and empties the
    // rest, so a chunk's content has to be compared against the original text
    // at the offset it is emitted at rather than against its own start and end
    let outputIndex = 0
    let chunk: Chunk | null = this.firstChunk

    while (chunk) {
      // Any intro/outro on a chunk means content was inserted
      if (chunk.intro || chunk.outro)
        return true

      if (!chunk.edited && chunk.start === outputIndex) {
        // An untouched chunk still at its original offset reproduces the
        // original exactly, so it needs no comparison
        outputIndex = chunk.end
      }
      else {
        // `startsWith` with an offset compares in place, where slicing the
        // original first would allocate on every edited chunk
        if (!this.original.startsWith(chunk.content, outputIndex))
          return true

        outputIndex += chunk.content.length
      }

      chunk = chunk.next
    }

    return outputIndex !== this.original.length
  }

  /** @internal */
  _replaceRegexp(searchValue: RegExp, replacement: string | ReplacementFunction): this {
    function getReplacement(match: RegExpMatchArray, str: string): string {
      if (typeof replacement === 'string') {
        return replacement.replace(/\$(\$|&|\d+)/g, (_: string, i: string) => {
          // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_string_as_a_parameter
          if (i === '$')
            return '$'
          if (i === '&')
            return match[0]
          const num = +i
          if (num < match.length)
            return match[+i]
          return `$${i}`
        })
      }
      else {
        return replacement(match[0], ...match.slice(1), match.index, str, match.groups)
      }
    }
    function matchAll(re: RegExp, str: string): RegExpExecArray[] {
      const matches = []
      while (true) {
        const match = re.exec(str)
        if (!match)
          break

        matches.push(match)
      }
      return matches
    }
    if (searchValue.global) {
      const matches = matchAll(searchValue, this.original)
      matches.forEach((match) => {
        if (match.index != null) {
          const replacement = getReplacement(match, this.original)
          if (replacement !== match[0]) {
            this.overwrite(match.index, match.index + match[0].length, replacement)
          }
        }
      })
    }
    else {
      const match = this.original.match(searchValue)
      if (match && match.index != null) {
        const replacement = getReplacement(match, this.original)
        if (replacement !== match[0]) {
          this.overwrite(match.index, match.index + match[0].length, replacement)
        }
      }
    }
    return this
  }

  /** @internal */
  _replaceString(string: string, replacement: string | ReplacementFunction): this {
    const { original } = this
    const index = original.indexOf(string)

    if (index !== -1) {
      if (typeof replacement === 'function') {
        replacement = replacement(string, index, original)
      }
      if (string !== replacement) {
        this.overwrite(index, index + string.length, replacement)
      }
    }

    return this
  }

  /**
   * String replacement with RegExp or string.
   */
  replace(searchValue: string | RegExp, replacement: string | ReplacementFunction): this {
    if (typeof searchValue === 'string') {
      return this._replaceString(searchValue, replacement)
    }

    return this._replaceRegexp(searchValue, replacement)
  }

  /** @internal */
  _replaceAllString(string: string, replacement: string | ReplacementFunction): this {
    const { original } = this
    const stringLength = string.length
    for (
      let index = original.indexOf(string);
      index !== -1;
      index = original.indexOf(string, index + stringLength)
    ) {
      const previous = original.slice(index, index + stringLength)
      const _replacement
        = typeof replacement === 'function' ? replacement(previous, index, original) : replacement
      if (previous !== _replacement)
        this.overwrite(index, index + stringLength, _replacement)
    }

    return this
  }

  /**
   * Same as `s.replace`, but replace all matched strings instead of just one.
   */
  replaceAll(searchValue: string | RegExp, replacement: string | ReplacementFunction): this {
    if (typeof searchValue === 'string') {
      return this._replaceAllString(searchValue, replacement)
    }

    if (!searchValue.global) {
      throw new MagicStringError('replaceAll() requires a global RegExp')
    }

    return this._replaceRegexp(searchValue, replacement)
  }
}
