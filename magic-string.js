(function (global, factory) {

	'use strict';

	if (typeof define === 'function' && define.amd) {
		// export as AMD
		define(['vlq'], factory);
	} else if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
		// node/browserify
		module.exports = factory(require('vlq'));
	} else {
		// browser global
		global.MagicString = factory(global.vlq);
	}

}(typeof window !== 'undefined' ? window : this, function (vlq__default) {

	'use strict';

	function guess_indent__guessIndent ( code ) {
		var lines, tabbed, spaced, min;
	
		lines = code.split( '\n' );
	
		tabbed = lines.filter( function ( line ) {
			return /^\t+/.test( line );
		});
	
		spaced = lines.filter( function ( line ) {
			return /^ +/.test( line );
		});
	
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
	var guess_indent__default = guess_indent__guessIndent;

	function encode_mappings__encodeMappings ( original, str, mappings, hires ) {
		var lineStart,
			locations,
			lines,
			encoded,
			inverseMappings,
			charOffset = 0,
			sourceCodeLine,
			sourceCodeColumn;
	
		// store locations, for fast lookup
		lineStart = 0;
		locations = original.split( '\n' ).map( function ( line ) {
			var start = lineStart;
			lineStart += line.length + 1; // +1 for the newline
	
			return start;
		});
	
		inverseMappings = encode_mappings__invert( str, mappings );
	
		lines = str.split( '\n' ).map( function ( line, lineIndex ) {
			var segments, segment, len, char, origin, lastOrigin, i, sourceCodeLine, sourceCodeColumn, location;
	
			segments = [];
	
			len = line.length;
			for ( i = 0; i < len; i += 1 ) {
				char = i + charOffset;
				origin = inverseMappings[ char ];
	
				if ( origin === -1 ) {
					if ( lastOrigin === -1 ) {
						// do nothing
					} else {
						segments.push({
							generatedCodeColumn: i,
							sourceCodeLine: 0,
							sourceCodeColumn: 0
						});
					}
				}
	
				else {
					if ( !hires && ( origin === lastOrigin + 1 ) ) {
						// do nothing
					} else {
						location = encode_mappings__getLocation( locations, origin );
	
						segments.push({
							generatedCodeColumn: i,
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
	
		sourceCodeLine = 0;
		sourceCodeColumn = 0;
	
		encoded = lines.map( function ( segments ) {
			var generatedCodeColumn = 0;
	
			return segments.map( function ( segment ) {
				var arr = [
					segment.generatedCodeColumn - generatedCodeColumn,
					0,
					segment.sourceCodeLine - sourceCodeLine,
					segment.sourceCodeColumn - sourceCodeColumn
				];
	
				generatedCodeColumn = segment.generatedCodeColumn;
				sourceCodeLine = segment.sourceCodeLine;
				sourceCodeColumn = segment.sourceCodeColumn;
	
				return vlq__default.encode( arr );
			}).join( ',' );
		}).join( ';' );
	
		return encoded;
	}
	var encode_mappings__default = encode_mappings__encodeMappings;
	
	
	function encode_mappings__invert ( str, mappings ) {
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
	
	function encode_mappings__getLocation ( locations, char ) {
		var i, len = locations.length;
	
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

	var magic_string__MagicString = function ( string ) {
		this.original = this.str = string;
		this.mappings = magic_string__initMappings( string.length );
	
		this.indentStr = guess_indent__default( string );
	};
	
	magic_string__MagicString.prototype = {
		append: function ( content ) {
			this.str += content;
			return this;
		},
	
		clone: function () {
			var clone, i;
	
			clone = new magic_string__MagicString( this.original );
			clone.str = this.str;
	
			i = clone.mappings.length;
			while ( i-- ) {
				clone.mappings[i] = this.mappings[i];
			}
	
			return clone;
		},
	
		generateMap: function ( options ) {
			var map, encoded;
	
			options = options || {};
	
			encoded = encode_mappings__default( this.original, this.str, this.mappings, options.hires );
	
			map = {
				version: 3,
				file: options.file,
				sources: [ options.source ],
				sourcesContent: options.includeContent ? [ this.original ] : [],
				names: [],
				mappings: encoded
			};
	
			Object.defineProperty( map, 'toString', {
				enumerable: false,
				value: function () {
					return JSON.stringify( map );
				}
			});
	
			return map;
		},
	
		indent: function ( indentStr, options ) {
			var self = this,
				mappings = this.mappings,
				pattern = /\n/g,
				match,
				inserts = [ 0 ],
				i,
				exclusions,
				lastEnd;
	
			if ( typeof indentStr === 'object' ) {
				options = indentStr;
				indentStr = undefined;
			}
	
			indentStr = indentStr !== undefined ? indentStr : this.indentStr;
	
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
					inserts.push( match.index + 1 );
				}
	
				this.str = indentStr + this.str.replace( pattern, '\n' + indentStr );
			} else {
				while ( match = pattern.exec( this.str ) ) {
					if ( !isExcluded( match.index ) ) {
						inserts.push( match.index + 1 );
					}
				}
	
				this.str = indentStr + this.str.replace( pattern, function ( match, index ) {
					return isExcluded( index ) ? match : '\n' + indentStr;
				});
			}
	
			inserts.forEach( function ( index, i ) {
				var origin;
	
				do {
					origin = self.locateOrigin( index++ );
				} while ( origin == null && index < self.str.length );
	
				magic_string__adjust( mappings, origin, indentStr.length );
			});
	
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
			magic_string__adjust( this.mappings, 0, content.length );
			return this;
		},
	
		remove: function ( start, end ) {
			this.replace( start, end, '' );
			return this;
		},
	
		replace: function ( start, end, content ) {
			var i, len, firstChar, lastChar, d;
	
			firstChar = this.locate( start );
			lastChar = this.locate( end - 1 );
	
			if ( firstChar === null || lastChar === null ) {
				throw new Error( 'Cannot replace the same content twice' );
			}
	
			this.str = this.str.substr( 0, firstChar ) + content + this.str.substring( lastChar + 1 );
	
			d = content.length - ( lastChar + 1 - firstChar );
	
			magic_string__blank( this.mappings, start, end );
			magic_string__adjust( this.mappings, end, d );
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
	
		trim: function () {
			var self = this;
	
			this.str = this.str
				.replace( /^\s+/, function ( leading ) {
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
	
					magic_string__adjust( self.mappings, adjustmentStart, -length );
	
					return '';
				})
				.replace( /\s+$/, function ( trailing, index, str ) {
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
		}
	};
	
	function magic_string__adjust ( mappings, start, d ) {
		var i = mappings.length;
		while ( i-- > start ) {
			if ( ~mappings[i] ) {
				mappings[i] += d;
			}
		}
	}
	
	function magic_string__initMappings ( i ) {
		var mappings = new Uint32Array( i );
	
		while ( i-- ) {
			mappings[i] = i;
		}
	
		return mappings;
	}
	
	function magic_string__blank ( mappings, start, i ) {
		while ( i-- > start ) {
			mappings[i] = -1;
		}
	}
	
	var magic_string__default = magic_string__MagicString;

	return magic_string__default;

}));