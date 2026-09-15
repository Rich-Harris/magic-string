import type { RawSourceMap } from 'source-map-js'
import { SourceMapConsumer } from 'source-map-js'
import { assert, describe, it } from 'vitest'
import { Bundle, MagicString } from '../../src/index.ts'
import { IntegrityCheckingMagicString } from '../__utils/IntegrityCheckingMagicString.ts'

// The flattened result is a plain MagicString, so borrow the integrity checker's
// walk to assert the rebuilt chunk list stays consistent.
function assertIntegrity(s: MagicString): void {
  const flat = s as unknown as IntegrityCheckingMagicString
  Object.setPrototypeOf(flat, IntegrityCheckingMagicString.prototype)
  flat.checkIntegrity()
}

describe('bundle', () => {
  describe('toMagicString', () => {
    it('returns a MagicString whose output matches the bundle', () => {
      const b = new Bundle()
      b.addSource(new MagicString('abc'))
      b.addSource(new MagicString('def'))

      const flat = b.toMagicString()

      assert.instanceOf(flat, MagicString)
      assert.strictEqual(flat.toString(), b.toString())
      assert.strictEqual(flat.toString(), 'abc\ndef')
      assert.strictEqual(flat.original, 'abcdef')
      assertIntegrity(flat)
    })

    it('honours a custom separator', () => {
      const b = new Bundle({ separator: '==' })
      b.addSource(new MagicString('abc'))
      b.addSource(new MagicString('def'))

      assert.strictEqual(b.toMagicString().toString(), 'abc==def')
    })

    it('preserves edits made on the sources', () => {
      const a = new MagicString('var answer = 42;')
      a.overwrite(4, 10, 'result')
      const c = new MagicString('console.log( answer );')
      c.remove(0, 8)

      const b = new Bundle()
      b.addSource(a)
      b.addSource(c)

      const flat = b.toMagicString()
      assert.strictEqual(flat.toString(), b.toString())
      assert.strictEqual(flat.toString(), 'var result = 42;\nlog( answer );')
      assertIntegrity(flat)
    })

    it('preserves bundle intro/prepend/append and source intro/outro', () => {
      const a = new MagicString('abc')
      a.prepend('[').append(']')
      const b = new Bundle({ intro: '// head\n' })
      b.addSource(a)
      b.addSource(new MagicString('def'))
      b.prepend('/* top */\n')
      b.append('\n// tail')

      const flat = b.toMagicString()
      assert.strictEqual(flat.toString(), b.toString())
      assertIntegrity(flat)
    })

    it('folds empty sources into the surrounding inserted text', () => {
      const b = new Bundle()
      b.addSource(new MagicString(''))
      b.addSource(new MagicString('abc'))
      b.addSource(new MagicString(''))
      b.addSource(new MagicString('def'))
      b.addSource(new MagicString(''))

      const flat = b.toMagicString()
      assert.strictEqual(flat.toString(), b.toString())
      assert.strictEqual(flat.original, 'abcdef')
      assertIntegrity(flat)
    })

    it('handles a bundle with no sources', () => {
      const b = new Bundle({ intro: 'only intro' })
      const flat = b.toMagicString()
      assert.strictEqual(flat.toString(), 'only intro')
      assert.strictEqual(flat.original, '')
      assertIntegrity(flat)
    })

    it('handles a bundle whose sources are all empty', () => {
      const b = new Bundle()
      b.append('a')
      b.append('b')
      const flat = b.toMagicString()
      assert.strictEqual(flat.toString(), b.toString())
      assert.strictEqual(flat.toString(), 'ab')
      assertIntegrity(flat)
    })

    it('supports further processing of the flattened string', () => {
      const b = new Bundle()
      b.addSource(new MagicString('abc'))
      b.addSource(new MagicString('def'))

      const flat = b.toMagicString()
      flat.prepend('<').append('>')
      flat.overwrite(0, 3, 'ABC')
      flat.appendLeft(6, '!')

      assert.strictEqual(flat.toString(), '<ABC\ndef!>')
      assertIntegrity(flat)
    })

    it('keeps a sourcemap that maps back to the combined original', () => {
      const a = new MagicString('var answer = 42;')
      a.overwrite(4, 10, 'result')
      const b = new Bundle()
      b.addSource(a)
      b.addSource(new MagicString('console.log( answer );'))

      const flat = b.toMagicString()
      const map = flat.generateMap({ hires: true, includeContent: true })

      assert.deepEqual(map.sourcesContent, ['var answer = 42;console.log( answer );'])

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)

      // "result" on line 1 maps back to the "answer" it replaced
      const overwritten = smc.originalPositionFor({ line: 1, column: 4 })
      assert.equal(overwritten.line, 1)
      assert.equal(overwritten.column, 4)

      // the second source lands on line 2 of the output but shares the one source
      const secondSource = smc.originalPositionFor({ line: 2, column: 0 })
      assert.equal(secondSource.line, 1)
      assert.equal(secondSource.column, 16)
    })

    it('carries stored names into the flattened names array', () => {
      const a = new MagicString('var answer = 42;')
      a.overwrite(4, 10, 'result', { storeName: true })
      const b = new Bundle()
      b.addSource(a)

      const map = b.toMagicString().generateMap()
      assert.deepEqual(map.names, ['answer'])
    })

    it('preserves per-source sourcemap locations', () => {
      const a = new MagicString('var answer = 42;')
      a.addSourcemapLocation(4)
      const c = new MagicString('console.log( answer );')
      c.addSourcemapLocation(8)
      const b = new Bundle()
      b.addSource(a)
      b.addSource(c)

      const map = b.toMagicString().generateMap() // lo-res

      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)
      // the added location on the second source lands at output line 2, column 8
      const loc = smc.originalPositionFor({ line: 2, column: 8 })
      assert.equal(loc.line, 1)
      assert.equal(loc.column, 24) // 16 (first source) + 8
    })

    it('flattens sources that have moved chunks', () => {
      const a = new MagicString('abcdef')
      a.move(0, 3, 6)
      const b = new Bundle()
      b.addSource(a)
      b.addSource(new MagicString('xyz'))

      const flat = b.toMagicString()
      assert.strictEqual(flat.toString(), b.toString())
      assert.strictEqual(flat.toString(), 'defabc\nxyz')
      assertIntegrity(flat)
    })

    it('keeps move() cycle-safety after flattening a moved source', () => {
      const a = new MagicString('abcdefgh')
      a.move(0, 2, 8) // reorders the chunk list to 'cdefghab'
      const b = new Bundle()
      b.addSource(a)

      const flat = b.toMagicString()
      assert.strictEqual(flat.toString(), 'cdefghab')

      // the reordered list must keep `hasMovedChunks` set so move()'s safety walk
      // still fires, rather than splicing the chunk list into a cycle
      assert.throws(() => flat.move(0, 4, 8), /earlier move split that range/)
    })
  })
})
