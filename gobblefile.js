var gobble = require( 'gobble' );
var path = require( 'path' );
var resolve = require( 'resolve' );
var Promise = require( 'es6-promise' ).Promise;

var src = gobble( 'src' ).transform( 'babel' );

module.exports = gobble([
	src.transform( 'esperanto-bundle', {
		entry: 'MagicString/index',
		dest: 'magic-string',
		type: 'umd',
		name: 'MagicString',

		// this works around the fact that we're NOT using strict mode, but we
		// need a named import - the batteries-included version below doesn't
		// need this fix
		transform: function ( source, path ) {
			if ( /utils[\/\\]encode.js$/.test( path ) ) {
				return "import vlq from 'vlq';\nexport default vlq.encode;";
			}

			return source;
		}
	}),

	// version with deps (i.e. vlq) included
	src.transform( 'esperanto-bundle', {
		entry: 'MagicString/index',
		dest: 'magic-string.deps',
		type: 'umd',
		name: 'MagicString',
		resolvePath: function ( importee, importer ) {
			return new Promise( function ( fulfil, reject ) {
				var callback = function ( err, result ) {
					if ( err ) {
						reject( err );
					} else {
						fulfil( result );
					}
				};

				resolve( importee, {
					basedir: path.dirname( importer ),
					packageFilter: function ( pkg ) {
						if ( pkg[ 'jsnext:main' ] ) {
							pkg.main = pkg[ 'jsnext:main' ];
						}

						return pkg;
					}
				}, callback );
			});
		}
	})
]);
