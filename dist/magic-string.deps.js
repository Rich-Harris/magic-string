(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	global.MagicString = factory()
}(this, function () { 'use strict';

	var _btoa;

	if ( typeof window !== 'undefined' && typeof window.btoa === 'function' ) {
		_btoa = window.btoa;
	} else if ( typeof Buffer === 'function' ) {
		_btoa = function ( str ) {
			return new Buffer( str ).toString( 'base64' );
		};
	} else {
		throw new Error( 'Unsupported environment: `window.btoa` or `Buffer` should be supported.' );
	}

	var btoa = _btoa;

	var SourceMap = function ( properties ) {
		this.version = 3;

		this.file           = properties.file;
		this.sources        = properties.sources;
		this.sourcesContent = properties.sourcesContent;
		this.names          = properties.names;
		this.mappings       = properties.mappings;
	};

	SourceMap.prototype = {
		toString: function () {
			return JSON.stringify( this );
		},

		toUrl: function () {
			return 'data:application/json;charset=utf-8;base64,' + btoa( this.toString() );
		}
	};

	var _SourceMap = SourceMap;

	function getRelativePath ( from, to ) {
		var fromParts, toParts, i;

		fromParts = from.split( /[\/\\]/ );
		toParts = to.split( /[\/\\]/ );

		fromParts.pop(); // get dirname

		while ( fromParts[0] === toParts[0] ) {
			fromParts.shift();
			toParts.shift();
		}

		if ( fromParts.length ) {
			i = fromParts.length;
			while ( i-- ) fromParts[i] = '..';
		}

		return fromParts.concat( toParts ).join( '/' );
	}

	var Bundle = function ( options ) {
		options = options || {};

		this.intro = options.intro || '';
		this.outro = options.outro || '';
		this.separator = 'separator' in options ? options.separator : '\n';

		this.sources = [];
	};

	Bundle.prototype = {
		addSource: function ( source ) {
			if ( typeof source !== 'object' || !source.content ) {
				throw new Error( 'bundle.addSource() takes an object with a `content` property, which should be an instance of MagicString, and an optional `filename`' );
			}

			this.sources.push( source );
			return this;
		},

		append: function ( str ) {
			this.outro += str;
			return this;
		},

		clone: function () {
			var bundle = new Bundle({
				intro: this.intro,
				outro: this.outro,
				separator: this.separator
			});

			this.sources.forEach( function ( source ) {
				bundle.addSource({
					filename: source.filename,
					content: source.content.clone()
				});
			});

			return bundle;
		},

		generateMap: function ( options ) {
			var offsets = {}, encoded, encodingSeparator;

			encodingSeparator = getSemis( this.separator );

			encoded = (
				getSemis( this.intro ) +
				this.sources.map( function ( source, sourceIndex) {
					return source.content.getMappings( options.hires, sourceIndex, offsets );
				}).join( encodingSeparator ) +
				getSemis( this.outro )
			);

			return new _SourceMap({
				file: ( options.file ? options.file.split( /[\/\\]/ ).pop() : null ),
				sources: this.sources.map( function ( source ) {
					return options.file ? getRelativePath( options.file, source.filename ) : source.filename;
				}),
				sourcesContent: this.sources.map( function ( source ) {
					return options.includeContent ? source.content.original : null;
				}),
				names: [],
				mappings: encoded
			});
		},

		getIndentString: function () {
			var indentStringCounts = {};

			this.sources.forEach( function ( source ) {
				var indentStr = source.content.indentStr;

				if ( indentStr === null ) return;

				if ( !indentStringCounts[ indentStr ] ) indentStringCounts[ indentStr ] = 0;
				indentStringCounts[ indentStr ] += 1;
			});

			return ( Object.keys( indentStringCounts ).sort( function ( a, b ) {
				return indentStringCounts[a] - indentStringCounts[b];
			})[0] ) || '\t';
		},

		indent: function ( indentStr ) {
			if ( !indentStr ) {
				indentStr = this.getIndentString();
			}

			this.sources.forEach( function ( source ) {
				source.content.indent( indentStr, { exclude: source.indentExclusionRanges });
			});

			this.intro = this.intro.replace( /^[^\n]/gm, indentStr + '$&' );
			this.outro = this.outro.replace( /^[^\n]/gm, indentStr + '$&' );

			return this;
		},

		prepend: function ( str ) {
			this.intro = str + this.intro;
			return this;
		},

		toString: function () {
			return this.intro + this.sources.map( stringify ).join( this.separator ) + this.outro;
		},

		trimLines: function () {
			return this.trim('[\\r\\n]');
		},

		trim: function (charType) {
			return this.trimStart(charType).trimEnd(charType);
		},

		trimStart: function (charType) {
			var rx = new RegExp('^' + (charType || '\\s') + '+');
			this.intro = this.intro.replace( rx, '' );

			if ( !this.intro ) {
				var source;
				var i = 0;
				do {
					source = this.sources[i];

					if ( !source ) {
						this.outro = this.outro.replace( rx, '' );
						break;
					}

					source.content.trimStart();
					i += 1;
				} while ( source.content.str === '' );
			}

			return this;
		},

		trimEnd: function(charType) {
			var rx = new RegExp((charType || '\\s') + '+$');
			this.outro = this.outro.replace( rx, '' );

			if ( !this.outro ) {
				var source;
				var i = this.sources.length - 1;
				do {
					source = this.sources[i];

					if ( !source ) {
						this.intro = this.intro.replace( rx, '' );
						break;
					}

					source.content.trimEnd(charType);
					i -= 1;
				} while ( source.content.str === '' );
			}

			return this;
		}
	};

	var _Bundle = Bundle;

	function stringify ( source ) {
		return source.content.toString();
	}

	function getSemis ( str ) {
		return new Array( str.split( '\n' ).length ).join( ';' );
	}

	function guessIndent ( code ) {
		var lines, tabbed, spaced, min;

		lines = code.split( '\n' );

		tabbed = lines.filter( function ( line ) {
			return /^\t+/.test( line );
		});

		spaced = lines.filter( function ( line ) {
			return /^ {2,}/.test( line );
		});

		if ( tabbed.length === 0 && spaced.length === 0 ) {
			return null;
		}

		// More lines tabbed than spaced? Assume tabs, and
		// default to tabs in the case of a tie (or nothing
		// to go on)
		if ( tabbed.length >= spaced.length ) {
			return '\t';
		}

		// Otherwise, we need to guess the multiple
		min = spaced.reduce( function ( previous, current ) {
			var numSpaces = /^ +/.exec( current )[0].length;
			return Math.min( numSpaces, previous );
		}, Infinity );

		return new Array( min + 1 ).join( ' ' );
	}

	var charToInteger = {};
	var integerToChar = {};

	'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='.split( '' ).forEach( function ( char, i ) {
		charToInteger[ char ] = i;
		integerToChar[ i ] = char;
	});

	function decode ( string ) {
		var result = [],
			len = string.length,
			i,
			hasContinuationBit,
			shift = 0,
			value = 0,
			integer,
			shouldNegate;

		for ( i = 0; i < len; i += 1 ) {
			integer = charToInteger[ string[i] ];

			if ( integer === undefined ) {
				throw new Error( 'Invalid character (' + string[i] + ')' );
			}

			hasContinuationBit = integer & 32;

			integer &= 31;
			value += integer << shift;

			if ( hasContinuationBit ) {
				shift += 5;
			} else {
				shouldNegate = value & 1;
				value >>= 1;

				result.push( shouldNegate ? -value : value );

				// reset
				value = shift = 0;
			}
		}

		return result;
	}

	function encode ( value ) {
		var result;

		if ( typeof value === 'number' ) {
			result = encodeInteger( value );
		} else if ( Array.isArray( value ) ) {
			result = '';
			value.forEach( function ( num ) {
				result += encodeInteger( num );
			});
		} else {
			throw new Error( 'vlq.encode accepts an integer or an array of integers' );
		}

		return result;
	}

	function encodeInteger ( num ) {
		var result = '', clamped;

		if ( num < 0 ) {
			num = ( -num << 1 ) | 1;
		} else {
			num <<= 1;
		}

		do {
			clamped = num & 31;
			num >>= 5;

			if ( num > 0 ) {
				clamped |= 32;
			}

			result += integerToChar[ clamped ];
		} while ( num > 0 );

		return result;
	}

	var utils_encode = encode;

	function encodeMappings ( original, str, mappings, hires, sourcemapLocations, sourceIndex, offsets ) {
		var lineStart,
			locations,
			lines,
			encoded,
			inverseMappings,
			charOffset = 0,
			firstSegment = true;

		// store locations, for fast lookup
		lineStart = 0;
		locations = original.split( '\n' ).map( function ( line ) {
			var start = lineStart;
			lineStart += line.length + 1; // +1 for the newline

			return start;
		});

		inverseMappings = invert( str, mappings );

		lines = str.split( '\n' ).map( function ( line ) {
			var segments, len, char, origin, lastOrigin, i, location;

			segments = [];

			len = line.length;
			for ( i = 0; i < len; i += 1 ) {
				char = i + charOffset;
				origin = inverseMappings[ char ];

				if ( !~origin ) {
					if ( !~lastOrigin ) {
						// do nothing
					} else {
						segments.push({
							generatedCodeColumn: i,
							sourceIndex: sourceIndex,
							sourceCodeLine: 0,
							sourceCodeColumn: 0
						});
					}
				}

				else {
					if ( !hires && ( origin === lastOrigin + 1 ) && !sourcemapLocations[ origin ] ) {
						// do nothing
					} else {
						location = getLocation( locations, origin );

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

		encoded = lines.map( function ( segments ) {
			var generatedCodeColumn = 0;

			return segments.map( function ( segment ) {
				var arr = [
					segment.generatedCodeColumn - generatedCodeColumn,
					segment.sourceIndex - offsets.sourceIndex,
					segment.sourceCodeLine - offsets.sourceCodeLine,
					segment.sourceCodeColumn - offsets.sourceCodeColumn
				];

				generatedCodeColumn = segment.generatedCodeColumn;
				offsets.sourceIndex = segment.sourceIndex;
				offsets.sourceCodeLine = segment.sourceCodeLine;
				offsets.sourceCodeColumn = segment.sourceCodeColumn;

				firstSegment = false;

				return utils_encode( arr );
			}).join( ',' );
		}).join( ';' );

		return encoded;
	}


	function invert ( str, mappings ) {
		var inverted = new Uint32Array( str.length ), i;

		// initialise everything to -1
		i = str.length;
		while ( i-- ) {
			inverted[i] = -1;
		}

		// then apply the actual mappings
		i = mappings.length;
		while ( i-- ) {
			if ( ~mappings[i] ) {
				inverted[ mappings[i] ] = i;
			}
		}

		return inverted;
	}

	function getLocation ( locations, char ) {
		var i;

		i = locations.length;
		while ( i-- ) {
			if ( locations[i] <= char ) {
				return {
					line: i,
					column: char - locations[i]
				};
			}
		}

		throw new Error( 'Character out of bounds' );
	}

	var MagicString = function ( string ) {
		this.original = this.str = string;
		this.mappings = initMappings( string.length );

		this.sourcemapLocations = {};

		this.indentStr = guessIndent( string );
	};

	MagicString.prototype = {
		addSourcemapLocation: function ( char ) {
			this.sourcemapLocations[ char ] = true;
		},

		append: function ( content ) {
			if ( typeof content !== 'string' ) {
				throw new TypeError( 'appended content must be a string' );
			}

			this.str += content;
			return this;
		},

		clone: function () {
			var clone, i;

			clone = new MagicString( this.original );
			clone.str = this.str;

			i = clone.mappings.length;
			while ( i-- ) {
				clone.mappings[i] = this.mappings[i];
			}

			return clone;
		},

		generateMap: function ( options ) {
			options = options || {};

			return new _SourceMap({
				file: ( options.file ? options.file.split( /[\/\\]/ ).pop() : null ),
				sources: [ options.source ? getRelativePath( options.file || '', options.source ) : null ],
				sourcesContent: options.includeContent ? [ this.original ] : [ null ],
				names: [],
				mappings: this.getMappings( options.hires, 0 )
			});
		},

		getIndentString: function () {
			return this.indentStr === null ? '\t' : this.indentStr;
		},

		getMappings: function ( hires, sourceIndex, offsets ) {
			return encodeMappings( this.original, this.str, this.mappings, hires, this.sourcemapLocations, sourceIndex, offsets );
		},

		indent: function ( indentStr, options ) {
			var self = this,
				mappings = this.mappings,
				reverseMappings = reverse( mappings, this.str.length ),
				pattern = /^[^\r\n]/gm,
				match,
				inserts = [],
				adjustments,
				exclusions,
				lastEnd,
				i;

			if ( typeof indentStr === 'object' ) {
				options = indentStr;
				indentStr = undefined;
			}

			indentStr = indentStr !== undefined ? indentStr : ( this.indentStr || '\t' );

			options = options || {};

			// Process exclusion ranges
			if ( options.exclude ) {
				exclusions = typeof options.exclude[0] === 'number' ? [ options.exclude ] : options.exclude;

				exclusions = exclusions.map( function ( range ) {
					var rangeStart, rangeEnd;

					rangeStart = self.locate( range[0] );
					rangeEnd = self.locate( range[1] );

					if ( rangeStart === null || rangeEnd === null ) {
						throw new Error( 'Cannot use indices of replaced characters as exclusion ranges' );
					}

					return [ rangeStart, rangeEnd ];
				});

				exclusions.sort( function ( a, b ) {
					return a[0] - b[0];
				});

				// check for overlaps
				lastEnd = -1;
				exclusions.forEach( function ( range ) {
					if ( range[0] < lastEnd ) {
						throw new Error( 'Exclusion ranges cannot overlap' );
					}

					lastEnd = range[1];
				});
			}

			if ( !exclusions ) {
				while ( match = pattern.exec( this.str ) ) {
					inserts.push( match.index );
				}

				this.str = this.str.replace( pattern, indentStr + '$&' );
			} else {
				while ( match = pattern.exec( this.str ) ) {
					if ( !isExcluded( match.index - 1 ) ) {
						inserts.push( match.index );
					}
				}

				this.str = this.str.replace( pattern, function ( match, index ) {
					return isExcluded( index - 1 ) ? match : indentStr + match;
				});
			}

			adjustments = inserts.map( function ( index ) {
				var origin;

				do {
					origin = reverseMappings[ index++ ];
				} while ( !~origin && index < self.str.length );

				return origin;
			});

			i = adjustments.length;
			lastEnd = this.mappings.length;
			while ( i-- ) {
				adjust( self.mappings, adjustments[i], lastEnd, ( ( i + 1 ) * indentStr.length ) );
				lastEnd = adjustments[i];
			}

			return this;

			function isExcluded ( index ) {
				var i = exclusions.length, range;

				while ( i-- ) {
					range = exclusions[i];

					if ( range[1] < index ) {
						return false;
					}

					if ( range[0] <= index ) {
						return true;
					}
				}
			}
		},

		insert: function ( index, content ) {
			if ( typeof content !== 'string' ) {
				throw new TypeError( 'inserted content must be a string' );
			}

			if ( index === this.original.length ) {
				this.append( content );
			} else {
				var mapped = this.locate(index);

				if ( mapped === null ) {
					throw new Error( 'Cannot insert at replaced character index: ' + index );
				}

				this.str = this.str.substr( 0, mapped ) + content + this.str.substr( mapped );
				adjust( this.mappings, index, this.mappings.length, content.length );
			}

			return this;
		},

		// get current location of character in original string
		locate: function ( character ) {
			var loc;

			if ( character < 0 || character > this.mappings.length ) {
				throw new Error( 'Character is out of bounds' );
			}

			loc = this.mappings[ character ];
			return ~loc ? loc : null;
		},

		locateOrigin: function ( character ) {
			var i;

			if ( character < 0 || character >= this.str.length ) {
				throw new Error( 'Character is out of bounds' );
			}

			i = this.mappings.length;
			while ( i-- ) {
				if ( this.mappings[i] === character ) {
					return i;
				}
			}

			return null;
		},

		prepend: function ( content ) {
			this.str = content + this.str;
			adjust( this.mappings, 0, this.mappings.length, content.length );
			return this;
		},

		remove: function ( start, end ) {
			var loc, d, i, currentStart, currentEnd;

			if ( start < 0 || end > this.mappings.length ) {
				throw new Error( 'Character is out of bounds' );
			}

			d = 0;
			currentStart = -1;
			currentEnd = -1;
			for ( i = start; i < end; i += 1 ) {
				loc = this.mappings[i];

				if ( loc !== -1 ) {
					if ( !~currentStart ) {
						currentStart = loc;
					}

					currentEnd = loc + 1;

					this.mappings[i] = -1;
					d += 1;
				}
			}

			this.str = this.str.slice( 0, currentStart ) + this.str.slice( currentEnd );

			adjust( this.mappings, end, this.mappings.length, -d );
			return this;
		},

		replace: function ( start, end, content ) {
			if ( typeof content !== 'string' ) {
				throw new TypeError( 'replacement content must be a string' );
			}

			var firstChar, lastChar, d;

			firstChar = this.locate( start );
			lastChar = this.locate( end - 1 );

			if ( firstChar === null || lastChar === null ) {
				throw new Error( 'Cannot replace the same content twice' );
			}

			if ( firstChar > lastChar + 1 ) {
				throw new Error(
					'BUG! First character mapped to a position after the last character: ' +
					'[' + start + ', ' + end + '] -> [' + firstChar + ', ' + ( lastChar + 1 ) + ']'
				);
			}

			this.str = this.str.substr( 0, firstChar ) + content + this.str.substring( lastChar + 1 );

			d = content.length - ( lastChar + 1 - firstChar );

			blank( this.mappings, start, end );
			adjust( this.mappings, end, this.mappings.length, d );
			return this;
		},

		slice: function ( start, end ) {
			var firstChar, lastChar;

			firstChar = this.locate( start );
			lastChar = this.locate( end - 1 ) + 1;

			if ( firstChar === null || lastChar === null ) {
				throw new Error( 'Cannot use replaced characters as slice anchors' );
			}

			return this.str.slice( firstChar, lastChar );
		},

		toString: function () {
			return this.str;
		},

		trimLines: function() {
			return this.trim('[\\r\\n]');
		},

		trim: function (charType) {
			return this.trimStart(charType).trimEnd(charType);
		},

		trimEnd: function (charType) {
			var self = this;
			var rx = new RegExp((charType || '\\s') + '+$');

			this.str = this.str.replace( rx, function ( trailing, index, str ) {
				var strLength = str.length,
					length = trailing.length,
					i,
					chars = [];

				i = strLength;
				while ( i-- > strLength - length ) {
					chars.push( self.locateOrigin( i ) );
				}

				i = chars.length;
				while ( i-- ) {
					if ( chars[i] !== null ) {
						self.mappings[ chars[i] ] = -1;
					}
				}

				return '';
			});

			return this;
		},

		trimStart: function (charType) {
			var self = this;
			var rx = new RegExp('^' + (charType || '\\s') + '+');

			this.str = this.str.replace( rx, function ( leading ) {
				var length = leading.length, i, chars = [], adjustmentStart = 0;

				i = length;
				while ( i-- ) {
					chars.push( self.locateOrigin( i ) );
				}

				i = chars.length;
				while ( i-- ) {
					if ( chars[i] !== null ) {
						self.mappings[ chars[i] ] = -1;
						adjustmentStart += 1;
					}
				}

				adjust( self.mappings, adjustmentStart, self.mappings.length, -length );

				return '';
			});

			return this;
		}
	};

	MagicString.Bundle = _Bundle;

	function adjust ( mappings, start, end, d ) {
		var i = end;

		if ( !d ) return; // replacement is same length as replaced string

		while ( i-- > start ) {
			if ( ~mappings[i] ) {
				mappings[i] += d;
			}
		}
	}

	function initMappings ( i ) {
		var mappings = new Uint32Array( i );

		while ( i-- ) {
			mappings[i] = i;
		}

		return mappings;
	}

	function blank ( mappings, start, i ) {
		while ( i-- > start ) {
			mappings[i] = -1;
		}
	}

	function reverse ( mappings, i ) {
		var result, location;

		result = new Uint32Array( i );

		while ( i-- ) {
			result[i] = -1;
		}

		i = mappings.length;
		while ( i-- ) {
			location = mappings[i];

			if ( ~location ) {
				result[ location ] = i;
			}
		}

		return result;
	}

	var MagicString_index = MagicString;

	return MagicString_index;

}));