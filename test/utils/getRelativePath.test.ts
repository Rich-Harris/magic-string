import { assert, describe, it } from 'vitest'
import getRelativePath from '../../src/utils/getRelativePath.ts'

describe('getRelativePath', () => {
  it('returns the sibling filename when in the same directory', () => {
    assert.equal(getRelativePath('src/foo.js', 'src/bar.js'), 'bar.js')
  })

  it('walks up directories when the target is further up the tree', () => {
    assert.equal(getRelativePath('src/nested/foo.js', 'bar.js'), '../../bar.js')
  })

  it('walks down into a nested directory', () => {
    assert.equal(getRelativePath('src/foo.js', 'src/nested/bar.js'), 'nested/bar.js')
  })
})
