import { assert, describe, it } from 'vitest'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('reset', () => {
    it('should reset moved characters from the original string', () => {
      const s = new MagicString('abcdefghijkl')

      s.remove(1, 5)
      s.reset(2, 4)
      assert.equal(s.toString(), 'acdfghijkl')

      s.reset(4, 5)
      assert.equal(s.toString(), 'acdefghijkl')
    })

    it('should reset from the start', () => {
      const s = new MagicString('abcdefghijkl')

      s.remove(0, 6)
      s.reset(0, 3)
      assert.equal(s.toString(), 'abcghijkl')
    })

    it('should reset from the end', () => {
      const s = new MagicString('abcdefghijkl')

      s.remove(6, 12)
      s.reset(10, 12)
      assert.equal(s.toString(), 'abcdefkl')
    })

    it('should treat zero-length resets as a no-op', () => {
      const s = new MagicString('abcdefghijkl')

      s.remove(3, 5)
      s.reset(0, 0).reset(6, 6).reset(9, -3)
      assert.equal(s.toString(), 'abcfghijkl')
    })

    it('should treat a zero-length reset on an empty string as a no-op', () => {
      const s = new MagicString('')
      assert.equal(s.reset(0, 0).toString(), '')
    })

    it('should treat not modified resets as a no-op', () => {
      const s = new MagicString('abcdefghijkl')

      s.reset(3, 5)
      assert.equal(s.toString(), 'abcdefghijkl')
    })

    it('should throw when the range is out of bounds', () => {
      const s = new MagicString('abcdefghijkl')
      assert.throws(() => s.reset(0, 99), /out of bounds/)
    })

    it('should throw when start is greater than end', () => {
      const s = new MagicString('abcdefghijkl')
      assert.throws(() => s.reset(9, 5), /end must be greater than start/)
    })

    it('should reset overlapping ranges', () => {
      const s1 = new MagicString('abcdefghijkl')

      s1.remove(0, 10)
      s1.reset(1, 7).reset(5, 9)
      assert.equal(s1.toString(), 'bcdefghikl')

      const s2 = new MagicString('abcdefghijkl')

      s2.remove(0, 10)
      s2.reset(3, 7).reset(4, 6)
      assert.equal(s2.toString(), 'defgkl')
    })

    it('should reset overlapping ranges, redux', () => {
      const s = new MagicString('abccde')

      s.remove(0, 6)
      s.reset(2, 3) // c
      s.reset(1, 3) // bc
      assert.equal(s.toString(), 'bc')
    })

    it('should reset modified ranges', () => {
      const s = new MagicString('abcdefghi')

      s.overwrite(3, 6, 'DEF')
      s.remove(1, 8) // bcDEFgh
      s.reset(2, 7) // cDEFg
      assert.equal(s.slice(1, 8), 'cdefg')
      assert.equal(s.toString(), 'acdefgi')
    })

    it('should reset modified ranges, redux', () => {
      const s = new MagicString('abcdefghi')

      s.remove(1, 8)
      s.appendLeft(2, 'W')
      s.appendRight(2, 'X')
      s.prependLeft(3, 'Y')
      s.prependRight(5, 'Z')
      s.reset(2, 7)
      assert.equal(s.toString(), 'aWcdefgi')
    })

    it('should not reset content inserted after the end of range', () => {
      const s = new MagicString('ab.c;')

      s.prependRight(0, '(')
      s.prependRight(4, ')')
      s.remove(1, 4)
      s.reset(2, 4)
      assert.equal(s.toString(), '(a.c);')
    })

    it('should provide a useful error when illegal removals are attempted', () => {
      const s = new MagicString('abcdefghijkl')

      s.remove(4, 8)

      s.overwrite(5, 7, 'XX')

      assert.throws(() => s.reset(4, 6), /cannot split a chunk that has already been edited/)
    })

    it('should return this', () => {
      const s = new MagicString('abcdefghijkl')
      s.remove(2, 5)
      assert.strictEqual(s.reset(3, 4), s)
    })

    it('removes across moved content', () => {
      const s = new MagicString('abcdefghijkl')

      s.remove(5, 8)
      s.move(6, 9, 3)
      s.reset(7, 8)

      assert.equal(s.toString(), 'abchidejkl')
    })
  })
})
