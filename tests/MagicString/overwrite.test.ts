import { assert, describe, it } from 'vitest'
import { MagicStringError } from '../../src/index.ts'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('overwrite', () => {
    it('should replace characters', () => {
      const s = new MagicString('abcdefghijkl')

      s.overwrite(5, 8, 'FGH')
      assert.equal(s.toString(), 'abcdeFGHijkl')
    })

    it('should throw an error if overlapping replacements are attempted', () => {
      const s = new MagicString('abcdefghijkl')

      s.overwrite(7, 11, 'xx')

      assert.throws(
        () => s.overwrite(8, 12, 'yy'),
        /cannot split a chunk that has already been edited/,
      )

      assert.equal(s.toString(), 'abcdefgxxl')

      s.overwrite(6, 12, 'yes')
      assert.equal(s.toString(), 'abcdefyes')
    })

    it('should allow contiguous but non-overlapping replacements', () => {
      const s = new MagicString('abcdefghijkl')

      s.overwrite(3, 6, 'DEF')
      assert.equal(s.toString(), 'abcDEFghijkl')

      s.overwrite(6, 9, 'GHI')
      assert.equal(s.toString(), 'abcDEFGHIjkl')

      s.overwrite(0, 3, 'ABC')
      assert.equal(s.toString(), 'ABCDEFGHIjkl')

      s.overwrite(9, 12, 'JKL')
      assert.equal(s.toString(), 'ABCDEFGHIJKL')
    })

    it('does not replace zero-length inserts at overwrite start location', () => {
      const s = new MagicString('abcdefghijkl')

      s.remove(0, 6)
      s.appendLeft(6, 'DEF')
      s.overwrite(6, 9, 'GHI')
      assert.equal(s.toString(), 'DEFGHIjkl')
    })

    it('replaces zero-length inserts inside overwrite', () => {
      const s = new MagicString('abcdefghijkl')

      s.appendLeft(6, 'XXX')
      s.overwrite(3, 9, 'DEFGHI')
      assert.equal(s.toString(), 'abcDEFGHIjkl')
    })

    it('replaces non-zero-length inserts inside overwrite', () => {
      const s = new MagicString('abcdefghijkl')

      s.overwrite(3, 4, 'XXX')
      s.overwrite(3, 5, 'DE')
      assert.equal(s.toString(), 'abcDEfghijkl')

      s.overwrite(7, 8, 'YYY')
      s.overwrite(6, 8, 'GH')
      assert.equal(s.toString(), 'abcDEfGHijkl')
    })

    it('should return this', () => {
      const s = new MagicString('abcdefghijkl')
      assert.strictEqual(s.overwrite(3, 4, 'D'), s)
    })

    it('should disallow overwriting zero-length ranges', () => {
      const s = new MagicString('x')
      assert.throws(
        () => s.overwrite(0, 0, 'anything'),
        /cannot overwrite a zero-length range/,
      )
    })

    it('should throw when given non-string content', () => {
      const s = new MagicString('')
      // @ts-expect-error runtime validation is the subject of this test
      assert.throws(() => s.overwrite(0, 1, []), MagicStringError)
    })

    it('replaces interior inserts', () => {
      const s = new MagicString('abcdefghijkl')

      s.appendLeft(1, '&')
      s.prependRight(1, '^')
      s.appendLeft(3, '!')
      s.prependRight(3, '?')
      s.overwrite(1, 3, '...')
      assert.equal(s.toString(), 'a&...?defghijkl')
    })

    it('preserves interior inserts with `contentOnly: true`', () => {
      const s = new MagicString('abcdefghijkl')

      s.appendLeft(1, '&')
      s.prependRight(1, '^')
      s.appendLeft(3, '!')
      s.prependRight(3, '?')
      s.overwrite(1, 3, '...', { contentOnly: true })
      assert.equal(s.toString(), 'a&^...!?defghijkl')
    })

    it('disallows overwriting partially overlapping moved content', () => {
      const s = new MagicString('abcdefghijkl')

      s.move(6, 9, 3)
      assert.throws(() => s.overwrite(5, 7, 'XX'), /cannot overwrite across a split point/)
    })

    it('disallows overwriting fully surrounding content moved away', () => {
      const s = new MagicString('abcdefghijkl')

      s.move(6, 9, 3)
      assert.throws(() => s.overwrite(4, 11, 'XX'), /cannot overwrite across a split point/)
    })

    it('disallows overwriting fully surrounding content moved away even if there is another split', () => {
      const s = new MagicString('abcdefghijkl')

      s.move(6, 9, 3)
      s.appendLeft(5, 'foo')
      assert.throws(() => s.overwrite(4, 11, 'XX'), /cannot overwrite across a split point/)
    })

    it('allows later insertions at the end', () => {
      const s = new MagicString('abcdefg')

      s.appendLeft(4, '(')
      s.overwrite(2, 7, '')
      s.appendLeft(7, 'h')
      assert.equal(s.toString(), 'abh')
    })

    // https://github.com/Rich-Harris/magic-string/issues/139
    // Re-editing a range whose chunk was already overwritten (the protobufjs
    // export-reassignment pattern that broke rollup) must surface a located
    // error rather than silently corrupting the chunk's content.
    it('reports a located error when re-editing an already-overwritten range', () => {
      const code = 'const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});'
      const s = new MagicString(code)

      s.overwrite(14, 40, 'ROOT')
      assert.throws(
        () => s.overwrite(14, 23, 'X'),
        /cannot split a chunk that has already been edited \(0:23/,
      )

      const output = s.toString()
      assert.equal(output, 'const $root = ROOT || ($protobuf.roots["default"] = {});')
      assert.notMatch(output, /undefined/)
    })
  })
})
