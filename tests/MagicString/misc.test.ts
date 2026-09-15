import { assert, describe, it } from 'vitest'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('isEmpty', () => {
    it('should support isEmpty', () => {
      const s = new MagicString(' abcde   fghijkl ')

      assert.equal(s.isEmpty(), false)

      s.prepend('  ')
      s.append('  ')
      s.remove(1, 6)
      s.remove(9, 15)

      assert.equal(s.isEmpty(), false)

      s.remove(15, 16)

      assert.equal(s.isEmpty(), true)
    })

    it('should count content appended or prepended to the string', () => {
      assert.equal(new MagicString('').append('X').isEmpty(), false)
      assert.equal(new MagicString('').prepend('Y').isEmpty(), false)

      const s = new MagicString('abc')
      s.remove(0, 3)
      s.append('!')
      assert.equal(s.toString(), '!')
      assert.equal(s.isEmpty(), false)
    })

    it('should still disregard whitespace appended or prepended to the string', () => {
      const s = new MagicString('').prepend('  ').append('   ')
      assert.equal(s.isEmpty(), true)
    })

    it('should disregard whitespace-only chunk intro/content/outro', () => {
      const s = new MagicString('   ')
      s.appendRight(0, ' ')
      s.appendLeft(3, ' ')
      assert.equal(s.isEmpty(), true)
    })

    it('should notice non-whitespace content in a chunk outro', () => {
      const s = new MagicString('abc')
      s.remove(0, 3)
      s.appendLeft(3, 'x')
      assert.equal(s.isEmpty(), false)
    })
  })

  describe('length', () => {
    it('should support length', () => {
      const s = new MagicString(' abcde   fghijkl ')

      assert.equal(s.length(), 17)

      s.prepend('  ')
      s.append('  ')
      s.remove(1, 6)
      s.remove(9, 15)

      assert.equal(s.length(), 6)

      s.remove(15, 16)

      assert.equal(s.length(), 5)
    })
  })

  describe('lastChar', () => {
    it('should return the last character of unmodified content', () => {
      const s = new MagicString('abc')
      assert.equal(s.lastChar(), 'c')
    })

    it('should return the last character of the global outro', () => {
      const s = new MagicString('abc')
      s.append('xyz')
      assert.equal(s.lastChar(), 'z')
    })

    it('should return the last character of a chunk outro', () => {
      const s = new MagicString('abc')
      s.appendLeft(3, 'xyz')
      assert.equal(s.lastChar(), 'z')
    })

    it('should return the last character of a chunk intro when content and outro are empty', () => {
      const s = new MagicString('abcdef')
      s.remove(3, 6)
      s.appendRight(3, 'xyz')
      assert.equal(s.lastChar(), 'z')
    })

    it('should return the last character of the global intro when there is nothing else', () => {
      const s = new MagicString('')
      s.prepend('xyz')
      assert.equal(s.lastChar(), 'z')
    })

    it('should return an empty string when there is no content at all', () => {
      const s = new MagicString('')
      assert.equal(s.lastChar(), '')
    })
  })

  describe('lastLine', () => {
    it('should support lastLine', () => {
      const s = new MagicString(' abcde\nfghijkl ')

      assert.equal(s.lastLine(), 'fghijkl ')

      s.prepend('  ')
      s.append('  ')
      s.remove(1, 6)
      s.remove(9, 15)

      assert.equal(s.lastLine(), 'fg  ')

      s.overwrite(7, 8, '\n')

      assert.equal(s.lastLine(), 'g  ')

      s.append('\n//lastline')

      assert.equal(s.lastLine(), '//lastline')
    })

    it('should return the tail of a chunk outro that contains a newline', () => {
      const s = new MagicString('abcdef')
      s.remove(0, 3)
      s.appendLeft(3, 'X\nY')
      assert.equal(s.lastLine(), 'Ydef')
    })

    it('should accumulate a chunk outro that has no newline', () => {
      const s = new MagicString('abcdef')
      s.remove(0, 3)
      s.appendLeft(3, 'XY')
      assert.equal(s.lastLine(), 'XYdef')
    })

    it('should return the tail of a chunk intro that contains a newline', () => {
      const s = new MagicString('abcdef')
      s.remove(3, 6)
      s.appendRight(3, 'X\nY')
      assert.equal(s.lastLine(), 'Y')
    })

    it('should accumulate a chunk intro that has no newline', () => {
      const s = new MagicString('abcdef')
      s.remove(3, 6)
      s.appendRight(3, 'XY')
      assert.equal(s.lastLine(), 'abcXY')
    })

    it('should return the tail of a global intro that contains a newline', () => {
      const s = new MagicString('')
      s.prepend('P\nQ')
      assert.equal(s.lastLine(), 'Q')
    })
  })

  describe('hasChanged', () => {
    it('should works', () => {
      const s = new MagicString(' abcde   fghijkl ')

      assert.ok(!s.hasChanged())

      assert.ok(s.clone().prepend('  ').hasChanged())
      assert.ok(s.clone().overwrite(1, 2, 'b').hasChanged())
      assert.ok(s.clone().remove(1, 6).hasChanged())

      s.trim()

      assert.ok(s.hasChanged())

      const clone = s.clone()

      assert.ok(clone.hasChanged())
    })

    it('should return false when edited content is identical to the original', () => {
      const s = new MagicString('abcdef')

      s.overwrite(0, 6, 'abcdef')
      assert.ok(!s.hasChanged())

      const t = new MagicString('abcdef')

      t.update(2, 4, 'cd')
      assert.ok(!t.hasChanged())
    })

    it('should return false when an edit spanning several chunks restores the original', () => {
      // `appendLeft` splits the chunk at 3, so the overwrite that follows
      // covers two chunks: the whole replacement lands on the first one and
      // the second is emptied
      const s = new MagicString('abcdefghij')

      s.appendLeft(3, '')
      s.overwrite(0, 5, 'abcde')
      assert.equal(s.toString(), 'abcdefghij')
      assert.ok(!s.hasChanged())

      // the same thing without an explicit split: the second overwrite spans
      // the chunk boundary left behind by the first
      const t = new MagicString('abcdefghij')

      t.overwrite(2, 6, 'cdef')
      t.overwrite(2, 7, 'cdefg')
      assert.equal(t.toString(), 'abcdefghij')
      assert.ok(!t.hasChanged())
    })

    it('should return false after reset reverts the edits', () => {
      const s = new MagicString('abcdef')

      s.remove(1, 3)
      assert.ok(s.hasChanged())

      s.reset(1, 3)
      assert.ok(!s.hasChanged())
    })

    it('should return true when content is only moved', () => {
      const s = new MagicString('abcdef')

      s.move(0, 2, 6)
      assert.ok(s.hasChanged())
    })

    it('should return true when content is inserted without changing existing characters', () => {
      const s = new MagicString('abcdef')

      s.appendLeft(3, '/* comment */')
      assert.ok(s.hasChanged())

      const t = new MagicString('abcdef')

      t.append(' // end')
      assert.ok(t.hasChanged())
    })

    it('should return true when trailing content is removed (chain no longer spans the original)', () => {
      const s = new MagicString('abcdef')

      s.remove(3, 6)
      assert.ok(s.hasChanged())
    })
  })
})
