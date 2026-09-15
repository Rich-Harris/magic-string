import type { ExclusionRange } from '../../src/index.ts'
import { assert, describe, it } from 'vitest'
import { Bundle } from '../../src/index.ts'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

interface BundleInternals extends Bundle {
  sources: Array<{
    content: MagicString
    filename?: string
    ignoreList?: boolean
    indentExclusionRanges?: ExclusionRange | ExclusionRange[]
  }>
}

describe('bundle', () => {
  describe('clone', () => {
    it('should clone a bundle', () => {
      const s1 = new MagicString('abcdef')
      const s2 = new MagicString('ghijkl')
      const b = new Bundle()
        .addSource({ content: s1 })
        .addSource({ content: s2 })
        .prepend('>>>')
        .append('<<<')
      const clone = b.clone()

      assert.equal(clone.toString(), '>>>abcdef\nghijkl<<<')

      s1.overwrite(2, 4, 'XX')
      assert.equal(b.toString(), '>>>abXXef\nghijkl<<<')
      assert.equal(clone.toString(), '>>>abcdef\nghijkl<<<')
    })
    it('should clone the ignore-list hint', () => {
      const b = new Bundle() as BundleInternals

      b.addSource({ content: new MagicString('foo', { filename: 'foo.js' }), ignoreList: true })

      const clone = b.clone() as BundleInternals

      assert.strictEqual(clone.sources[0].ignoreList, true)
      assert.deepEqual(clone.generateMap({ includeContent: false }).x_google_ignoreList, [0])
    })

    it('should clone indentExclusionRanges', () => {
      const b = new Bundle() as BundleInternals

      b.addSource({
        content: new MagicString('foo', { filename: 'foo.js' }),
        indentExclusionRanges: [1, 2],
      })

      const clone = b.clone() as BundleInternals

      assert.deepEqual(clone.sources[0].indentExclusionRanges, [1, 2])
    })
  })
})
