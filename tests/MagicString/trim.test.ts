import { assert, describe, it } from 'vitest'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('trim', () => {
    it('should trim whitespace appended after the content', () => {
      const s = new MagicString('abc')
      s.append('  ')
      s.trimEnd()
      assert.equal(s.toString(), 'abc')
    })

    it('should trim whitespace prepended before the content', () => {
      const s = new MagicString('abc')
      s.prepend('  ')
      s.trimStart()
      assert.equal(s.toString(), 'abc')
    })

    it('should abort trimEnd when the global outro still has content after trimming', () => {
      const s = new MagicString('abc')
      s.append(' x ')
      s.trimEnd()
      assert.equal(s.toString(), 'abc x')
    })

    it('should abort trimStart when the global intro still has content after trimming', () => {
      const s = new MagicString('abc')
      s.prepend(' x ')
      s.trimStart()
      assert.equal(s.toString(), 'x abc')
    })

    it('should carry trimStart into the global outro when nothing comes before it', () => {
      const s = new MagicString('   ')
      s.append(' x ')
      s.trimStart()
      assert.equal(s.toString(), 'x ')
    })

    it('should carry trimEnd into the global intro when nothing comes after it', () => {
      const s = new MagicString('   ')
      s.prepend(' x ')
      s.trimEnd()
      assert.equal(s.toString(), ' x')
    })

    it('should trim original content', () => {
      assert.equal(new MagicString('   abcdefghijkl   ').trim().toString(), 'abcdefghijkl')
      assert.equal(new MagicString('   abcdefghijkl').trim().toString(), 'abcdefghijkl')
      assert.equal(new MagicString('abcdefghijkl   ').trim().toString(), 'abcdefghijkl')
    })

    it('should trim replaced content', () => {
      const s = new MagicString('abcdefghijkl')

      s.overwrite(0, 3, '   ').overwrite(9, 12, '   ').trim()
      assert.equal(s.toString(), 'defghi')
    })

    it('should trim replaced content with end space', () => {
      const s = new MagicString('  test  ')
      s.overwrite(2, 6, 'abcd  ')
      s.trimEnd()
      assert.equal(s.toString(), '  abcd')
    })

    it('should trim replaced content with start space', () => {
      const s = new MagicString('  test  ')
      s.overwrite(0, 6, '  abcd')
      s.trimStart()
      assert.equal(s.toString(), 'abcd  ')
    })

    it('should trim fully replaced content with surrounding space', () => {
      const s = new MagicString('  test  ')
      s.overwrite(0, 8, '  abcd  ')
      s.trim()
      assert.equal(s.toString(), 'abcd')
    })

    it('should trim a replacement that is longer than the range it replaces', () => {
      const s = new MagicString('ab')
      s.overwrite(0, 1, '   xyz')
      s.trimStart()

      assert.equal(s.toString(), 'xyzb')

      for (const line of s.generateDecodedMap({ source: 'in.js' }).mappings) {
        for (const segment of line) {
          if (segment.length > 1) {
            assert.ok(segment[1]! >= 0 && segment[2]! >= 0 && segment[3]! >= 0, `segment ${JSON.stringify(segment)} points outside the original`)
          }
        }
      }
    })

    it('should trim the end of a replacement that is longer than the range it replaces', () => {
      const s = new MagicString('ab')
      s.overwrite(1, 2, 'xyz   ')
      s.trimEnd()

      assert.equal(s.toString(), 'axyz')
      assert.equal(s.slice(0, 2), 'axyz')
    })

    it('should trim original content before replaced content', () => {
      const s = new MagicString('abc   def')

      s.remove(6, 9)
      assert.equal(s.toString(), 'abc   ')

      s.trim()
      assert.equal(s.toString(), 'abc')
    })

    it('should trim original content after replaced content', () => {
      const s = new MagicString('abc   def')

      s.remove(0, 3)
      assert.equal(s.toString(), '   def')

      s.trim()
      assert.equal(s.toString(), 'def')
    })

    it('should trim original content before and after replaced content', () => {
      const s = new MagicString('abc   def   ghi')

      s.remove(0, 3)
      s.remove(12, 15)
      assert.equal(s.toString(), '   def   ')

      s.trim()
      assert.equal(s.toString(), 'def')
    })

    it('should trim appended/prepended content', () => {
      const s = new MagicString(' abcdefghijkl ')

      s.prepend('  ').append('  ').trim()
      assert.equal(s.toString(), 'abcdefghijkl')
    })

    it('should trim empty string', () => {
      const s = new MagicString('   ')

      assert.equal(s.trim().toString(), '')
    })

    it('should return this', () => {
      const s = new MagicString('  abcdefghijkl  ')
      assert.strictEqual(s.trim(), s)
    })

    it('should support trimming chunks with intro and outro', () => {
      const s = new MagicString('    \n')
      s.appendRight(4, 'test')
      assert.strictEqual(s.trim().toString(), 'test')
    })
  })

  describe('trimLines', () => {
    it('should trim original content', () => {
      const s = new MagicString('\n\n   abcdefghijkl   \n\n')

      s.trimLines()
      assert.equal(s.toString(), '   abcdefghijkl   ')
    })
  })
})
