import { assert, describe, it } from 'vitest'
import { Bundle } from '../../src/index.ts'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('bundle', () => {
  describe('indent', () => {
    it('should indent a bundle', () => {
      const b = new Bundle()

      b.addSource({ content: new MagicString('abcdef') })
      b.addSource({ content: new MagicString('ghijkl') })

      b.indent().prepend('>>>\n').append('\n<<<')
      assert.equal(b.toString(), '>>>\n\tabcdef\n\tghijkl\n<<<')
    })

    it('should ignore non-indented sources when guessing indentation', () => {
      const b = new Bundle()

      b.addSource({ content: new MagicString('abcdef') })
      b.addSource({ content: new MagicString('ghijkl') })
      b.addSource({ content: new MagicString('  mnopqr') })

      b.indent()
      assert.equal(b.toString(), '  abcdef\n  ghijkl\n    mnopqr')
    })

    it('should guess the most common indentation', () => {
      const b = new Bundle()

      b.addSource({ content: new MagicString('    abc') })
      b.addSource({ content: new MagicString('    def') })
      b.addSource({ content: new MagicString('  ghi') })

      assert.equal(b.getIndentString(), '    ')
    })

    it('should not let a single source outvote the rest', () => {
      const b = new Bundle()

      b.addSource({ content: new MagicString('  abc') })
      b.addSource({ content: new MagicString('  def') })
      b.addSource({ content: new MagicString('      ghi') })

      assert.equal(b.getIndentString(), '  ')
    })

    it('should respect indent exclusion ranges', () => {
      const b = new Bundle()

      b.addSource({
        content: new MagicString('abc\ndef\nghi\njkl'),
        indentExclusionRanges: [7, 15],
      })

      b.indent('  ')
      assert.equal(b.toString(), '  abc\n  def\nghi\njkl')

      b.indent('>>')
      assert.equal(b.toString(), '>>  abc\n>>  def\nghi\njkl')
    })

    it('does not indent sources with no preceding newline, i.e. append()', () => {
      const b = new Bundle()

      b.addSource(new MagicString('abcdef'))
      b.addSource(new MagicString('ghijkl'))

      b.prepend('>>>').append('<<<').indent()
      assert.equal(b.toString(), '\t>>>abcdef\n\tghijkl<<<')
    })

    it('should noop with an empty string', () => {
      const b = new Bundle()

      b.addSource(new MagicString('abcdef'))
      b.addSource(new MagicString('ghijkl'))

      b.indent('')
      assert.equal(b.toString(), 'abcdef\nghijkl')
    })

    it('indents prepended content', () => {
      const b = new Bundle()
      b.prepend('a\nb').indent()

      assert.equal(b.toString(), '\ta\n\tb')
    })

    it('indents content immediately following intro with trailing newline', () => {
      const b = new Bundle({ separator: '\n\n' })

      const s = new MagicString('2')
      b.addSource({ content: s })

      b.prepend('1\n')

      assert.equal(b.indent().toString(), '\t1\n\t2')
    })

    it('should return this', () => {
      const b = new Bundle()
      assert.strictEqual(b.indent(), b)
    })

    it('should return this on noop', () => {
      const b = new Bundle()
      assert.strictEqual(b.indent(''), b)
    })
  })
})
