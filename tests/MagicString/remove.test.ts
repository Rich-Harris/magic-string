import { assert, describe, it } from 'vitest'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('remove', () => {
    it('should remove characters from the original string', () => {
      const s = new MagicString('abcdefghijkl')

      s.remove(1, 5)
      assert.equal(s.toString(), 'afghijkl')

      s.remove(9, 12)
      assert.equal(s.toString(), 'afghi')
    })

    it('should remove from the start', () => {
      const s = new MagicString('abcdefghijkl')

      s.remove(0, 6)
      assert.equal(s.toString(), 'ghijkl')
    })

    it('should remove from the end', () => {
      const s = new MagicString('abcdefghijkl')

      s.remove(6, 12)
      assert.equal(s.toString(), 'abcdef')
    })

    it('should treat zero-length removals as a no-op', () => {
      const s = new MagicString('abcdefghijkl')

      s.remove(0, 0).remove(6, 6).remove(9, -3)
      assert.equal(s.toString(), 'abcdefghijkl')
    })

    it('should remove overlapping ranges', () => {
      const s1 = new MagicString('abcdefghijkl')

      s1.remove(3, 7).remove(5, 9)
      assert.equal(s1.toString(), 'abcjkl')

      const s2 = new MagicString('abcdefghijkl')

      s2.remove(3, 7).remove(4, 6)
      assert.equal(s2.toString(), 'abchijkl')
    })

    it('should remove overlapping ranges, redux', () => {
      const s = new MagicString('abccde')

      s.remove(2, 3) // c
      s.remove(1, 3) // bc
      assert.equal(s.toString(), 'acde')
    })

    it('should remove modified ranges', () => {
      const s = new MagicString('abcdefghi')

      s.overwrite(3, 6, 'DEF')
      s.remove(2, 7) // cDEFg
      assert.equal(s.slice(1, 8), 'bh')
      assert.equal(s.toString(), 'abhi')
    })

    it('should not remove content inserted after the end of removed range', () => {
      const s = new MagicString('ab.c;')

      s.prependRight(0, '(')
      s.prependRight(4, ')')
      s.remove(2, 4)
      assert.equal(s.toString(), '(ab);')
    })

    it('should remove interior inserts', () => {
      const s = new MagicString('abcde;')

      s.appendLeft(2, '[')
      assert.equal(s.toString(), 'ab[cde;')
      s.prependRight(2, '(')
      assert.equal(s.toString(), 'ab[(cde;')
      s.appendLeft(4, ')')
      assert.equal(s.toString(), 'ab[(cd)e;')
      s.prependRight(4, ']')
      assert.equal(s.toString(), 'ab[(cd)]e;')
      s.remove(1, 5)
      assert.equal(s.toString(), 'a;')
    })

    it('should preserve inserts anchored to the edges of the removed range', () => {
      const s = new MagicString('abc;')

      s.appendLeft(1, '[')
      s.prependRight(1, '(')
      s.appendLeft(2, ')')
      s.prependRight(2, ']')
      s.remove(1, 2)
      assert.equal(s.toString(), 'a[()]c;')
    })

    it('should preserve content appended at the edge of a removed range (#282)', () => {
      const s = new MagicString(
        '.prose pre{--at-apply:text-sm;--at-apply:p-5;--at-apply:p-6;}',
      )

      s.appendRight(45, 'padding:1.25rem;')
      assert.equal(
        s.toString(),
        '.prose pre{--at-apply:text-sm;--at-apply:p-5;padding:1.25rem;--at-apply:p-6;}',
      )

      s.remove(30, 45)

      assert.equal(
        s.toString(),
        '.prose pre{--at-apply:text-sm;padding:1.25rem;--at-apply:p-6;}',
      )

      s.appendRight(60, 'padding:1.5rem;')
      assert.equal(
        s.toString(),
        '.prose pre{--at-apply:text-sm;padding:1.25rem;--at-apply:p-6;padding:1.5rem;}',
      )

      s.remove(45, 60)
      assert.equal(
        s.toString(),
        '.prose pre{--at-apply:text-sm;padding:1.25rem;padding:1.5rem;}',
      )
    })

    it('should provide a useful error when illegal removals are attempted', () => {
      const s = new MagicString('abcdefghijkl')

      s.overwrite(5, 7, 'XX')

      assert.throws(() => s.remove(4, 6), /cannot split a chunk that has already been edited/)
    })

    it('should return this', () => {
      const s = new MagicString('abcdefghijkl')
      assert.strictEqual(s.remove(3, 4), s)
    })

    it('removes across moved content', () => {
      const s = new MagicString('abcdefghijkl')

      s.move(6, 9, 3)
      s.remove(5, 7)

      assert.equal(s.toString(), 'abchidejkl')
    })

    it('should accept negative indices', () => {
      const s = new MagicString('abcde')
      // "abcde"
      //     ^
      s.remove(-2, -1)
      assert.equal(s.toString(), 'abce')
    })

    it('should throw error when using negative indices with empty string', () => {
      const s = new MagicString('')
      assert.throws(() => s.remove(-2, -1), /out of bounds/)
    })

    it('should report the resolved indices when a negative start lands past end', () => {
      const s = new MagicString('problems = 99')
      // -1 resolves to 12, which is past `end`
      assert.throws(() => s.remove(-1, 5), /end must be greater than start \(start: 12, end: 5\)/)
    })
  })
})
