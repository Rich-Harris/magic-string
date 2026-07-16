import Bundle from './Bundle.ts';
import MagicString from './MagicString.ts';
import SourceMap from './SourceMap.ts';

export { Bundle, MagicString as default, MagicString, SourceMap };
export type { BundleOptions } from './Bundle.ts';
export type {
	ExclusionRange,
	IndentOptions,
	MagicStringOptions,
	OverwriteOptions,
	ReplacementFunction,
	UpdateOptions,
} from './MagicString.ts';
export type { DecodedSourceMap, SourceMapOptions, SourceMapSegment } from './SourceMap.ts';
