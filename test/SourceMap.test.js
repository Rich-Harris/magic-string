import { describe, it } from 'vitest';
import assert from 'assert';
import { SourceMap } from '../';

describe('MagicString.SourceMap', () => {
	describe('options', () => {
		it('preserves ignore list information', () => {
			const map = new SourceMap({
				file: 'foo.min.js',
				sources: ['foo.js'],
				sourcesContent: ['42'],
				names: [],
				mappings: [[0, 0]],
				x_google_ignoreList: [0],
			});

			assert.deepEqual(map.x_google_ignoreList, [0]);
		});
	});

	describe('toString', () => {
		it('serializes ignore list information', () => {
			const map = new SourceMap({
				file: 'foo.min.js',
				sources: ['foo.js'],
				sourcesContent: ['42'],
				names: [],
				mappings: [[0, 0]],
				x_google_ignoreList: [0],
			});

			assert.equal(
				map.toString(),
				'{"version":3,"file":"foo.min.js","sources":["foo.js"],"sourcesContent":["42"],"names":[],"mappings":"AAAAA,AAAAA","x_google_ignoreList":[0]}',
			);
		});
	});
});
