var gobble = require( 'gobble' );
var path = require( 'path' );
var resolve = require( 'resolve' );
var Promise = require( 'es6-promise' ).Promise;

module.exports = gobble([
	gobble( 'src' ).transform( 'rollup-babel', {
		entry: 'index.js',
		dest: 'magic-string.js',
		format: 'umd',
		moduleName: 'MagicString',
		external: [ 'vlq' ],
		sourceMap: true
	}),

	// version with deps (i.e. vlq) included
	gobble( 'src' ).transform( 'rollup-babel', {
		entry: 'index.js',
		dest: 'magic-string.deps.js',
		format: 'umd',
		moduleName: 'MagicString',
		sourceMap: true
	})
]);
