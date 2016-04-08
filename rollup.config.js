import buble from 'rollup-plugin-buble';
import nodeResolve from 'rollup-plugin-node-resolve';

var external = process.env.DEPS ? null : [ 'vlq' ];

export default {
	entry: 'src/index.js',
	plugins: [
		buble({ exclude: 'node_modules/**' }),
		nodeResolve({ jsnext: true, skip: external })
	],
	moduleName: 'MagicString',
	external: external,
	sourceMap: true
};
