import type { RawSourceMap } from 'source-map-js'
import { encode } from '@jridgewell/sourcemap-codec'
import { SourceMapConsumer } from 'source-map-js'
import { assert, describe, it } from 'vitest'
import { Bundle } from '../../src/index.ts'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('bundle', () => {
  describe('generateMap', () => {
    it('should generate a sourcemap', () => {
      const b = new Bundle()
        .addSource({
          filename: 'foo.js',
          content: new MagicString('var answer = 42;'),
        })
        .addSource({
          filename: 'bar.js',
          content: new MagicString('console.log( answer );'),
        })

      const map = b.generateMap({
        file: 'bundle.js',
        includeContent: true,
        hires: true,
      })

      assert.equal(map.version, 3)
      assert.equal(map.file, 'bundle.js')
      assert.deepEqual(map.sources, ['foo.js', 'bar.js'])
      assert.deepEqual(map.sourcesContent, ['var answer = 42;', 'console.log( answer );'])

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      let loc

      loc = smc.originalPositionFor({ line: 1, column: 0 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 0)
      assert.equal(loc.source, 'foo.js')

      loc = smc.originalPositionFor({ line: 1, column: 1 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 1)
      assert.equal(loc.source, 'foo.js')

      loc = smc.originalPositionFor({ line: 2, column: 0 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 0)
      assert.equal(loc.source, 'bar.js')

      loc = smc.originalPositionFor({ line: 2, column: 1 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 1)
      assert.equal(loc.source, 'bar.js')
    })

    it('should handle Windows-style paths', () => {
      const b = new Bundle()
        .addSource({
          filename: 'path\\to\\foo.js',
          content: new MagicString('var answer = 42;'),
        })
        .addSource({
          filename: 'path\\to\\bar.js',
          content: new MagicString('console.log( answer );'),
        })

      const map = b.generateMap({
        file: 'bundle.js',
        includeContent: true,
        hires: true,
      })

      assert.equal(map.version, 3)
      assert.equal(map.file, 'bundle.js')
      assert.deepEqual(map.sources, ['path/to/foo.js', 'path/to/bar.js'])
      assert.deepEqual(map.sourcesContent, ['var answer = 42;', 'console.log( answer );'])

      assert.equal(
        map.toString(),
        '{"version":3,"file":"bundle.js","sources":["path/to/foo.js","path/to/bar.js"],"sourcesContent":["var answer = 42;","console.log( answer );"],"names":[],"mappings":"AAAA,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC;ACAf,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC"}',
      )

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      let loc

      loc = smc.originalPositionFor({ line: 1, column: 0 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 0)
      assert.equal(loc.source, 'path/to/foo.js')

      loc = smc.originalPositionFor({ line: 1, column: 1 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 1)
      assert.equal(loc.source, 'path/to/foo.js')

      loc = smc.originalPositionFor({ line: 2, column: 0 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 0)
      assert.equal(loc.source, 'path/to/bar.js')

      loc = smc.originalPositionFor({ line: 2, column: 1 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 1)
      assert.equal(loc.source, 'path/to/bar.js')
    })

    it('should handle edge case with intro content', () => {
      const b = new Bundle()
        .addSource({
          filename: 'foo.js',
          content: new MagicString('var answer = 42;'),
        })
        .addSource({
          filename: 'bar.js',
          content: new MagicString('\nconsole.log( answer );'),
        })
        .indent()
        .prepend('(function () {\n')
        .append('\n}());')

      const map = b.generateMap({
        file: 'bundle.js',
        includeContent: true,
        hires: true,
      })

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      let loc

      loc = smc.originalPositionFor({ line: 2, column: 1 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 0)
      assert.equal(loc.source, 'foo.js')

      loc = smc.originalPositionFor({ line: 2, column: 2 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 1)
      assert.equal(loc.source, 'foo.js')

      loc = smc.originalPositionFor({ line: 4, column: 1 })
      assert.equal(loc.line, 2)
      assert.equal(loc.column, 0)
      assert.equal(loc.source, 'bar.js')

      loc = smc.originalPositionFor({ line: 4, column: 2 })
      assert.equal(loc.line, 2)
      assert.equal(loc.column, 1)
      assert.equal(loc.source, 'bar.js')
    })

    it('should allow missing file option when generating map', () => {
      new Bundle()
        .addSource({
          filename: 'foo.js',
          content: new MagicString('var answer = 42;'),
        })
        .generateMap({
          includeContent: true,
          hires: true,
        })
    })

    it('should handle repeated sources', () => {
      const b = new Bundle()

      const foo = new MagicString('var one = 1;\nvar three = 3;', {
        filename: 'foo.js',
      })

      const bar = new MagicString('var two = 2;\nvar four = 4;', {
        filename: 'bar.js',
      })

      b.addSource(foo.snip(0, 12))
      b.addSource(bar.snip(0, 12))
      b.addSource(foo.snip(13, 27))
      b.addSource(bar.snip(13, 26))

      const code = b.toString()
      assert.equal(code, 'var one = 1;\nvar two = 2;\nvar three = 3;\nvar four = 4;')

      const map = b.generateMap({
        includeContent: true,
        hires: true,
      })

      assert.equal(map.sources.length, 2)
      assert.equal(map.sourcesContent.length, 2)

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      let loc

      loc = smc.originalPositionFor({ line: 1, column: 0 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 0)
      assert.equal(loc.source, 'foo.js')

      loc = smc.originalPositionFor({ line: 2, column: 0 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 0)
      assert.equal(loc.source, 'bar.js')

      loc = smc.originalPositionFor({ line: 3, column: 0 })
      assert.equal(loc.line, 2)
      assert.equal(loc.column, 0)
      assert.equal(loc.source, 'foo.js')

      loc = smc.originalPositionFor({ line: 4, column: 0 })
      assert.equal(loc.line, 2)
      assert.equal(loc.column, 0)
      assert.equal(loc.source, 'bar.js')
    })

    it('should recover original names', () => {
      const b = new Bundle()

      const one = new MagicString('function one () {}', { filename: 'one.js' })
      const two = new MagicString('function two () {}', { filename: 'two.js' })

      one.overwrite(9, 12, 'three', { storeName: true })
      two.overwrite(9, 12, 'four', { storeName: true })

      b.addSource(one)
      b.addSource(two)

      const map = b.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
      })

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      let loc

      loc = smc.originalPositionFor({ line: 1, column: 9 })
      assert.equal(loc.name, 'one')

      loc = smc.originalPositionFor({ line: 2, column: 9 })
      assert.equal(loc.name, 'two')
    })

    it('should not duplicate a name shared by multiple sources', () => {
      const b = new Bundle()

      const one = new MagicString('var foo = 1', { filename: 'one.js' })
      const two = new MagicString('var foo = 2', { filename: 'two.js' })

      one.overwrite(4, 7, 'bar', { storeName: true })
      two.overwrite(4, 7, 'bar', { storeName: true })

      b.addSource(one)
      b.addSource(two)

      const map = b.generateDecodedMap({ file: 'output.js', source: 'input.js' })
      assert.deepEqual(map.names, ['foo'])
    })

    it('should exclude sources without filename from sourcemap', () => {
      const b = new Bundle()

      const one = new MagicString('function one () {}', { filename: 'one.js' })
      const two = new MagicString('function two () {}', { filename: undefined })
      const three = new MagicString('function three () {}', { filename: 'three.js' })

      b.addSource(one)
      b.addSource(two)
      b.addSource(three)

      const map = b.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
      })

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      let loc

      loc = smc.originalPositionFor({ line: 1, column: 9 })
      assert.equal(loc.source, 'one.js')

      loc = smc.originalPositionFor({ line: 2, column: 9 })
      assert.equal(loc.source, null)

      loc = smc.originalPositionFor({ line: 3, column: 9 })
      assert.equal(loc.source, 'three.js')
    })

    it('should generate x_google_ignoreList correctly', () => {
      const b = new Bundle()

      const one = new MagicString('function one () {}', { filename: 'one.js' })
      const two = new MagicString('function two () {}', { filename: 'two.js' })
      const three = new MagicString('function three () {}', { filename: 'three.js' })
      const four = new MagicString('function four () {}', { filename: 'four.js' })

      b.addSource({ content: one, ignoreList: false })
      b.addSource({ content: two, ignoreList: true })
      b.addSource({ content: three, ignoreList: true })
      b.addSource({ content: four })

      const map = b.generateMap({
        file: 'output.js',
      })

      assert.deepEqual(map.x_google_ignoreList, [
        map.sources.indexOf('two.js'),
        map.sources.indexOf('three.js'),
      ])
    })

    it('numbers hires "experimental-range" mappings across sources sharing a generated line', () => {
      const b = new Bundle({ separator: ' + ' })

      b.addSource(new MagicString('aaa', { filename: 'a.js' }))
      b.addSource(new MagicString('bbb', { filename: 'b.js' }))
      assert.equal(b.toString(), 'aaa + bbb')

      const decoded = b.generateDecodedMap({ hires: 'experimental-range' })

      assert.deepEqual(decoded.mappings, [
        [
          [0, 0, 0, 0],
          [2, 0, 0, 2],
          [6, 1, 0, 0],
          [8, 1, 0, 2],
        ],
      ])

      assert.deepEqual(decoded.rangeMappings, [[0, 2]])

      const map = b.generateMap({ hires: 'experimental-range' })
      assert.equal(map.mappings, 'AAAA,EAAE,ICAF,EAAE')
      assert.equal(map.rangeMappings, 'AC')
    })

    it('records hires "experimental-range" mappings per generated line', () => {
      const b = new Bundle()

      b.addSource(new MagicString('aaa', { filename: 'a.js' }))
      b.addSource(new MagicString('bbb', { filename: 'b.js' }))
      assert.equal(b.toString(), 'aaa\nbbb')

      const decoded = b.generateDecodedMap({ hires: 'experimental-range' })

      assert.deepEqual(decoded.mappings, [
        [[0, 0, 0, 0], [2, 0, 0, 2]],
        [[0, 1, 0, 0], [2, 1, 0, 2]],
      ])
      assert.deepEqual(decoded.rangeMappings, [[0], [0]])

      const map = b.generateMap({ hires: 'experimental-range' })
      assert.equal(map.mappings, 'AAAA,EAAE;ACAF,EAAE')
      assert.equal(map.rangeMappings, 'A;A')
    })

    it('tracks generated lines across a source containing a new line and a new line separator', () => {
      const b = new Bundle()

      b.addSource(new MagicString('aaa\nbbb', { filename: 'a.js' }))
      b.addSource(new MagicString('ccc', { filename: 'b.js' }))
      assert.equal(b.toString(), 'aaa\nbbb\nccc')

      const decoded = b.generateDecodedMap({ hires: 'experimental-range' })

      assert.deepEqual(decoded.mappings, [
        [[0, 0, 0, 0]],
        [[2, 0, 1, 2]],
        [[0, 1, 0, 0], [2, 1, 0, 2]],
      ])

      assert.deepEqual(decoded.rangeMappings, [[0], [], [0]])

      const map = b.generateMap({ hires: 'experimental-range' })
      assert.equal(map.mappings, 'AAAA;EACE;ACDF,EAAE')
      assert.equal(map.rangeMappings, 'A;;A')
    })

    it('does not record hires "experimental-range" mappings for sources without a filename', () => {
      const b = new Bundle({ separator: '' })

      b.addSource({ content: new MagicString('/*x*/') })
      b.addSource(new MagicString('aaa', { filename: 'a.js' }))
      assert.equal(b.toString(), '/*x*/aaa')

      const decoded = b.generateDecodedMap({ hires: 'experimental-range' })

      assert.deepEqual(decoded.mappings, [
        [
          [5, 0, 0, 0],
          [7, 0, 0, 2],
        ],
      ])
      assert.deepEqual(decoded.rangeMappings, [[0]])

      const map = b.generateMap({ hires: 'experimental-range' })
      assert.equal(map.mappings, 'KAAA,EAAE')
      assert.equal(map.rangeMappings, 'A')
    })

    it('does not emit rangeMappings for other hires modes', () => {
      const b = new Bundle()

      b.addSource(new MagicString('aaa', { filename: 'a.js' }))

      assert.deepEqual(b.generateDecodedMap().rangeMappings, [[]])
      assert.deepEqual(b.generateDecodedMap({ hires: true }).rangeMappings, [[]])
      assert.deepEqual(b.generateDecodedMap({ hires: 'boundary' }).rangeMappings, [[]])

      assert.equal(b.generateMap().rangeMappings, undefined)
      assert.equal(b.generateMap({ hires: true }).rangeMappings, undefined)
      assert.equal(b.generateMap({ hires: 'boundary' }).rangeMappings, undefined)
    })

    it('generates the same mappings as encoding the decoded map, for every hires mode', () => {
      const hiresModes = [false, true, 'boundary', 'experimental-range'] as const

      for (const hires of hiresModes) {
        const b = new Bundle({ intro: '/* bundle */\n' })

        const one = new MagicString('function one() {\n  return 1\n}', { filename: 'one.js' })
        one.overwrite(9, 12, 'uno', { storeName: true })
        const two = new MagicString('function two() {\n  return 2\n}', { filename: 'two.js' })
        two.addSourcemapLocation(20)
        b.addSource(one)
        b.addSource(two)
        b.addSource({ content: new MagicString('/* no filename */') })

        const map = b.generateMap({ hires })
        const decoded = b.generateDecodedMap({ hires })

        assert.equal(map.mappings, encode(decoded.mappings), `hires: ${hires}`)
      }
    })

    it('handles prepended content', () => {
      const b = new Bundle()

      const one = new MagicString('function one () {}', { filename: 'one.js' })
      const two = new MagicString('function two () {}', { filename: 'two.js' })
      two.prepend('function oneAndAHalf() {}\n')

      b.addSource(one)
      b.addSource(two)

      const map = b.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
      })

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      let loc

      loc = smc.originalPositionFor({ line: 1, column: 9 })
      assert.equal(loc.source, 'one.js')

      loc = smc.originalPositionFor({ line: 3, column: 9 })
      assert.equal(loc.source, 'two.js')
    })

    it('handles appended content', () => {
      const b = new Bundle()

      const one = new MagicString('function one () {}', { filename: 'one.js' })
      one.append('\nfunction oneAndAHalf() {}')
      const two = new MagicString('function two () {}', { filename: 'two.js' })

      b.addSource(one)
      b.addSource(two)

      const map = b.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
      })

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      let loc

      loc = smc.originalPositionFor({ line: 1, column: 9 })
      assert.equal(loc.source, 'one.js')

      loc = smc.originalPositionFor({ line: 3, column: 9 })
      assert.equal(loc.source, 'two.js')
    })

    it('should handle empty separator', () => {
      const b = new Bundle({
        separator: '',
      })

      b.addSource({
        content: new MagicString('if ( foo ) { '),
      })

      const s = new MagicString('console.log( 42 );')
      s.addSourcemapLocation(8)
      s.addSourcemapLocation(15)

      b.addSource({
        filename: 'input.js',
        content: s,
      })

      b.addSource({
        content: new MagicString(' }'),
      })

      assert.equal(b.toString(), 'if ( foo ) { console.log( 42 ); }')

      const map = b.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
      })

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      const loc = smc.originalPositionFor({ line: 1, column: 21 })

      assert.deepEqual(loc as unknown as Record<string, unknown>, {
        source: 'input.js',
        name: null,
        line: 1,
        column: 8,
      })
    })

    it('should use a source\'s own separator', () => {
      const b = new Bundle({ separator: '\n' })

      b.addSource({ filename: 'a.js', content: new MagicString('AAA') })
      b.addSource({
        filename: 'b.js',
        content: new MagicString('BBB'),
        separator: '\n\n\n',
      })

      assert.equal(b.toString(), 'AAA\n\n\nBBB')

      const map = b.generateMap({ file: 'out.js', includeContent: true })
      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      const loc = smc.originalPositionFor({ line: 4, column: 0 })

      assert.equal(loc.source, 'b.js')
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 0)
    })

    it('should stay aligned after append', () => {
      const b = new Bundle()

      b.addSource({ filename: 'a.js', content: new MagicString('AAA') })
      b.append('XXX')
      b.addSource({ filename: 'b.js', content: new MagicString('BBB') })

      assert.equal(b.toString(), 'AAAXXX\nBBB')

      const map = b.generateMap({ file: 'out.js', includeContent: true })
      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      const loc = smc.originalPositionFor({ line: 2, column: 0 })

      assert.equal(loc.source, 'b.js')
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 0)
    })

    // TODO tidy this up. is a recreation of a bug in Svelte
    it('generates a correct sourcemap for a Svelte component', () => {
      const b = new Bundle({
        separator: '',
      })

      const s = new MagicString(
        [
          '<div></div>',
          '',
          '<script>',
          '\texport default {',
          '\t\tonrender () {',
          '\t\t\tconsole.log( 42 );',
          '\t\t}',
          '\t}',
          '</script>',
        ].join('\n'),
      )

      const sourcemapLocations = [21, 23, 38, 42, 50, 51, 54, 59, 66, 67, 70, 72, 74, 76, 77, 81, 84, 85]
      sourcemapLocations.forEach((pos) => {
        s.addSourcemapLocation(pos)
      })

      s.remove(0, 21)
      s.overwrite(23, 38, 'return ')
      s.prependRight(21, 'var template = (function () {')
      s.appendLeft(85, '}());')
      s.overwrite(85, 94, '')

      b.addSource({
        content: s,
        filename: 'input.js',
      })

      assert.equal(
        b.toString(),
        [
          'var template = (function () {',
          '\treturn {',
          '\t\tonrender () {',
          '\t\t\tconsole.log( 42 );',
          '\t\t}',
          '\t}',
          '}());',
        ].join('\n'),
      )

      const map = b.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
      })

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      const loc = smc.originalPositionFor({ line: 4, column: 16 })

      assert.deepEqual(loc as unknown as Record<string, unknown>, {
        source: 'input.js',
        name: null,
        line: 6,
        column: 16,
      })
    })

    it('supports a function for includeContent', () => {
      const b = new Bundle()

      const files: Record<string, MagicString> = {
        'one.js': new MagicString('function one () {}', { filename: 'one.js' }),
        'two.js': new MagicString('function two () {}', { filename: 'two.js' }),
      }

      b.addSource(files['one.js'])
      b.addSource(files['two.js'])

      const map = b.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent(source) {
          assert.ok(files[source.filename])
          assert.equal(files[source.filename].original, source.content)

          return source.filename === 'one.js'
        },
      })

      assert.equal(map.sourcesContent[0], files['one.js'].original)
      assert.equal(map.sourcesContent[1], null)
    })

    it('keeps the mappings intact when includeContent generates another map', () => {
      // includeContent runs while the bundle's own mappings are still being encoded,
      // and a map generated inside it used to overwrite the encoder's pending output
      const b = new Bundle()
      b.addSource(new MagicString('abcdefghij;'.repeat(600), { filename: 'a.js' }))
      const other = new MagicString('function foo() { return 1 }\n'.repeat(40))

      const expected = encode(b.generateDecodedMap({ hires: true }).mappings)
      const map = b.generateMap({
        hires: true,
        includeContent() {
          other.generateMap({ hires: true })
          return true
        },
      })

      assert.equal(map.mappings, expected)
    })
  })
})
