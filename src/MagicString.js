import Chunk from './Chunk.js';
import SourceMap from './utils/SourceMap.js';
import guessIndent from './utils/guessIndent.js';
import encodeMappings from './utils/encodeMappings.js';
import getRelativePath from './utils/getRelativePath.js';
import isObject from './utils/isObject.js';

let warned = false;

export default function MagicString ( string, options = {} ) {
	const chunk = new Chunk( 0, string.length, string );

	Object.defineProperties( this, {
		original:              { writable: true, value: string },
		outro:                 { writable: true, value: '' },
		intro:                 { writable: true, value: '' },
		chunks:                { writable: true, value: [ chunk ] },
		moves:                 { writable: true, value: [] },
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

		cloned.chunks = this.chunks.map( chunk => chunk.clone() );

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
		return encodeMappings( this.original, this.intro, this.chunks, hires, this.sourcemapLocations, sourceIndex, offsets, names );
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

							const indentation = new Chunk( charIndex, charIndex, '' ).edit( indentStr, false );
							const remainder = chunk.split( charIndex );

							if ( charIndex === chunk.start ) {
								this.chunks.splice( chunkIndex, 0, indentation );
								chunkIndex += 1;
							} else {
								this.chunks.splice( chunkIndex + 1, 0, indentation, remainder );
								chunkIndex += 2;
							}

							chunk = remainder;
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

	insert ( index, content ) {
		if ( typeof content !== 'string' ) throw new TypeError( 'inserted content must be a string' );

		this._split( index );

		let next = this.chunks.findIndex( chunk => chunk.end > index );
		if ( !~next ) next = this.chunks.length;

		const newChunk = new Chunk( index, index, '' ).edit( content, false );

		this.chunks.splice( next, 0, newChunk );
		return this;
	},

	// get current location of character in original string
	locate ( character ) {
		throw new Error( 'magicString.locate is deprecated' );
	},

	locateOrigin ( character ) {
		throw new Error( 'magicString.locateOrigin is deprecated' );
	},

	move ( start, end, index ) {
		this._split( start );
		this._split( end );
		this._split( index );

		this.moves.push({ start, end, index });

		return this;
	},

	overwrite ( start, end, content, storeName ) {
		if ( typeof content !== 'string' ) {
			throw new TypeError( 'replacement content must be a string' );
		}

		this._split( start );
		this._split( end );

		if ( storeName ) {
			const original = this.original.slice( start, end );
			this.storedNames[ original ] = true;
		}

		let firstIndex = this.chunks.findIndex( chunk => chunk.start === start );
		let lastIndex = this.chunks.findIndex( chunk => chunk.start === end );
		if ( !~firstIndex ) firstIndex = this.chunks.length;
		if ( !~lastIndex ) lastIndex = this.chunks.length;

		const newChunk = new Chunk( start, end, this.original.slice( start, end ) ).edit( content, storeName );

		this.chunks.splice( firstIndex, lastIndex - firstIndex, newChunk );
		return this;
	},

	prepend ( content ) {
		if ( typeof content !== 'string' ) throw new TypeError( 'outro content must be a string' );

		this.intro = content + this.intro;
		return this;
	},

	remove ( start, end ) {
		if ( start < 0 || end > this.original.length ) throw new Error( 'Character is out of bounds' );
		if ( start > end ) throw new Error( 'end must be greater than start' );

		if ( start < end ) this.overwrite( start, end, '', false );
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

		let result = '';

		// TODO handle moves

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

	_sortChunks () {
		let chunks = this.chunks.slice();

		// TODO there must be a better way than this...

		this.moves.forEach( move => {
			let firstIndex = chunks.findIndex( chunk => chunk.start === move.start );
			let lastIndex = chunks.findIndex( chunk => chunk.start === move.end );
			if ( !~lastIndex ) lastIndex = chunks.length;

			let insertionIndex = chunks.findIndex( chunk => chunk.start === move.index );
			const num = lastIndex - firstIndex;

			if ( firstIndex < insertionIndex ) insertionIndex -= num;

			const toMove = chunks.splice( firstIndex, num );
			chunks.splice.apply( chunks, [ insertionIndex, 0 ].concat( toMove ) );
		});

		return chunks;
	},

	_split ( index ) {
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
		return this.intro + this._sortChunks().map( chunk => chunk.content ).join( '' ) + this.outro;
	},

	trimLines () {
		return this.trim('[\\r\\n]');
	},

	trim ( charType ) {
		return this.trimStart( charType ).trimEnd( charType );
	},

	trimEnd ( charType ) {
		const rx = new RegExp( ( charType || '\\s' ) + '+$' );

		this.outro = this.outro.replace( rx, '' );
		if ( this.outro.length ) return this;

		let charIndex = this.original.length;
		let i = this.chunks.length;

		while ( i-- ) {
			const chunk = this.chunks[i];

			if ( charIndex > chunk.end ) {
				const slice = this.original.slice( chunk.end, charIndex );

				const match = rx.exec( slice );
				if ( match ) {
					this.chunk( charIndex - match[0].length, charIndex, '' );
				}

				if ( !match || match[0].length < slice.length ) {
					// there is non-whitespace after the chunk
					return this;
				}
			}

			chunk.content = chunk.content.replace( rx, '' );
			if ( chunk.content ) return this;

			charIndex = chunk.start;
		}

		const slice = this.original.slice( 0, charIndex );

		const match = rx.exec( slice );
		if ( match ) this.chunk( charIndex - match[0].length, charIndex, '' );

		return this;
	},

	trimStart ( charType ) {
		const rx = new RegExp( '^' + ( charType || '\\s' ) + '+' );

		this.intro = this.intro.replace( rx, '' );
		if ( this.intro.length ) return this;

		let charIndex = 0;

		for ( let i = 0; i < this.chunks.length; i += 1 ) {
			const chunk = this.chunks[i];

			if ( charIndex < chunk.start ) {
				const slice = this.original.slice( charIndex, chunk.start );

				const match = rx.exec( slice );
				if ( match ) this.chunk( charIndex, charIndex + match[0].length, '' );

				if ( !match || match[0].length < slice.length ) {
					// there is non-whitespace before the chunk
					return this;
				}
			}

			chunk.content = chunk.content.replace( rx, '' );
			if ( chunk.content ) return this;

			charIndex = chunk.end;
		}

		const slice = this.original.slice( charIndex, this.original.length );

		const match = rx.exec( slice );
		if ( match ) this.chunk( charIndex, charIndex + match[0].length, '' );

		return this;
	}
}
