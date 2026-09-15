import { assert, describe, it } from 'vitest'
import { Bundle } from '../../src/index.ts'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('bundle', () => {
  describe('length', () => {
    it('should count the default separator between sources', () => {
      const b = new Bundle()

      b.addSource(new MagicString('abc'))
      b.addSource(new MagicString('def'))

      assert.equal(b.toString(), 'abc\ndef')
      assert.equal(b.length(), b.toString().length)
    })

    it('should count a custom separator', () => {
      const b = new Bundle({ separator: '\n\n' })

      b.addSource(new MagicString('a'))
      b.addSource(new MagicString('b'))
      b.addSource(new MagicString('c'))

      assert.equal(b.length(), b.toString().length)
    })

    it('should count a per-source separator', () => {
      const b = new Bundle({ separator: '\n\n' })

      b.addSource(new MagicString('a'))
      b.addSource({ content: new MagicString('b'), separator: '; ' })

      assert.equal(b.length(), b.toString().length)
    })

    it('should count the intro', () => {
      const b = new Bundle({ intro: '// intro\n' })

      b.addSource(new MagicString('abc'))

      assert.equal(b.length(), b.toString().length)
    })

    it('should count content appended or prepended to a source', () => {
      const b = new Bundle({ separator: ';' })

      b.addSource(new MagicString('abc').append('X'))
      b.addSource(new MagicString('def').prepend('Y'))

      assert.equal(b.toString(), 'abcX;Ydef')
      assert.equal(b.length(), b.toString().length)
    })
  })
})
