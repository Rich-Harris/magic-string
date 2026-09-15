import { assert, describe, it } from 'vitest'
import { Bundle } from '../../src/index.ts'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('bundle', () => {
  describe('trim', () => {
    it('should trim bundle', () => {
      const b = new Bundle()

      b.addSource({
        content: new MagicString('   abcdef   '),
      })

      b.addSource({
        content: new MagicString('   ghijkl   '),
      })

      b.trim()
      assert.equal(b.toString(), 'abcdef   \n   ghijkl')
    })

    it('should handle funky edge cases', () => {
      const b = new Bundle()

      b.addSource({
        content: new MagicString('   abcdef   '),
      })

      b.addSource({
        content: new MagicString('   x   '),
      })

      b.prepend('\n>>>\n').append('   ')

      b.trim()
      assert.equal(b.toString(), '>>>\n   abcdef   \n   x')
    })

    it('should return this', () => {
      const b = new Bundle()
      assert.strictEqual(b.trim(), b)
    })

    it('should trim a whitespace separator', () => {
      const b = new Bundle()

      b.addSource({ content: new MagicString('   ') })
      b.addSource({ content: new MagicString('   abc') })

      b.trimStart()
      assert.equal(b.toString(), 'abc')
    })

    it('should trim a whitespace separator from the end', () => {
      const b = new Bundle()

      b.addSource({ content: new MagicString('abc   ') })
      b.addSource({ content: new MagicString('   ') })

      b.trimEnd()
      assert.equal(b.toString(), 'abc')
    })

    it('should empty a bundle of whitespace sources', () => {
      const b = new Bundle()

      b.addSource({ content: new MagicString('  ') })
      b.addSource({ content: new MagicString('  ') })

      b.trim()
      assert.equal(b.toString(), '')
    })

    it('should stop at a separator that is not whitespace', () => {
      const b = new Bundle({ separator: ';' })

      b.addSource({ content: new MagicString('   ') })
      b.addSource({ content: new MagicString('   abc') })

      b.trimStart()
      assert.equal(b.toString(), ';   abc')
    })

    it('should trim empty lines with trimLines', () => {
      const b = new Bundle()

      b.addSource({ content: new MagicString('\n\nabc\n\n') })

      b.trimLines()
      assert.equal(b.toString(), 'abc')
    })

    it('should stop trimEnd at a separator that is not whitespace', () => {
      const b = new Bundle({ separator: ';' })

      b.addSource({ content: new MagicString('abc   ') })
      b.addSource({ content: new MagicString('   ') })

      b.trimEnd()
      assert.equal(b.toString(), 'abc   ;')
    })

    it('should stop trimStart at a blank source that still has appended content', () => {
      const b = new Bundle()

      b.addSource({ content: new MagicString('   ').append('X') })
      b.addSource({ content: new MagicString('  Y') })

      b.trimStart()
      assert.equal(b.toString(), 'X\n  Y')
    })

    it('should stop trimEnd at a blank source that still has prepended content', () => {
      const b = new Bundle()

      b.addSource({ content: new MagicString('Y  ') })
      b.addSource({ content: new MagicString('   ').prepend('X') })

      b.trimEnd()
      assert.equal(b.toString(), 'Y  \nX')
    })
  })
})
