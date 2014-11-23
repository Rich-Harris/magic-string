var gobble = require( 'gobble' );

var esperantoBundle = require( 'gobble-esperanto-bundle' ); // TODO once this is released...

module.exports = gobble( 'src' ).transform( esperantoBundle, {
	entry: 'MagicString/index',
	dest: 'magic-string',
	type: 'umd',
	name: 'MagicString'
});
