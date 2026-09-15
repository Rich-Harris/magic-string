import { assert, describe, it } from 'vitest'
import { MagicStringError } from '../../src/index.ts'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('replaceAll', () => {
    it('works with string replace', () => {
      assert.strictEqual(new MagicString('1212').replaceAll('2', '3').toString(), '1313')
    })
    it('works with string replace and function replacer', () => {
      const code = '1 2 1 2'
      const s = new MagicString(code)
      const indexs: number[] = []
      const _strs: string[] = []

      s.replaceAll('2', (match: string, i: number, str: string) => {
        indexs.push(i)
        _strs.push(str)
        return `${match}-3`
      })

      assert.strictEqual(s.toString(), '1 2-3 1 2-3')
      assert.deepEqual(indexs, [2, 6])
      assert.deepEqual(_strs, [code, code])
    })

    it('should not treat string as regexp', () => {
      assert.strictEqual(new MagicString('1234').replaceAll('.', '*').toString(), '1234')
    })

    it('should use substitution directly', () => {
      assert.strictEqual(new MagicString('11').replaceAll('1', '$0$1').toString(), '$0$1$0$1')
    })

    it('should not search back', () => {
      assert.strictEqual(new MagicString('121212').replaceAll('12', '21').toString(), '212121')
    })

    it('global regex result the same as .replace', () => {
      assert.strictEqual(
        new MagicString('1 2 3 4 a b c').replaceAll(/(\d)/g, 'xx$1$10').toString(),
        new MagicString('1 2 3 4 a b c').replace(/(\d)/g, 'xx$1$10').toString(),
      )

      assert.strictEqual(
        new MagicString('1 2 3 4 a b c').replaceAll(/(\d)/g, '$$').toString(),
        new MagicString('1 2 3 4 a b c').replace(/(\d)/g, '$$').toString(),
      )

      assert.strictEqual(
        new MagicString('hey this is magic')
          .replaceAll(/(\w)(\w+)/g, (_, $1, $2) => `${$1.toUpperCase()}${$2}`)
          .toString(),
        new MagicString('hey this is magic')
          .replace(/(\w)(\w+)/g, (_, $1, $2) => `${$1.toUpperCase()}${$2}`)
          .toString(),
      )
    })

    it('rejects with non-global regexp', () => {
      assert.throws(
        () => new MagicString('123').replaceAll(/./, ''),
        MagicStringError,
        'replaceAll() requires a global RegExp',
      )
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

    it('should insert at every zero-length match', () => {
      assert.strictEqual(
        new MagicString('a\nb\nc').replaceAll(/^/gm, '// ').toString(),
        '// a\n// b\n// c',
      )
      assert.strictEqual(new MagicString('a\nb').replaceAll(/$/gm, ';').toString(), 'a;\nb;')
      assert.strictEqual(new MagicString('ab cd').replaceAll(/\b/g, '|').toString(), '|ab| |cd|')
      assert.strictEqual(new MagicString('abc').replaceAll(/x*/g, '-').toString(), '-a-b-c-')
      assert.strictEqual(new MagicString('abc').replaceAll('', '-').toString(), '-a-b-c-')
    })

    it('should step over a whole code point for a unicode-aware regexp', () => {
      // without the `u` flag the surrogate halves are matched between, as they are
      // by `String.prototype.replaceAll`
      const emoji = '\u{1F600}'

      assert.strictEqual(
        new MagicString(`a${emoji}b`).replaceAll(/x*/gu, '.').toString(),
        `.a.${emoji}.b.`,
      )
      assert.strictEqual(
        new MagicString(`a${emoji}b`).replaceAll(/x*/g, '.').toString(),
        `.a.${emoji[0]}.${emoji[1]}.b.`,
      )
    })

    it('should report the index of every empty-string match to a replacer', () => {
      const indexes: number[] = []
      const s = new MagicString('ab').replaceAll('', (_match, index) => {
        indexes.push(index)
        return `<${index}>`
      })

      assert.strictEqual(s.toString(), '<0>a<1>b<2>')
      assert.deepEqual(indexes, [0, 1, 2])
    })

    it('should leave the original alone when an empty match is replaced by itself', () => {
      const s = new MagicString('abc')

      s.replaceAll(/x*/g, '')
      s.replaceAll('', '')

      assert.strictEqual(s.toString(), 'abc')
      assert.strictEqual(s.hasChanged(), false)
    })

    it('expands substitution patterns for every match', () => {
      assert.strictEqual(
        new MagicString('a1b2').replaceAll(/(\d)/g, '[$1$&]').toString(),
        'a[11]b[22]',
      )
      assert.strictEqual(new MagicString('foo foo').replaceAll('foo', '$&$&').toString(), 'foofoo foofoo')
    })

    it('expands substitution patterns at every empty-string match', () => {
      const code = 'ab'

      assert.strictEqual(
        new MagicString(code).replaceAll('', '$`').toString(),
        code.replaceAll('', '$`'),
      )
      assert.strictEqual(
        new MagicString(code).replaceAll('', '<$$>').toString(),
        code.replaceAll('', '<$$>'),
      )
    })

    it('skips matches whose content has been removed', () => {
      // https://github.com/Rich-Harris/magic-string/issues/223
      assert.strictEqual(new MagicString('000').remove(0, 1).replaceAll('0', '1').toString(), '11')
      assert.strictEqual(new MagicString('000').remove(0, 1).replaceAll(/0/g, '1').toString(), '11')
    })

    it('finds removed content that lies before the last searched chunk', () => {
      // the insert at 5 leaves the chunk search past the removed range, so the
      // lookup for a match inside it has to walk backwards to find it
      const create = () => new MagicString('000----').remove(0, 3).appendLeft(5, '!')

      assert.strictEqual(create().replaceAll('0', '1').toString(), '--!--')
      assert.strictEqual(create().replaceAll(/0/g, '1').toString(), '--!--')
      assert.strictEqual(create().replace('0', '1').toString(), '--!--')
    })
  })
})
