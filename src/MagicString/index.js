import SourceMap from '../utils/SourceMap';
import guessIndent from './guessIndent';
import encodeMappings from './encodeMappings';
import getRelativePath from '../utils/getRelativePath';

let warned = false;

class MagicString {
	constructor ( string, options = {} ) {
		Object.defineProperties( this, {
			original:              { writable: true, value: string },
			str:                   { writable: true, value: string },
			mappings:              { writable: true, value: initMappings( string.length ) },
			filename:              { writable: true, value: options.filename },
			indentExclusionRanges: { writable: true, value: options.indentExclusionRanges },
			sourcemapLocations:    { writable: true, value: {} },
			nameLocations:         { writable: true, value: {} },
			indentStr:             { writable: true, value: guessIndent( string ) }
		});
	}

	addSourcemapLocation ( char ) {
		this.sourcemapLocations[ char ] = true;
	}

	append ( content ) {
		if ( typeof content !== 'string' ) {
			throw new TypeError( 'appended content must be a string' );
		}

		this.str += content;
		return this;
	}

	clone () {
		let clone = new MagicString( this.original, { filename: this.filename });
		clone.str = this.str;

		let i = clone.mappings.length;
		while ( i-- ) {
			clone.mappings[i] = this.mappings[i];
		}

		if ( this.indentExclusionRanges ) {
			clone.indentExclusionRanges = typeof this.indentExclusionRanges[0] === 'number' ?
				[ this.indentExclusionRanges[0], this.indentExclusionRanges[1] ] :
				this.indentExclusionRanges.map( range => [ range.start, range.end ] );
		}

		Object.keys( this.sourcemapLocations ).forEach( loc => {
			clone.sourcemapLocations[ loc ] = true;
		});

		return clone;
	}

	generateMap ( options ) {
		options = options || {};

		let names = [];
		Object.keys( this.nameLocations ).forEach( location => {
			const name = this.nameLocations[ location ];
			if ( !~names.indexOf( name ) ) names.push( name );
		});

		return new SourceMap({
			file: ( options.file ? options.file.split( /[\/\\]/ ).pop() : null ),
			sources: [ options.source ? getRelativePath( options.file || '', options.source ) : null ],
			sourcesContent: options.includeContent ? [ this.original ] : [ null ],
			names,
			mappings: this.getMappings( options.hires, 0, {}, names )
		});
	}

	getIndentString () {
		return this.indentStr === null ? '\t' : this.indentStr;
	}

	getMappings ( hires, sourceIndex, offsets, names ) {
		return encodeMappings( this.original, this.str, this.mappings, hires, this.sourcemapLocations, sourceIndex, offsets, names, this.nameLocations );
	}

	indent ( indentStr, options ) {
		const mappings = this.mappings;
		const reverseMappings = reverse( mappings, this.str.length );
		const pattern = /^[^\r\n]/gm;

		if ( typeof indentStr === 'object' ) {
			options = indentStr;
			indentStr = undefined;
		}

		indentStr = indentStr !== undefined ? indentStr : ( this.indentStr || '\t' );

		if ( indentStr === '' ) return this; // noop

		options = options || {};

		// Process exclusion ranges
		let exclusions;

		if ( options.exclude ) {
			exclusions = typeof options.exclude[0] === 'number' ? [ options.exclude ] : options.exclude;

			exclusions = exclusions.map( range => {
				const rangeStart = this.locate( range[0] );
				const rangeEnd = this.locate( range[1] );

				if ( rangeStart === null || rangeEnd === null ) {
					throw new Error( 'Cannot use indices of replaced characters as exclusion ranges' );
				}

				return [ rangeStart, rangeEnd ];
			});

			exclusions.sort( ( a, b ) => a[0] - b[0] );

			// check for overlaps
			lastEnd = -1;
			exclusions.forEach( range => {
				if ( range[0] < lastEnd ) {
					throw new Error( 'Exclusion ranges cannot overlap' );
				}

				lastEnd = range[1];
			});
		}

		const indentStart = options.indentStart !== false;
		let inserts = [];

		if ( !exclusions ) {
			this.str = this.str.replace( pattern, ( match, index ) => {
				if ( !indentStart && index === 0 ) {
					return match;
				}

				inserts.push( index );
				return indentStr + match;
			});
		} else {
			this.str = this.str.replace( pattern, ( match, index ) => {
				if ( ( !indentStart && index === 0 ) || isExcluded( index - 1 ) ) {
					return match;
				}

				inserts.push( index );
				return indentStr + match;
			});
		}

		const adjustments = inserts.map( index => {
			let origin;

			do {
				origin = reverseMappings[ index++ ];
			} while ( !~origin && index < this.str.length );

			return origin;
		});

		let i = adjustments.length;
		let lastEnd = this.mappings.length;
		while ( i-- ) {
			adjust( this.mappings, adjustments[i], lastEnd, ( ( i + 1 ) * indentStr.length ) );
			lastEnd = adjustments[i];
		}

		return this;

		function isExcluded ( index ) {
			let i = exclusions.length;
			let range;

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
	}

	insert ( index, content ) {
		if ( typeof content !== 'string' ) {
			throw new TypeError( 'inserted content must be a string' );
		}

		if ( index === this.original.length ) {
			this.append( content );
		} else {
			const mapped = this.locate( index );

			if ( mapped === null ) {
				throw new Error( 'Cannot insert at replaced character index: ' + index );
			}

			this.str = this.str.substr( 0, mapped ) + content + this.str.substr( mapped );
			adjust( this.mappings, index, this.mappings.length, content.length );
		}

		return this;
	}

	// get current location of character in original string
	locate ( character ) {
		if ( character < 0 || character > this.mappings.length ) {
			throw new Error( 'Character is out of bounds' );
		}

		const loc = this.mappings[ character ];
		return ~loc ? loc : null;
	}

	locateOrigin ( character ) {
		if ( character < 0 || character >= this.str.length ) {
			throw new Error( 'Character is out of bounds' );
		}

		let i = this.mappings.length;
		while ( i-- ) {
			if ( this.mappings[i] === character ) {
				return i;
			}
		}

		return null;
	}

	overwrite ( start, end, content, storeName ) {
		if ( typeof content !== 'string' ) {
			throw new TypeError( 'replacement content must be a string' );
		}

		const firstChar = this.locate( start );
		const lastChar = this.locate( end - 1 );

		if ( firstChar === null || lastChar === null ) {
			throw new Error( `Cannot overwrite the same content twice: '${this.original.slice(start, end).replace(/\n/g, '\\n')}'` );
		}

		if ( firstChar > lastChar + 1 ) {
			throw new Error(
				'BUG! First character mapped to a position after the last character: ' +
				'[' + start + ', ' + end + '] -> [' + firstChar + ', ' + ( lastChar + 1 ) + ']'
			);
		}

		if ( storeName ) {
			this.nameLocations[ start ] = this.original.slice( start, end );
		}

		this.str = this.str.substr( 0, firstChar ) + content + this.str.substring( lastChar + 1 );

		const d = content.length - ( lastChar + 1 - firstChar );

		blank( this.mappings, start, end );
		adjust( this.mappings, end, this.mappings.length, d );
		return this;
	}

	prepend ( content ) {
		this.str = content + this.str;
		adjust( this.mappings, 0, this.mappings.length, content.length );
		return this;
	}

	remove ( start, end ) {
		if ( start < 0 || end > this.mappings.length ) {
			throw new Error( 'Character is out of bounds' );
		}

		let currentStart = -1;
		let currentEnd = -1;
		for ( let i = start; i < end; i += 1 ) {
			const loc = this.mappings[i];

			if ( ~loc ) {
				if ( !~currentStart ) currentStart = loc;

				currentEnd = loc + 1;
				this.mappings[i] = -1;
			}
		}

		this.str = this.str.slice( 0, currentStart ) + this.str.slice( currentEnd );

		adjust( this.mappings, end, this.mappings.length, currentStart - currentEnd );
		return this;
	}

	replace ( start, end, content ) {
		if ( !warned ) {
			console.warn( 'magicString.replace(...) is deprecated. Use magicString.overwrite(...) instead' );
			warned = true;
		}

		return this.overwrite( start, end, content );
	}

	slice ( start, end = this.original.length ) {
		while ( start < 0 ) start += this.original.length;
		while ( end < 0 ) end += this.original.length;

		const firstChar = this.locate( start );
		const lastChar = this.locate( end - 1 );

		if ( firstChar === null || lastChar === null ) {
			throw new Error( 'Cannot use replaced characters as slice anchors' );
		}

		return this.str.slice( firstChar, lastChar + 1 );
	}

	snip ( start, end ) {
		const clone = this.clone();
		clone.remove( 0, start );
		clone.remove( end, clone.original.length );

		return clone;
	}

	toString () {
		return this.str;
	}

	trimLines () {
		return this.trim('[\\r\\n]');
	}

	trim (charType) {
		return this.trimStart(charType).trimEnd(charType);
	}

	trimEnd (charType) {
		const rx = new RegExp( ( charType || '\\s' ) + '+$' );

		this.str = this.str.replace( rx, ( trailing, index, str ) => {
			const strLength = str.length;
			const length = trailing.length;

			let chars = [];

			let i = strLength;
			while ( i-- > strLength - length ) {
				chars.push( this.locateOrigin( i ) );
			}

			i = chars.length;
			while ( i-- ) {
				if ( chars[i] !== null ) {
					this.mappings[ chars[i] ] = -1;
				}
			}

			return '';
		});

		return this;
	}

	trimStart (charType) {
		const rx = new RegExp( '^' + ( charType || '\\s' ) + '+' );

		this.str = this.str.replace( rx, leading => {
			const length = leading.length;

			let chars = [];
			let adjustmentStart = 0;

			let i = length;
			while ( i-- ) {
				chars.push( this.locateOrigin( i ) );
			}

			i = chars.length;
			while ( i-- ) {
				if ( chars[i] !== null ) {
					this.mappings[ chars[i] ] = -1;
					adjustmentStart += 1;
				}
			}

			adjust( this.mappings, adjustmentStart, this.mappings.length, -length );

			return '';
		});

		return this;
	}
}

function adjust ( mappings, start, end, d ) {
	if ( !d ) return; // replacement is same length as replaced string

	let i = end;
	while ( i-- > start ) {
		if ( ~mappings[i] ) {
			mappings[i] += d;
		}
	}
}

function initMappings ( i ) {
	let mappings = new Uint32Array( i );

	while ( i-- ) mappings[i] = i;
	return mappings;
}

function blank ( mappings, start, i ) {
	while ( i-- > start ) mappings[i] = -1;
}

function reverse ( mappings, i ) {
	let result = new Uint32Array( i );

	while ( i-- ) {
		result[i] = -1;
	}

	let location;
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
