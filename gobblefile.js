var gobble = require( 'gobble' );
var path = require( 'path' );
var resolve = require( 'resolve' );
var Promise = require( 'es6-promise' ).Promise;

var src = gobble( 'src' ).transform( 'babel' );

module.exports = gobble([
	src.transform( 'rollup', {
		entry: 'index.js',
		dest: 'magic-string.js',
		format: 'umd',
		moduleName: 'MagicString',
		external: [ 'vlq' ]
	}),

	// version with deps (i.e. vlq) included
	src.transform( 'rollup', {
		entry: 'index.js',
		dest: 'magic-string.deps.js',
		format: 'umd',
		moduleName: 'MagicString'
	})
]);
