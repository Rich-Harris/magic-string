import { assert, describe, it } from 'vitest'
import { Bundle } from '../../src/index.ts'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('bundle', () => {
  describe('prepend', () => {
    it('should append content', () => {
      const b = new Bundle()

      b.addSource({ content: new MagicString('*') })

      b.prepend('123').prepend('456')
      assert.equal(b.toString(), '456123*')
    })

    it('should return this', () => {
      const b = new Bundle()
      assert.strictEqual(b.prepend('x'), b)
    })
  })
})
