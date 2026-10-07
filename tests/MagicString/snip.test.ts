import { assert, describe, it } from 'vitest'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('snip', () => {
    it('should return a clone with content outside `start` and `end` removed', () => {
      const s = new MagicString('abcdefghijkl', {
        filename: 'foo.js',
      })

      s.overwrite(6, 9, 'GHI')

      const snippet = s.snip(3, 9)
      assert.equal(snippet.toString(), 'defGHI')
      assert.equal(snippet.filename, 'foo.js')
    })

    it('should snip from the start', () => {
      const s = new MagicString('abcdefghijkl')
      const snippet = s.snip(0, 6)

      assert.equal(snippet.toString(), 'abcdef')
    })

    it('should snip from the end', () => {
      const s = new MagicString('abcdefghijkl')
      const snippet = s.snip(6, 12)

      assert.equal(snippet.toString(), 'ghijkl')
    })

    it('should respect original indices', () => {
      const s = new MagicString('abcdefghijkl')
      const snippet = s.snip(3, 9)

      snippet.overwrite(6, 9, 'GHI')
      assert.equal(snippet.toString(), 'defGHI')
    })

    it('should respect the offset', () => {
      const s = new MagicString('hello world', { offset: 6 })
      s.overwrite(0, 1, 'W')

      assert.equal(s.snip(0, 5).toString(), 'World')
      assert.equal(s.snip(1, 3).toString(), 'or')
    })
  })
})
