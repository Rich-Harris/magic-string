import type { RawSourceMap } from 'source-map-js'
import { encode } from '@jridgewell/sourcemap-codec'
import { SourceMapConsumer } from 'source-map-js'
import { assert, describe, it } from 'vitest'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('generateMap', () => {
    it('should generate a sourcemap', () => {
      const s = new MagicString('abcdefghijkl').remove(3, 9)

      const map = s.generateMap({
        file: 'output.md',
        source: 'input.md',
        includeContent: true,
        hires: true,
      })

      assert.equal(map.version, 3)
      assert.equal(map.file, 'output.md')
      assert.deepEqual(map.sources, ['input.md'])
      assert.deepEqual(map.sourcesContent, ['abcdefghijkl'])
      assert.equal(map.mappings, 'AAAA,CAAC,CAAC,CAAO,CAAC,CAAC')

      assert.equal(
        map.toString(),
        '{"version":3,"file":"output.md","sources":["input.md"],"sourcesContent":["abcdefghijkl"],"names":[],"mappings":"AAAA,CAAC,CAAC,CAAO,CAAC,CAAC"}',
      )
      assert.equal(
        map.toUrl(),
        'data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0Lm1kIiwic291cmNlcyI6WyJpbnB1dC5tZCJdLCJzb3VyY2VzQ29udGVudCI6WyJhYmNkZWZnaGlqa2wiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsQ0FBQyxDQUFDLENBQU8sQ0FBQyxDQUFDIn0=',
      )

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      let loc

      loc = smc.originalPositionFor({ line: 1, column: 0 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 0)

      loc = smc.originalPositionFor({ line: 1, column: 1 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 1)

      loc = smc.originalPositionFor({ line: 1, column: 4 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 10)
    })

    it('should generate a correct sourcemap for prepend content when hires = false', () => {
      const s = new MagicString('x\nq')

      s.prepend('y\n')

      const map = s.generateMap({
        includeContent: true,
      })

      assert.equal(map.mappings, ';AAAA;AACA')
    })

    it('should generate a correct sourcemap for indented content', () => {
      const s = new MagicString('var answer = 42;\nconsole.log("the answer is %s", answer);')

      s.prepend('\'use strict\';\n\n')
      s.indent('\t').prepend('(function () {\n').append('\n}).call(global);')

      const map = s.generateMap({
        source: 'input.md',
        includeContent: true,
        hires: true,
      })

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)

      const originLoc = smc.originalPositionFor({ line: 5, column: 1 })
      assert.equal(originLoc.line, 2)
      assert.equal(originLoc.column, 0)
    })

    it('should generate a correct sourcemap including correct lines', () => {
      const s = new MagicString('var answer = 42;\nconsole.log("the answer is %s", answer);')
      s.append('\n\n\n\n}).call(global);')
      assert.equal(
        // output lines
        s.toString().split('\n').length,
        // sourcemap lines
        s.generateDecodedMap().mappings.length,
      )
    })

    it('should generate a sourcemap using specified locations', () => {
      const s = new MagicString('abcdefghijkl')

      s.addSourcemapLocation(0)
      s.addSourcemapLocation(3)
      s.addSourcemapLocation(10)

      s.remove(6, 9)
      const map = s.generateMap({
        file: 'output.md',
        source: 'input.md',
        includeContent: true,
      })

      assert.equal(map.version, 3)
      assert.equal(map.file, 'output.md')
      assert.deepEqual(map.sources, ['input.md'])
      assert.deepEqual(map.sourcesContent, ['abcdefghijkl'])

      assert.equal(
        map.toString(),
        '{"version":3,"file":"output.md","sources":["input.md"],"sourcesContent":["abcdefghijkl"],"names":[],"mappings":"AAAA,GAAG,GAAM,CAAC"}',
      )
      assert.equal(
        map.toUrl(),
        'data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0Lm1kIiwic291cmNlcyI6WyJpbnB1dC5tZCJdLCJzb3VyY2VzQ29udGVudCI6WyJhYmNkZWZnaGlqa2wiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsR0FBRyxHQUFNLENBQUMifQ==',
      )

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      let loc

      loc = smc.originalPositionFor({ line: 1, column: 0 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 0)

      loc = smc.originalPositionFor({ line: 1, column: 3 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 3)

      loc = smc.originalPositionFor({ line: 1, column: 7 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 10)
    })

    it('should correctly map inserted content', () => {
      const s = new MagicString('function Foo () {}')

      s.overwrite(9, 12, 'Bar')

      const map = s.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
      })

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)

      const loc = smc.originalPositionFor({ line: 1, column: 9 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 9)
    })

    it('should yield consistent results between appendLeft and prependRight', () => {
      const s1 = new MagicString('abcdefghijkl')
      s1.appendLeft(6, 'X')

      const s2 = new MagicString('abcdefghijkl')
      s2.prependRight(6, 'X')

      const m1 = s1.generateMap({ file: 'output', source: 'input', includeContent: true })
      const m2 = s2.generateMap({ file: 'output', source: 'input', includeContent: true })

      assert.deepEqual(m1, m2)
    })

    it('should recover original names', () => {
      const s = new MagicString('function Foo () {}')

      s.overwrite(9, 12, 'Bar', { storeName: true })

      const map = s.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
      })

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)

      const loc = smc.originalPositionFor({ line: 1, column: 9 })
      assert.equal(loc.name, 'Foo')
    })

    it('should generate one segment per replacement', () => {
      const s = new MagicString('var answer = 42')
      s.overwrite(4, 10, 'number', { storeName: true })

      const map = s.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
      })

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)

      let numMappings = 0
      smc.eachMapping(() => (numMappings += 1))

      assert.equal(numMappings, 3) // one at 0, one at the edit, one afterwards
    })

    it('should recover names for multiline replacement content', () => {
      const s = new MagicString('function Foo () {}')

      s.overwrite(9, 12, 'Bar\nBaz', { storeName: true })

      const map = s.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
      })

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)

      const loc = smc.originalPositionFor({ line: 1, column: 9 })
      assert.equal(loc.name, 'Foo')
    })

    it('should generate a sourcemap that correctly locates moved content', () => {
      const s = new MagicString('abcdefghijkl')
      s.move(3, 6, 9)

      const result = s.toString()
      const map = s.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
        hires: true,
      })

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)

      'abcdefghijkl'.split('').forEach((letter, i) => {
        const column = result.indexOf(letter)
        const loc = smc.originalPositionFor({ line: 1, column })

        assert.equal(loc.line, 1)
        assert.equal(loc.column, i)
      })
    })

    it('generates a map with trimmed content (#53)', () => {
      const s1 = new MagicString('abcdefghijkl ').trim()
      const map1 = s1.generateMap({
        file: 'output',
        source: 'input',
        includeContent: true,
        hires: true,
      })

      const smc1 = new SourceMapConsumer(map1 as unknown as RawSourceMap)
      const loc1 = smc1.originalPositionFor({ line: 1, column: 11 })

      assert.equal(loc1.column, 11)

      const s2 = new MagicString(' abcdefghijkl').trim()
      const map2 = s2.generateMap({
        file: 'output',
        source: 'input',
        includeContent: true,
        hires: true,
      })

      const smc2 = new SourceMapConsumer(map2 as unknown as RawSourceMap)
      const loc2 = smc2.originalPositionFor({ line: 1, column: 1 })

      assert.equal(loc2.column, 2)
    })

    it('skips empty segments at the start', () => {
      const s = new MagicString('abcdefghijkl')
      s.remove(0, 3).remove(3, 6)

      const map = s.generateMap()
      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      const loc = smc.originalPositionFor({ line: 1, column: 6 })

      assert.equal(loc.column, 6)
    })

    it('skips indentation at the start', () => {
      const s = new MagicString('abcdefghijkl')
      s.indent('    ')

      const map = s.generateMap()
      assert.equal(map.mappings, 'IAAA')
    })

    it('generates x_google_ignoreList', () => {
      const s = new MagicString('function foo(){}', {
        ignoreList: true,
      })

      const map = s.generateMap({ source: 'foo.js' })
      assert.deepEqual(map.sources, ['foo.js'])
      assert.deepEqual(map.x_google_ignoreList, [0])
    })

    it('generates segments per word boundary with hires "boundary"', () => {
      const s = new MagicString('function foo(){ console.log("bar") }')

      // rename bar to hello
      s.overwrite(29, 32, 'hello')

      const map = s.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
        hires: 'boundary',
      })

      assert.equal(
        map.mappings,
        'AAAA,QAAQ,CAAC,GAAG,CAAC,CAAC,CAAC,CAAC,OAAO,CAAC,GAAG,CAAC,CAAC,KAAG,CAAC,CAAC,CAAC',
      )

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      let loc

      loc = smc.originalPositionFor({ line: 1, column: 3 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 0)

      loc = smc.originalPositionFor({ line: 1, column: 11 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 9)

      loc = smc.originalPositionFor({ line: 1, column: 29 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 29)

      loc = smc.originalPositionFor({ line: 1, column: 35 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 33)
    })

    it('generates segments per word boundary with hires "boundary" in the next line', () => {
      const s = new MagicString('// foo\nconsole.log("bar")')

      // rename bar to hello
      s.overwrite(20, 23, 'hello')

      const map = s.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
        hires: 'boundary',
      })

      assert.equal(map.mappings, 'AAAA,CAAC,CAAC,CAAC;AACH,OAAO,CAAC,GAAG,CAAC,CAAC,KAAG,CAAC')

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      let loc

      loc = smc.originalPositionFor({ line: 2, column: 2 })
      assert.equal(loc.line, 2)
      assert.equal(loc.column, 0)

      loc = smc.originalPositionFor({ line: 2, column: 12 })
      assert.equal(loc.line, 2)
      assert.equal(loc.column, 12)
    })

    it('generates segments per chunk with hires "experimental-range"', () => {
      const s = new MagicString('function foo(){ console.log("bar") }')

      // rename bar to hello
      s.overwrite(29, 32, 'hello')

      const options = {
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
        hires: 'experimental-range',
      } as const

      const decoded = s.generateDecodedMap(options)

      assert.deepEqual(decoded.mappings, [
        [
          [0, 0, 0, 0],
          [28, 0, 0, 28],
          [29, 0, 0, 29],
          [34, 0, 0, 32],
          [37, 0, 0, 35],
        ],
      ])
      assert.deepEqual(decoded.rangeMappings, [[0, 3]])

      const map = s.generateMap(options)

      assert.equal(
        map.mappings,
        'AAAA,4BAA4B,CAAC,KAAG,GAAG',
      )
      assert.equal(
        map.rangeMappings,
        'AD',
      )

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      let loc

      // FIXME: the consumer library doesn't support range mappings yet
      // loc = smc.originalPositionFor({ line: 1, column: 15 })
      // assert.equal(loc.line, 1)
      // assert.equal(loc.column, 15)

      loc = smc.originalPositionFor({ line: 1, column: 28 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 28)

      loc = smc.originalPositionFor({ line: 1, column: 29 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 29)

      loc = smc.originalPositionFor({ line: 1, column: 34 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 32)

      // FIXME: see above
      // loc = smc.originalPositionFor({ line: 1, column: 35 })
      // assert.equal(loc.line, 1)
      // assert.equal(loc.column, 33)
    })

    it('generates segments per chunk with hires "experimental-range" (multiple ranges on a line)', () => {
      const s = new MagicString('function foo(){ console.log("bar") }')

      // rename foo to baz, bar to hello
      s.overwrite(9, 12, 'baz')
      s.overwrite(29, 32, 'hello')

      const options = {
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
        hires: 'experimental-range',
      } as const

      const decoded = s.generateDecodedMap(options)

      assert.deepEqual(decoded.mappings, [
        [
          [0, 0, 0, 0],
          [8, 0, 0, 8],
          [9, 0, 0, 9],
          [12, 0, 0, 12],
          [28, 0, 0, 28],
          [29, 0, 0, 29],
          [34, 0, 0, 32],
          [37, 0, 0, 35],
        ],
      ])
      assert.deepEqual(decoded.rangeMappings, [[0, 3, 6]])

      const map = s.generateMap(options)

      assert.equal(
        map.mappings,
        'AAAA,QAAQ,CAAC,GAAG,gBAAgB,CAAC,KAAG,GAAG',
      )
      assert.equal(
        map.rangeMappings,
        'ADD',
      )

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      let loc

      // FIXME: the consumer library doesn't support range mappings yet
      // loc = smc.originalPositionFor({ line: 1, column: 15 })
      // assert.equal(loc.line, 1)
      // assert.equal(loc.column, 15)

      loc = smc.originalPositionFor({ line: 1, column: 28 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 28)

      loc = smc.originalPositionFor({ line: 1, column: 29 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 29)

      loc = smc.originalPositionFor({ line: 1, column: 34 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 32)

      // FIXME: see above
      // loc = smc.originalPositionFor({ line: 1, column: 35 })
      // assert.equal(loc.line, 1)
      // assert.equal(loc.column, 33)
    })

    it('generates segments per chunk with hires "experimental-range" in the next line', () => {
      const s = new MagicString('// foo\nconsole.log("bar")')

      // rename bar to hello
      s.overwrite(20, 23, 'hello')

      const options = {
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
        hires: 'experimental-range',
      } as const

      const decoded = s.generateDecodedMap(options)

      assert.deepEqual(decoded.mappings, [
        [
          [0, 0, 0, 0],
        ],
        [
          [12, 0, 1, 12],
          [13, 0, 1, 13],
          [18, 0, 1, 16],
          [19, 0, 1, 17],
        ],
      ])
      assert.deepEqual(decoded.rangeMappings, [[0], [2]])

      const map = s.generateMap(options)

      assert.equal(map.mappings, 'AAAA;YACY,CAAC,KAAG,CAAC')
      assert.equal(map.rangeMappings, 'A;C')

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      let loc

      // FIXME: the consumer library doesn't support range mappings yet
      // loc = smc.originalPositionFor({ line: 1, column: 2 })
      // assert.equal(loc.line, 1)
      // assert.equal(loc.column, 2)

      // loc = smc.originalPositionFor({ line: 2, column: 2 })
      // assert.equal(loc.line, 2)
      // assert.equal(loc.column, 2)

      loc = smc.originalPositionFor({ line: 2, column: 12 })
      assert.equal(loc.line, 2)
      assert.equal(loc.column, 12)

      loc = smc.originalPositionFor({ line: 2, column: 18 })
      assert.equal(loc.line, 2)
      assert.equal(loc.column, 16)

      loc = smc.originalPositionFor({ line: 2, column: 19 })
      assert.equal(loc.line, 2)
      assert.equal(loc.column, 17)
    })

    it('records hires "experimental-range" mappings on the line the range actually starts on', () => {
      const s = new MagicString('abcdef')

      s.overwrite(0, 2, 'X\nY')
      assert.equal(s.toString(), 'X\nYcdef')

      const decoded = s.generateDecodedMap({ hires: 'experimental-range' })

      assert.deepEqual(decoded.mappings, [
        [
          [0, 0, 0, 0],
        ],
        [
          [0, 0, 0, 0],
          [1, 0, 0, 2],
          [4, 0, 0, 5],
        ],
      ])
      assert.deepEqual(decoded.rangeMappings, [[], [1]])

      const map = s.generateMap({ hires: 'experimental-range' })
      assert.equal(map.mappings, 'AAAA;AAAA,CAAE,GAAG')
      assert.equal(map.rangeMappings, ';B')
    })

    it('does not flag a range terminator when a replacement contains a new line', () => {
      const s = new MagicString('abcdef')

      s.appendLeft(2, 'ZZZ')
      s.overwrite(2, 4, 'X\nY')
      assert.equal(s.toString(), 'abZZZX\nYef')

      const decoded = s.generateDecodedMap({ hires: 'experimental-range' })

      assert.deepEqual(decoded.mappings, [
        [
          [0, 0, 0, 0],
          [1, 0, 0, 1],
          [5, 0, 0, 2],
        ],
        [
          [0, 0, 0, 2],
          [1, 0, 0, 4],
          [2, 0, 0, 5],
        ],
      ])
      assert.deepEqual(decoded.rangeMappings, [[0], [1]])

      const map = s.generateMap({ hires: 'experimental-range' })

      assert.equal(map.mappings, 'AAAA,CAAC,IAAC;AAAA,CAAE,CAAC')
      assert.equal(map.rangeMappings, 'A;B')
    })

    it('generates a correct source map with update using a content containing a new line', () => {
      const s = new MagicString('foobar')
      s.update(3, 4, '\nbb')
      assert.equal(s.toString(), 'foo\nbbar')

      const map = s.generateMap({ hires: true })

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      const loc = smc.originalPositionFor({ line: 1, column: 3 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 3)
      const loc2 = smc.originalPositionFor({ line: 2, column: 0 })
      assert.equal(loc2.line, 1)
      assert.equal(loc2.column, 3)
      const loc3 = smc.originalPositionFor({ line: 2, column: 1 })
      assert.equal(loc3.line, 1)
      assert.equal(loc3.column, 3)
      const loc4 = smc.originalPositionFor({ line: 2, column: 2 })
      assert.equal(loc4.line, 1)
      assert.equal(loc4.column, 4)
    })

    it('generates a correct source map with update using content ending with a new line', () => {
      const s = new MagicString('foobar')
      s.update(2, 3, 'od\n')
      s.update(4, 5, 'a\nnd\n')
      assert.equal(s.toString(), 'food\nba\nnd\nr')

      const map = s.generateMap({ hires: true })
      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)

      // od\n
      const loc = smc.originalPositionFor({ line: 1, column: 3 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 2)
      const loc2 = smc.originalPositionFor({ line: 1, column: 4 })
      assert.equal(loc2.line, 1)
      assert.equal(loc2.column, 2)
      const loc3 = smc.originalPositionFor({ line: 2, column: 0 })
      assert.equal(loc3.line, 1)
      assert.equal(loc3.column, 3)
      const loc4 = smc.originalPositionFor({ line: 2, column: 1 })
      assert.equal(loc4.line, 1)
      assert.equal(loc4.column, 4)
      // a\nnd\n
      const loc5 = smc.originalPositionFor({ line: 2, column: 2 })
      assert.equal(loc5.line, 1)
      assert.equal(loc5.column, 4)
      const loc6 = smc.originalPositionFor({ line: 2, column: 3 })
      assert.equal(loc6.line, 1)
      assert.equal(loc6.column, 4)
      const loc7 = smc.originalPositionFor({ line: 3, column: 0 })
      assert.equal(loc7.line, 1)
      assert.equal(loc7.column, 4)
      const loc8 = smc.originalPositionFor({ line: 4, column: 0 })
      assert.equal(loc8.line, 1)
      assert.equal(loc8.column, 5)
    })

    it('generates a source map without unneeded line break mappings', () => {
      const s = new MagicString('function foo(){\n  console.log("bar")\n}')

      const map = s.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
        hires: 'boundary',
      })

      assert.equal(
        map.mappings,
        'AAAA,QAAQ,CAAC,GAAG,CAAC,CAAC;AACd,CAAC,CAAC,OAAO,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC;AACnB',
      )
    })

    it('generates the same mappings as encoding the decoded map, for every hires mode', () => {
      const hiresModes = [false, true, 'boundary', 'experimental-range'] as const

      for (const hires of hiresModes) {
        const s = new MagicString('function foo(a, b) {\n  return a + b\n}\nfoo(1, 2)\n')
        s.prepend('"use strict";\n')
        s.overwrite(9, 12, 'add', { storeName: true })
        s.update(23, 24, 'first\nvalue', { storeName: true })
        s.remove(36, 37)
        s.appendLeft(38, ' // sum')
        s.append('\nexport { foo }')
        s.addSourcemapLocation(41)
        s.addSourcemapLocation(45)

        const map = s.generateMap({ hires })
        const decoded = s.generateDecodedMap({ hires })

        assert.equal(map.mappings, encode(decoded.mappings), `hires: ${hires}`)
        assert.deepEqual(decoded.names, map.names, `hires: ${hires}`)
      }
    })

    it('generates correct mappings that are larger than the encoder buffer', () => {
      // one segment per character, far exceeding the 16KB encoder buffer
      const wide = new MagicString('a'.repeat(20000))
      assert.equal(
        wide.generateMap({ hires: true }).mappings,
        encode(wide.generateDecodedMap({ hires: true }).mappings),
      )

      // only line breaks, so the buffer fills up between segments
      const tall = new MagicString('\n'.repeat(20000))
      assert.equal(
        tall.generateMap({ hires: true }).mappings,
        encode(tall.generateDecodedMap({ hires: true }).mappings),
      )
    })
  })
})
