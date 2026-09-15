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
  describe('addSource', () => {
    it('should return this', () => {
      const b = new Bundle()
      const source = new MagicString('abcdefghijkl')

      assert.strictEqual(b.addSource({ content: source }), b)
    })

    it('should accept MagicString instance as a single argument', () => {
      const b = new Bundle() as BundleInternals
      const array: ExclusionRange[] = []
      const source = new MagicString('abcdefghijkl', {
        filename: 'foo.js',
        indentExclusionRanges: array,
      })

      b.addSource(source)
      assert.strictEqual(b.sources[0].content, source)
      assert.strictEqual(b.sources[0].filename, 'foo.js')
      assert.strictEqual(b.sources[0].indentExclusionRanges, array)
    })

    it('should accept ignore-list hint', () => {
      const b = new Bundle() as BundleInternals
      const foo = new MagicString('foo', { filename: 'foo.js' })
      const bar = new MagicString('bar', { filename: 'bar.js' })

      b.addSource({ content: foo, ignoreList: true })
      b.addSource({ content: bar, ignoreList: false })
      assert.strictEqual(b.sources[0].content, foo)
      assert.strictEqual(b.sources[0].ignoreList, true)
      assert.strictEqual(b.sources[1].content, bar)
      assert.strictEqual(b.sources[1].ignoreList, false)
    })

    it('respects MagicString init options with { content: source }', () => {
      const b = new Bundle() as BundleInternals
      const array: ExclusionRange[] = []
      const source = new MagicString('abcdefghijkl', {
        filename: 'foo.js',
        ignoreList: false,
        indentExclusionRanges: array,
      })

      b.addSource({ content: source })
      assert.strictEqual(b.sources[0].content, source)
      assert.strictEqual(b.sources[0].filename, 'foo.js')
      assert.strictEqual(b.sources[0].ignoreList, false)
      assert.strictEqual(b.sources[0].indentExclusionRanges, array)
    })

    it('should throw when content is missing', () => {
      const b = new Bundle()
      // @ts-expect-error runtime validation is the subject of this test
      assert.throws(() => b.addSource({}), /requires a `content` property/)
    })

    it('should throw when adding a different source under a duplicate filename', () => {
      const b = new Bundle()
      const foo = new MagicString('foo', { filename: 'foo.js' })
      const alsoFoo = new MagicString('bar', { filename: 'foo.js' })

      b.addSource(foo)
      assert.throws(() => b.addSource(alsoFoo), /duplicate filename "foo\.js" with different content/)
    })

    it('should allow the same filename when the content matches', () => {
      const b = new Bundle()
      const foo1 = new MagicString('foo', { filename: 'foo.js' })
      const foo2 = new MagicString('foo', { filename: 'foo.js' })

      b.addSource(foo1)
      assert.doesNotThrow(() => b.addSource(foo2))
    })
  })
})
