import MagicString from '../MagicString/index';
import SourceMap from '../SourceMap';
import getRelativePath from '../utils/getRelativePath';

class Bundle {
	constructor ( options = {} ) {
		this.intro = options.intro || '';
		this.outro = options.outro || '';
		this.separator = 'separator' in options ? options.separator : '\n';

		this.sources = [];
	}

	addSource ( source ) {
		if ( source instanceof MagicString ) {
			return this.addSource({
				content: source,
				filename: source.filename
			});
		}

		if ( typeof source !== 'object' || !source.content ) {
			throw new Error( 'bundle.addSource() takes an object with a `content` property, which should be an instance of MagicString, and an optional `filename`' );
		}

		this.sources.push( source );
		return this;
	}

	append ( str ) {
		this.outro += str;
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
				content: source.content.clone()
			});
		});

		return bundle;
	}

	generateMap ( options ) {
		const encodingSeparator = getSemis( this.separator );

		let offsets = {};

		const encoded = (
			getSemis( this.intro ) +
			this.sources.map( function ( source, sourceIndex) {
				return source.content.getMappings( options.hires, sourceIndex, offsets );
			}).join( encodingSeparator ) +
			getSemis( this.outro )
		);

		return new SourceMap({
			file: ( options.file ? options.file.split( /[\/\\]/ ).pop() : null ),
			sources: this.sources.map( source => {
				return options.file ? getRelativePath( options.file, source.filename ) : source.filename;
			}),
			sourcesContent: this.sources.map( source => {
				return options.includeContent ? source.content.original : null;
			}),
			names: [],
			mappings: encoded
		});
	}

	getIndentString () {
		let indentStringCounts = {};

		this.sources.forEach( source => {
			var indentStr = source.content.indentStr;

			if ( indentStr === null ) return;

			if ( !indentStringCounts[ indentStr ] ) indentStringCounts[ indentStr ] = 0;
			indentStringCounts[ indentStr ] += 1;
		});

		return ( Object.keys( indentStringCounts ).sort( ( a, b ) => {
			return indentStringCounts[a] - indentStringCounts[b];
		})[0] ) || '\t';
	}

	indent ( indentStr ) {
		if ( !indentStr ) {
			indentStr = this.getIndentString();
		}

		this.sources.forEach( source => {
			source.content.indent( indentStr, { exclude: source.indentExclusionRanges });
		});

		this.intro = this.intro.replace( /^[^\n]/gm, indentStr + '$&' );
		this.outro = this.outro.replace( /^[^\n]/gm, indentStr + '$&' );

		return this;
	}

	prepend ( str ) {
		this.intro = str + this.intro;
		return this;
	}

	toString () {
		return this.intro + this.sources.map( stringify ).join( this.separator ) + this.outro;
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

function stringify ( source ) {
	return source.content.toString();
}

function getSemis ( str ) {
	return new Array( str.split( '\n' ).length ).join( ';' );
}
