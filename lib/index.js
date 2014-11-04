var guessIndent = require( './guessIndent' ),
	encodeMappings = require( './encodeMappings' );

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

	indent: function ( indentStr ) {
		var self = this,
			mappings = this.mappings,
			pattern = /\n/g,
			match,
			inserts = [ 0 ],
			i;

		indentStr = indentStr !== undefined ? indentStr : this.indentStr;

		while ( match = pattern.exec( this.str ) ) {
			inserts.push( match.index + 1 );
		}

		this.str = indentStr + this.str.replace( pattern, '\n' + indentStr );

		inserts.forEach( function ( index, i ) {
			do {
				origin = self.locateOrigin( index++ );
			} while ( origin == null && index < self.str.length );

			adjust( mappings, origin, indentStr.length );
		});

		return this;
	},

	// get current location of character in original string
	locate: function ( character ) {
		var loc;

		if ( character < 0 || character >= this.mappings.length ) {
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

		d = content.length - ( end - start );

		blank( this.mappings, start, end );
		adjust( this.mappings, end, d );
		return this;
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

module.exports = MagicString;

