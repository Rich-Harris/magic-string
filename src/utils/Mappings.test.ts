import type { SourceLocation } from './getLocator.ts'
import { assert, describe, it } from 'vitest'
import { BitSet } from '../BitSet.ts'
import { Chunk } from '../Chunk.ts'
import { Mappings } from './Mappings.ts'

function loc(line: number, column: number): SourceLocation {
  return { line, column }
}

describe('mappings', () => {
  it('starts with an empty raw mapping for the first line', () => {
    const mappings = new Mappings(false)
    assert.deepEqual(mappings.raw, [[]])
    assert.equal(mappings.generatedCodeLine, 0)
    assert.equal(mappings.generatedCodeColumn, 0)
    assert.equal(mappings.pending, null)
  })

  describe('addEdit', () => {
    it('adds a segment for single-line content', () => {
      const mappings = new Mappings(false)
      mappings.addEdit(0, 'xyz', loc(2, 4), -1)

      assert.deepEqual(mappings.raw, [[[0, 0, 2, 4]]])
      assert.equal(mappings.generatedCodeColumn, 3)
    })

    it('includes the name index when given', () => {
      const mappings = new Mappings(false)
      mappings.addEdit(0, 'xyz', loc(0, 0), 5)

      assert.deepEqual(mappings.raw, [[[0, 0, 0, 0, 5]]])
    })

    it('does nothing for empty content with no pending segment', () => {
      const mappings = new Mappings(false)
      mappings.addEdit(0, '', loc(0, 0), -1)

      assert.deepEqual(mappings.raw, [[]])
    })

    it('flushes a pending segment when content is empty', () => {
      const mappings = new Mappings(false)
      mappings.pending = [0, 0, 0, 0]
      mappings.addEdit(0, '', loc(0, 0), -1)

      assert.deepEqual(mappings.raw, [[[0, 0, 0, 0]]])
      assert.equal(mappings.pending, null)
    })

    it('creates a new line for each newline in multi-line content', () => {
      const mappings = new Mappings(false)
      mappings.addEdit(0, 'ab\ncd', loc(0, 0), -1)

      assert.deepEqual(mappings.raw, [
        [[0, 0, 0, 0]],
        [[0, 0, 0, 0]],
      ])
      assert.equal(mappings.generatedCodeLine, 1)
      assert.equal(mappings.generatedCodeColumn, 2)
    })

    it('does not add a trailing segment when content ends with a newline', () => {
      const mappings = new Mappings(false)
      mappings.addEdit(0, 'ab\n', loc(0, 0), -1)

      assert.deepEqual(mappings.raw, [
        [[0, 0, 0, 0]],
        [],
      ])
      assert.equal(mappings.generatedCodeLine, 1)
      assert.equal(mappings.generatedCodeColumn, 0)
    })
  })

  describe('advance', () => {
    it('does nothing for an empty string', () => {
      const mappings = new Mappings(false)
      mappings.advance('')

      assert.equal(mappings.generatedCodeLine, 0)
      assert.equal(mappings.generatedCodeColumn, 0)
    })

    it('moves the column forward for a single-line string', () => {
      const mappings = new Mappings(false)
      mappings.advance('abc')

      assert.equal(mappings.generatedCodeLine, 0)
      assert.equal(mappings.generatedCodeColumn, 3)
    })

    it('moves to a new line for each newline', () => {
      const mappings = new Mappings(false)
      mappings.advance('a\nbc\nd')

      assert.equal(mappings.generatedCodeLine, 2)
      assert.equal(mappings.generatedCodeColumn, 1)
      assert.deepEqual(mappings.raw, [[], [], []])
    })
  })

  describe('addUneditedChunk', () => {
    it('adds one segment per line by default (non-hires)', () => {
      const mappings = new Mappings(false)
      const original = 'ab\ncd'
      const chunk = new Chunk(0, original.length, original)
      const location = loc(0, 0)

      mappings.addUneditedChunk(0, chunk, original, location, new BitSet())

      assert.deepEqual(mappings.raw, [
        [[0, 0, 0, 0]],
        [[0, 0, 1, 0]],
      ])
      assert.deepEqual(location, { line: 1, column: 2 })
    })

    it('adds a segment for each explicit sourcemap location (non-hires)', () => {
      const mappings = new Mappings(false)
      const original = 'abcd'
      const chunk = new Chunk(0, original.length, original)
      const locations = new BitSet()
      locations.add(2)

      mappings.addUneditedChunk(0, chunk, original, loc(0, 0), locations)

      assert.deepEqual(mappings.raw, [
        [[0, 0, 0, 0], [2, 0, 0, 2]],
      ])
    })

    it('adds one segment per character when hires is true', () => {
      const mappings = new Mappings(true)
      const original = 'ab\ncd'
      const chunk = new Chunk(0, original.length, original)

      mappings.addUneditedChunk(0, chunk, original, loc(0, 0), new BitSet())

      assert.deepEqual(mappings.raw, [
        [[0, 0, 0, 0], [1, 0, 0, 1]],
        [[0, 0, 1, 0], [1, 0, 1, 1]],
      ])
    })

    it('groups segments by word boundary when hires is "boundary"', () => {
      const mappings = new Mappings('boundary')
      const original = 'ab cd'
      const chunk = new Chunk(0, original.length, original)

      mappings.addUneditedChunk(0, chunk, original, loc(0, 0), new BitSet())

      assert.deepEqual(mappings.raw, [
        [[0, 0, 0, 0], [2, 0, 0, 2], [3, 0, 0, 3]],
      ])
    })

    it('adds a single range segment when hires is "experimental-range"', () => {
      const mappings = new Mappings('experimental-range')
      const original = 'abcd'
      const chunk = new Chunk(0, original.length, original)

      mappings.addUneditedChunk(0, chunk, original, loc(0, 0), new BitSet())

      assert.deepEqual(mappings.raw, [
        [[0, 0, 0, 0], [3, 0, 0, 3]],
      ])
      assert.deepEqual(mappings.rawRangeMappingsIndices, [0])
    })

    it('clears the pending segment', () => {
      const mappings = new Mappings(false)
      mappings.pending = [0, 0, 0, 0]
      const original = 'a'
      const chunk = new Chunk(0, original.length, original)

      mappings.addUneditedChunk(0, chunk, original, loc(0, 0), new BitSet())

      assert.equal(mappings.pending, null)
    })
  })
})
