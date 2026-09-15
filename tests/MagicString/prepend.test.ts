import { assert, describe, it } from 'vitest'
import { MagicStringError } from '../../src/index.ts'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('prepend', () => {
    it('should prepend content', () => {
      const s = new MagicString('abcdefghijkl')

      s.prepend('xyz')
      assert.equal(s.toString(), 'xyzabcdefghijkl')

      s.prepend('123')
      assert.equal(s.toString(), '123xyzabcdefghijkl')
    })

    it('should return this', () => {
      const s = new MagicString('abcdefghijkl')
      assert.strictEqual(s.prepend('xyz'), s)
    })

    it('should throw when given non-string content', () => {
      const s = new MagicString('abcdefghijkl')
      // @ts-expect-error runtime validation is the subject of this test
      assert.throws(() => s.prepend([]), MagicStringError)
    })
  })

  describe('prependLeft', () => {
    it('should return this', () => {
      const s = new MagicString('abcdefghijkl')
      assert.strictEqual(s.prependLeft(0, 'a'), s)
    })

    it('should throw when given non-string content', () => {
      const s = new MagicString('abcdefghijkl')
      // @ts-expect-error runtime validation is the subject of this test
      assert.throws(() => s.prependLeft(0, []), MagicStringError)
    })
  })

  describe('prependRight', () => {
    it('should return this', () => {
      const s = new MagicString('abcdefghijkl')
      assert.strictEqual(s.prependRight(0, 'a'), s)
    })

    it('should throw when given non-string content', () => {
      const s = new MagicString('abcdefghijkl')
      // @ts-expect-error runtime validation is the subject of this test
      assert.throws(() => s.prependRight(0, []), MagicStringError)
    })
  })
})
