import { assert, describe, it } from 'vitest'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('getIndentString', () => {
    it('should guess the indent string', () => {
      const s = new MagicString('abc\n  def\nghi')
      assert.equal(s.getIndentString(), '  ')
    })

    it('should return a tab if no lines are indented', () => {
      const s = new MagicString('abc\ndef\nghi')
      assert.equal(s.getIndentString(), '\t')
    })

    it('should return a tab when more lines are tab-indented than space-indented', () => {
      const s = new MagicString('abc\n\tdef\nghi')
      assert.equal(s.getIndentString(), '\t')
    })
  })

  describe('indent', () => {
    it('should indent content with a single tab character by default', () => {
      const s = new MagicString('abc\ndef\nghi\njkl')

      s.indent()
      assert.equal(s.toString(), '\tabc\n\tdef\n\tghi\n\tjkl')

      s.indent()
      assert.equal(s.toString(), '\t\tabc\n\t\tdef\n\t\tghi\n\t\tjkl')
    })

    it('should indent content, using existing indentation as a guide', () => {
      const s = new MagicString('abc\n  def\n    ghi\n  jkl')

      s.indent()
      assert.equal(s.toString(), '  abc\n    def\n      ghi\n    jkl')

      s.indent()
      assert.equal(s.toString(), '    abc\n      def\n        ghi\n      jkl')
    })

    it('should disregard single-space indentation when auto-indenting', () => {
      const s = new MagicString('abc\n/**\n *comment\n */')

      s.indent()
      assert.equal(s.toString(), '\tabc\n\t/**\n\t *comment\n\t */')
    })

    it('should indent content using the supplied indent string', () => {
      const s = new MagicString('abc\ndef\nghi\njkl')

      s.indent('  ')
      assert.equal(s.toString(), '  abc\n  def\n  ghi\n  jkl')

      s.indent('>>')
      assert.equal(s.toString(), '>>  abc\n>>  def\n>>  ghi\n>>  jkl')
    })

    it('should indent content using the empty string if specified (i.e. noop)', () => {
      const s = new MagicString('abc\ndef\nghi\njkl')

      s.indent('')
      assert.equal(s.toString(), 'abc\ndef\nghi\njkl')
    })

    it('should prevent excluded characters from being indented', () => {
      const s = new MagicString('abc\ndef\nghi\njkl')

      s.indent('  ', { exclude: [7, 15] })
      assert.equal(s.toString(), '  abc\n  def\nghi\njkl')

      s.indent('>>', { exclude: [7, 15] })
      assert.equal(s.toString(), '>>  abc\n>>  def\nghi\njkl')
    })

    it('should accept an options object as the only argument', () => {
      const s = new MagicString('abc\ndef\nghi\njkl')

      s.indent({ exclude: [7, 15] })
      assert.equal(s.toString(), '\tabc\n\tdef\nghi\njkl')
    })

    it('should accept an array of exclusion ranges', () => {
      const s = new MagicString('abc\ndef\nghi\njkl')

      s.indent('  ', { exclude: [[7, 15]] })
      assert.equal(s.toString(), '  abc\n  def\nghi\njkl')
    })

    it('should not indent an excluded chunk intro', () => {
      const s = new MagicString('abc\ndef')
      s.appendRight(4, '>>')

      s.indent('  ', { exclude: [4, 7] })
      assert.equal(s.toString(), '  abc\n>>def')
    })

    it('should not indent excluded edited content', () => {
      const s = new MagicString('abc\ndef\nghi')
      s.overwrite(4, 7, 'XXX')

      s.indent('  ', { exclude: [4, 7] })
      assert.equal(s.toString(), '  abc\nXXX\n  ghi')
    })

    it('should not add characters to empty lines', () => {
      const s = new MagicString('\n\nabc\ndef\n\nghi\njkl')

      s.indent()
      assert.equal(s.toString(), '\n\n\tabc\n\tdef\n\n\tghi\n\tjkl')

      s.indent()
      assert.equal(s.toString(), '\n\n\t\tabc\n\t\tdef\n\n\t\tghi\n\t\tjkl')
    })

    it('should not add characters to empty lines, even on Windows', () => {
      const s = new MagicString('\r\n\r\nabc\r\ndef\r\n\r\nghi\r\njkl')

      s.indent()
      assert.equal(s.toString(), '\r\n\r\n\tabc\r\n\tdef\r\n\r\n\tghi\r\n\tjkl')

      s.indent()
      assert.equal(s.toString(), '\r\n\r\n\t\tabc\r\n\t\tdef\r\n\r\n\t\tghi\r\n\t\tjkl')
    })

    it('should indent content with removals', () => {
      const s = new MagicString('/* remove this line */\nvar foo = 1;')

      s.remove(0, 23)
      s.indent()

      assert.equal(s.toString(), '\tvar foo = 1;')
    })

    it('should not indent patches in the middle of a line', () => {
      const s = new MagicString('class Foo extends Bar {}')

      s.overwrite(18, 21, 'Baz')
      assert.equal(s.toString(), 'class Foo extends Baz {}')

      s.indent()
      assert.equal(s.toString(), '\tclass Foo extends Baz {}')
    })

    it('should indent content added with appendRight/prependRight', () => {
      const s = new MagicString('a\nb\nc')

      s.appendRight(2, 'Q\n')
      assert.equal(s.toString(), 'a\nQ\nb\nc')

      s.indent('>')
      assert.equal(s.toString(), '>a\n>Q\n>b\n>c')
    })

    it('should indent content added with appendLeft/prependLeft', () => {
      const s = new MagicString('a\nb\nc')

      s.appendLeft(1, '\nQ')
      assert.equal(s.toString(), 'a\nQ\nb\nc')

      s.indent('>')
      assert.equal(s.toString(), '>a\n>Q\n>b\n>c')
    })

    it('should indent a line that starts inside inserted content', () => {
      const s = new MagicString('a\nb\nc')

      s.appendLeft(2, 'X')
      assert.equal(s.toString(), 'a\nXb\nc')

      // the indent belongs in front of the insert, not between it and `b`
      s.indent('>')
      assert.equal(s.toString(), '>a\n>Xb\n>c')
    })

    it('should indent original content that follows a multiline insert', () => {
      const s = new MagicString('a\nb\nc')

      s.prependRight(2, 'one\ntwo\n')
      assert.equal(s.toString(), 'a\none\ntwo\nb\nc')

      s.indent('>')
      assert.equal(s.toString(), '>a\n>one\n>two\n>b\n>c')
    })

    it('should not indent content that continues the current line', () => {
      const s = new MagicString('a\nb\nc')

      s.appendRight(2, 'X')
      assert.equal(s.toString(), 'a\nXb\nc')

      s.indent('>')
      assert.equal(s.toString(), '>a\n>Xb\n>c')
    })

    it('should indent lines that start inside the outro', () => {
      const s = new MagicString('a\nb\nc')

      s.append('\nZ')
      assert.equal(s.toString(), 'a\nb\nc\nZ')

      s.indent('>')
      assert.equal(s.toString(), '>a\n>b\n>c\n>Z')
    })

    it('should indent every line of a wrapped module', () => {
      const s = new MagicString('var a = 1;\nvar b = 2;')

      s.prepend('(function () {\n')
      s.prependRight(11, 'debugger;\n')
      s.append('\n}());')
      assert.equal(
        s.toString(),
        '(function () {\nvar a = 1;\ndebugger;\nvar b = 2;\n}());',
      )

      s.indent('  ')
      assert.equal(
        s.toString(),
        '  (function () {\n  var a = 1;\n  debugger;\n  var b = 2;\n  }());',
      )
    })

    it('should indent every line of the generated string', () => {
      const original = 'const a = 1;\nconst b = 2;\n\nexport { a, b };\n'

      const build = (s: MagicString) => {
        s.prepend('// header\n')
        s.appendLeft(12, '\nconst inserted = 3;')
        s.overwrite(13, 25, 'const b = 20;\nconst c = 30;')
        s.append('// footer\n')
      }

      const generated = new MagicString(original)
      build(generated)

      const indented = new MagicString(original)
      build(indented)
      indented.indent('  ')

      assert.equal(
        indented.toString(),
        generated
          .toString()
          .split('\n')
          .map(line => (line === '' ? line : `  ${line}`))
          .join('\n'),
      )
    })

    it('should respect indentStart across inserted content', () => {
      const s = new MagicString('a\nb')

      s.prependRight(0, 'X')
      s.indent('>', { indentStart: false })
      assert.equal(s.toString(), 'Xa\n>b')
    })

    it('should return this', () => {
      const s = new MagicString('abcdefghijkl')
      assert.strictEqual(s.indent(), s)
    })

    it('should return this on noop', () => {
      const s = new MagicString('abcdefghijkl')
      assert.strictEqual(s.indent(''), s)
    })
  })
})
