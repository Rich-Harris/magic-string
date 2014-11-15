import guessIndent from './guess-indent';
import encodeMappings from './encode-mappings';

var MagicString = function ( string ) {
	this.original = this.str = string;
	this.mappings = initMappings( string.length );

	this.indentStr = guessIndent( string );
};

MagicString.prototype = {
	append: function ( content ) {
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
		var map, encoded;

		options = options || {};

		encoded = encodeMappings( this.original, this.str, this.mappings, options.hires );

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

			adjust( mappings, origin, indentStr.length );
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

	insert: function ( index, content ) {
		if ( index === 0 ) {
			this.prepend( content );
		} else if ( index === this.original.length ) {
			this.append( content );
		} else {
			this.replace( index, index, content );
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
		adjust( this.mappings, 0, content.length );
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

		blank( this.mappings, start, end );
		adjust( this.mappings, end, d );
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

				adjust( self.mappings, adjustmentStart, -length );

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

function adjust ( mappings, start, d ) {
	var i = mappings.length;
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

export default MagicString;
