import type Chunk from '../../src/Chunk.ts'
import { assert } from 'vitest'
import MagicString from '../../src/index.ts'

class IntegrityCheckingMagicString extends MagicString {
  checkIntegrity() {
    let prevChunk: Chunk | null = null
    let chunk: Chunk | null = this.firstChunk
    let numNodes = 0
    while (chunk) {
      assert.strictEqual(this.byStart.get(chunk.start), chunk)
      assert.strictEqual(this.byEnd.get(chunk.end), chunk)
      assert.strictEqual(chunk.previous, prevChunk)
      if (prevChunk) {
        assert.strictEqual(prevChunk.next, chunk)
      }
      prevChunk = chunk
      chunk = chunk.next
      numNodes++
    }
    assert.strictEqual(prevChunk, this.lastChunk)
    assert.strictEqual(this.lastChunk.next, null)
    assert.strictEqual(this.byStart.size, numNodes)
    assert.strictEqual(this.byEnd.size, numNodes)
  }
}

for (const key in MagicString.prototype) {
  if (!Object.hasOwn(MagicString.prototype, key)) {
    continue
  }
  const func = (MagicString.prototype as unknown as Record<string, unknown>)[key]
  if (typeof func === 'function') {
    (IntegrityCheckingMagicString.prototype as unknown as Record<string, unknown>)[key] = function (this: IntegrityCheckingMagicString, ...args: unknown[]) {
      const result = (func as (...a: unknown[]) => unknown).apply(this, args)
      try {
        this.checkIntegrity()
      }
      catch (e) {
        const err = e as Error
        err.message = `Integrity error after invoking ${key}:\n${err.message}`
        throw err
      }
      return result
    }
  }
}

export default IntegrityCheckingMagicString
