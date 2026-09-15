import { assert, describe, it } from 'vitest'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('slice', () => {
    it('should return the generated content between the specified original characters', () => {
      const s = new MagicString('abcdefghijkl')

      assert.equal(s.slice(3, 9), 'defghi')
      s.overwrite(4, 8, 'XX')
      assert.equal(s.slice(3, 9), 'dXXi')
      s.overwrite(2, 10, 'ZZ')
      assert.equal(s.slice(1, 11), 'bZZk')
      assert.equal(s.slice(2, 10), 'ZZ')

      assert.throws(() => s.slice(3, 9))
    })

    it('should support slicing an empty string', () => {
      const s = new MagicString('')
      assert.equal(s.slice(), '')
    })

    it('defaults `end` to the original string length', () => {
      const s = new MagicString('abcdefghijkl')
      assert.equal(s.slice(3), 'defghijkl')
    })

    it('allows negative numbers as arguments', () => {
      const s = new MagicString('abcdefghijkl')
      assert.equal(s.slice(-3), 'jkl')
      assert.equal(s.slice(0, -3), 'abcdefghi')
    })

    it('clamps negative indices below -length instead of wrapping repeatedly', () => {
      const s = new MagicString('problems = 99')
      assert.equal(s.slice(-100, 5), 'probl')
      assert.equal(s.slice(-100, -1), 'problems = 9')

      const sRemove = new MagicString('problems = 99')
      sRemove.remove(-100, 5)
      assert.equal(sRemove.toString(), 'ems = 99')

      const sUpdate = new MagicString('problems = 99')
      sUpdate.update(-100, 5, 'solution')
      assert.equal(sUpdate.toString(), 'solutionems = 99')

      const sReset = new MagicString('problems = 99')
      sReset.update(0, 5, 'XXXXX')
      sReset.reset(-100, 5)
      assert.equal(sReset.toString(), 'problems = 99')
    })

    it('includes inserted characters, respecting insertion direction', () => {
      const s = new MagicString('abefij')

      s.prependRight(2, 'cd')
      s.appendLeft(4, 'gh')

      assert.equal(s.slice(), 'abcdefghij')
      assert.equal(s.slice(1, 5), 'bcdefghi')
      assert.equal(s.slice(2, 4), 'cdefgh')
      assert.equal(s.slice(3, 4), 'fgh')
      assert.equal(s.slice(0, 2), 'ab')
      assert.equal(s.slice(0, 3), 'abcde')
      assert.equal(s.slice(4, 6), 'ij')
      assert.equal(s.slice(3, 6), 'fghij')
    })

    it('supports characters moved outward', () => {
      const s = new MagicString('abcdEFghIJklmn')

      s.move(4, 6, 2)
      s.move(8, 10, 12)
      assert.equal(s.toString(), 'abEFcdghklIJmn')

      assert.equal(s.slice(1, -1), 'bEFcdghklIJm')
      assert.equal(s.slice(2, -2), 'cdghkl')
      assert.equal(s.slice(3, -3), 'dghk')
      assert.equal(s.slice(4, -4), 'EFcdghklIJ')
      assert.equal(s.slice(5, -5), 'FcdghklI')
      assert.equal(s.slice(6, -6), 'gh')
    })

    it('supports characters moved inward', () => {
      const s = new MagicString('abCDefghijKLmn')

      s.move(2, 4, 6)
      s.move(10, 12, 8)
      assert.equal(s.toString(), 'abefCDghKLijmn')

      assert.equal(s.slice(1, -1), 'befCDghKLijm')
      assert.equal(s.slice(2, -2), 'CDghKL')
      assert.equal(s.slice(3, -3), 'DghK')
      assert.equal(s.slice(4, -4), 'efCDghKLij')
      assert.equal(s.slice(5, -5), 'fCDghKLi')
      assert.equal(s.slice(6, -6), 'gh')
    })

    it('supports characters moved opposing', () => {
      const s = new MagicString('abCDefghIJkl')

      s.move(2, 4, 8)
      s.move(8, 10, 4)
      assert.equal(s.toString(), 'abIJefghCDkl')

      assert.equal(s.slice(1, -1), 'bIJefghCDk')
      assert.equal(s.slice(2, -2), '')
      assert.equal(s.slice(3, -3), '')
      assert.equal(s.slice(-3, 3), 'JefghC')
      assert.equal(s.slice(4, -4), 'efgh')
      assert.equal(s.slice(0, 3), 'abIJefghC')
      assert.equal(s.slice(3), 'Dkl')
      assert.equal(s.slice(0, -3), 'abI')
      assert.equal(s.slice(-3), 'JefghCDkl')
    })

    it('errors if replaced characters are used as slice anchors', () => {
      const s = new MagicString('abcdef')
      s.overwrite(2, 4, 'CD')

      assert.throws(() => s.slice(2, 3), /slice end anchor/)

      assert.throws(() => s.slice(3, 4), /slice start anchor/)

      assert.throws(() => s.slice(3, 5), /slice start anchor/)

      assert.equal(s.slice(1, 5), 'bCDe')
    })

    it('does not error if slice is after removed characters', () => {
      const s = new MagicString('abcdef')

      s.remove(0, 2)

      assert.equal(s.slice(2, 4), 'cd')
    })

    it('treats an end of zero as an empty upper bound', () => {
      const s = new MagicString('hello')
      assert.equal(s.slice(0, 0), '')
      assert.equal(s.slice(3, 0), '')
      assert.equal(s.slice(0, -100), '')
      assert.equal(s.slice(5, 0), '')
    })

    it('walks moved chunks when the end is zero', () => {
      const s = new MagicString('abcde')
      s.move(0, 2, 5)
      assert.equal(s.toString(), 'cdeab')
      assert.equal(s.slice(2, 0), 'cde')
      assert.equal(s.slice(4, 0), 'e')
      assert.equal(s.slice(1, 0), '')
    })
  })
})
