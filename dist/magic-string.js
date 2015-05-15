(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('vlq')) :
	typeof define === 'function' && define.amd ? define(['vlq'], factory) :
	global.MagicString = factory(global.vlq)
}(this, function (vlq) { 'use strict';

	var _btoa;

	if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
		_btoa = window.btoa;
	} else if (typeof Buffer === 'function') {
		_btoa = function (str) {
			return new Buffer(str).toString('base64');
		};
	} else {
		throw new Error('Unsupported environment: `window.btoa` or `Buffer` should be supported.');
	}

	var btoa = _btoa;
	//# sourceMappingURL=/www/magic-string/.gobble-build/01-babel/.cache/utils/btoa.js.map

	function SourceMap___classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

	var SourceMap = (function () {
		function SourceMap(properties) {
			SourceMap___classCallCheck(this, SourceMap);

			this.version = 3;

			this.file = properties.file;
			this.sources = properties.sources;
			this.sourcesContent = properties.sourcesContent;
			this.names = properties.names;
			this.mappings = properties.mappings;
		}

		SourceMap.prototype.toString = function toString() {
			return JSON.stringify(this);
		};

		SourceMap.prototype.toUrl = function toUrl() {
			return 'data:application/json;charset=utf-8;base64,' + btoa(this.toString());
		};

		return SourceMap;
	})();


	//# sourceMappingURL=/www/magic-string/.gobble-build/01-babel/.cache/SourceMap/index.js.map

	function getRelativePath(from, to) {
		var fromParts = from.split(/[\/\\]/);
		var toParts = to.split(/[\/\\]/);

		fromParts.pop(); // get dirname

		while (fromParts[0] === toParts[0]) {
			fromParts.shift();
			toParts.shift();
		}

		if (fromParts.length) {
			var i = fromParts.length;
			while (i--) fromParts[i] = '..';
		}

		return fromParts.concat(toParts).join('/');
	}
	//# sourceMappingURL=/www/magic-string/.gobble-build/01-babel/.cache/utils/getRelativePath.js.map

	var hasOwnProp = Object.prototype.hasOwnProperty;
	//# sourceMappingURL=/www/magic-string/.gobble-build/01-babel/.cache/utils/hasOwnProp.js.map

	function Bundle___classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

	var Bundle = (function () {
		function Bundle() {
			var options = arguments[0] === undefined ? {} : arguments[0];

			Bundle___classCallCheck(this, Bundle);

			this.intro = options.intro || '';
			this.outro = options.outro || '';
			this.separator = 'separator' in options ? options.separator : '\n';

			this.sources = [];
		}

		Bundle.prototype.addSource = function addSource(source) {
			if (source instanceof MagicString) {
				return this.addSource({
					content: source,
					filename: source.filename
				});
			}

			if (typeof source !== 'object' || !source.content) {
				throw new Error('bundle.addSource() takes an object with a `content` property, which should be an instance of MagicString, and an optional `filename`');
			}

			if (!hasOwnProp.call(source, 'filename')) source.filename = source.content.filename;
			if (!hasOwnProp.call(source, 'indentExclusionRanges')) source.indentExclusionRanges = source.content.indentExclusionRanges;

			this.sources.push(source);
			return this;
		};

		Bundle.prototype.append = function append(str) {
			this.outro += str;
			return this;
		};

		Bundle.prototype.clone = function clone() {
			var bundle = new Bundle({
				intro: this.intro,
				outro: this.outro,
				separator: this.separator
			});

			this.sources.forEach(function (source) {
				bundle.addSource({
					filename: source.filename,
					content: source.content.clone()
				});
			});

			return bundle;
		};

		Bundle.prototype.generateMap = function generateMap(options) {
			var encodingSeparator = getSemis(this.separator);

			var offsets = {};

			var encoded = getSemis(this.intro) + this.sources.map(function (source, sourceIndex) {
				return source.content.getMappings(options.hires, sourceIndex, offsets);
			}).join(encodingSeparator) + getSemis(this.outro);

			return new SourceMap({
				file: options.file ? options.file.split(/[\/\\]/).pop() : null,
				sources: this.sources.map(function (source) {
					return options.file ? getRelativePath(options.file, source.filename) : source.filename;
				}),
				sourcesContent: this.sources.map(function (source) {
					return options.includeContent ? source.content.original : null;
				}),
				names: [],
				mappings: encoded
			});
		};

		Bundle.prototype.getIndentString = function getIndentString() {
			var indentStringCounts = {};

			this.sources.forEach(function (source) {
				var indentStr = source.content.indentStr;

				if (indentStr === null) return;

				if (!indentStringCounts[indentStr]) indentStringCounts[indentStr] = 0;
				indentStringCounts[indentStr] += 1;
			});

			return Object.keys(indentStringCounts).sort(function (a, b) {
				return indentStringCounts[a] - indentStringCounts[b];
			})[0] || '\t';
		};

		Bundle.prototype.indent = function indent(indentStr) {
			if (!indentStr) {
				indentStr = this.getIndentString();
			}

			this.sources.forEach(function (source) {
				source.content.indent(indentStr, { exclude: source.indentExclusionRanges });
			});

			this.intro = this.intro.replace(/^[^\n]/gm, indentStr + '$&');
			this.outro = this.outro.replace(/^[^\n]/gm, indentStr + '$&');

			return this;
		};

		Bundle.prototype.prepend = function prepend(str) {
			this.intro = str + this.intro;
			return this;
		};

		Bundle.prototype.toString = function toString() {
			return this.intro + this.sources.map(stringify).join(this.separator) + this.outro;
		};

		Bundle.prototype.trimLines = function trimLines() {
			return this.trim('[\\r\\n]');
		};

		Bundle.prototype.trim = function trim(charType) {
			return this.trimStart(charType).trimEnd(charType);
		};

		Bundle.prototype.trimStart = function trimStart(charType) {
			var rx = new RegExp('^' + (charType || '\\s') + '+');
			this.intro = this.intro.replace(rx, '');

			if (!this.intro) {
				var source = undefined; // TODO put inside loop if safe
				var i = 0;

				do {
					source = this.sources[i];

					if (!source) {
						this.outro = this.outro.replace(rx, '');
						break;
					}

					source.content.trimStart();
					i += 1;
				} while (source.content.str === '');
			}

			return this;
		};

		Bundle.prototype.trimEnd = function trimEnd(charType) {
			var rx = new RegExp((charType || '\\s') + '+$');
			this.outro = this.outro.replace(rx, '');

			if (!this.outro) {
				var source = undefined;
				var i = this.sources.length - 1;

				do {
					source = this.sources[i];

					if (!source) {
						this.intro = this.intro.replace(rx, '');
						break;
					}

					source.content.trimEnd(charType);
					i -= 1;
				} while (source.content.str === '');
			}

			return this;
		};

		return Bundle;
	})();



	function stringify(source) {
		return source.content.toString();
	}

	function getSemis(str) {
		return new Array(str.split('\n').length).join(';');
	}
	//# sourceMappingURL=/www/magic-string/.gobble-build/01-babel/.cache/Bundle/index.js.map

	function guessIndent(code) {
		var lines = code.split('\n');

		var tabbed = lines.filter(function (line) {
			return /^\t+/.test(line);
		});
		var spaced = lines.filter(function (line) {
			return /^ {2,}/.test(line);
		});

		if (tabbed.length === 0 && spaced.length === 0) {
			return null;
		}

		// More lines tabbed than spaced? Assume tabs, and
		// default to tabs in the case of a tie (or nothing
		// to go on)
		if (tabbed.length >= spaced.length) {
			return '\t';
		}

		// Otherwise, we need to guess the multiple
		var min = spaced.reduce(function (previous, current) {
			var numSpaces = /^ +/.exec(current)[0].length;
			return Math.min(numSpaces, previous);
		}, Infinity);

		return new Array(min + 1).join(' ');
	}
	//# sourceMappingURL=/www/magic-string/.gobble-build/01-babel/.cache/MagicString/guessIndent.js.map

	var encode = vlq.encode;

	function encodeMappings(original, str, mappings, hires, sourcemapLocations, sourceIndex, offsets) {
		// store locations, for fast lookup
		var lineStart = 0;
		var locations = original.split('\n').map(function (line) {
			var start = lineStart;
			lineStart += line.length + 1; // +1 for the newline

			return start;
		});

		var inverseMappings = invert(str, mappings);

		var charOffset = 0;
		var lines = str.split('\n').map(function (line) {
			var segments = [];

			var char = undefined; // TODO put these inside loop, once we've determined it's safe to do so transpilation-wise
			var origin = undefined;
			var lastOrigin = undefined;
			var location = undefined;

			var i = undefined;

			var len = line.length;
			for (i = 0; i < len; i += 1) {
				char = i + charOffset;
				origin = inverseMappings[char];

				if (! ~origin) {
					if (! ~lastOrigin) {} else {
						segments.push({
							generatedCodeColumn: i,
							sourceIndex: sourceIndex,
							sourceCodeLine: 0,
							sourceCodeColumn: 0
						});
					}
				} else {
					if (!hires && origin === lastOrigin + 1 && !sourcemapLocations[origin]) {} else {
						location = getLocation(locations, origin);

						segments.push({
							generatedCodeColumn: i,
							sourceIndex: sourceIndex,
							sourceCodeLine: location.line,
							sourceCodeColumn: location.column
						});
					}
				}

				lastOrigin = origin;
			}

			charOffset += line.length + 1;
			return segments;
		});

		offsets = offsets || {};

		offsets.sourceIndex = offsets.sourceIndex || 0;
		offsets.sourceCodeLine = offsets.sourceCodeLine || 0;
		offsets.sourceCodeColumn = offsets.sourceCodeColumn || 0;

		var encoded = lines.map(function (segments) {
			var generatedCodeColumn = 0;

			return segments.map(function (segment) {
				var arr = [segment.generatedCodeColumn - generatedCodeColumn, segment.sourceIndex - offsets.sourceIndex, segment.sourceCodeLine - offsets.sourceCodeLine, segment.sourceCodeColumn - offsets.sourceCodeColumn];

				generatedCodeColumn = segment.generatedCodeColumn;
				offsets.sourceIndex = segment.sourceIndex;
				offsets.sourceCodeLine = segment.sourceCodeLine;
				offsets.sourceCodeColumn = segment.sourceCodeColumn;

				return encode(arr);
			}).join(',');
		}).join(';');

		return encoded;
	}

	function invert(str, mappings) {
		var inverted = new Uint32Array(str.length),
		    i;

		// initialise everything to -1
		i = str.length;
		while (i--) {
			inverted[i] = -1;
		}

		// then apply the actual mappings
		i = mappings.length;
		while (i--) {
			if (~mappings[i]) {
				inverted[mappings[i]] = i;
			}
		}

		return inverted;
	}

	function getLocation(locations, char) {
		var i;

		i = locations.length;
		while (i--) {
			if (locations[i] <= char) {
				return {
					line: i,
					column: char - locations[i]
				};
			}
		}

		throw new Error('Character out of bounds');
	}

	// do nothing

	// do nothing
	//# sourceMappingURL=/www/magic-string/.gobble-build/01-babel/.cache/MagicString/encodeMappings.js.map

	function MagicString___classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

	var warned = false;

	var MagicString = (function () {
		function MagicString(string) {
			var options = arguments[1] === undefined ? {} : arguments[1];

			MagicString___classCallCheck(this, MagicString);

			this.original = this.str = string;
			this.mappings = initMappings(string.length);

			this.filename = options.filename;
			this.indentExclusionRanges = options.indentExclusionRanges;

			this.sourcemapLocations = {};

			this.indentStr = guessIndent(string);
		}

		MagicString.prototype.addSourcemapLocation = function addSourcemapLocation(char) {
			this.sourcemapLocations[char] = true;
		};

		MagicString.prototype.append = function append(content) {
			if (typeof content !== 'string') {
				throw new TypeError('appended content must be a string');
			}

			this.str += content;
			return this;
		};

		MagicString.prototype.clone = function clone() {
			var clone, i;

			clone = new MagicString(this.original, { filename: this.filename });
			clone.str = this.str;

			i = clone.mappings.length;
			while (i--) {
				clone.mappings[i] = this.mappings[i];
			}

			return clone;
		};

		MagicString.prototype.generateMap = function generateMap(options) {
			options = options || {};

			return new SourceMap({
				file: options.file ? options.file.split(/[\/\\]/).pop() : null,
				sources: [options.source ? getRelativePath(options.file || '', options.source) : null],
				sourcesContent: options.includeContent ? [this.original] : [null],
				names: [],
				mappings: this.getMappings(options.hires, 0)
			});
		};

		MagicString.prototype.getIndentString = function getIndentString() {
			return this.indentStr === null ? '\t' : this.indentStr;
		};

		MagicString.prototype.getMappings = function getMappings(hires, sourceIndex, offsets) {
			return encodeMappings(this.original, this.str, this.mappings, hires, this.sourcemapLocations, sourceIndex, offsets);
		};

		MagicString.prototype.indent = function indent(indentStr, options) {
			var self = this,
			    mappings = this.mappings,
			    reverseMappings = reverse(mappings, this.str.length),
			    pattern = /^[^\r\n]/gm,
			    match,
			    inserts = [],
			    adjustments,
			    exclusions,
			    lastEnd,
			    i;

			if (typeof indentStr === 'object') {
				options = indentStr;
				indentStr = undefined;
			}

			indentStr = indentStr !== undefined ? indentStr : this.indentStr || '\t';

			options = options || {};

			// Process exclusion ranges
			if (options.exclude) {
				exclusions = typeof options.exclude[0] === 'number' ? [options.exclude] : options.exclude;

				exclusions = exclusions.map(function (range) {
					var rangeStart, rangeEnd;

					rangeStart = self.locate(range[0]);
					rangeEnd = self.locate(range[1]);

					if (rangeStart === null || rangeEnd === null) {
						throw new Error('Cannot use indices of replaced characters as exclusion ranges');
					}

					return [rangeStart, rangeEnd];
				});

				exclusions.sort(function (a, b) {
					return a[0] - b[0];
				});

				// check for overlaps
				lastEnd = -1;
				exclusions.forEach(function (range) {
					if (range[0] < lastEnd) {
						throw new Error('Exclusion ranges cannot overlap');
					}

					lastEnd = range[1];
				});
			}

			if (!exclusions) {
				while (match = pattern.exec(this.str)) {
					inserts.push(match.index);
				}

				this.str = this.str.replace(pattern, indentStr + '$&');
			} else {
				while (match = pattern.exec(this.str)) {
					if (!isExcluded(match.index - 1)) {
						inserts.push(match.index);
					}
				}

				this.str = this.str.replace(pattern, function (match, index) {
					return isExcluded(index - 1) ? match : indentStr + match;
				});
			}

			adjustments = inserts.map(function (index) {
				var origin;

				do {
					origin = reverseMappings[index++];
				} while (! ~origin && index < self.str.length);

				return origin;
			});

			i = adjustments.length;
			lastEnd = this.mappings.length;
			while (i--) {
				adjust(self.mappings, adjustments[i], lastEnd, (i + 1) * indentStr.length);
				lastEnd = adjustments[i];
			}

			return this;

			function isExcluded(index) {
				var i = exclusions.length,
				    range;

				while (i--) {
					range = exclusions[i];

					if (range[1] < index) {
						return false;
					}

					if (range[0] <= index) {
						return true;
					}
				}
			}
		};

		MagicString.prototype.insert = function insert(index, content) {
			if (typeof content !== 'string') {
				throw new TypeError('inserted content must be a string');
			}

			if (index === this.original.length) {
				this.append(content);
			} else {
				var mapped = this.locate(index);

				if (mapped === null) {
					throw new Error('Cannot insert at replaced character index: ' + index);
				}

				this.str = this.str.substr(0, mapped) + content + this.str.substr(mapped);
				adjust(this.mappings, index, this.mappings.length, content.length);
			}

			return this;
		};

		// get current location of character in original string

		MagicString.prototype.locate = function locate(character) {
			var loc;

			if (character < 0 || character > this.mappings.length) {
				throw new Error('Character is out of bounds');
			}

			loc = this.mappings[character];
			return ~loc ? loc : null;
		};

		MagicString.prototype.locateOrigin = function locateOrigin(character) {
			var i;

			if (character < 0 || character >= this.str.length) {
				throw new Error('Character is out of bounds');
			}

			i = this.mappings.length;
			while (i--) {
				if (this.mappings[i] === character) {
					return i;
				}
			}

			return null;
		};

		MagicString.prototype.overwrite = function overwrite(start, end, content) {
			if (typeof content !== 'string') {
				throw new TypeError('replacement content must be a string');
			}

			var firstChar, lastChar, d;

			firstChar = this.locate(start);
			lastChar = this.locate(end - 1);

			if (firstChar === null || lastChar === null) {
				throw new Error('Cannot replace the same content twice');
			}

			if (firstChar > lastChar + 1) {
				throw new Error('BUG! First character mapped to a position after the last character: ' + '[' + start + ', ' + end + '] -> [' + firstChar + ', ' + (lastChar + 1) + ']');
			}

			this.str = this.str.substr(0, firstChar) + content + this.str.substring(lastChar + 1);

			d = content.length - (lastChar + 1 - firstChar);

			blank(this.mappings, start, end);
			adjust(this.mappings, end, this.mappings.length, d);
			return this;
		};

		MagicString.prototype.prepend = function prepend(content) {
			this.str = content + this.str;
			adjust(this.mappings, 0, this.mappings.length, content.length);
			return this;
		};

		MagicString.prototype.remove = function remove(start, end) {
			var loc, d, i, currentStart, currentEnd;

			if (start < 0 || end > this.mappings.length) {
				throw new Error('Character is out of bounds');
			}

			d = 0;
			currentStart = -1;
			currentEnd = -1;
			for (i = start; i < end; i += 1) {
				loc = this.mappings[i];

				if (loc !== -1) {
					if (! ~currentStart) {
						currentStart = loc;
					}

					currentEnd = loc + 1;

					this.mappings[i] = -1;
					d += 1;
				}
			}

			this.str = this.str.slice(0, currentStart) + this.str.slice(currentEnd);

			adjust(this.mappings, end, this.mappings.length, -d);
			return this;
		};

		MagicString.prototype.replace = function replace(start, end, content) {
			if (!warned) {
				console.warn('magicString.replace(...) is deprecated. Use magicString.overwrite(...) instead');
				warned = true;
			}

			return this.overwrite(start, end, content);
		};

		MagicString.prototype.slice = function slice(start, end) {
			var firstChar, lastChar;

			firstChar = this.locate(start);
			lastChar = this.locate(end - 1) + 1;

			if (firstChar === null || lastChar === null) {
				throw new Error('Cannot use replaced characters as slice anchors');
			}

			return this.str.slice(firstChar, lastChar);
		};

		MagicString.prototype.snip = function snip(start, end) {
			var clone = this.clone();
			clone.remove(0, start);
			clone.remove(end, clone.original.length);

			return clone;
		};

		MagicString.prototype.toString = function toString() {
			return this.str;
		};

		MagicString.prototype.trimLines = function trimLines() {
			return this.trim('[\\r\\n]');
		};

		MagicString.prototype.trim = function trim(charType) {
			return this.trimStart(charType).trimEnd(charType);
		};

		MagicString.prototype.trimEnd = function trimEnd(charType) {
			var self = this;
			var rx = new RegExp((charType || '\\s') + '+$');

			this.str = this.str.replace(rx, function (trailing, index, str) {
				var strLength = str.length,
				    length = trailing.length,
				    i,
				    chars = [];

				i = strLength;
				while (i-- > strLength - length) {
					chars.push(self.locateOrigin(i));
				}

				i = chars.length;
				while (i--) {
					if (chars[i] !== null) {
						self.mappings[chars[i]] = -1;
					}
				}

				return '';
			});

			return this;
		};

		MagicString.prototype.trimStart = function trimStart(charType) {
			var self = this;
			var rx = new RegExp('^' + (charType || '\\s') + '+');

			this.str = this.str.replace(rx, function (leading) {
				var length = leading.length,
				    i,
				    chars = [],
				    adjustmentStart = 0;

				i = length;
				while (i--) {
					chars.push(self.locateOrigin(i));
				}

				i = chars.length;
				while (i--) {
					if (chars[i] !== null) {
						self.mappings[chars[i]] = -1;
						adjustmentStart += 1;
					}
				}

				adjust(self.mappings, adjustmentStart, self.mappings.length, -length);

				return '';
			});

			return this;
		};

		return MagicString;
	})();

	MagicString.Bundle = Bundle;

	function adjust(mappings, start, end, d) {
		var i = end;

		if (!d) return; // replacement is same length as replaced string

		while (i-- > start) {
			if (~mappings[i]) {
				mappings[i] += d;
			}
		}
	}

	function initMappings(i) {
		var mappings = new Uint32Array(i);

		while (i--) {
			mappings[i] = i;
		}

		return mappings;
	}

	function blank(mappings, start, i) {
		while (i-- > start) {
			mappings[i] = -1;
		}
	}

	function reverse(mappings, i) {
		var result, location;

		result = new Uint32Array(i);

		while (i--) {
			result[i] = -1;
		}

		i = mappings.length;
		while (i--) {
			location = mappings[i];

			if (~location) {
				result[location] = i;
			}
		}

		return result;
	}


	
//# sourceMappingURL=magic-string.js.map
