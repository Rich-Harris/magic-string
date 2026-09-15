import { assert, describe, it } from 'vitest'
import { Stats } from './Stats.ts'

describe('stats', () => {
  it('accumulates elapsed time under a label across multiple time/timeEnd calls', () => {
    const stats = new Stats()

    stats.time('foo')
    stats.timeEnd('foo')
    assert.equal(typeof stats.foo, 'number')
    assert.isAtLeast(stats.foo as number, 0)

    const first = stats.foo as number

    stats.time('foo')
    stats.timeEnd('foo')
    assert.isAtLeast(stats.foo as number, first)
  })

  it('tracks separate labels independently', () => {
    const stats = new Stats()

    stats.time('a')
    stats.timeEnd('a')
    stats.time('b')
    stats.timeEnd('b')

    assert.equal(typeof stats.a, 'number')
    assert.equal(typeof stats.b, 'number')
  })

  it('does not enumerate startTimes as an own property', () => {
    const stats = new Stats()
    assert.equal(Object.keys(stats).length, 0)
  })
})
