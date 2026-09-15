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

    it('should append/prepend at end of string when index is out of upper bound', () => {
      const s = new MagicString('x')
      s.prependLeft(6, 'A')
      s.appendLeft(6, 'B')
      s.prependRight(6, 'C')
      s.appendRight(6, 'D')

      assert.equal(s.toString(), 'ABxCD')
    })

    it('should append/prepend on empty string when index is out of upper bound', () => {
      const s = new MagicString('')
      s.prependLeft(6, 'A')
      s.appendLeft(6, 'B')
      s.prependRight(6, 'C')
      s.appendRight(6, 'D')

      assert.equal(s.toString(), 'ABCD')
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
