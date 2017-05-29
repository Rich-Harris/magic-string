import MagicString from './MagicString.js';
import Bundle from './Bundle.js';

MagicString.Bundle = Bundle;
MagicString.default = MagicString; // work around TypeScript bug https://github.com/Rich-Harris/magic-string/pull/121

export default MagicString;
