import Patch from './Patch.js';
import SourceMap from './utils/SourceMap.js';
import guessIndent from './utils/guessIndent.js';
import encodeMappings from './utils/encodeMappings.js';
import getRelativePath from './utils/getRelativePath.js';
import isObject from './utils/isObject.js';

let warned = false;

export default function MagicString ( string, options = {} ) {
	Object.defineProperties( this, {
		original:              { writable: true, value: string },
		appended:              { writable: true, value: '' },
		prepended:             { writable: true, value: '' },
		patches:               { writable: true, value: [] },
		filename:              { writable: true, value: options.filename },
		indentExclusionRanges: { writable: true, value: options.indentExclusionRanges },
		sourcemapLocations:    { writable: true, value: {} },
		nameLocations:         { writable: true, value: {} },
		indentStr:             { writable: true, value: guessIndent( string ) }
	});
}

MagicString.prototype = {
	addSourcemapLocation ( char ) {
		this.sourcemapLocations[ char ] = true;
	},

	append ( content ) {
		if ( typeof content !== 'string' ) throw new TypeError( 'appended content must be a string' );

		this.appended += content;
		return this;
	},

	clone () {
		let cloned = new MagicString( this.original, { filename: this.filename });

		cloned.patches = this.patches.map( patch => patch.clone() );

		if ( this.indentExclusionRanges ) {
			cloned.indentExclusionRanges = typeof this.indentExclusionRanges[0] === 'number' ?
				[ this.indentExclusionRanges[0], this.indentExclusionRanges[1] ] :
				this.indentExclusionRanges.map( range => [ range.start, range.end ] );
		}

		Object.keys( this.sourcemapLocations ).forEach( loc => {
			cloned.sourcemapLocations[ loc ] = true;
		});

		return cloned;
	},

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
	},

	getIndentString () {
		return this.indentStr === null ? '\t' : this.indentStr;
	},

	getMappings ( hires, sourceIndex, offsets, names ) {
		return encodeMappings( this.original, this.str, this.mappings, hires, this.sourcemapLocations, sourceIndex, offsets, names, this.nameLocations );
	},

	indent ( indentStr, options ) {
		const mappings = this.mappings;
		const reverseMappings = reverse( mappings, this.str.length );
		const pattern = /^[^\r\n]/gm;

		if ( isObject( indentStr ) ) {
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
	},

	insert ( index, content ) {
		if ( typeof content !== 'string' ) {
			throw new TypeError( 'inserted content must be a string' );
		}

		this.patch( index, index, content );
		return this;
	},

	// get current location of character in original string
	locate ( character ) {
		throw new Error( 'magicString.locate is deprecated' );
	},

	locateOrigin ( character ) {
		throw new Error( 'magicString.locateOrigin is deprecated' );
	},

	overwrite ( start, end, content, storeName ) {
		if ( typeof content !== 'string' ) {
			throw new TypeError( 'replacement content must be a string' );
		}

		this.patch( start, end, content, this.original.slice( start, end ) );
		return this;
	},

	patch ( start, end, content ) {
		const original = this.original.slice( start, end );
		const patch = new Patch( start, end, content, original );

		let i = this.patches.length;
		while ( i-- ) {
			const previous = this.patches[i];

			// TODO can we tidy this up?

			// if this completely covers previous patch, remove it
			if ( start !== end && start <= previous.start && end >= previous.end ) {
				this.patches.splice( i, 1 );
			}

			// if it overlaps, throw error
			else if ( start < previous.end && end > previous.end ) {
				throw new Error( `Cannot overwrite the same content twice: '${original}'` );
			}

			// if this precedes previous patch, stop search
			else if ( start >= previous.end ) {
				break;
			}
		}

		this.patches.splice( i + 1, 0, patch );
		return patch;
	},

	prepend ( content ) {
		if ( typeof content !== 'string' ) throw new TypeError( 'appended content must be a string' );

		this.prepended = content + this.prepended;
		return this;
	},

	remove ( start, end ) {
		if ( start < 0 || end > this.original.length ) {
			throw new Error( 'Character is out of bounds' );
		}

		this.patch( start, end, '' );
		return this;
	},

	replace ( start, end, content ) {
		if ( !warned ) {
			console.warn( 'magicString.replace(...) is deprecated. Use magicString.overwrite(...) instead' );
			warned = true;
		}

		return this.overwrite( start, end, content );
	},

	slice ( start, end = this.original.length ) {
		while ( start < 0 ) start += this.original.length;
		while ( end < 0 ) end += this.original.length;

		let firstPatchIndex = 0;
		let lastPatchIndex = this.patches.length;

		while ( lastPatchIndex-- ) {
			const patch = this.patches[ lastPatchIndex ];
			if ( end >= patch.start && end < patch.end ) throw new Error( `Cannot use replaced characters (${start}, ${end}) as slice anchors` );

			// TODO this is weird, rewrite it
			if ( patch.start > end ) continue;
			break;
		}

		for ( firstPatchIndex = 0; firstPatchIndex <= lastPatchIndex; firstPatchIndex += 1 ) {
			const patch = this.patches[ firstPatchIndex ];
			if ( start > patch.start && start <= patch.end ) throw new Error( `Cannot use replaced characters (${start}, ${end}) as slice anchors` );

			if ( start <= patch.start ) {
				break;
			}
		}

		let result = '';
		let lastIndex = start;

		for ( let i = firstPatchIndex; i <= lastPatchIndex; i += 1 ) {
			const patch = this.patches[i];
			result += this.original.slice( lastIndex, patch.start );
			result += patch.content;

			lastIndex = patch.end;
		}

		result += this.original.slice( lastIndex, end );

		return result;
	},

	snip ( start, end ) {
		const clone = this.clone();
		clone.remove( 0, start );
		clone.remove( end, clone.original.length );

		return clone;
	},

	toString () {
		return this.prepended + this.slice( 0, this.original.length ) + this.appended;
	},

	trimLines () {
		return this.trim('[\\r\\n]');
	},

	trim ( charType ) {
		return this.trimStart( charType ).trimEnd( charType );
	},

	trimEnd ( charType ) {
		const rx = new RegExp( ( charType || '\\s' ) + '+$' );

		this.appended = this.appended.replace( rx, '' );
		if ( this.appended.length ) return this;

		// TODO trim patches
		const match = rx.exec( this.original );
		if ( match ) {
			this.patch( this.original.length - match[0].length, this.original.length, '' );
		}

		return this;
	},

	trimStart ( charType ) {
		const rx = new RegExp( '^' + ( charType || '\\s' ) + '+' );

		this.prepended = this.prepended.replace( rx, '' );
		if ( this.prepended.length ) return this;

		// TODO trim patches
		const match = rx.exec( this.original );
		if ( match ) {
			this.patch( 0, match[0].length, '' );
		}

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
