import { assert, describe, it } from 'vitest'
import { Bundle } from '../../src/index.ts'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('bundle', () => {
  describe('toString', () => {
    it('should separate with a newline by default', () => {
      const b = new Bundle()

      b.addSource(new MagicString('abc'))
      b.addSource(new MagicString('def'))

      assert.strictEqual(b.toString(), 'abc\ndef')
    })

    it('should accept separator option', () => {
      const b = new Bundle({ separator: '==' })

      b.addSource(new MagicString('abc'))
      b.addSource(new MagicString('def'))

      assert.strictEqual(b.toString(), 'abc==def')
    })

    it('should accept empty string separator option', () => {
      const b = new Bundle({ separator: '' })

      b.addSource(new MagicString('abc'))
      b.addSource(new MagicString('def'))

      assert.strictEqual(b.toString(), 'abcdef')
    })
  })
})
