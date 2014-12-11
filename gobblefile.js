var gobble = require( 'gobble' );

module.exports = gobble( 'src' ).transform( 'esperanto-bundle', {
	entry: 'MagicString/index',
	dest: 'magic-string',
	type: 'umd',
	name: 'MagicString'
});
