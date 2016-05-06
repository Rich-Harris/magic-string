import Chunk from './Chunk.js';
import SourceMap from './utils/SourceMap.js';
import guessIndent from './utils/guessIndent.js';
import encodeMappings from './utils/encodeMappings.js';
import getRelativePath from './utils/getRelativePath.js';
import isObject from './utils/isObject.js';
import { find, findIndex } from './utils/findIndex.js';

let warned = false;

export default function MagicString ( string, options = {} ) {
	const chunk = new Chunk( 0, string.length, string );

	Object.defineProperties( this, {
		original:              { writable: true, value: string },
		outro:                 { writable: true, value: '' },
		intro:                 { writable: true, value: '' },
		chunks:                { writable: true, value: [ chunk ] },
		firstChunk:            { writable: true, value: chunk },
		lastChunk:             { writable: true, value: chunk },
		filename:              { writable: true, value: options.filename },
		indentExclusionRanges: { writable: true, value: options.indentExclusionRanges },
		sourcemapLocations:    { writable: true, value: {} },
		storedNames:           { writable: true, value: {} },
		indentStr:             { writable: true, value: guessIndent( string ) }
	});
}

MagicString.prototype = {
	addSourcemapLocation ( char ) {
		this.sourcemapLocations[ char ] = true;
	},

	append ( content ) {
		if ( typeof content !== 'string' ) throw new TypeError( 'outro content must be a string' );

		this.outro += content;
		return this;
	},

	clone () {
		let cloned = new MagicString( this.original, { filename: this.filename });

		cloned.chunks = [];
		let originalChunk = this.firstChunk;
		let clonedChunk = cloned.firstChunk = originalChunk.clone();

		while ( originalChunk ) {
			cloned.chunks.push( clonedChunk );

			const nextOriginalChunk = originalChunk.next;
			const nextClonedChunk = nextOriginalChunk && nextOriginalChunk.clone();

			if ( nextClonedChunk ) {
				clonedChunk.next = nextClonedChunk;
				nextClonedChunk.previous = clonedChunk;

				clonedChunk = nextClonedChunk;
			}

			originalChunk = nextOriginalChunk;
		}

		cloned.lastChunk = clonedChunk;

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

		const names = Object.keys( this.storedNames );

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
		return encodeMappings( this.original, this.intro, this.firstChunk, hires, this.sourcemapLocations, sourceIndex, offsets, names );
	},

	indent ( indentStr, options ) {
		const pattern = /^[^\r\n]/gm;

		if ( isObject( indentStr ) ) {
			options = indentStr;
			indentStr = undefined;
		}

		indentStr = indentStr !== undefined ? indentStr : ( this.indentStr || '\t' );

		if ( indentStr === '' ) return this; // noop

		options = options || {};

		// Process exclusion ranges
		let isExcluded = {};

		if ( options.exclude ) {
			let exclusions = typeof options.exclude[0] === 'number' ? [ options.exclude ] : options.exclude;
			exclusions.forEach( exclusion => {
				for ( let i = exclusion[0]; i < exclusion[1]; i += 1 ) {
					isExcluded[i] = true;
				}
			});
		}

		let shouldIndentNextCharacter = options.indentStart !== false;
		const replacer = match => {
			if ( shouldIndentNextCharacter ) return `${indentStr}${match}`;
			shouldIndentNextCharacter = true;
			return match;
		};

		this.intro = this.intro.replace( pattern, replacer );

		let chunkIndex;
		let charIndex = 0;

		for ( chunkIndex = 0; chunkIndex < this.chunks.length; chunkIndex += 1 ) { // can't cache this.chunks.length, it may change
			let chunk = this.chunks[ chunkIndex ];
			const end = chunk.end;

			if ( chunk.edited ) {
				if ( !isExcluded[ charIndex ] ) {
					chunk.content = chunk.content.replace( pattern, replacer );

					if ( chunk.content.length ) {
						shouldIndentNextCharacter = chunk.content[ chunk.content.length - 1 ] === '\n';
					}
				}
			} else {
				charIndex = chunk.start;

				while ( charIndex < end ) {
					if ( !isExcluded[ charIndex ] ) {
						const char = this.original[ charIndex ];

						if ( char === '\n' ) {
							shouldIndentNextCharacter = true;
						} else if ( char !== '\r' && shouldIndentNextCharacter ) {
							shouldIndentNextCharacter = false;

							// const rhs = chunk.split( charIndex );
							// rhs.prepend( indentStr );
							// this.chunks.splice( chunkIndex + 1, 0, rhs );

							if ( charIndex === chunk.start ) {
								chunk.prepend( indentStr );
								// chunkIndex += 1;
							} else {
								const rhs = chunk.split( charIndex );
								rhs.prepend( indentStr );

								this.chunks.splice( chunkIndex + 1, 0, rhs );
								chunkIndex += 1;
								chunk = rhs;
							}

						}
					}

					charIndex += 1;
				}
			}

			charIndex = chunk.end;
		}

		this.outro = this.outro.replace( pattern, replacer );

		return this;
	},

	insert () {
		throw new Error( 'magicString.insert(...) is deprecated. Use insertBefore(...) or insertAfter(...)' );
	},

	insertAfter ( index, content ) {
		if ( typeof content !== 'string' ) throw new TypeError( 'inserted content must be a string' );

		this._split( index );

		const chunk = find( this.chunks, chunk => chunk.end === index );

		if ( chunk ) {
			chunk.append( content );
		} else {
			this.intro += content;
		}

		return this;
	},

	insertBefore ( index, content ) {
		if ( typeof content !== 'string' ) throw new TypeError( 'inserted content must be a string' );

		this._split( index );

		const chunk = find( this.chunks, chunk => chunk.start === index );

		if ( chunk ) {
			chunk.prepend( content );
		} else {
			this.outro += content;
		}

		return this;
	},

	// get current location of character in original string
	locate () {
		throw new Error( 'magicString.locate is deprecated' );
	},

	locateOrigin () {
		throw new Error( 'magicString.locateOrigin is deprecated' );
	},

	move ( start, end, index ) {
		if ( index >= start && index <= end ) throw new Error( 'Cannot move a selection inside itself' );

		this._split( start );
		this._split( end );
		this._split( index );

		const first = find( this.chunks, chunk => chunk.start === start );
		const last = find( this.chunks, chunk => chunk.end === end );

		const oldLeft = first.previous;//find( this.chunks, chunk => chunk.end === start );
		const oldRight = last.next;//find( this.chunks, chunk => chunk.start === end );

		const newLeft = find( this.chunks, chunk => chunk.end === index );
		const newRight = find( this.chunks, chunk => chunk.start === index );

		if ( oldLeft ) oldLeft.next = oldRight;
		if ( oldRight ) oldRight.previous = oldLeft;

		if ( newLeft ) newLeft.next = first;
		if ( newRight ) newRight.previous = last;

		if ( !first.previous ) this.firstChunk = last.next;
		if ( !last.next ) this.lastChunk = first.previous;

		first.previous = newLeft;
		last.next = newRight;

		if ( !newLeft ) this.firstChunk = first;
		if ( !newRight ) this.lastChunk = last;

		return this;
	},

	overwrite ( start, end, content, storeName ) {
		if ( typeof content !== 'string' ) {
			throw new TypeError( 'replacement content must be a string' );
		}

		while ( start < 0 ) start += this.original.length;
		while ( end < 0 ) end += this.original.length;

		if ( end > this.original.length ) throw new Error( 'end is out of bounds' );

		this._split( start );
		this._split( end );

		if ( storeName ) {
			const original = this.original.slice( start, end );
			this.storedNames[ original ] = true;
		}

		const firstIndex = findIndex( this.chunks, chunk => chunk.start === start );
		const lastIndex = findIndex( this.chunks, chunk => chunk.end === end );

		const first = this.chunks[ firstIndex ];
		const last = this.chunks[ lastIndex ];

		if ( first ) {
			first.edit( content, storeName );

			if ( first !== last ) {
				first.next = last.next;
				first.end = last.end;
				first.outro = last.outro;

				this.chunks.splice( firstIndex + 1, lastIndex - firstIndex );
			}
		}

		else {
			// must be inserting at the end
			const newChunk = new Chunk( start, end, '' ).edit( content, storeName );

			// TODO last chunk in the array may not be the last chunk, if it's moved...
			last.next = newChunk;
			newChunk.previous = last;

			this.chunks.push( newChunk );
		}

		return this;
	},

	prepend ( content ) {
		if ( typeof content !== 'string' ) throw new TypeError( 'outro content must be a string' );

		this.intro = content + this.intro;
		return this;
	},

	remove ( start, end ) {
		while ( start < 0 ) start += this.original.length;
		while ( end < 0 ) end += this.original.length;

		if ( start === end ) return this;

		if ( start < 0 || end > this.original.length ) throw new Error( 'Character is out of bounds' );
		if ( start > end ) throw new Error( 'end must be greater than start' );

		this._split( start );
		this._split( end );

		const firstIndex = findIndex( this.chunks, chunk => chunk.start === start );
		const lastIndex = findIndex( this.chunks, chunk => chunk.end === end );

		const first = this.chunks[ firstIndex ];
		const last = this.chunks[ lastIndex ];
		this.chunks.splice( firstIndex, lastIndex + 1 - firstIndex );

		const previous = first.previous;
		const next = last.next;

		if ( next ) next.previous = previous;
		if ( previous ) previous.next = next;

		if ( !previous ) this.firstChunk = next;
		if ( !next ) this.lastChunk = previous;


		// let firstIndex = findIndex( this.chunks, chunk => chunk.start <= start && chunk.end > start );
		// let chunk = this.chunks[ firstIndex ];
		//
		// // if the chunk contains `start`, split
		// if ( chunk.start < start ) {
		// 	if ( chunk.edited && chunk.content.length ) throw new Error( `Cannot remove edited content ("${this.original.slice(start, end)}")` );
		// 	this._split( start );
		// 	firstIndex += 1;
		// }
		//
		// let lastIndex = findIndex( this.chunks, chunk => chunk.start < end && chunk.end >= end );
		// chunk = this.chunks[ lastIndex ];
		//
		// // if the chunk contains `end`, split
		// if ( chunk.start < end ) {
		// 	if ( chunk.edited && chunk.content.length ) throw new Error( `Cannot remove edited content ("${this.original.slice(start, end)}")` );
		// 	this._split( end );
		// }
		//
		// lastIndex += 1;
		//
		// const newChunk = new Chunk( start, end, this.original.slice( start, end ) ).edit( '', false );
		// this.chunks.splice( firstIndex, lastIndex - firstIndex, newChunk );
		//
		return this;
	},

	replace ( start, end, content ) {
		if ( !warned ) {
			console.warn( 'magicString.replace(...) is deprecated. Use magicString.overwrite(...) instead' ); // eslint-disable-line no-console
			warned = true;
		}

		return this.overwrite( start, end, content );
	},

	slice ( start, end = this.original.length ) {
		while ( start < 0 ) start += this.original.length;
		while ( end < 0 ) end += this.original.length;

		let result = '';

		for ( let i = 0; i < this.chunks.length; i += 1 ) {
			const chunk = this.chunks[i];

			if ( chunk.end <= start ) continue;
			if ( chunk.start >= end ) break;

			if ( chunk.start < start || chunk.end > end ) {
				if ( chunk.edited ) throw new Error( `Cannot use replaced characters (${start}, ${end}) as slice anchors` );

				const sliceStart = Math.max( start - chunk.start, 0 );
				const sliceEnd = Math.min( chunk.content.length - ( chunk.end - end ), chunk.content.length );

				result += chunk.content.slice( sliceStart, sliceEnd );
			} else {
				result += chunk.content;
			}
		}

		return result;
	},

	snip ( start, end ) {
		const clone = this.clone();
		clone.remove( 0, start );
		clone.remove( end, clone.original.length );

		return clone;
	},

	_split ( index ) {
		// TODO if split point already exists, bug out

		// TODO bisect
		for ( let i = 0; i < this.chunks.length; i += 1 ) {
			const chunk = this.chunks[i];
			if ( chunk.start === index || chunk.end === index ) return;

			if ( chunk.start < index && chunk.end > index ) {
				const newChunk = chunk.split( index );
				this.chunks.splice( i + 1, 0, newChunk );
				return;
			}
		}
	},

	toString () {
		let str = this.intro;

		let chunk = this.firstChunk;
		while ( chunk ) {
			str += chunk.toString();
			chunk = chunk.next;
		}

		return str + this.outro;
	},

	trimLines () {
		return this.trim('[\\r\\n]');
	},

	// TODO rewrite these methods, post-refactor
	trim ( charType ) {
		return this.trimStart( charType ).trimEnd( charType );
	},

	trimEnd ( charType ) {
		const rx = new RegExp( ( charType || '\\s' ) + '+$' );

		this.outro = this.outro.replace( rx, '' );
		if ( this.outro.length ) return this;

		let chunk = this.lastChunk;

		do {
			if ( chunk.trimEnd( rx ) ) return this;

			chunk.next = null;
			this.lastChunk = chunk;

			chunk = chunk.previous;
		} while ( chunk );
	},

	trimStart ( charType ) {
		const rx = new RegExp( '^' + ( charType || '\\s' ) + '+' );

		this.intro = this.intro.replace( rx, '' );
		if ( this.intro.length ) return this;

		let chunk = this.firstChunk;

		do {
			if ( chunk.trimStart( rx ) ) return this;

			chunk.previous = null;
			this.firstChunk = chunk;

			chunk = chunk.next;
		} while ( chunk );
	}
};
