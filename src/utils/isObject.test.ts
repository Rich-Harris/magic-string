import { assert, describe, it } from 'vitest'
import { isObject } from './isObject.ts'

describe('isObject', () => {
  it('returns true for plain objects', () => {
    assert.equal(isObject({}), true)
    assert.equal(isObject({ foo: 'bar' }), true)
  })

  it('returns false for arrays', () => {
    assert.equal(isObject([]), false)
  })

  it('returns false for primitives', () => {
    assert.equal(isObject('string'), false)
    assert.equal(isObject(42), false)
    assert.equal(isObject(true), false)
    assert.equal(isObject(null), false)
    assert.equal(isObject(undefined), false)
  })

  it('returns true for class instances (relies on the default Object.prototype.toString tag)', () => {
    class Foo {}
    assert.equal(isObject(new Foo()), true)
  })

  it('returns false for built-ins with a distinct toStringTag, like Map', () => {
    assert.equal(isObject(new Map()), false)
  })

  it('returns false for functions', () => {
    assert.equal(isObject(() => {}), false)
  })
})
