import buble from 'rollup-plugin-buble';
import resolve from 'rollup-plugin-node-resolve';
import replace from 'rollup-plugin-replace';

export default [
	/* esm */
	{
		input: 'src/index.js',
		external: ['vlq'],
		plugins: [
			buble({ exclude: 'node_modules/**' }),
			resolve(),
			replace({ DEBUG: false })
		],
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
		external: ['vlq'],
		plugins: [
			buble({ exclude: 'node_modules/**' }),
			resolve(),
			replace({ DEBUG: false })
		],
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
		plugins: [
			buble({ exclude: 'node_modules/**' }),
			resolve(),
			replace({ DEBUG: false })
		],
		output: {
			file: 'dist/magic-string.umd.js',
			format: 'umd',
			exports: 'default',
			name: 'MagicString',
			sourcemap: true
		}
	}
];
