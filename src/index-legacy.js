import MagicString from './MagicString.js';
import Bundle from './Bundle.js';
import SourceMap from './SourceMap.js';

MagicString.Bundle = Bundle;
MagicString.SourceMap = SourceMap;
MagicString.default = MagicString; // work around TypeScript bug https://github.com/Rich-Harris/magic-string/pull/121

export default MagicString;
