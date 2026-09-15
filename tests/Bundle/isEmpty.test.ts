import { assert, describe, it } from 'vitest'
import { Bundle } from '../../src/index.ts'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('bundle', () => {
  describe('isEmpty', () => {
    it('should ignore a whitespace separator', () => {
      const b = new Bundle()

      b.addSource(new MagicString(''))
      b.addSource(new MagicString(''))

      assert.equal(b.toString(), '\n')
      assert.equal(b.isEmpty(), true)
    })

    it('should see a custom separator', () => {
      const b = new Bundle({ separator: ';' })

      b.addSource(new MagicString(''))
      b.addSource(new MagicString(''))

      assert.equal(b.toString(), ';')
      assert.equal(b.isEmpty(), false)
    })

    it('should see a per-source separator', () => {
      const b = new Bundle()

      b.addSource(new MagicString(''))
      b.addSource({ content: new MagicString(''), separator: ';' })

      assert.equal(b.toString(), ';')
      assert.equal(b.isEmpty(), false)
    })

    it('should ignore the separator of a lone source', () => {
      const b = new Bundle({ separator: ';' })

      b.addSource(new MagicString(''))

      assert.equal(b.toString(), '')
      assert.equal(b.isEmpty(), true)
    })

    it('should ignore a whitespace-only intro', () => {
      const b = new Bundle()

      b.addSource(new MagicString(''))
      b.prepend('  ')

      assert.equal(b.isEmpty(), true)
    })

    it('should see a non-whitespace intro', () => {
      const b = new Bundle()

      b.addSource(new MagicString(''))
      b.prepend('//intro')

      assert.equal(b.isEmpty(), false)
    })
  })
})
