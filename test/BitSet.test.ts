import { assert, describe, it } from 'vitest'
import BitSet from '../src/BitSet.ts'

describe('bitSet', () => {
  it('tracks added bits', () => {
    const set = new BitSet()

    assert.equal(set.has(3), false)
    set.add(3)
    assert.equal(set.has(3), true)
    assert.equal(set.has(4), false)
  })

  it('handles bits across word boundaries', () => {
    const set = new BitSet()

    set.add(31)
    set.add(32)
    set.add(63)

    assert.equal(set.has(31), true)
    assert.equal(set.has(32), true)
    assert.equal(set.has(63), true)
    assert.equal(set.has(0), false)
  })

  it('clones bits from another BitSet', () => {
    const set = new BitSet()
    set.add(5)

    const clone = new BitSet(set)
    clone.add(9)

    assert.equal(clone.has(5), true)
    assert.equal(clone.has(9), true)
    assert.equal(set.has(9), false)
  })
})
