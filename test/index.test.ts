import assert from 'node:assert';
import MagicString, * as magicStringModule from 'magic-string';
import { describe, it } from 'vitest';

describe('module exports', () => {
	it('only exposes ESM exports', () => {
		assert.deepEqual(Object.keys(magicStringModule), [
			'Bundle',
			'MagicString',
			'default',
			'SourceMap',
		]);
		assert.equal(Object.hasOwn(MagicString, 'Bundle'), false);
		assert.equal(Object.hasOwn(MagicString, 'SourceMap'), false);
		assert.equal(Object.hasOwn(MagicString, 'default'), false);
		assert.equal(Object.hasOwn(magicStringModule, 'module.exports'), false);
	});

	it('keeps MagicString internal state non-enumerable', () => {
		const magicString = new MagicString('abc');

		assert.deepEqual(Object.keys(magicString), []);
		assert.equal(JSON.stringify(magicString), '{}');
	});

	it('does not add uninitialized runtime fields', () => {
		const bundle = new magicStringModule.Bundle();
		const sourceMap = new magicStringModule.SourceMap({
			sources: [],
			names: [],
			mappings: [],
		});

		assert.equal(Object.hasOwn(bundle, 'indentExclusionRanges'), false);
		assert.equal(Object.hasOwn(sourceMap, 'x_google_ignoreList'), false);
		assert.equal(Object.hasOwn(sourceMap, 'debugId'), false);
	});
});
