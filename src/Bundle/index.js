import MagicString from '../MagicString/index';
import SourceMap from '../utils/SourceMap';
import getRelativePath from '../utils/getRelativePath';
import hasOwnProp from '../utils/hasOwnProp';

class Bundle {
	constructor ( options = {} ) {
		this.intro = options.intro || '';
		this.outro = options.outro || '';
		this.separator = options.separator !== undefined ? options.separator : '\n';

		this.sources = [];

		this.uniqueSources = [];
		this.uniqueSourceIndexByFilename = {};
	}

	addSource ( source ) {
		if ( source instanceof MagicString ) {
			return this.addSource({
				content: source,
				filename: source.filename,
				separator: this.separator
			});
		}

		if ( typeof source !== 'object' || !source.content ) {
			throw new Error( 'bundle.addSource() takes an object with a `content` property, which should be an instance of MagicString, and an optional `filename`' );
		}

		[ 'filename', 'indentExclusionRanges', 'separator' ].forEach( option => {
			if ( !hasOwnProp.call( source, option ) ) source[ option ] = source.content[ option ];
		});

		if ( source.separator === undefined ) { // TODO there's a bunch of this sort of thing, needs cleaning up
			source.separator = this.separator;
		}

		if ( source.filename ) {
			if ( !hasOwnProp.call( this.uniqueSourceIndexByFilename, source.filename ) ) {
				this.uniqueSourceIndexByFilename[ source.filename ] = this.uniqueSources.length;
				this.uniqueSources.push({ filename: source.filename, content: source.content.original });
			} else {
				const uniqueSource = this.uniqueSources[ this.uniqueSourceIndexByFilename[ source.filename ] ];
				if ( source.content.original !== uniqueSource.content ) {
					throw new Error( `Illegal source: same filename (${source.filename}), different contents` );
				}
			}
		}

		this.sources.push( source );
		return this;
	}

	append ( str, options ) {
		this.addSource({
			content: new MagicString( str ),
			separator: ( options && options.separator ) || ''
		});

		return this;
	}

	clone () {
		const bundle = new Bundle({
			intro: this.intro,
			outro: this.outro,
			separator: this.separator
		});

		this.sources.forEach( source => {
			bundle.addSource({
				filename: source.filename,
				content: source.content.clone(),
				separator: source.separator
			});
		});

		return bundle;
	}

	generateMap ( options ) {
		let offsets = {};

		let names = [];
		this.sources.forEach( source => {
			Object.keys( source.content.nameLocations ).forEach( location => {
				const name = source.content.nameLocations[ location ];
				if ( !~names.indexOf( name ) ) names.push( name );
			});
		});

		const encoded = (
			getSemis( this.intro ) +
			this.sources.map( ( source, i ) => {
				const prefix = ( i > 0 ) ? ( getSemis( source.separator ) || ',' ) : '';
				let mappings;

				// we don't bother encoding sources without a filename
				if ( !source.filename ) {
					mappings = getSemis( source.content.toString() );
				} else {
					const sourceIndex = this.uniqueSourceIndexByFilename[ source.filename ];
					mappings = source.content.getMappings( options.hires, sourceIndex, offsets, names );
				}

				return prefix + mappings;
			}).join( '' ) +
			getSemis( this.outro )
		);

		return new SourceMap({
			file: ( options.file ? options.file.split( /[\/\\]/ ).pop() : null ),
			sources: this.uniqueSources.map( source => {
				return options.file ? getRelativePath( options.file, source.filename ) : source.filename;
			}),
			sourcesContent: this.uniqueSources.map( source => {
				return options.includeContent ? source.content : null;
			}),
			names,
			mappings: encoded
		});
	}

	getIndentString () {
		let indentStringCounts = {};

		this.sources.forEach( source => {
			const indentStr = source.content.indentStr;

			if ( indentStr === null ) return;

			if ( !indentStringCounts[ indentStr ] ) indentStringCounts[ indentStr ] = 0;
			indentStringCounts[ indentStr ] += 1;
		});

		return ( Object.keys( indentStringCounts ).sort( ( a, b ) => {
			return indentStringCounts[a] - indentStringCounts[b];
		})[0] ) || '\t';
	}

	indent ( indentStr ) {
		if ( !arguments.length ) {
			indentStr = this.getIndentString();
		}

		if ( indentStr === '' ) return this; // noop

		let trailingNewline = !this.intro || this.intro.slice( -1 ) === '\n';

		this.sources.forEach( ( source, i ) => {
			const separator = source.separator !== undefined ? source.separator : this.separator;
			const indentStart = trailingNewline || ( i > 0 && /\r?\n$/.test( separator ) );

			source.content.indent( indentStr, {
				exclude: source.indentExclusionRanges,
				indentStart//: trailingNewline || /\r?\n$/.test( separator )  //true///\r?\n/.test( separator )
			});

			trailingNewline = source.content.str.slice( 0, -1 ) === '\n';
		});

		if ( this.intro ) {
			this.intro = indentStr + this.intro.replace( /^[^\n]/gm, ( match, index ) => {
				return index > 0 ? indentStr + match : match;
			});
		}

		this.outro = this.outro.replace( /^[^\n]/gm, indentStr + '$&' );

		return this;
	}

	prepend ( str ) {
		this.intro = str + this.intro;
		return this;
	}

	toString () {
		const body = this.sources.map( ( source, i ) => {
			const separator = source.separator !== undefined ? source.separator : this.separator;
			let str = ( i > 0 ? separator : '' ) + source.content.toString();

			return str;
		}).join( '' );

		return this.intro + body + this.outro;
	}

	trimLines () {
		return this.trim('[\\r\\n]');
	}

	trim ( charType ) {
		return this.trimStart( charType ).trimEnd( charType );
	}

	trimStart ( charType ) {
		const rx = new RegExp( '^' + ( charType || '\\s' ) + '+' );
		this.intro = this.intro.replace( rx, '' );

		if ( !this.intro ) {
			let source; // TODO put inside loop if safe
			let i = 0;

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
	}

	trimEnd ( charType ) {
		const rx = new RegExp( ( charType || '\\s' ) + '+$' );
		this.outro = this.outro.replace( rx, '' );

		if ( !this.outro ) {
			let source;
			let i = this.sources.length - 1;

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
}

export default Bundle;

function getSemis ( str ) {
	return new Array( str.split( '\n' ).length ).join( ';' );
}
