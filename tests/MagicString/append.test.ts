import { assert, describe, it } from 'vitest'
import { MagicStringError } from '../../src/index.ts'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('append', () => {
    it('should append content', () => {
      const s = new MagicString('abcdefghijkl')

      s.append('xyz')
      assert.equal(s.toString(), 'abcdefghijklxyz')

      s.append('xyz')
      assert.equal(s.toString(), 'abcdefghijklxyzxyz')
    })

    it('should return this', () => {
      const s = new MagicString('abcdefghijkl')
      assert.strictEqual(s.append('xyz'), s)
    })

    it('should throw when given non-string content', () => {
      const s = new MagicString('')
      // @ts-expect-error runtime validation is the subject of this test
      assert.throws(() => s.append([]), MagicStringError)
    })
  })

  describe('(ap|pre)pend(Left|Right)', () => {
    it('preserves intended order', () => {
      const s = new MagicString('0123456789')

      s.appendLeft(5, 'A')
      s.prependRight(5, 'a')
      s.prependRight(5, 'b')
      s.appendLeft(5, 'B')
      s.appendLeft(5, 'C')
      s.prependRight(5, 'c')

      assert.equal(s.toString(), '01234ABCcba56789')
      assert.equal(s.slice(0, 5), '01234ABC')
      assert.equal(s.slice(5), 'cba56789')

      s.prependLeft(5, '<')
      s.prependLeft(5, '{')
      assert.equal(s.toString(), '01234{<ABCcba56789')

      s.appendRight(5, '>')
      s.appendRight(5, '}')
      assert.equal(s.toString(), '01234{<ABCcba>}56789')

      s.appendLeft(5, '(')
      s.appendLeft(5, '[')
      assert.equal(s.toString(), '01234{<ABC([cba>}56789')

      s.prependRight(5, ')')
      s.prependRight(5, ']')
      assert.equal(s.toString(), '01234{<ABC([])cba>}56789')

      assert.equal(s.slice(0, 5), '01234{<ABC([')
      assert.equal(s.slice(5), '])cba>}56789')
    })

    it('preserves intended order at beginning of string', () => {
      const s = new MagicString('x')

      s.appendLeft(0, '1')
      s.prependLeft(0, '2')
      s.appendLeft(0, '3')
      s.prependLeft(0, '4')

      assert.equal(s.toString(), '4213x')
    })

    it('preserves intended order at end of string', () => {
      const s = new MagicString('x')

      s.appendRight(1, '1')
      s.prependRight(1, '2')
      s.appendRight(1, '3')
      s.prependRight(1, '4')

      assert.equal(s.toString(), 'x4213')
    })

    it('should throw when the index is out of upper bound', () => {
      const s = new MagicString('x')

      assert.throws(() => s.prependLeft(6, 'A'), /index 6 is out of bounds/)
      assert.throws(() => s.appendLeft(6, 'B'), /index 6 is out of bounds/)
      assert.throws(() => s.prependRight(6, 'C'), /index 6 is out of bounds/)
      assert.throws(() => s.appendRight(6, 'D'), /index 6 is out of bounds/)
      assert.equal(s.toString(), 'x')
    })

    it('should append/prepend at the end of the string when index equals its length', () => {
      const s = new MagicString('x')
      s.prependLeft(1, 'A')
      s.appendLeft(1, 'B')
      s.prependRight(1, 'C')
      s.appendRight(1, 'D')

      assert.equal(s.toString(), 'xABCD')
    })

    it('should throw on an empty string when the index is out of upper bound', () => {
      const s = new MagicString('')

      assert.throws(() => s.appendLeft(6, 'A'), /index 6 is out of bounds/)
      assert.throws(() => s.appendRight(6, 'D'), /index 6 is out of bounds/)
    })
  })

  describe('appendLeft', () => {
    it('should return this', () => {
      const s = new MagicString('abcdefghijkl')
      assert.strictEqual(s.appendLeft(0, 'a'), s)
    })

    it('should throw when given non-string content', () => {
      const s = new MagicString('abcdefghijkl')
      // @ts-expect-error runtime validation is the subject of this test
      assert.throws(() => s.appendLeft(0, []), MagicStringError)
    })

    it('should resolve a negative index from the end', () => {
      assert.equal(new MagicString('abc').appendLeft(-1, 'X').toString(), 'abXc')
    })

    it('should throw on a non-integer index', () => {
      const s = new MagicString('abc')
      assert.throws(() => s.appendLeft(1.5, 'X'), /must be an integer, got 1.5/)
    })

    it('should apply the offset before validating', () => {
      const s = new MagicString('abc', { offset: 1 })
      assert.equal(s.appendLeft(2, 'X').toString(), 'abcX')
      assert.throws(() => s.appendLeft(3, 'X'), /index 4 is out of bounds/)
    })
  })

  describe('appendRight', () => {
    it('should return this', () => {
      const s = new MagicString('abcdefghijkl')
      assert.strictEqual(s.appendRight(0, 'a'), s)
    })

    it('should throw when given non-string content', () => {
      const s = new MagicString('abcdefghijkl')
      // @ts-expect-error runtime validation is the subject of this test
      assert.throws(() => s.appendRight(0, []), MagicStringError)
    })
  })
})
