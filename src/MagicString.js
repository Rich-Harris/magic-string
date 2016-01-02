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
		outro:                 { writable: true, value: '' },
		intro:                 { writable: true, value: '' },
		patches:               { writable: true, value: [] },
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
		return encodeMappings( this.original, this.intro, this.patches, hires, this.sourcemapLocations, sourceIndex, offsets, names );
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

		let charIndex = 0;
		let patchIndex = 0;

		const indentUntil = end => {
			while ( charIndex < end ) {
				if ( !isExcluded[ charIndex ] ) {
					const char = this.original[ charIndex ];

					if ( char === '\n' ) {
						shouldIndentNextCharacter = true;
					} else if ( char !== '\r' && shouldIndentNextCharacter ) {
						this.patches.splice( patchIndex, 0, new Patch( charIndex, charIndex, indentStr, '', false ) );
						shouldIndentNextCharacter = false;

						patchIndex += 1;
					}
				}

				charIndex += 1;
			}
		};

		for ( ; patchIndex < this.patches.length; patchIndex += 1 ) { // can't cache this.patches.length, it may change
			const patch = this.patches[ patchIndex ];

			indentUntil( patch.start );

			if ( !isExcluded[ charIndex ] ) {
				patch.content = patch.content.replace( pattern, replacer );

				if ( patch.content.length ) {
					shouldIndentNextCharacter = patch.content[ patch.content.length - 1 ] === '\n';
				}
			}

			charIndex = patch.end;
		}

		indentUntil( this.original.length );

		this.outro = this.outro.replace( pattern, replacer );

		return this;
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

		this.patch( start, end, content, storeName );
		return this;
	},

	patch ( start, end, content, storeName ) {
		const original = this.original.slice( start, end );
		if ( storeName ) this.storedNames[ original ] = true;

		let i = this.patches.length;
		while ( i-- ) {
			const previous = this.patches[i];

			// TODO can we tidy this up?

			// if this completely covers previous patch, remove it
			if ( start !== end && start <= previous.start && end >= previous.end ) {
				// unless it's an insert at the start
				if ( previous.start === previous.end && previous.start === start ) break;
				// or it's an insert at the end
				if ( previous.start === previous.end && previous.end === end ) continue;
				this.patches.splice( i, 1 );
			}

			// if it overlaps, throw error
			else if ( start < previous.end && end > previous.start ) {
				// special case – it's okay to remove overlapping ranges
				if ( !previous.content.length && !content.length ) {
					previous.start = Math.min( start, previous.start );
					previous.end = Math.max( end, previous.end );
					return;
				}

				throw new Error( `Cannot overwrite the same content twice: '${original}'` );
			}

			// if this precedes previous patch, stop search
			else if ( start >= previous.end ) {
				break;
			}
		}

		const patch = new Patch( start, end, content, original, storeName );
		this.patches.splice( i + 1, 0, patch );
		return patch;
	},

	prepend ( content ) {
		if ( typeof content !== 'string' ) throw new TypeError( 'outro content must be a string' );

		this.intro = content + this.intro;
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
		return this.intro + this.slice( 0, this.original.length ) + this.outro;
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
		let i = this.patches.length;

		while ( i-- ) {
			const patch = this.patches[i];

			if ( charIndex > patch.end ) {
				const slice = this.original.slice( patch.end, charIndex );

				const match = rx.exec( slice );
				if ( match ) {
					this.patch( charIndex - match[0].length, charIndex, '' );
				}

				if ( !match || match[0].length < slice.length ) {
					// there is non-whitespace after the patch
					return this;
				}
			}

			patch.content = patch.content.replace( rx, '' );
			if ( patch.content ) return this;

			charIndex = patch.start;
		}

		const slice = this.original.slice( 0, charIndex );

		const match = rx.exec( slice );
		if ( match ) this.patch( charIndex - match[0].length, charIndex, '' );

		return this;
	},

	trimStart ( charType ) {
		const rx = new RegExp( '^' + ( charType || '\\s' ) + '+' );

		this.intro = this.intro.replace( rx, '' );
		if ( this.intro.length ) return this;

		let charIndex = 0;

		for ( let i = 0; i < this.patches.length; i += 1 ) {
			const patch = this.patches[i];

			if ( charIndex < patch.start ) {
				const slice = this.original.slice( charIndex, patch.start );

				const match = rx.exec( slice );
				if ( match ) this.patch( charIndex, charIndex + match[0].length, '' );

				if ( !match || match[0].length < slice.length ) {
					// there is non-whitespace before the patch
					return this;
				}
			}

			patch.content = patch.content.replace( rx, '' );
			if ( patch.content ) return this;

			charIndex = patch.end;
		}

		const slice = this.original.slice( charIndex, this.original.length );

		const match = rx.exec( slice );
		if ( match ) this.patch( charIndex, charIndex + match[0].length, '' );

		return this;
	}
}
