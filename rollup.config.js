import buble from 'rollup-plugin-buble';
import nodeResolve from 'rollup-plugin-node-resolve';
import replace from 'rollup-plugin-replace';

var external = process.env.DEPS ? null : [ 'vlq' ];
var format = process.env.DEPS ? 'umd' : process.env.ES ? 'es6' : 'cjs';

export default {
	entry: process.env.ES ? 'src/index.js' : 'src/index-legacy.js',
	dest: 'dist/magic-string.' + format + '.js',
	format: format,
	plugins: [
		buble({ exclude: 'node_modules/**' }),
		nodeResolve({ jsnext: true, skip: external }),
		replace({ DEBUG: false })
	],
	moduleName: 'MagicString',
	external: external,
	sourceMap: true
};
