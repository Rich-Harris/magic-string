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

    it('should not indent the carriage return of a blank CRLF line in the intro', () => {
      const b = new Bundle({ intro: 'a\r\n\r\nb\n' })
      b.addSource(new MagicString('x'))

      b.indent('  ')
      assert.equal(b.toString(), '  a\r\n\r\n  b\n  x')
    })

    it('should not indent leading blank lines in the intro', () => {
      const lf = new Bundle({ intro: '\n\na\nb\n' })
      lf.addSource(new MagicString('x'))
      lf.indent('  ')
      assert.equal(lf.toString(), '\n\n  a\n  b\n  x')

      const crlf = new Bundle({ intro: '\r\n\r\na\r\nb\r\n' })
      crlf.addSource(new MagicString('x'))
      crlf.indent('  ')
      assert.equal(crlf.toString(), '\r\n\r\n  a\r\n  b\r\n  x')
    })

    it('should treat an explicit undefined argument the same as no argument', () => {
      const b = new Bundle({ intro: '// header\n' })
      b.addSource(new MagicString('  a'))
      b.addSource(new MagicString('  b'))
      b.addSource(new MagicString('c'))

      b.indent(undefined)
      assert.equal(b.toString(), '  // header\n    a\n    b\n  c')
    })

    it('should preserve a trailing newline across an empty source', () => {
      const b = new Bundle({ intro: '// header\n', separator: '' })
      b.addSource(new MagicString(''))
      b.addSource(new MagicString('a\n'))
      const removed = new MagicString('removed')
      removed.remove(0, 7)
      b.addSource(removed)
      b.append('b')

      b.indent('  ')
      assert.equal(b.toString(), '  // header\n  a\n  b')
    })

    it('should not indent a source after a non-newline separator following a source that ends with a newline', () => {
      const b = new Bundle()
      b.addSource(new MagicString('a\n'))
      b.addSource({
        content: new MagicString('b\nc'),
        separator: '/* inline */ ',
      })

      b.indent('  ')
      assert.equal(b.toString(), '  a\n/* inline */ b\n  c')
    })
  })
})
