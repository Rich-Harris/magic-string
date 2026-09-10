import type { SourceMapSegment } from '../src/index.ts'
import { Buffer } from 'node:buffer'
import { assert, describe, it } from 'vitest'
import { SourceMap } from '../src/index.ts'

describe('magicString.SourceMap', () => {
  describe('options', () => {
    it('preserves ignore list information', () => {
      const map = new SourceMap({
        file: 'foo.min.js',
        sources: ['foo.js'],
        sourcesContent: ['42'],
        names: [],
        mappings: [[0, 0]] as unknown as SourceMapSegment[][],
        x_google_ignoreList: [0],
      })

      assert.deepEqual(map.x_google_ignoreList, [0])
    })
  })

  describe('toString', () => {
    it('serializes ignore list information', () => {
      const map = new SourceMap({
        file: 'foo.min.js',
        sources: ['foo.js'],
        sourcesContent: ['42'],
        names: [],
        mappings: [[0, 0]] as unknown as SourceMapSegment[][],
        x_google_ignoreList: [0],
      })

      assert.equal(
        map.toString(),
        '{"version":3,"file":"foo.min.js","sources":["foo.js"],"sourcesContent":["42"],"names":[],"mappings":"AAAAA,AAAAA","x_google_ignoreList":[0]}',
      )
    })

    it('preserves debugId', () => {
      const map = new SourceMap({
        file: 'foo.min.js',
        sources: ['foo.js'],
        names: [],
        mappings: [],
        debugId: 'abc123',
      })

      assert.equal(map.debugId, 'abc123')
      assert.match(map.toString(), /"debugId":"abc123"/)
    })
  })

  describe('toUrl', () => {
    it('returns a base64-encoded data URI', () => {
      const map = new SourceMap({
        file: 'foo.min.js',
        sources: ['foo.js'],
        names: [],
        mappings: [],
      })

      const url = map.toUrl()
      assert.match(url, /^data:application\/json;charset=utf-8;base64,/)

      const base64 = url.slice(url.indexOf(',') + 1)
      const decoded = Buffer.from(base64, 'base64').toString('utf-8')
      assert.deepEqual(JSON.parse(decoded), JSON.parse(map.toString()))
    })
  })
})
