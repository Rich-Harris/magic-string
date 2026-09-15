import type { ExclusionRange } from '../../src/index.ts'
import { assert, describe, it } from 'vitest'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('clone', () => {
    it('should clone a magic string', () => {
      const s = new MagicString('abcdefghijkl')

      s.overwrite(3, 9, 'XYZ')
      const c = s.clone()

      assert.notEqual(s, c)
      assert.equal(c.toString(), 'abcXYZjkl')
    })

    it('should clone filename info', () => {
      const s = new MagicString('abcdefghijkl', { filename: 'foo.js' })
      const c = s.clone()

      assert.equal(c.filename, 'foo.js')
    })

    it('should clone indentExclusionRanges', () => {
      const array: ExclusionRange = [3, 6]
      const source = new MagicString('abcdefghijkl', {
        filename: 'foo.js',
        indentExclusionRanges: array,
      })

      const clone = source.clone()

      assert.notStrictEqual(source.indentExclusionRanges, clone.indentExclusionRanges)
      assert.deepEqual(source.indentExclusionRanges, clone.indentExclusionRanges)
    })

    it('should clone complex indentExclusionRanges', () => {
      const array: ExclusionRange[] = [
        [3, 6],
        [7, 9],
      ]
      const source = new MagicString('abcdefghijkl', {
        filename: 'foo.js',
        indentExclusionRanges: array,
      })

      const clone = source.clone()

      assert.notStrictEqual(source.indentExclusionRanges, clone.indentExclusionRanges)
      assert.deepEqual(source.indentExclusionRanges, clone.indentExclusionRanges)
    })

    it('should clone sourcemapLocations', () => {
      const source = new MagicString('abcdefghijkl', {
        filename: 'foo.js',
      })

      source.addSourcemapLocation(3)

      const clone = source.clone()

      assert.notStrictEqual(source.sourcemapLocations, clone.sourcemapLocations)
      assert.deepEqual(source.sourcemapLocations, clone.sourcemapLocations)
    })

    it('should clone intro and outro', () => {
      const source = new MagicString('defghi')

      source.prepend('abc')
      source.append('jkl')

      const clone = source.clone()

      assert.equal(source.toString(), clone.toString())
    })

    it('should clone the ignore-list hint', () => {
      const source = new MagicString('abcdefghijkl', {
        filename: 'foo.js',
        ignoreList: true,
      })

      const clone = source.clone()

      assert.equal(clone.ignoreList, true)
      assert.deepEqual(clone.generateMap({ includeContent: false }).x_google_ignoreList, [0])
    })

    it('should clone stored names', () => {
      const source = new MagicString('abcdefghijkl', { filename: 'foo.js' })

      source.update(3, 9, 'XYZ', { storeName: true })

      const clone = source.clone()

      assert.notStrictEqual(source.storedNames, clone.storedNames)
      assert.deepEqual(clone.generateMap({ includeContent: false }).names, ['defghi'])
    })

    it('should not share stored names with the clone', () => {
      const source = new MagicString('abcdefghijkl', { filename: 'foo.js' })

      source.update(3, 9, 'XYZ', { storeName: true })

      const clone = source.clone()
      clone.update(0, 3, 'ABC', { storeName: true })

      assert.deepEqual(source.generateMap({ includeContent: false }).names, ['defghi'])
    })
  })
})
