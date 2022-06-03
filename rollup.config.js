import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';

const plugins = [
	nodeResolve(),
	replace({ DEBUG: false, preventAssignment: true })
];

export default [
	/* esm */
	{
		input: 'src/index.js',
		external: ['@jridgewell/sourcemap-codec'],
		plugins,
		output: {
			file: 'dist/magic-string.es.mjs',
			format: 'es',
			exports: 'named',
			sourcemap: true
		}
	},

	/* cjs */
	{
		input: 'src/index-legacy.js',
		external: ['@jridgewell/sourcemap-codec'],
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
