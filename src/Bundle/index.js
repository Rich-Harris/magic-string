import SourceMap from '../SourceMap';
import getRelativePath from '../utils/getRelativePath';

var Bundle = function ( options ) {
	options = options || {};

	this.intro = options.intro || '';
	this.outro = options.outro || '';
	this.separator = 'separator' in options ? options.separator : '\n';

	this.sources = [];
};

Bundle.prototype = {
	addSource: function ( source ) {
		if ( typeof source !== 'object' || !source.content ) {
			throw new Error( 'bundle.addSource() takes an object with a `content` property, which should be an instance of MagicString, and an optional `filename`' );
		}

		this.sources.push( source );
		return this;
	},

	append: function ( str ) {
		this.outro += str;
		return this;
	},

	clone: function () {
		var bundle = new Bundle({
			intro: this.intro,
			outro: this.outro,
			separator: this.separator
		});

		this.sources.forEach( function ( source ) {
			bundle.addSource({
				filename: source.filename,
				content: source.content.clone()
			});
		});

		return bundle;
	},

	generateMap: function ( options ) {
		var offsets = {}, encoded, encodingSeparator;

		encodingSeparator = getSemis( this.separator );

		encoded = (
			getSemis( this.intro ) +
			this.sources.map( function ( source, sourceIndex) {
				return source.content.getMappings( options.hires, sourceIndex, offsets );
			}).join( encodingSeparator ) +
			getSemis( this.outro )
		);

		return new SourceMap({
			file: options.file.split( '/' ).pop(),
			sources: this.sources.map( function ( source ) {
				return getRelativePath( options.file, source.filename );
			}),
			sourcesContent: this.sources.map( function ( source ) {
				return options.includeContent ? source.content.original : null;
			}),
			names: [],
			mappings: encoded
		});
	},

	getIndentString: function () {
		var indentStringCounts = {};

		this.sources.forEach( function ( source ) {
			var indentStr = source.content.indentStr;

			if ( !indentStringCounts[ indentStr ] ) indentStringCounts[ indentStr ] = 0;
			indentStringCounts[ indentStr ] += 1;
		});

		return ( Object.keys( indentStringCounts ).sort( function ( a, b ) {
			return indentStringCounts[a] - indentStringCounts[b];
		})[0] ) || '\t';
	},

	indent: function ( indentStr ) {
		if ( !indentStr ) {
			indentStr = this.getIndentString();
		}

		this.sources.forEach( function ( source ) {
			source.content.indent( indentStr );
		});

		this.intro = ( this.intro ? indentStr : '' ) + this.intro.replace( /\n(.+)/g, ( '\n' + indentStr + '$1' ) );
		this.outro = this.outro.replace( /\n(.+)/g, ( '\n' + indentStr + '$1' ) );

		return this;
	},

	prepend: function ( str ) {
		this.intro = str + this.intro;
		return this;
	},

	toString: function () {
		return this.intro + this.sources.map( stringify ).join( this.separator ) + this.outro;
	},

	trim: function () {
		var i, source;

		this.intro = this.intro.replace( /^\s+/, '' );
		this.outro = this.outro.replace( /\s+$/, '' );

		// trim start
		if ( !this.intro ) {
			i = 0;
			do {
				source = this.sources[i];

				if ( !source ) {
					this.outro = this.outro.replace( /^\s+/, '' );
					break;
				}

				source.content.trimStart();
				i += 1;
			} while ( source.content.str === '' );
		}

		// trim end
		if ( !this.outro ) {
			i = this.sources.length - 1;
			do {
				source = this.sources[i];

				if ( !source ) {
					this.intro = this.intro.replace( /\s+$/, '' );
					break;
				}

				source.content.trimEnd();
				i -= 1;
			} while ( source.content.str === '' );
		}

		return this;
	}
};

export default Bundle;

function stringify ( source ) {
	return source.content.toString();
}

function getSemis ( str ) {
	return new Array( str.split( '\n' ).length ).join( ';' );
}