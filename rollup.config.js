import babel from 'rollup-plugin-babel';
import npm from 'rollup-plugin-npm';

var external = process.env.DEPS ? null : [ 'vlq' ];

export default {
	entry: 'src/index.js',
	plugins: [
		babel({ exclude: 'node_modules/**' }),
		npm({ jsnext: true, skip: external })
	],
	moduleName: 'MagicString',
	external: external,
	sourceMap: true
};
