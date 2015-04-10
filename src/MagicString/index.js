import Bundle from '../Bundle';
import SourceMap from '../SourceMap';
import guessIndent from './guessIndent';
import encodeMappings from './encodeMappings';
import getRelativePath from '../utils/getRelativePath';

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

		return new SourceMap({
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

MagicString.Bundle = Bundle;

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

export default MagicString;
