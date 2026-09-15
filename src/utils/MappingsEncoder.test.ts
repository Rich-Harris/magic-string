import type { FullSegment } from './MappingsEncoder.ts'
import { encode } from '@jridgewell/sourcemap-codec'
import { assert, describe, it } from 'vitest'
import { MappingsEncoder, SEGMENTS_PER_FLUSH } from './MappingsEncoder.ts'

describe('mappingsEncoder', () => {
  it('produces an empty string for no segments', () => {
    const encoder = new MappingsEncoder()
    assert.equal(encoder.finish([]), '')
  })

  it('encodes a single segment', () => {
    const encoder = new MappingsEncoder()
    assert.equal(encoder.finish([[0, 0, 0, 0]]), 'AAAA')
  })

  it('encodes segments on one line relative to each other', () => {
    const encoder = new MappingsEncoder()
    assert.equal(encoder.finish([[0, 0, 0, 0], [1, 0, 0, 1], [2, 0, 0, 2]]), 'AAAA,CAAC,CAAC')
  })

  it('encodes negative deltas', () => {
    const encoder = new MappingsEncoder()
    assert.equal(encoder.finish([[4, 0, 2, 8], [5, 0, 0, 1]]), encode([[[4, 0, 2, 8], [5, 0, 0, 1]]]))
  })

  it('includes the name index for five-field segments', () => {
    const encoder = new MappingsEncoder()
    assert.equal(
      encoder.finish([[0, 0, 0, 0, 1], [3, 0, 0, 3]]),
      encode([[[0, 0, 0, 0, 1], [3, 0, 0, 3]]]),
    )
  })

  it('separates lines ended with endLine by semicolons and resets the generated column', () => {
    const encoder = new MappingsEncoder()
    encoder.endLine([[4, 0, 0, 0]])
    encoder.endLine([])
    assert.equal(
      encoder.finish([[4, 0, 1, 0]]),
      encode([[[4, 0, 0, 0]], [], [[4, 0, 1, 0]]]),
    )
  })

  it('continues the current line after a partial flush through segments()', () => {
    const encoder = new MappingsEncoder()
    encoder.segments([[0, 0, 0, 0], [1, 0, 0, 1]])
    assert.equal(encoder.finish([[2, 0, 0, 2]]), 'AAAA,CAAC,CAAC')
  })

  it('drains buffered lines once enough segments accumulate', () => {
    const encoder = new MappingsEncoder()
    const decoded: FullSegment[][] = []
    for (let line = 0; line < SEGMENTS_PER_FLUSH + 10; line++) {
      const segments: FullSegment[] = [[0, 0, line, 0]]
      decoded.push(segments)
      encoder.endLine(segments)
    }
    decoded.push([])
    assert.equal(encoder.finish([]), encode(decoded))
  })

  it('encodes output larger than its internal byte buffer', () => {
    const segments: FullSegment[] = []
    for (let i = 0; i < 20000; i++) {
      segments.push([i, 0, 0, i])
    }
    const encoder = new MappingsEncoder()
    assert.equal(encoder.finish(segments), encode([segments]))
  })

  it('leaves nothing in the shared buffer for another encoder to overwrite', () => {
    const encoder = new MappingsEncoder()
    const decoded: FullSegment[][] = []
    for (let line = 0; line < SEGMENTS_PER_FLUSH; line++) {
      const segments: FullSegment[] = [[0, 0, line, 0]]
      decoded.push(segments)
      encoder.endLine(segments)
    }

    // a second encoder running to completion in between, as a map generated
    // inside a Bundle includeContent callback does
    new MappingsEncoder().finish([[0, 0, 0, 0], [1, 0, 0, 1]])

    decoded.push([])
    assert.equal(encoder.finish([]), encode(decoded))
  })
})
