import type { RawSourceMap } from 'source-map-js'
import { SourceMapConsumer } from 'source-map-js'
import { assert, describe, it } from 'vitest'
import { Bundle } from '../../src/index.ts'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('bundle', () => {
  describe('mappings', () => {
    it('should produce correct mappings after remove and move in multiple sources', () => {
      const s1 = 'ABCDE'
      const ms1 = new MagicString(s1, { filename: 'first' })

      const s2 = 'VWXYZ'
      const ms2 = new MagicString(s2, { filename: 'second' })

      const bundle = new Bundle()
      bundle.addSource(ms1)
      bundle.addSource(ms2)

      ms1.remove(2, 4) // ABE
      ms1.move(0, 1, 5) // BEA

      ms2.remove(2, 4) // VWZ
      ms2.move(0, 1, 5) // WZV

      const map = bundle.generateMap({ file: 'result', hires: true, includeContent: true })
      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)

      const result1 = ms1.toString()
      assert.strictEqual(result1, 'BEA')

      const result2 = ms2.toString()
      assert.strictEqual(result2, 'WZV')

      assert.strictEqual(bundle.toString(), 'BEA\nWZV')

      // B = B
      // E = E
      // A = A
      let line = 1
      for (let i = 0; i < result1.length; i++) {
        const loc = smc.originalPositionFor({ line, column: i })
        assert.strictEqual(s1[loc.column], result1[i])
      }

      // W = W
      // Z = Z
      // V = V
      line = 2
      for (let i = 0; i < result2.length; i++) {
        const loc = smc.originalPositionFor({ line, column: i })
        assert.strictEqual(s2[loc.column], result2[i])
      }

      assert.strictEqual(
        map.toString(),
        '{"version":3,"file":"result","sources":["first","second"],"sourcesContent":["ABCDE","VWXYZ"],"names":[],"mappings":"AAAC,CAAG,CAAJ;ACAC,CAAG,CAAJ"}',
      )
    })
  })
})
