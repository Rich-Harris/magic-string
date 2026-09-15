import { assert, describe, it } from 'vitest'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('options', () => {
    it('stores source file information', () => {
      const s = new MagicString('abc', {
        filename: 'foo.js',
      })

      assert.equal(s.filename, 'foo.js')
    })

    it('stores ignore-list hint', () => {
      const s = new MagicString('abc', { ignoreList: true })

      assert.equal(s.ignoreList, true)
    })
  })
})
