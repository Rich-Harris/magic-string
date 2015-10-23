var gobble = require( 'gobble' );
var path = require( 'path' );
var resolve = require( 'resolve' );
var Promise = require( 'es6-promise' ).Promise;

module.exports = gobble([
	// CommonJS build
	gobble( 'src' ).transform( 'rollup-babel', {
		entry: 'index.js',
		dest: 'magic-string.cjs.js',
		format: 'cjs',
		external: [ 'vlq' ],
		sourceMap: true
	}),

	// ES6 build
	gobble( 'src' ).transform( 'rollup-babel', {
		entry: 'index.js',
		dest: 'magic-string.es6.js',
		format: 'es6',
		external: [ 'vlq' ],
		sourceMap: true
	}),

	// UMD build with deps (i.e. vlq) included
	gobble( 'src' ).transform( 'rollup-babel', {
		entry: 'index.js',
		dest: 'magic-string.deps.js',
		format: 'umd',
		moduleName: 'MagicString',
		sourceMap: true
	})
]);
