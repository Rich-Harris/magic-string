import { assert, describe, it } from 'vitest'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('replace', () => {
    it('works with string replace', () => {
      const code = '1 2 1 2'
      const s = new MagicString(code)

      s.replace('2', '3')

      assert.strictEqual(s.toString(), '1 3 1 2')
    })

    it('works with string replace and function replacer', () => {
      const code = '1 2 1 2'
      const s = new MagicString(code)
      let index = -1
      let _str = ''

      s.replace('2', (match, i, str) => {
        index = i
        _str = str
        return `${match}-3`
      })

      assert.strictEqual(s.toString(), '1 2-3 1 2')
      assert.strictEqual(index, 2)
      assert.strictEqual(_str, code)
    })

    it('should not treat string as regexp', () => {
      assert.strictEqual(new MagicString('1234').replace('.', '*').toString(), '1234')
    })

    it('should use substitution directly', () => {
      assert.strictEqual(new MagicString('11').replace('1', '$0$1').toString(), '$0$11')
    })

    it('should not search back', () => {
      assert.strictEqual(new MagicString('122121').replace('12', '21').toString(), '212121')
    })

    it('works with global regex replace', () => {
      const code = '1 2 3 4 a b c'
      const s = new MagicString(code)

      s.replace(/(\d)/g, 'xx$1$10')

      // there is no tenth group, so `$10` is group 1 followed by a literal "0"
      assert.strictEqual(s.toString(), 'xx110 xx220 xx330 xx440 a b c')
      assert.strictEqual(s.toString(), code.replace(/(\d)/g, 'xx$1$10'))
    })

    it('works with global regex replace $$', () => {
      const s = new MagicString('1 2 3 4 a b c')

      s.replace(/(\d)/g, '$$')

      assert.strictEqual(s.toString(), '$ $ $ $ a b c')
    })

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_string_as_a_parameter
    describe('substitution patterns', () => {
      it('expands $& to the matched substring', () => {
        assert.strictEqual(new MagicString('abcabc').replace(/b/, '[$&]').toString(), 'a[b]cabc')
      })

      it('expands $` and $\' to the text around the match', () => {
        assert.strictEqual(new MagicString('abcabc').replace(/b/, '$`').toString(), 'aacabc')
        assert.strictEqual(new MagicString('abcabc').replace(/b/, '$\'').toString(), 'acabccabc')
      })

      it('expands $<name> for a named capture group', () => {
        const s = new MagicString('abcabc')

        s.replace(/(?<first>a)(?<second>b)/, '$<second>$<first>')

        assert.strictEqual(s.toString(), 'bacabc')
      })

      it('expands an unknown group name to nothing', () => {
        assert.strictEqual(
          new MagicString('abcabc').replace(/(?<first>a)/, '[$<nope>]').toString(),
          '[]bcabc',
        )
      })

      it('leaves $<name> literal when the pattern has no named groups', () => {
        assert.strictEqual(
          new MagicString('abcabc').replace(/b/, '$<first>').toString(),
          'a$<first>cabc',
        )
      })

      it('expands a group that did not participate in the match to nothing', () => {
        assert.strictEqual(new MagicString('ac').replace(/a(b)?/, '[$1]').toString(), '[]c')
      })

      it('leaves $0 literal, since it names no group', () => {
        assert.strictEqual(new MagicString('abcabc').replace(/(a)/, '[$0]').toString(), '[$0]bcabc')
      })

      it('prefers $nn over $n only when that group exists', () => {
        // one group: `$12` is group 1 followed by a literal "2"
        assert.strictEqual(new MagicString('ab').replace(/(a)/, '[$12]').toString(), '[a2]b')
        // two groups: `$01` is group 1
        assert.strictEqual(new MagicString('ab').replace(/(a)(b)/, '[$01]').toString(), '[a]')
        // `$00` names no group at all
        assert.strictEqual(new MagicString('ab').replace(/(a)(b)/, '[$00]').toString(), '[$00]')
      })

      it('leaves a dollar sign that introduces nothing recognisable alone', () => {
        assert.strictEqual(new MagicString('abcabc').replace(/b/, '$').toString(), 'a$cabc')
        assert.strictEqual(new MagicString('abcabc').replace(/b/, '$z').toString(), 'a$zcabc')
      })

      it('expands $$, $& and the surrounding text for a string search value', () => {
        assert.strictEqual(new MagicString('abcabc').replace('b', '$$').toString(), 'a$cabc')
        assert.strictEqual(new MagicString('abcabc').replace('b', '[$&]').toString(), 'a[b]cabc')
        assert.strictEqual(new MagicString('abcabc').replace('b', '$`').toString(), 'aacabc')
        assert.strictEqual(new MagicString('abcabc').replace('b', '$\'').toString(), 'acabccabc')
      })

      it('leaves group references literal for a string search value', () => {
        // a string search value has no capture groups of either kind
        assert.strictEqual(new MagicString('11').replace('1', '$0$1').toString(), '$0$11')
        assert.strictEqual(new MagicString('abc').replace('b', '$<x>').toString(), 'a$<x>c')
      })

      it('agrees with String.prototype.replace and replaceAll across the table', () => {
        const sources = ['abcabc', 'hello world', 'a1b2c3', 'aaa']
        const patterns: [string, string][] = [
          ['b', ''],
          ['b', 'g'],
          ['(a)(b)', ''],
          ['(a)(b)', 'g'],
          ['a(b)?', 'g'],
          ['(?<first>a)(?<second>b)', 'g'],
          [String.raw`(\w)(\w+)`, 'g'],
        ]
        const replacements = [
          'X',
          '$$',
          '$&',
          '$`',
          '$\'',
          '$0',
          '$1',
          '$2',
          '$3',
          '$12',
          '$01',
          '$<first>',
          '$<second>',
          '$<nope>',
          '$<unclosed',
          '$',
          '$z',
          '$$&',
          '<$`|$&|$\'>',
        ]

        for (const source of sources) {
          for (const [pattern, flags] of patterns) {
            for (const replacement of replacements) {
              for (const method of ['replace', 'replaceAll'] as const) {
                if (method === 'replaceAll' && !flags.includes('g'))
                  continue

                const label = `${JSON.stringify(source)}.${method}(/${pattern}/${flags}, ${JSON.stringify(replacement)})`

                assert.strictEqual(
                  new MagicString(source)[method](new RegExp(pattern, flags), replacement).toString(),
                  source[method](new RegExp(pattern, flags), replacement),
                  label,
                )
              }
            }
          }
        }
      })

      it('agrees with String.prototype for a string search value', () => {
        const sources = ['abcabc', 'hello world', 'foo bar foo']
        const needles = ['b', 'o', 'foo', 'zzz', '']
        const replacements = ['X', '$$', '$&', '$`', '$\'', '$1', '$0', '$<n>', '$', '[$&]', '$$&']

        for (const source of sources) {
          for (const needle of needles) {
            for (const replacement of replacements) {
              for (const method of ['replace', 'replaceAll'] as const) {
                const label = `${JSON.stringify(source)}.${method}(${JSON.stringify(needle)}, ${JSON.stringify(replacement)})`

                assert.strictEqual(
                  new MagicString(source)[method](needle, replacement).toString(),
                  source[method](needle, replacement),
                  label,
                )
              }
            }
          }
        }
      })
    })

    it('works with global regex replace function', () => {
      const code = 'hey this is magic'
      const s = new MagicString(code)

      s.replace(/(\w)(\w+)/g, (_, $1, $2) => `${$1.toUpperCase()}${$2}`)

      assert.strictEqual(s.toString(), 'Hey This Is Magic')
    })

    it('respects a custom RegExp Symbol.match implementation', () => {
      const regex = /x/
      regex[Symbol.match] = () => Object.assign(['a'], {
        index: 0,
        input: 'abc',
      }) as RegExpMatchArray

      assert.strictEqual(new MagicString('abc').replace(regex, 'Z').toString(), 'Zbc')
    })

    it('replace function offset', () => {
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_function_as_a_parameter
      function replacer(match: string, p1: string, p2: string, p3: string, offset: number, string: string, groups: Record<string, string> | undefined) {
        // p1 is nondigits, p2 digits, and p3 non-alphanumerics
        return [match, p1, p2, p3, offset, string, groups].join(' - ')
      }
      const code = 'abc12345#$*%'
      const regex = /(\D*)(\d*)(\W*)/
      assert.strictEqual(
        code.replace(regex, replacer),
        new MagicString(code).replace(regex, replacer).toString(),
      )
    })

    it('only passes the groups object when the pattern has named groups', () => {
      const args: any[][] = []
      const native: any[][] = []
      const code = 'abc'

      new MagicString(code).replace(/b/g, (...rest: any[]) => {
        args.push(rest)
        return 'Z'
      })
      code.replace(/b/g, (...rest: any[]) => {
        native.push(rest)
        return 'Z'
      })

      assert.deepEqual(args, native)
      assert.deepEqual(args, [['b', 1, code]])
    })

    it('passes the groups object when the pattern has named groups', () => {
      const args: any[][] = []
      const native: any[][] = []
      const code = 'abc'

      new MagicString(code).replace(/(?<mid>b)/g, (...rest: any[]) => {
        args.push(rest)
        return 'Z'
      })
      code.replace(/(?<mid>b)/g, (...rest: any[]) => {
        native.push(rest)
        return 'Z'
      })

      assert.deepEqual(args, native)
      assert.deepEqual(args, [['b', 'b', 1, code, { mid: 'b' }]])
    })

    it('should ignore non-changed replacements', () => {
      const code = 'a12bc345#$*%'
      const matched: string[] = []

      const s = new MagicString(code)

      assert.strictEqual(s.firstChunk, s.lastChunk)

      s.replace(/(\d)/g, (match: string, $1: string) => {
        matched.push($1)
        return match
      })

      assert.strictEqual(s.toString(), code)
      assert.deepEqual(matched, ['1', '2', '3', '4', '5'])

      assert.strictEqual(s.firstChunk, s.lastChunk)
    })

    it('should insert at a zero-length match instead of overwriting nothing', () => {
      // an empty match spans no characters, so there is no range to overwrite -
      // `String.prototype.replace` inserts at the matched position
      assert.strictEqual(new MagicString('abc').replace(/x?/, 'Y').toString(), 'Yabc')
      assert.strictEqual(new MagicString('abc').replace('', 'X').toString(), 'Xabc')
    })

    it('should terminate on a global regexp that matches the empty string', () => {
      assert.strictEqual(new MagicString('bab').replace(/a*/g, 'X').toString(), 'XbXXbX')
      assert.strictEqual(new MagicString('a b').replace(/\s*/g, '_').toString(), '_a__b_')
      assert.strictEqual(new MagicString('axb').replace(/x?/g, 'Y').toString(), 'YaYYbY')
    })

    it('should start a global regexp from the beginning of the string', () => {
      const re = /o/g
      re.exec('foo') // leaves lastIndex at 2

      assert.strictEqual(new MagicString('foo').replace(re, 'X').toString(), 'fXX')
      assert.strictEqual(re.lastIndex, 0)
    })

    it('does not resurrect removed content when the match sits on it', () => {
      // https://github.com/Rich-Harris/magic-string/issues/223
      assert.strictEqual(new MagicString('00').remove(0, 1).replace('0', '1').toString(), '1')
      assert.strictEqual(new MagicString('00').remove(0, 1).replace(/0/, '1').toString(), '1')
    })

    it('replaces the first match still present in the output', () => {
      // the first occurrence has been removed, so the second one is replaced,
      // and the replacer sees the surviving match's index
      const s = new MagicString('0-0').remove(0, 1).replace('0', (_, index) => String(index))
      assert.strictEqual(s.toString(), '-2')
    })

    it('does nothing when every match has been removed', () => {
      assert.strictEqual(new MagicString('00').remove(0, 2).replace('0', '1').toString(), '')
      assert.strictEqual(new MagicString('00').remove(0, 2).replace(/0/, '1').toString(), '')
    })
  })
})
