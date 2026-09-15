import { assert, describe, it } from 'vitest'
import { MagicStringError } from '../../src/index.ts'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('update', () => {
    it('should replace characters', () => {
      const s = new MagicString('abcdefghijkl')

      s.update(5, 8, 'FGH')
      assert.equal(s.toString(), 'abcdeFGHijkl')
    })

    it('should throw an error if overlapping replacements are attempted', () => {
      const s = new MagicString('abcdefghijkl')

      s.update(7, 11, 'xx')

      assert.throws(
        () => s.update(8, 12, 'yy'),
        /cannot split a chunk that has already been edited/,
      )

      assert.equal(s.toString(), 'abcdefgxxl')

      s.update(6, 12, 'yes')
      assert.equal(s.toString(), 'abcdefyes')
    })

    it('should allow contiguous but non-overlapping replacements', () => {
      const s = new MagicString('abcdefghijkl')

      s.update(3, 6, 'DEF')
      assert.equal(s.toString(), 'abcDEFghijkl')

      s.update(6, 9, 'GHI')
      assert.equal(s.toString(), 'abcDEFGHIjkl')

      s.update(0, 3, 'ABC')
      assert.equal(s.toString(), 'ABCDEFGHIjkl')

      s.update(9, 12, 'JKL')
      assert.equal(s.toString(), 'ABCDEFGHIJKL')
    })

    it('does not replace zero-length inserts at update start location', () => {
      const s = new MagicString('abcdefghijkl')

      s.remove(0, 6)
      s.appendLeft(6, 'DEF')
      s.update(6, 9, 'GHI')
      assert.equal(s.toString(), 'DEFGHIjkl')
    })

    it('replaces zero-length inserts inside update with overwrite option', () => {
      const s = new MagicString('abcdefghijkl')

      s.appendLeft(6, 'XXX')
      s.update(3, 9, 'DEFGHI', { overwrite: true })
      assert.equal(s.toString(), 'abcDEFGHIjkl')
    })

    it('replaces non-zero-length inserts inside update', () => {
      const s = new MagicString('abcdefghijkl')

      s.update(3, 4, 'XXX')
      s.update(3, 5, 'DE')
      assert.equal(s.toString(), 'abcDEfghijkl')

      s.update(7, 8, 'YYY')
      s.update(6, 8, 'GH')
      assert.equal(s.toString(), 'abcDEfGHijkl')
    })

    it('should return this', () => {
      const s = new MagicString('abcdefghijkl')
      assert.strictEqual(s.update(3, 4, 'D'), s)
    })

    it('should disallow updating zero-length ranges', () => {
      const s = new MagicString('x')
      assert.throws(
        () => s.update(0, 0, 'anything'),
        /cannot overwrite a zero-length range/,
      )
    })

    it('should throw when given non-string content', () => {
      const s = new MagicString('')
      // @ts-expect-error runtime validation is the subject of this test
      assert.throws(() => s.update(0, 1, []), MagicStringError)
    })

    it('should throw when start is greater than end', () => {
      const s = new MagicString('problems = 99')
      assert.throws(() => s.update(9, 5, 'x'), /end must be greater than start \(start: 9, end: 5\)/)
    })

    it('should report the resolved indices when a negative start lands past end', () => {
      const s = new MagicString('problems = 99')
      // -1 resolves to 12, which is past `end`
      assert.throws(() => s.update(-1, 5, 'x'), /end must be greater than start \(start: 12, end: 5\)/)
    })

    it('should throw error when using negative indices with empty string', () => {
      const s = new MagicString('')
      assert.throws(() => s.update(-2, -1, 'x'), /out of bounds/)
    })

    it('should throw when end is greater than the original string length', () => {
      const s = new MagicString('abc')
      assert.throws(() => s.update(0, 4, 'x'), /end 4 is out of bounds/)
    })

    it('should resolve a negative end index relative to the string length', () => {
      const s = new MagicString('abcdefghijkl')
      s.update(9, -1, 'XYZ')
      assert.equal(s.toString(), 'abcdefghiXYZl')
    })

    it('should warn and treat `true` as legacy storeName option', () => {
      const s = new MagicString('abcdefghijkl')
      const warn = console.warn
      let warned = false
      console.warn = () => {
        warned = true
      }
      try {
        s.update(3, 4, 'D', true)
      }
      finally {
        console.warn = warn
      }
      assert.equal(warned, true)
      assert.equal(s.toString(), 'abcDefghijkl')
    })

    it('does not warn again for `true` once it already has', () => {
      const s = new MagicString('abcdefghijkl')
      const warn = console.warn
      let warnCount = 0
      console.warn = () => {
        warnCount += 1
      }
      try {
        // the deprecation warning was already emitted by the previous test
        s.update(6, 7, 'G', true)
      }
      finally {
        console.warn = warn
      }
      assert.equal(warnCount, 0)
      assert.equal(s.toString(), 'abcdefGhijkl')
    })

    it('replaces interior inserts with overwrite option', () => {
      const s = new MagicString('abcdefghijkl')

      s.appendLeft(1, '&')
      s.prependRight(1, '^')
      s.appendLeft(3, '!')
      s.prependRight(3, '?')
      s.update(1, 3, '...', { overwrite: true })
      assert.equal(s.toString(), 'a&...?defghijkl')
    })

    it('preserves interior inserts with `contentOnly: true`', () => {
      const s = new MagicString('abcdefghijkl')

      s.appendLeft(1, '&')
      s.prependRight(1, '^')
      s.appendLeft(3, '!')
      s.prependRight(3, '?')
      // @ts-expect-error legacy runtime option retained for compatibility
      s.update(1, 3, '...', { contentOnly: true })
      assert.equal(s.toString(), 'a&^...!?defghijkl')
    })

    it('disallows overwriting partially overlapping moved content', () => {
      const s = new MagicString('abcdefghijkl')

      s.move(6, 9, 3)
      assert.throws(() => s.update(5, 7, 'XX'), /cannot overwrite across a split point/)
    })

    it('disallows overwriting fully surrounding content moved away', () => {
      const s = new MagicString('abcdefghijkl')

      s.move(6, 9, 3)
      assert.throws(() => s.update(4, 11, 'XX'), /cannot overwrite across a split point/)
    })

    it('disallows overwriting fully surrounding content moved away even if there is another split', () => {
      const s = new MagicString('abcdefghijkl')

      s.move(6, 9, 3)
      s.appendLeft(5, 'foo')
      assert.throws(() => s.update(4, 11, 'XX'), /cannot overwrite across a split point/)
    })

    it('allows later insertions at the end with overwrite option', () => {
      const s = new MagicString('abcdefg')

      s.appendLeft(4, '(')
      s.update(2, 7, '', { overwrite: true })
      s.appendLeft(7, 'h')
      assert.equal(s.toString(), 'abh')
    })
  })
})
