import type { ExclusionRange } from './MagicString.ts'
import type { DecodedSourceMap, SourceMapOptions } from './SourceMap.ts'
import MagicString from './MagicString.ts'
import MagicStringError from './MagicStringError.ts'
import SourceMap from './SourceMap.ts'
import getLocator from './utils/getLocator.ts'
import getRelativePath from './utils/getRelativePath.ts'
import isObject from './utils/isObject.ts'
import Mappings from './utils/Mappings.ts'

const hasOwnProp = Object.prototype.hasOwnProperty

export interface BundleOptions {
  intro?: string
  separator?: string
}

interface BundleSourceDescription {
  filename?: string
  content: MagicString
  ignoreList?: boolean
  indentExclusionRanges?: ExclusionRange | ExclusionRange[]
  separator?: string
}

interface UniqueSource {
  filename: string
  content: string
}

export interface DecodedSourceMapOrMissingContent extends Omit<DecodedSourceMap, 'sourcesContent'> {
  sourcesContent: Array<string | null>
}

export default class Bundle {
  /** @internal */
  declare intro: string
  /** @internal */
  declare separator: string
  /** @internal */
  declare sources: BundleSourceDescription[]
  /** @internal */
  declare uniqueSources: UniqueSource[]
  /** @internal */
  declare uniqueSourceIndexByFilename: Record<string, number>
  declare indentExclusionRanges: ExclusionRange | ExclusionRange[] | undefined

  constructor(options: BundleOptions = {}) {
    this.intro = options.intro || ''
    this.separator = options.separator !== undefined ? options.separator : '\n'
    this.sources = []
    this.uniqueSources = []
    this.uniqueSourceIndexByFilename = {}
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

    ['filename', 'ignoreList', 'indentExclusionRanges', 'separator'].forEach((option) => {
      if (!hasOwnProp.call(source, option))
        source[option] = source.content[option]
    })

    if (source.separator === undefined) {
      // TODO there's a bunch of this sort of thing, needs cleaning up
      source.separator = this.separator
    }

    if (source.filename) {
      if (!hasOwnProp.call(this.uniqueSourceIndexByFilename, source.filename)) {
        this.uniqueSourceIndexByFilename[source.filename] = this.uniqueSources.length
        this.uniqueSources.push({ filename: source.filename, content: source.content.original })
      }
      else {
        const uniqueSource = this.uniqueSources[this.uniqueSourceIndexByFilename[source.filename]]
        if (source.content.original !== uniqueSource.content) {
          throw new MagicStringError(
            `duplicate filename "${source.filename}" with different content, use unique filenames`,
          )
        }
      }
    }

    this.sources.push(source)
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
        separator: source.separator,
      })
    })

    return bundle as this
  }

  generateDecodedMap(options: SourceMapOptions = {}): DecodedSourceMapOrMissingContent {
    const names = []
    let x_google_ignoreList
    this.sources.forEach((source) => {
      Object.keys(source.content.storedNames).forEach((name) => {
        if (!names.includes(name))
          names.push(name)
      })
    })

    const mappings = new Mappings(options.hires)

    if (this.intro) {
      mappings.advance(this.intro)
    }

    this.sources.forEach((source, i) => {
      if (i > 0) {
        // mirrors toString(): a source can override the bundle separator
        mappings.advance(source.separator !== undefined ? source.separator : this.separator)
      }

      const sourceIndex = source.filename ? this.uniqueSourceIndexByFilename[source.filename] : -1
      const magicString = source.content
      const locate = getLocator(magicString.original)

      if (magicString.intro) {
        mappings.advance(magicString.intro)
      }

      magicString.firstChunk.eachNext((chunk) => {
        const loc = locate(chunk.start)

        if (chunk.intro.length)
          mappings.advance(chunk.intro)

        if (source.filename) {
          if (chunk.edited) {
            mappings.addEdit(
              sourceIndex,
              chunk.content,
              loc,
              chunk.storeName ? names.indexOf(chunk.original) : -1,
            )
          }
          else {
            mappings.addUneditedChunk(
              sourceIndex,
              chunk,
              magicString.original,
              loc,
              magicString.sourcemapLocations,
            )
          }
        }
        else {
          mappings.advance(chunk.content)
        }

        if (chunk.outro.length)
          mappings.advance(chunk.outro)
      })

      if (magicString.outro) {
        mappings.advance(magicString.outro)
      }

      if (source.ignoreList && sourceIndex !== -1) {
        if (x_google_ignoreList === undefined) {
          x_google_ignoreList = []
        }
        x_google_ignoreList.push(sourceIndex)
      }
    })

    return {
      file: options.file ? options.file.split(/[/\\]/).pop() : undefined,
      sources: this.uniqueSources.map((source) => {
        return options.file ? getRelativePath(options.file, source.filename) : source.filename
      }),
      sourcesContent: this.uniqueSources.map((source) => {
        return options.includeContent ? source.content : null
      }),
      names,
      mappings: mappings.raw,
      x_google_ignoreList,
    }
  }

  generateMap(
    options?: SourceMapOptions,
  ): Omit<SourceMap, 'sourcesContent'> & { sourcesContent: Array<string | null> } {
    return new SourceMap(this.generateDecodedMap(options)) as Omit<SourceMap, 'sourcesContent'> & {
      sourcesContent: Array<string | null>
    }
  }

  getIndentString(): string {
    const indentStringCounts = {}

    this.sources.forEach((source) => {
      const indentStr = source.content._getRawIndentString()

      if (indentStr === null)
        return

      if (!indentStringCounts[indentStr])
        indentStringCounts[indentStr] = 0
      indentStringCounts[indentStr] += 1
    })

    return (
      Object.keys(indentStringCounts).sort((a, b) => {
        return indentStringCounts[a] - indentStringCounts[b]
      })[0] || '\t'
    )
  }

  indent(indentStr?: string): this {
    if (!arguments.length) {
      indentStr = this.getIndentString()
    }

    if (indentStr === '')
      return this // noop

    let trailingNewline = !this.intro || this.intro.slice(-1) === '\n'

    this.sources.forEach((source, i) => {
      const separator = source.separator !== undefined ? source.separator : this.separator
      const indentStart = trailingNewline || (i > 0 && /\r?\n$/.test(separator))

      source.content.indent(indentStr, {
        exclude: source.indentExclusionRanges,
        indentStart, // : trailingNewline || /\r?\n$/.test( separator )  //true///\r?\n/.test( separator )
      })

      trailingNewline = source.content.lastChar() === '\n'
    })

    if (this.intro) {
      this.intro
        = indentStr
          + this.intro.replace(/^[^\n]/gm, (match, index) => {
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
        const separator = source.separator !== undefined ? source.separator : this.separator
        const str = (i > 0 ? separator : '') + source.content.toString()

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
      const separator = source.separator !== undefined ? source.separator : this.separator

      return (i > 0 && separator.trim() !== '') || !source.content.isEmpty()
    })) {
      return false
    }
    return true
  }

  length(): number {
    return this.sources.reduce((length, source, i) => {
      // mirrors toString(): every source but the first is preceded by a separator
      const separator = source.separator !== undefined ? source.separator : this.separator

      return length + (i > 0 ? separator.length : 0) + source.content.length()
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
      let source
      let i = 0

      do {
        source = this.sources[i++]
        if (!source) {
          break
        }
      } while (!source.content.trimStartAborted(charType))
    }

    return this
  }

  trimEnd(charType?: string): this {
    const rx = new RegExp(`${charType || '\\s'}+$`)

    let source
    let i = this.sources.length - 1

    do {
      source = this.sources[i--]
      if (!source) {
        this.intro = this.intro.replace(rx, '')
        break
      }
    } while (!source.content.trimEndAborted(charType))

    return this
  }
}
