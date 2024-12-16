import js from '@eslint/js';

export default [
	js.configs.recommended,
	{
		rules: {
			'space-before-blocks': [2, 'always'],
			'no-mixed-spaces-and-tabs': [2, 'smart-tabs'],
			'object-shorthand': [2, 'always'],
			'no-const-assign': 2,
			'no-unused-vars': 2,
			'no-class-assign': 2,
			'no-this-before-super': 2,
			'no-var': 2,
			'one-var': [2, 'never'],
			'prefer-arrow-callback': 2,
			'prefer-const': 2,
			'no-cond-assign': 0,
			'no-constant-condition': 0,
			'no-console': [2, { allow: ['warn', 'error'] }],
		},
		languageOptions: {
			globals: {
				DEBUG: true,
				process: true,
				Buffer: true,
				globalThis: true,
				console: true,
			},
			parserOptions: {
				ecmaVersion: 2020,
				sourceType: 'module',
			},
		},
	},
];
