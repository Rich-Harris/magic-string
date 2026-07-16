import { encode } from '@jridgewell/sourcemap-codec'

type Btoa = (str: string) => string

interface GlobalBuffer {
  from: (str: string, encoding: 'utf-8') => {
    toString: (encoding: 'base64') => string
  }
}

export interface SourceMapOptions {
  /**
   * Whether the mapping should be high-resolution.
   * Hi-res mappings map every single character, meaning (for example) your devtools will always
   * be able to pinpoint the exact location of function calls and so on.
   * With lo-res mappings, devtools may only be able to identify the correct
   * line - but they're quicker to generate and less bulky.
   * You can also set `"boundary"` to generate a semi-hi-res mappings segmented per word boundary
   * instead of per character, suitable for string semantics that are separated by words.
   * If sourcemap locations have been specified with s.addSourceMapLocation(), they will be used here.
   */
  hires?: boolean | 'boundary'
  /**
   * The filename where you plan to write the sourcemap.
   */
  file?: string
  /**
   * The filename of the file containing the original source.
   */
  source?: string
  /**
   * Whether to include the original content in the map's sourcesContent array.
   */
  includeContent?: boolean
}

export type SourceMapSegment
  = | [number]
    | [number, number, number, number]
    | [number, number, number, number, number]

export interface DecodedSourceMap {
  file?: string
  sources: string[]
  sourcesContent?: Array<string | null>
  names: string[]
  mappings: SourceMapSegment[][]
  x_google_ignoreList?: number[]
  debugId?: string
}

function getBtoa(): Btoa {
  if (typeof globalThis !== 'undefined' && typeof globalThis.btoa === 'function') {
    return str => globalThis.btoa(unescape(encodeURIComponent(str)))
  }

  const bufferKey = 'Buffer'
  const buffer = (globalThis as typeof globalThis & Record<string, GlobalBuffer | undefined>)[bufferKey]
  if (buffer) {
    return str => buffer.from(str, 'utf-8').toString('base64')
  }

  return () => {
    throw new Error('Unsupported environment: `window.btoa` or `Buffer` should be supported.')
  }
}

const btoa = /* #__PURE__ */ getBtoa()

export default class SourceMap {
  declare version: number
  declare file: string | undefined
  declare sources: string[]
  declare sourcesContent: Array<string | null> | undefined
  declare names: string[]
  declare mappings: string
  declare x_google_ignoreList: number[] | undefined
  declare debugId: string | undefined

  constructor(properties: DecodedSourceMap) {
    this.version = 3
    this.file = properties.file
    this.sources = properties.sources
    this.sourcesContent = properties.sourcesContent
    this.names = properties.names
    this.mappings = encode(properties.mappings)
    if (typeof properties.x_google_ignoreList !== 'undefined') {
      this.x_google_ignoreList = properties.x_google_ignoreList
    }
    if (typeof properties.debugId !== 'undefined') {
      this.debugId = properties.debugId
    }
  }

  /**
   * Returns the equivalent of `JSON.stringify(map)`
   */
  toString(): string {
    return JSON.stringify(this)
  }

  /**
   * Returns a DataURI containing the sourcemap. Useful for doing this sort of thing:
   * `generateMap(options?: SourceMapOptions): SourceMap;`
   */
  toUrl(): string {
    return `data:application/json;charset=utf-8;base64,${btoa(this.toString())}`
  }
}
