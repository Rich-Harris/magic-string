import buble from 'rollup-plugin-buble';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from 'rollup-plugin-replace';

const plugins = [
	buble({ exclude: 'node_modules/**' }),
	nodeResolve(),
	replace({ DEBUG: false })
];

export default [
	/* esm */
	{
		input: 'src/index.js',
		external: ['sourcemap-codec'],
		plugins,
		output: {
			file: 'dist/magic-string.es.js',
			format: 'es',
			exports: 'named',
			sourcemap: true
		}
	},

	/* cjs */
	{
		input: 'src/index-legacy.js',
		external: ['sourcemap-codec'],
		plugins,
		output: {
			file: 'dist/magic-string.cjs.js',
			format: 'cjs',
			exports: 'default',
			sourcemap: true
		}
	},

	/* umd */
	{
		input: 'src/index-legacy.js',
		plugins,
		output: {
			file: 'dist/magic-string.umd.js',
			format: 'umd',
			exports: 'default',
			name: 'MagicString',
			sourcemap: true
		}
	}
];
