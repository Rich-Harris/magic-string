const assert = require('assert');
const SourceMapConsumer = require('source-map-js').SourceMapConsumer;
const MagicString = require('../');

require('source-map-support').install();

describe('MagicString.Bundle', () => {
	describe('addSource', () => {
		it('should return this', () => {
			const b = new MagicString.Bundle();
			const source = new MagicString('abcdefghijkl');

			assert.strictEqual(b.addSource({ content: source }), b);
		});

		it('should accept MagicString instance as a single argument', () => {
			const b = new MagicString.Bundle();
			const array = [];
			const source = new MagicString('abcdefghijkl', {
				filename: 'foo.js',
				indentExclusionRanges: array
			});

			b.addSource(source);
			assert.strictEqual(b.sources[0].content, source);
			assert.strictEqual(b.sources[0].filename, 'foo.js');
			assert.strictEqual(b.sources[0].indentExclusionRanges, array);
		});

		it('should accept ignore-list hint', () => {
			const b = new MagicString.Bundle();
			const foo = new MagicString('foo', {filename: 'foo.js'});
			const bar = new MagicString('bar', {filename: 'bar.js'});

			b.addSource({content: foo, ignoreList: true});
			b.addSource({content: bar, ignoreList: false});
			assert.strictEqual(b.sources[0].content, foo);
			assert.strictEqual(b.sources[0].ignoreList, true);
			assert.strictEqual(b.sources[1].content, bar);
			assert.strictEqual(b.sources[1].ignoreList, false);
		});

		it('respects MagicString init options with { content: source }', () => {
			const b = new MagicString.Bundle();
			const array = [];
			const source = new MagicString('abcdefghijkl', {
				filename: 'foo.js',
				ignoreList: false,
				indentExclusionRanges: array
			});

			b.addSource({ content: source });
			assert.strictEqual(b.sources[0].content, source);
			assert.strictEqual(b.sources[0].filename, 'foo.js');
			assert.strictEqual(b.sources[0].ignoreList, false);
			assert.strictEqual(b.sources[0].indentExclusionRanges, array);
		});
	});

	describe('append', () => {
		it('should append content', () => {
			const b = new MagicString.Bundle();

			b.addSource({ content: new MagicString('*') });

			b.append('123').append('456');
			assert.equal(b.toString(), '*123456');
		});

		it('should append content before subsequent sources', () => {
			const b = new MagicString.Bundle();

			b.addSource(new MagicString('*'));

			b.append('123').addSource(new MagicString('-')).append('456');
			assert.equal(b.toString(), '*123\n-456');
		});

		it('should return this', () => {
			const b = new MagicString.Bundle();
			assert.strictEqual(b.append('x'), b);
		});
	});

	describe('clone', () => {
		it('should clone a bundle', () => {
			const s1 = new MagicString('abcdef');
			const s2 = new MagicString('ghijkl');
			const b = new MagicString.Bundle()
				.addSource({ content: s1 })
				.addSource({ content: s2 })
				.prepend('>>>')
				.append('<<<');
			const clone = b.clone();

			assert.equal(clone.toString(), '>>>abcdef\nghijkl<<<');

			s1.overwrite(2, 4, 'XX');
			assert.equal(b.toString(), '>>>abXXef\nghijkl<<<');
			assert.equal(clone.toString(), '>>>abcdef\nghijkl<<<');
		});
	});

	describe('generateMap', () => {
		it('should generate a sourcemap', () => {
			const b = new MagicString.Bundle()
				.addSource({
					filename: 'foo.js',
					content: new MagicString('var answer = 42;')
				})
				.addSource({
					filename: 'bar.js',
					content: new MagicString('console.log( answer );')
				});


			const map = b.generateMap({
				file: 'bundle.js',
				includeContent: true,
				hires: true
			});

			assert.equal(map.version, 3);
			assert.equal(map.file, 'bundle.js');
			assert.deepEqual(map.sources, ['foo.js', 'bar.js']);
			assert.deepEqual(map.sourcesContent, ['var answer = 42;', 'console.log( answer );']);

			const smc = new SourceMapConsumer(map);
			let loc;

			loc = smc.originalPositionFor({ line: 1, column: 0 });
			assert.equal(loc.line, 1);
			assert.equal(loc.column, 0);
			assert.equal(loc.source, 'foo.js');

			loc = smc.originalPositionFor({ line: 1, column: 1 });
			assert.equal(loc.line, 1);
			assert.equal(loc.column, 1);
			assert.equal(loc.source, 'foo.js');

			loc = smc.originalPositionFor({ line: 2, column: 0 });
			assert.equal(loc.line, 1);
			assert.equal(loc.column, 0);
			assert.equal(loc.source, 'bar.js');

			loc = smc.originalPositionFor({ line: 2, column: 1 });
			assert.equal(loc.line, 1);
			assert.equal(loc.column, 1);
			assert.equal(loc.source, 'bar.js');
		});

		it('should handle Windows-style paths', () => {
			const b = new MagicString.Bundle()
				.addSource({
					filename: 'path\\to\\foo.js',
					content: new MagicString('var answer = 42;')
				})
				.addSource({
					filename: 'path\\to\\bar.js',
					content: new MagicString('console.log( answer );')
				});

			const map = b.generateMap({
				file: 'bundle.js',
				includeContent: true,
				hires: true
			});

			assert.equal(map.version, 3);
			assert.equal(map.file, 'bundle.js');
			assert.deepEqual(map.sources, ['path/to/foo.js', 'path/to/bar.js']);
			assert.deepEqual(map.sourcesContent, ['var answer = 42;', 'console.log( answer );']);

			assert.equal(map.toString(), '{"version":3,"file":"bundle.js","sources":["path/to/foo.js","path/to/bar.js"],"sourcesContent":["var answer = 42;","console.log( answer );"],"names":[],"mappings":"AAAA,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC;ACAf,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC"}');

			const smc = new SourceMapConsumer(map);
			let loc;

			loc = smc.originalPositionFor({ line: 1, column: 0 });
			assert.equal(loc.line, 1);
			assert.equal(loc.column, 0);
			assert.equal(loc.source, 'path/to/foo.js');

			loc = smc.originalPositionFor({ line: 1, column: 1 });
			assert.equal(loc.line, 1);
			assert.equal(loc.column, 1);
			assert.equal(loc.source, 'path/to/foo.js');

			loc = smc.originalPositionFor({ line: 2, column: 0 });
			assert.equal(loc.line, 1);
			assert.equal(loc.column, 0);
			assert.equal(loc.source, 'path/to/bar.js');

			loc = smc.originalPositionFor({ line: 2, column: 1 });
			assert.equal(loc.line, 1);
			assert.equal(loc.column, 1);
			assert.equal(loc.source, 'path/to/bar.js');
		});

		it('should handle edge case with intro content', () => {
			const b = new MagicString.Bundle()
				.addSource({
					filename: 'foo.js',
					content: new MagicString('var answer = 42;')
				})
				.addSource({
					filename: 'bar.js',
					content: new MagicString('\nconsole.log( answer );')
				})
				.indent().prepend('(function () {\n').append('\n}());');

			const map = b.generateMap({
				file: 'bundle.js',
				includeContent: true,
				hires: true
			});

			const smc = new SourceMapConsumer(map);
			let loc;

			loc = smc.originalPositionFor({ line: 2, column: 1 });
			assert.equal(loc.line, 1);
			assert.equal(loc.column, 0);
			assert.equal(loc.source, 'foo.js');

			loc = smc.originalPositionFor({ line: 2, column: 2 });
			assert.equal(loc.line, 1);
			assert.equal(loc.column, 1);
			assert.equal(loc.source, 'foo.js');

			loc = smc.originalPositionFor({ line: 4, column: 1 });
			assert.equal(loc.line, 2);
			assert.equal(loc.column, 0);
			assert.equal(loc.source, 'bar.js');

			loc = smc.originalPositionFor({ line: 4, column: 2 });
			assert.equal(loc.line, 2);
			assert.equal(loc.column, 1);
			assert.equal(loc.source, 'bar.js');
		});

		it('should allow missing file option when generating map', () => {
			new MagicString.Bundle()
				.addSource({
					filename: 'foo.js',
					content: new MagicString('var answer = 42;')
				})
				.generateMap({
					includeContent: true,
					hires: true
				});
		});

		it('should handle repeated sources', () => {
			const b = new MagicString.Bundle();

			const foo = new MagicString('var one = 1;\nvar three = 3;', {
				filename: 'foo.js'
			});

			const bar = new MagicString('var two = 2;\nvar four = 4;', {
				filename: 'bar.js'
			});

			b.addSource(foo.snip(0, 12));
			b.addSource(bar.snip(0, 12));
			b.addSource(foo.snip(13, 27));
			b.addSource(bar.snip(13, 26));

			const code = b.toString();
			assert.equal(code, 'var one = 1;\nvar two = 2;\nvar three = 3;\nvar four = 4;');

			const map = b.generateMap({
				includeContent: true,
				hires: true
			});

			assert.equal(map.sources.length, 2);
			assert.equal(map.sourcesContent.length, 2);

			const smc = new SourceMapConsumer(map);
			let loc;

			loc = smc.originalPositionFor({ line: 1, column: 0 });
			assert.equal(loc.line, 1);
			assert.equal(loc.column, 0);
			assert.equal(loc.source, 'foo.js');

			loc = smc.originalPositionFor({ line: 2, column: 0 });
			assert.equal(loc.line, 1);
			assert.equal(loc.column, 0);
			assert.equal(loc.source, 'bar.js');

			loc = smc.originalPositionFor({ line: 3, column: 0 });
			assert.equal(loc.line, 2);
			assert.equal(loc.column, 0);
			assert.equal(loc.source, 'foo.js');

			loc = smc.originalPositionFor({ line: 4, column: 0 });
			assert.equal(loc.line, 2);
			assert.equal(loc.column, 0);
			assert.equal(loc.source, 'bar.js');
		});

		it('should recover original names', () => {
			const b = new MagicString.Bundle();

			const one = new MagicString('function one () {}', { filename: 'one.js' });
			const two = new MagicString('function two () {}', { filename: 'two.js' });

			one.overwrite(9, 12, 'three', { storeName: true });
			two.overwrite(9, 12, 'four', { storeName: true });

			b.addSource(one);
			b.addSource(two);

			const map = b.generateMap({
				file: 'output.js',
				source: 'input.js',
				includeContent: true
			});

			const smc = new SourceMapConsumer(map);
			let loc;

			loc = smc.originalPositionFor({ line: 1, column: 9 });
			assert.equal(loc.name, 'one');

			loc = smc.originalPositionFor({ line: 2, column: 9 });
			assert.equal(loc.name, 'two');
		});

		it('should exclude sources without filename from sourcemap', () => {
			const b = new MagicString.Bundle();

			const one = new MagicString('function one () {}', { filename: 'one.js' });
			const two = new MagicString('function two () {}', { filename: null });
			const three = new MagicString('function three () {}', { filename: 'three.js' });

			b.addSource(one);
			b.addSource(two);
			b.addSource(three);

			const map = b.generateMap({
				file: 'output.js',
				source: 'input.js',
				includeContent: true
			});

			const smc = new SourceMapConsumer(map);
			let loc;

			loc = smc.originalPositionFor({ line: 1, column: 9 });
			assert.equal(loc.source, 'one.js');

			loc = smc.originalPositionFor({ line: 2, column: 9 });
			assert.equal(loc.source, null);

			loc = smc.originalPositionFor({ line: 3, column: 9 });
			assert.equal(loc.source, 'three.js');
		});

		it('should generate x_google_ignoreList correctly', () => {
			const b = new MagicString.Bundle();

			const one = new MagicString('function one () {}', { filename: 'one.js' });
			const two = new MagicString('function two () {}', { filename: 'two.js' });
			const three = new MagicString('function three () {}', { filename: 'three.js' });
			const four = new MagicString('function four () {}', { filename: 'four.js' });

			b.addSource({ content: one, ignoreList: false });
			b.addSource({ content: two, ignoreList: true });
			b.addSource({ content: three, ignoreList: true });
			b.addSource({ content: four });

			const map = b.generateMap({
				file: 'output.js'
			});

			assert.deepEqual(map.x_google_ignoreList, [
				map.sources.indexOf('two.js'),
				map.sources.indexOf('three.js')
			]);
		});

		it('handles prepended content', () => {
			const b = new MagicString.Bundle();

			const one = new MagicString('function one () {}', { filename: 'one.js' });
			const two = new MagicString('function two () {}', { filename: 'two.js' });
			two.prepend('function oneAndAHalf() {}\n');

			b.addSource(one);
			b.addSource(two);

			const map = b.generateMap({
				file: 'output.js',
				source: 'input.js',
				includeContent: true
			});

			const smc = new SourceMapConsumer(map);
			let loc;

			loc = smc.originalPositionFor({ line: 1, column: 9 });
			assert.equal(loc.source, 'one.js');

			loc = smc.originalPositionFor({ line: 3, column: 9 });
			assert.equal(loc.source, 'two.js');
		});

		it('handles appended content', () => {
			const b = new MagicString.Bundle();

			const one = new MagicString('function one () {}', { filename: 'one.js' });
			one.append('\nfunction oneAndAHalf() {}');
			const two = new MagicString('function two () {}', { filename: 'two.js' });

			b.addSource(one);
			b.addSource(two);

			const map = b.generateMap({
				file: 'output.js',
				source: 'input.js',
				includeContent: true
			});

			const smc = new SourceMapConsumer(map);
			let loc;

			loc = smc.originalPositionFor({ line: 1, column: 9 });
			assert.equal(loc.source, 'one.js');

			loc = smc.originalPositionFor({ line: 3, column: 9 });
			assert.equal(loc.source, 'two.js');
		});

		it('should handle empty separator', () => {
			const b = new MagicString.Bundle({
				separator: ''
			});

			b.addSource({
				content: new MagicString('if ( foo ) { ')
			});

			const s = new MagicString('console.log( 42 );');
			s.addSourcemapLocation(8);
			s.addSourcemapLocation(15);

			b.addSource({
				filename: 'input.js',
				content: s
			});

			b.addSource({
				content: new MagicString(' }')
			});

			assert.equal(b.toString(), 'if ( foo ) { console.log( 42 ); }');

			const map = b.generateMap({
				file: 'output.js',
				source: 'input.js',
				includeContent: true
			});

			const smc = new SourceMapConsumer(map);
			const loc = smc.originalPositionFor({ line: 1, column: 21 });

			assert.deepEqual(loc, {
				source: 'input.js',
				name: null,
				line: 1,
				column: 8
			});
		});

		// TODO tidy this up. is a recreation of a bug in Svelte
		it('generates a correct sourcemap for a Svelte component', () => {
			const b = new MagicString.Bundle({
				separator: ''
			});

			const s = new MagicString(`
<div></div>

<script>
	export default {
		onrender () {
			console.log( 42 );
		}
	}
</script>`.trim());

			[21, 23, 38, 42, 50, 51, 54, 59, 66, 67, 70, 72, 74, 76, 77, 81, 84, 85].forEach(pos => {
				s.addSourcemapLocation(pos);
			});

			s.remove(0, 21);
			s.overwrite(23, 38, 'return ');
			s.prependRight(21, 'var template = (function () {');
			s.appendLeft(85, '}());');
			s.overwrite(85, 94, '');

			b.addSource({
				content: s,
				filename: 'input.js'
			});

			assert.equal(b.toString(), `
var template = (function () {
	return {
		onrender () {
			console.log( 42 );
		}
	}
}());`.trim());

			const map = b.generateMap({
				file: 'output.js',
				source: 'input.js',
				includeContent: true
			});

			const smc = new SourceMapConsumer(map);
			const loc = smc.originalPositionFor({ line: 4, column: 16 });

			assert.deepEqual(loc, {
				source: 'input.js',
				name: null,
				line: 6,
				column: 16
			});
		});
	});

	describe('indent', () => {
		it('should indent a bundle', () => {
			const b = new MagicString.Bundle();

			b.addSource({ content: new MagicString('abcdef') });
			b.addSource({ content: new MagicString('ghijkl') });

			b.indent().prepend('>>>\n').append('\n<<<');
			assert.equal(b.toString(), '>>>\n\tabcdef\n\tghijkl\n<<<');
		});

		it('should ignore non-indented sources when guessing indentation', () => {
			const b = new MagicString.Bundle();

			b.addSource({ content: new MagicString('abcdef') });
			b.addSource({ content: new MagicString('ghijkl') });
			b.addSource({ content: new MagicString('  mnopqr') });

			b.indent();
			assert.equal(b.toString(), '  abcdef\n  ghijkl\n    mnopqr');
		});

		it('should respect indent exclusion ranges', () => {
			const b = new MagicString.Bundle();

			b.addSource({
				content: new MagicString('abc\ndef\nghi\njkl'),
				indentExclusionRanges: [7, 15]
			});

			b.indent('  ');
			assert.equal(b.toString(), '  abc\n  def\nghi\njkl');

			b.indent('>>');
			assert.equal(b.toString(), '>>  abc\n>>  def\nghi\njkl');
		});

		it('does not indent sources with no preceding newline, i.e. append()', () => {
			const b = new MagicString.Bundle();

			b.addSource(new MagicString('abcdef'));
			b.addSource(new MagicString('ghijkl'));

			b.prepend('>>>').append('<<<').indent();
			assert.equal(b.toString(), '\t>>>abcdef\n\tghijkl<<<');
		});

		it('should noop with an empty string', () => {
			const b = new MagicString.Bundle();

			b.addSource(new MagicString('abcdef'));
			b.addSource(new MagicString('ghijkl'));

			b.indent('');
			assert.equal(b.toString(), 'abcdef\nghijkl');
		});

		it('indents prepended content', () => {
			const b = new MagicString.Bundle();
			b.prepend('a\nb').indent();

			assert.equal(b.toString(), '\ta\n\tb');
		});

		it('indents content immediately following intro with trailing newline', () => {
			const b = new MagicString.Bundle({ separator: '\n\n' });

			const s = new MagicString('2');
			b.addSource({ content: s });

			b.prepend('1\n');

			assert.equal(b.indent().toString(), '\t1\n\t2');
		});

		it('should return this', () => {
			const b = new MagicString.Bundle();
			assert.strictEqual(b.indent(), b);
		});

		it('should return this on noop', () => {
			const b = new MagicString.Bundle();
			assert.strictEqual(b.indent(''), b);
		});
	});

	describe('prepend', () => {
		it('should append content', () => {
			const b = new MagicString.Bundle();

			b.addSource({ content: new MagicString('*') });

			b.prepend('123').prepend('456');
			assert.equal(b.toString(), '456123*');
		});

		it('should return this', () => {
			const b = new MagicString.Bundle();
			assert.strictEqual(b.prepend('x'), b);
		});
	});

	describe('trim', () => {
		it('should trim bundle', () => {
			const b = new MagicString.Bundle();

			b.addSource({
				content: new MagicString('   abcdef   ')
			});

			b.addSource({
				content: new MagicString('   ghijkl   ')
			});

			b.trim();
			assert.equal(b.toString(), 'abcdef   \n   ghijkl');
		});

		it('should handle funky edge cases', () => {
			const b = new MagicString.Bundle();

			b.addSource({
				content: new MagicString('   abcdef   ')
			});

			b.addSource({
				content: new MagicString('   x   ')
			});

			b.prepend('\n>>>\n').append('   ');

			b.trim();
			assert.equal(b.toString(), '>>>\n   abcdef   \n   x');
		});

		it('should return this', () => {
			const b = new MagicString.Bundle();
			assert.strictEqual(b.trim(), b);
		});
	});

	describe('toString', () => {
		it('should separate with a newline by default', () => {
			const b = new MagicString.Bundle();

			b.addSource(new MagicString('abc'));
			b.addSource(new MagicString('def'));

			assert.strictEqual(b.toString(), 'abc\ndef');
		});

		it('should accept separator option', () => {
			const b = new MagicString.Bundle({ separator: '==' });

			b.addSource(new MagicString('abc'));
			b.addSource(new MagicString('def'));

			assert.strictEqual(b.toString(), 'abc==def');
		});

		it('should accept empty string separator option', () => {
			const b = new MagicString.Bundle({ separator: '' });

			b.addSource(new MagicString('abc'));
			b.addSource(new MagicString('def'));

			assert.strictEqual(b.toString(), 'abcdef');
		});
	});

	describe('mappings', () => {
		it('should produce correct mappings after remove and move in multiple sources', () => {
			const s1 = 'ABCDE';
			const ms1 = new MagicString(s1, { filename: 'first' });

			const s2 = 'VWXYZ';
			const ms2 = new MagicString(s2, { filename: 'second' });

			const bundle = new MagicString.Bundle();
			bundle.addSource(ms1);
			bundle.addSource(ms2);

			ms1.remove(2,4);   // ABE
			ms1.move(0, 1, 5); // BEA

			ms2.remove(2,4);   // VWZ
			ms2.move(0, 1, 5); // WZV

			const map = bundle.generateMap({file: 'result', hires: true, includeContent: true});
			const smc = new SourceMapConsumer(map);

			const result1 = ms1.toString();
			assert.strictEqual(result1, 'BEA');

			const result2 = ms2.toString();
			assert.strictEqual(result2, 'WZV');

			assert.strictEqual(bundle.toString(), 'BEA\nWZV');

			// B = B
			// E = E
			// A = A
			let line = 1;
			for (let i = 0; i < result1.length; i++) {
				const loc = smc.originalPositionFor({ line, column: i });
				assert.strictEqual(s1[loc.column], result1[i]);
			}

			// W = W
			// Z = Z
			// V = V
			line = 2;
			for (let i = 0; i < result2.length; i++) {
				const loc = smc.originalPositionFor({ line, column: i });
				assert.strictEqual(s2[loc.column], result2[i]);
			}

			assert.strictEqual(map.toString(), '{"version":3,"file":"result","sources":["first","second"],"sourcesContent":["ABCDE","VWXYZ"],"names":[],"mappings":"AAAC,CAAG,CAAJ;ACAC,CAAG,CAAJ"}');
		});
	});
});
