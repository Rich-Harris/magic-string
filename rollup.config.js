import buble from 'rollup-plugin-buble';
import nodeResolve from 'rollup-plugin-node-resolve';
import replace from 'rollup-plugin-replace';

var external = process.env.DEPS ? null : [ 'vlq' ];

export default {
	entry: 'src/index.js',
	plugins: [
		buble({ exclude: 'node_modules/**' }),
		nodeResolve({ jsnext: true, skip: external }),
		replace({ DEBUG: false })
	],
	moduleName: 'MagicString',
	external: external,
	sourceMap: true
};
