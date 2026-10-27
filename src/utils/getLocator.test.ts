import { assert, describe, it } from 'vitest'
import { getLineOffsets, getLocator } from './getLocator.ts'

describe('getLocator', () => {
  it('locates a position on the first line', () => {
    const locate = getLocator(getLineOffsets('abc\ndef\nghi'))
    assert.deepEqual(locate(0), { line: 0, column: 0 })
    assert.deepEqual(locate(2), { line: 0, column: 2 })
  })

  it('locates a position on a subsequent line', () => {
    const locate = getLocator(getLineOffsets('abc\ndef\nghi'))
    assert.deepEqual(locate(4), { line: 1, column: 0 })
    assert.deepEqual(locate(6), { line: 1, column: 2 })
    assert.deepEqual(locate(8), { line: 2, column: 0 })
  })

  it('handles a source with no newlines', () => {
    const locate = getLocator(getLineOffsets('abcdef'))
    assert.deepEqual(locate(0), { line: 0, column: 0 })
    assert.deepEqual(locate(5), { line: 0, column: 5 })
  })

  it('treats the newline character itself as belonging to the preceding line', () => {
    const locate = getLocator(getLineOffsets('ab\ncd'))
    assert.deepEqual(locate(2), { line: 0, column: 2 })
  })

  it('ends a line at every line terminator, counting CRLF once', () => {
    const locate = getLocator(getLineOffsets('a\rb\r\nc\u2028d\u2029e'))
    assert.deepEqual(locate(2), { line: 1, column: 0 })
    assert.deepEqual(locate(5), { line: 2, column: 0 })
    assert.deepEqual(locate(7), { line: 3, column: 0 })
    assert.deepEqual(locate(9), { line: 4, column: 0 })
  })
})
