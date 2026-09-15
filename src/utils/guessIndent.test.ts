import { assert, describe, it } from 'vitest'
import { guessIndent } from './guessIndent.ts'

describe('guessIndent', () => {
  it('returns null when no indentation is present', () => {
    assert.equal(guessIndent('foo\nbar\nbaz'), null)
  })

  it('detects tab indentation', () => {
    assert.equal(guessIndent('foo\n\tbar\n\tbaz'), '\t')
  })

  it('detects space indentation and returns the smallest indent', () => {
    assert.equal(guessIndent('foo\n  bar\n    baz'), '  ')
  })

  it('ignores single-space indentation', () => {
    assert.equal(guessIndent('foo\n bar\n baz'), null)
  })

  it('defaults to tabs on a tie', () => {
    assert.equal(guessIndent('foo\n\tbar\n  baz'), '\t')
  })

  it('prefers tabs when there are more tabbed lines than spaced lines', () => {
    assert.equal(guessIndent('foo\n\tbar\n\tbaz\n  qux'), '\t')
  })
})
