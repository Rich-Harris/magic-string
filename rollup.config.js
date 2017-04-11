import buble from 'rollup-plugin-buble';
import typescript from 'rollup-plugin-typescript';
import nodeResolve from 'rollup-plugin-node-resolve';
import replace from 'rollup-plugin-replace';

const external = process.env.DEPS ? null : [ 'vlq' ];
const format = process.env.DEPS ? 'umd' : process.env.ES ? 'es' : 'cjs';

export default {
	entry: process.env.ES ? 'src/index.ts' : 'src/index-legacy.ts',
	dest: 'dist/magic-string.' + format + '.js',
	format,
	exports: process.env.ES ? 'named' : 'default',
	plugins: [
		typescript({
			exclude: 'node_modules/**',
			typescript: require('typescript')
		}),
		nodeResolve({ jsnext: true }),
		replace({ DEBUG: false })
	],
	moduleName: 'MagicString',
	external,
	sourceMap: true
};
