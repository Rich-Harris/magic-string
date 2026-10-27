import { Bundle } from './Bundle.ts'
import { MagicString } from './MagicString.ts'
import { MagicStringError } from './MagicStringError.ts'
import { SourceMap } from './SourceMap.ts'

export { Bundle, MagicString as default, MagicString, MagicStringError, SourceMap }
export type {
  BundledSourceFileRecord,
  BundleOptions,
  BundleSourceDescription,
  BundleSourceMapOptions,
  DecodedSourceMapOrMissingContent,
} from './Bundle.ts'
export type {
  ExclusionRange,
  IndentOptions,
  MagicStringOptions,
  OverwriteOptions,
  ReplacementFunction,
  UpdateOptions,
} from './MagicString.ts'
export type { DecodedSourceMap, SourceMapOptions, SourceMapRangeMappings, SourceMapSegment } from './SourceMap.ts'
