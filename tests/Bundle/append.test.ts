import { assert, describe, it } from 'vitest'
import { Bundle } from '../../src/index.ts'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('bundle', () => {
  describe('append', () => {
    it('should append content', () => {
      const b = new Bundle()

      b.addSource({ content: new MagicString('*') })

      b.append('123').append('456')
      assert.equal(b.toString(), '*123456')
    })

    it('should append content before subsequent sources', () => {
      const b = new Bundle()

      b.addSource(new MagicString('*'))

      b.append('123').addSource(new MagicString('-')).append('456')
      assert.equal(b.toString(), '*123\n-456')
    })

    it('should return this', () => {
      const b = new Bundle()
      assert.strictEqual(b.append('x'), b)
    })

    it('should accept a custom separator', () => {
      const b = new Bundle()

      b.addSource(new MagicString('*'))
      b.append('123', { separator: ';' })
      b.append('456')

      assert.equal(b.toString(), '*;123456')
    })
  })
})
