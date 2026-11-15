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

    it('with offset', () => {
      const s = new MagicString('hello world', { offset: 6 })
      assert.equal(s.slice(0, 5), 'world')
      assert.equal(s.remove(0, 5).toString(), 'hello ')
      assert.equal(s.prependLeft(0, 'w').toString(), 'hello w')
      assert.equal(s.appendLeft(0, 'o').toString(), 'hello wo')
      assert.equal(s.prependRight(0, 'r').toString(), 'hello wor')
      assert.equal(s.appendRight(0, 'l').toString(), 'hello worl')
      assert.equal(s.reset(4, 5).toString(), 'hello world')
      assert.equal(s.update(0, 5, 'd').toString(), 'hello world')
      assert.equal(s.overwrite(0, 5, 'rld').toString(), 'hello world')

      s.offset = 1
      const s1 = s.clone()
      assert.strictEqual(s1.slice(), 'ello world')
      assert.equal(s1.move(0, 1, 2).slice(0), 'elo world')
    })
  })
})
