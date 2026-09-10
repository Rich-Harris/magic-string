import { assert, describe, it } from 'vitest'
import Chunk from '../src/Chunk.ts'

describe('chunk', () => {
  describe('eachPrevious', () => {
    it('visits this chunk and every previous chunk in order', () => {
      const a = new Chunk(0, 1, 'a')
      const b = new Chunk(1, 2, 'b')
      const c = new Chunk(2, 3, 'c')

      a.next = b
      b.previous = a
      b.next = c
      c.previous = b

      const visited: Chunk[] = []
      c.eachPrevious(chunk => visited.push(chunk))

      assert.deepEqual(visited, [c, b, a])
    })
  })

  describe('trimEnd', () => {
    it('returns true and stops trimming when the outro still has content', () => {
      const chunk = new Chunk(0, 3, 'abc')
      chunk.outro = ' x '

      const result = chunk.trimEnd(/\s+$/)

      assert.equal(result, true)
      assert.equal(chunk.outro, ' x')
      assert.equal(chunk.content, 'abc')
    })
  })

  describe('trimStart', () => {
    it('returns true when the outro still has content after the content is fully trimmed', () => {
      const chunk = new Chunk(0, 3, '   ')
      chunk.outro = ' x'

      const result = chunk.trimStart(/\s+/)

      assert.equal(result, true)
      assert.equal(chunk.content, '')
      assert.equal(chunk.outro, 'x')
    })
  })
})
