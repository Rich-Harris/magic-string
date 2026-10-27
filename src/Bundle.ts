import type { Chunk } from './Chunk.ts'
import type { ExclusionRange } from './MagicString.ts'
import type { DecodedSourceMap, SourceMapOptions } from './SourceMap.ts'
import { MagicString } from './MagicString.ts'
import { MagicStringError } from './MagicStringError.ts'
import { SourceMap } from './SourceMap.ts'
import { getRelativePath } from './utils/getRelativePath.ts'
import { isObject } from './utils/isObject.ts'
import { Mappings } from './utils/Mappings.ts'
import { MappingsEncoder } from './utils/MappingsEncoder.ts'

const hasOwnProp = Object.prototype.hasOwnProperty

export interface BundleOptions {
  intro?: string
  separator?: string
}

export interface BundleSourceDescription {
  filename?: string
  content: MagicString
  ignoreList?: boolean
  indentExclusionRanges?: ExclusionRange | ExclusionRange[]
  separator?: string
}

// what `sources` holds: every field resolved once in addSource
interface BundleSource {
  filename: string | undefined
  content: MagicString
  ignoreList: boolean | undefined
  indentExclusionRanges: ExclusionRange | ExclusionRange[] | undefined
  separator: string
}

interface UniqueSource {
  filename: string
  content: string
}

export interface BundledSourceFileRecord {
  filename: string
  content: string
}

export interface BundleSourceMapOptions extends Omit<SourceMapOptions, 'includeContent'> {
  /**
   * Whether to include the original content of each source in the map's `sourcesContent` array.
   * Can also be a function that receives the source's `filename` and `content` and returns
   * whether to include it, allowing per-source control (for example, omitting content for
   * sources that are otherwise loadable at runtime, such as public http(s) urls).
   */
  includeContent?: boolean | ((source: BundledSourceFileRecord) => boolean)
}

export interface DecodedSourceMapOrMissingContent extends Omit<DecodedSourceMap, 'sourcesContent'> {
  sourcesContent: Array<string | null>
}

export class Bundle {
  /** @internal */
  declare intro: string
  /** @internal */
  declare separator: string
  /** @internal */
  declare sources: BundleSource[]
  /** @internal */
  declare uniqueSources: UniqueSource[]
  /** @internal */
  declare uniqueSourceIndexByFilename: Map<string, number>
  declare indentExclusionRanges: ExclusionRange | ExclusionRange[] | undefined

  constructor(options: BundleOptions = {}) {
    this.intro = options.intro || ''
    this.separator = options.separator !== undefined ? options.separator : '\n'
    this.sources = []
    this.uniqueSources = []
    this.uniqueSourceIndexByFilename = new Map()
  }

  /**
   * Adds the specified source to the bundle, which can either be a `MagicString` object directly,
   * or an options object that holds a magic string `content` property and optionally provides
   * a `filename` for the source within the bundle, as well as an optional `ignoreList` hint
   * (which defaults to `false`). The `filename` is used when constructing the source map for the
   * bundle, to identify this `source` in the source map's `sources` field. The `ignoreList` hint
   * is used to populate the `x_google_ignoreList` extension field in the source map, which is a
   * mechanism for tools to signal to debuggers that certain sources should be ignored by default
   * (depending on user preferences).
   */
  addSource(source: MagicString | BundleSourceDescription): this {
    if (source instanceof MagicString) {
      return this.addSource({
        content: source,
        filename: source.filename,
        separator: this.separator,
      })
    }

    if (!isObject(source) || !source.content) {
      throw new MagicStringError('addSource() requires a `content` property that is a MagicString')
    }

    const content = source.content
    const record: BundleSource = {
      content,
      filename: hasOwnProp.call(source, 'filename') ? source.filename : content.filename,
      ignoreList: hasOwnProp.call(source, 'ignoreList') ? source.ignoreList : content.ignoreList,
      indentExclusionRanges: hasOwnProp.call(source, 'indentExclusionRanges')
        ? source.indentExclusionRanges
        : content.indentExclusionRanges,
      separator: source.separator ?? this.separator,
    }

    if (record.filename) {
      const index = this.uniqueSourceIndexByFilename.get(record.filename)
      if (index === undefined) {
        this.uniqueSourceIndexByFilename.set(record.filename, this.uniqueSources.length)
        this.uniqueSources.push({ filename: record.filename, content: content.original })
      }
      else if (content.original !== this.uniqueSources[index].content) {
        throw new MagicStringError(
          `duplicate filename "${record.filename}" with different content, use unique filenames`,
        )
      }
    }

    this.sources.push(record)
    return this
  }

  append(str: string, options?: BundleOptions): this {
    this.addSource({
      content: new MagicString(str),
      separator: (options && options.separator) || '',
    })

    return this
  }

  clone(): this {
    const bundle = new Bundle({
      intro: this.intro,
      separator: this.separator,
    })

    this.sources.forEach((source) => {
      bundle.addSource({
        filename: source.filename,
        content: source.content.clone(),
        ignoreList: source.ignoreList,
        indentExclusionRanges: source.indentExclusionRanges,
        separator: source.separator,
      })
    })

    return bundle as this
  }

  /**
   * Flattens the bundle into a single `MagicString`, so the concatenated result can be
   * processed further with the full `MagicString` API. The returned string's `original`
   * is the concatenation of every source's `original`, and all existing edits, inserts,
   * intros, outros and separators are preserved as inserted content, so its `toString()`
   * equals the bundle's `toString()` and its sourcemap maps back to that combined original.
   *
   * Because a `MagicString` maps to a single source, per-source `filename`s are not carried
   * over; generate the bundle's map before flattening if you need the multi-source mapping.
   */
  toMagicString(): MagicString {
    const combined = new MagicString(this.sources.map(source => source.content.original).join(''))

    let offset = 0
    let pending = this.intro
    let first: Chunk | null = null
    let last: Chunk | null = null
    const byStart = new Map<number, Chunk>()
    const byEnd = new Map<number, Chunk>()
    let hasMovedChunks = false

    for (const [i, source] of this.sources.entries()) {
      const magicString = source.content
      const separator = i > 0 ? source.separator : ''

      // A source with no original contributes only inserted text (its intro, any
      // appends, its outro), which has no place in the combined coordinate space,
      // so fold it into the text waiting in front of the next real chunk.
      if (magicString.original.length === 0) {
        pending += separator + magicString.toString()
        continue
      }

      pending += separator + magicString.intro

      let sourceFirst: Chunk | null = null
      let previous: Chunk | null = null
      let originalChunk: Chunk | null = magicString.firstChunk
      while (originalChunk) {
        const chunk = originalChunk.clone()
        chunk.start += offset
        chunk.end += offset
        // these record positions in the source's original too
        if (chunk.replacesUntil !== -1)
          chunk.replacesUntil += offset
        if (chunk.replacedFrom !== -1)
          chunk.replacedFrom += offset
        chunk.previous = previous
        chunk.next = null
        if (previous)
          previous.next = chunk
        byStart.set(chunk.start, chunk)
        byEnd.set(chunk.end, chunk)
        sourceFirst ??= chunk
        previous = chunk
        originalChunk = originalChunk.next
      }
      const sourceLast = previous!

      sourceFirst!.intro = pending + sourceFirst!.intro
      pending = ''
      sourceLast.outro += magicString.outro

      if (last) {
        last.next = sourceFirst
        sourceFirst!.previous = last
      }
      else {
        first = sourceFirst
      }
      last = sourceLast

      magicString.sourcemapLocations.forEach((index) => {
        // a location past this source's end would land in the next source's range
        if (index < magicString.original.length)
          combined.sourcemapLocations.add(index + offset)
      })
      magicString.storedNames.forEach(name => combined.storedNames.add(name))
      if (magicString.hasMovedChunks)
        hasMovedChunks = true

      offset += magicString.original.length
    }

    if (!first || !last) {
      // every source was empty (or there were none): keep the default empty chunk
      // and hang all the inserted text off the string-level intro
      combined.intro = pending
      return combined
    }

    if (pending)
      last.outro += pending

    combined.firstChunk = first
    combined.lastChunk = last
    combined.lastSearchedChunk = first
    combined.byStart = byStart
    combined.byEnd = byEnd
    combined.hasMovedChunks = hasMovedChunks

    return combined
  }

  generateDecodedMap(options: BundleSourceMapOptions = {}): DecodedSourceMapOrMissingContent {
    const mappings = new Mappings(options.hires)
    const { names, x_google_ignoreList } = this._generateMappings(mappings)

    return {
      ...this._mapProperties(options, names, x_google_ignoreList),
      mappings: mappings.raw,
      rangeMappings: mappings.rawRangeMappings,
    }
  }

  generateMap(
    options: BundleSourceMapOptions = {},
  ): Omit<SourceMap, 'sourcesContent'> & { sourcesContent: Array<string | null> } {
    const encoder = new MappingsEncoder()
    const mappings = new Mappings(options.hires, encoder)
    const { names, x_google_ignoreList } = this._generateMappings(mappings)

    // bundle maps always provide sourcesContent, while SourceMap types it as optional
    return new SourceMap({
      ...this._mapProperties(options, names, x_google_ignoreList),
      mappings: encoder.finish(mappings.rawSegments),
      rangeMappings: mappings.rawRangeMappings,
    }) as Omit<SourceMap, 'sourcesContent'> & {
      sourcesContent: Array<string | null>
    }
  }

  /** @internal */
  _generateMappings(mappings: Mappings): { names: string[], x_google_ignoreList: number[] | undefined } {
    let x_google_ignoreList: number[] | undefined
    const storedNames = new Set<string>()
    this.sources.forEach(source => source.content.storedNames.forEach(name => storedNames.add(name)))
    const names = [...storedNames]
    const nameIndex = new Map(names.map((name, i) => [name, i]))

    if (this.intro) {
      mappings.advance(this.intro)
    }

    this.sources.forEach((source, i) => {
      if (i > 0) {
        // mirrors toString(): a source can override the bundle separator
        mappings.advance(source.separator)
      }

      const sourceIndex = source.filename ? this.uniqueSourceIndexByFilename.get(source.filename) ?? -1 : -1
      mappings.addMagicString(source.content, sourceIndex, nameIndex)

      if (source.ignoreList && sourceIndex !== -1) {
        if (x_google_ignoreList === undefined) {
          x_google_ignoreList = []
        }
        x_google_ignoreList.push(sourceIndex)
      }
    })

    return { names, x_google_ignoreList }
  }

  /** @internal */
  _mapProperties(
    options: BundleSourceMapOptions,
    names: string[],
    x_google_ignoreList: number[] | undefined,
  ): Omit<DecodedSourceMapOrMissingContent, 'mappings' | 'rangeMappings'> {
    return {
      file: options.file ? options.file.split(/[/\\]/).pop() : undefined,
      sources: this.uniqueSources.map((source) => {
        return options.file ? getRelativePath(options.file, source.filename) : source.filename
      }),
      sourcesContent: this.uniqueSources.map((source) => {
        const includeContent = typeof options.includeContent === 'function'
          ? options.includeContent(source)
          : options.includeContent

        return includeContent ? source.content : null
      }),
      names,
      x_google_ignoreList,
    }
  }

  getIndentString(): string {
    const indentStringCounts = new Map<string, number>()

    this.sources.forEach((source) => {
      const indentStr = source.content._getRawIndentString()

      if (indentStr == null)
        return

      indentStringCounts.set(indentStr, (indentStringCounts.get(indentStr) ?? 0) + 1)
    })

    return [...indentStringCounts.entries()].sort(([, a], [, b]) => b - a)[0]?.[0] ?? '\t'
  }

  indent(indentStr?: string): this {
    if (!arguments.length) {
      indentStr = this.getIndentString()
    }

    if (indentStr === '')
      return this // noop

    let trailingNewline = !this.intro || this.intro.slice(-1) === '\n'

    this.sources.forEach((source, i) => {
      const indentStart = trailingNewline || (i > 0 && /\r?\n$/.test(source.separator))

      source.content.indent(indentStr, {
        exclude: source.indentExclusionRanges,
        indentStart, // : trailingNewline || /\r?\n$/.test( separator )  //true///\r?\n/.test( separator )
      })

      trailingNewline = source.content.lastChar() === '\n'
    })

    if (this.intro) {
      this.intro
        = indentStr
          + this.intro.replace(/^[^\r\n]/gm, (match, index) => {
            return index > 0 ? indentStr + match : match
          })
    }

    return this
  }

  prepend(str: string): this {
    this.intro = str + this.intro
    return this
  }

  toString(): string {
    const body = this.sources
      .map((source, i) => {
        const str = (i > 0 ? source.separator : '') + source.content.toString()

        return str
      })
      .join('')

    return this.intro + body
  }

  isEmpty(): boolean {
    if (this.intro.length && this.intro.trim())
      return false
    if (this.sources.some((source, i) => {
      // mirrors toString(): every source but the first is preceded by a separator
      return (i > 0 && source.separator.trim() !== '') || !source.content.isEmpty()
    })) {
      return false
    }
    return true
  }

  length(): number {
    return this.sources.reduce((length, source, i) => {
      // mirrors toString(): every source but the first is preceded by a separator
      return length + (i > 0 ? source.separator.length : 0) + source.content.length() + source.content.intro.length + source.content.outro.length
    }, this.intro.length)
  }

  trimLines(): this {
    return this.trim('[\\r\\n]')
  }

  trim(charType?: string): this {
    return this.trimStart(charType).trimEnd(charType)
  }

  trimStart(charType?: string): this {
    const rx = new RegExp(`^${charType || '\\s'}+`)
    this.intro = this.intro.replace(rx, '')

    if (!this.intro) {
      for (let i = 0; i < this.sources.length; i += 1) {
        const source = this.sources[i]

        if (i > 0) {
          // mirrors toString(): every source but the first is preceded by a separator
          source.separator = source.separator.replace(rx, '')

          if (source.separator) {
            break
          }
        }

        if (source.content.trimStartAborted(charType)) {
          break
        }
      }
    }

    return this
  }

  trimEnd(charType?: string): this {
    const rx = new RegExp(`${charType || '\\s'}+$`)

    for (let i = this.sources.length - 1; i >= 0; i -= 1) {
      const source = this.sources[i]

      if (source.content.trimEndAborted(charType)) {
        return this
      }

      if (i > 0) {
        // mirrors toString(): every source but the first is preceded by a separator
        source.separator = source.separator.replace(rx, '')

        if (source.separator) {
          return this
        }
      }
    }

    this.intro = this.intro.replace(rx, '')

    return this
  }
}
