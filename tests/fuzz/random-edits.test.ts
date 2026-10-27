import { assert, describe, it } from 'vitest'
import { MagicStringError } from '../../src/index.ts'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'
import { EditModel, EditModelError } from './edit-model.ts'

type Op
  = | { kind: 'append' | 'prepend', content: string }
    | { kind: 'appendLeft' | 'appendRight' | 'prependLeft' | 'prependRight', index: number, content: string }
    | { kind: 'update', start: number, end: number, content: string, overwrite: boolean }
    | { kind: 'overwrite', start: number, end: number, content: string }
    | { kind: 'remove' | 'reset', start: number, end: number }

// Each entry skips one confirmed divergence and points at its block in tests/fuzz/FINDINGS.md
const knownDivergences: Array<(ops: Op[]) => boolean> = []

const seed = Number(process.env.FUZZ_SEED ?? 1)
const count = Number(process.env.FUZZ_SEQUENCES ?? 1000)

const ALPHABET = 'abcdefghij'
const CONTENTS = ['', 'X', 'yz', '\n']
const KINDS = ['append', 'prepend', 'appendLeft', 'appendRight', 'prependLeft', 'prependRight', 'update', 'overwrite', 'remove', 'reset'] as const

interface Editable {
  append: (content: string) => void
  prepend: (content: string) => void
  appendLeft: (index: number, content: string) => void
  appendRight: (index: number, content: string) => void
  prependLeft: (index: number, content: string) => void
  prependRight: (index: number, content: string) => void
  update: (start: number, end: number, content: string, options: { overwrite: boolean }) => void
  overwrite: (start: number, end: number, content: string) => void
  remove: (start: number, end: number) => void
  reset: (start: number, end: number) => void
}

function mulberry32(state: number): () => number {
  return () => {
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generate(random: () => number): { original: string, ops: Op[] } {
  const int = (max: number): number => Math.floor(random() * max)
  const pick = <T>(items: readonly T[]): T => items[int(items.length)]
  const n = 2 + int(7)
  const range = (): { start: number, end: number } => {
    if (random() < 0.7) {
      const start = int(n)
      return { start, end: start + 1 + int(n - start) }
    }
    if (random() < 0.5) {
      const index = int(n + 1)
      return { start: index, end: index }
    }
    const end = int(n)
    return { start: end + 1 + int(n - end), end }
  }

  const ops = Array.from({ length: 1 + int(8) }, (): Op => {
    const kind = pick(KINDS)
    switch (kind) {
      case 'append':
      case 'prepend':
        return { kind, content: pick(CONTENTS) }
      case 'appendLeft':
      case 'appendRight':
      case 'prependLeft':
      case 'prependRight':
        return { kind, index: int(n + 1), content: pick(CONTENTS) }
      case 'update':
        return { kind, ...range(), content: pick(CONTENTS), overwrite: random() < 0.5 }
      case 'overwrite':
        return { kind, ...range(), content: pick(CONTENTS) }
      default:
        return { kind, ...range() }
    }
  })
  return { original: ALPHABET.slice(0, n), ops }
}

function applyOp(target: Editable, op: Op): void {
  switch (op.kind) {
    case 'append':
    case 'prepend':
      return target[op.kind](op.content)
    case 'appendLeft':
    case 'appendRight':
    case 'prependLeft':
    case 'prependRight':
      return target[op.kind](op.index, op.content)
    case 'update':
      return target.update(op.start, op.end, op.content, { overwrite: op.overwrite })
    case 'overwrite':
      return target.overwrite(op.start, op.end, op.content)
    case 'remove':
    case 'reset':
      return target[op.kind](op.start, op.end)
  }
}

function formatOp(op: Op): string {
  const content = 'content' in op ? JSON.stringify(op.content) : ''
  switch (op.kind) {
    case 'append':
    case 'prepend':
      return `s.${op.kind}(${content})`
    case 'appendLeft':
    case 'appendRight':
    case 'prependLeft':
    case 'prependRight':
      return `s.${op.kind}(${op.index}, ${content})`
    case 'update':
      return `s.update(${op.start}, ${op.end}, ${content}${op.overwrite ? ', { overwrite: true }' : ''})`
    case 'overwrite':
      return `s.overwrite(${op.start}, ${op.end}, ${content})`
    case 'remove':
    case 'reset':
      return `s.${op.kind}(${op.start}, ${op.end})`
  }
}

/** Whether `fn` threw `expected`; any other error is a crash and propagates */
function throws(fn: () => void, expected: typeof MagicStringError | typeof EditModelError): boolean {
  try {
    fn()
    return false
  }
  catch (e) {
    if (e instanceof expected)
      return true
    throw e
  }
}

function sliceOutcome(fn: () => string, expected: typeof MagicStringError | typeof EditModelError): string {
  try {
    return JSON.stringify(fn())
  }
  catch (e) {
    if (e instanceof expected)
      return '<throws>'
    throw e
  }
}

/** Returns a description of the first property violated, or null */
function check(original: string, ops: Op[], random: () => number): string | null {
  const n = original.length
  const s = new MagicString(original)
  const model = new EditModel(original)
  const presplit = new MagicString(original)
  for (let i = 1; i < n; i++)
    presplit.appendLeft(i, '')
  let compareSplits = true
  let output = original

  const differ = (property: string, expected: string | number | boolean, actual: string | number | boolean): string | null =>
    Object.is(expected, actual) ? null : `${property}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`

  for (const [k, op] of ops.entries()) {
    const at = `after op ${k + 1} (${formatOp(op)}): `
    const before = output
    const threw = throws(() => applyOp(s, op), MagicStringError)
    const modelThrew = throws(() => applyOp(model, op), EditModelError)
    const presplitThrew = throws(() => applyOp(presplit, op), MagicStringError)

    output = s.toString()

    const failure
      = differ('throws', modelThrew, threw)
        ?? (threw ? differ('atomicity', before, output) : null)
        ?? differ('toString', model.toString(), output)
        ?? differ('length', model.length(), s.length())
        ?? differ('hasChanged', model.hasChanged(), s.hasChanged())
        ?? differ('isEmpty', model.isEmpty(), s.isEmpty())
        ?? differ('clone', output, s.clone().toString())
    if (failure)
      return at + failure

    for (let j = 0; j < 3; j++) {
      const start = Math.floor(random() * n)
      const end = start + 1 + Math.floor(random() * (n - start))
      const sliceFailure = differ(
        `slice(${start}, ${end})`,
        sliceOutcome(() => model.slice(start, end), EditModelError),
        sliceOutcome(() => s.slice(start, end), MagicStringError),
      )
      if (sliceFailure)
        return at + sliceFailure
    }

    if (compareSplits) {
      // Pre-splitting removes every split, so the only throw it can avoid is
      // splitting inside a replacement; past that the two histories differ
      if (threw && !presplitThrew) {
        compareSplits = false
      }
      else {
        const splitFailure = differ('split-invariance throws', threw, presplitThrew)
          ?? differ('split-invariance toString', output, presplit.toString())
        if (splitFailure)
          return at + splitFailure
      }
    }
  }

  const lineStarts = [0]
  for (const [i, char] of [...original].entries()) {
    if (char === '\n')
      lineStarts.push(i + 1)
  }
  for (const line of s.generateDecodedMap({ hires: true }).mappings) {
    for (const segment of line) {
      if (segment.length === 1)
        continue
      const [, , sourceLine, sourceColumn] = segment
      const offset = lineStarts[sourceLine] + sourceColumn
      if (sourceLine >= lineStarts.length || offset >= (lineStarts[sourceLine + 1] ?? n))
        return `map-bounds: segment ${JSON.stringify(segment)} points outside the original`
    }
  }
  return null
}

describe('magicString', () => {
  describe('random edit sequences', () => {
    it(`agree with the reference edit model (seed ${seed}, ${count} sequences)`, { timeout: 0 }, () => {
      const failures: Array<{ ops: Op[], report: string }> = []
      let skipped = 0
      for (let i = 0; i < count; i++) {
        const random = mulberry32((seed * 0x9E3779B1 + i) | 0)
        const { original, ops } = generate(random)
        if (knownDivergences.some(matches => matches(ops))) {
          skipped++
          continue
        }
        let failure: string | null
        try {
          failure = check(original, ops, random)
        }
        catch (e) {
          failure = `crash: ${e instanceof Error ? e.message : String(e)}`
        }
        if (failure) {
          const replay = [`const s = new MagicString(${JSON.stringify(original)})`, ...ops.map(formatOp)].join('; ')
          failures.push({ ops, report: `FUZZ_SEED=${seed} sequence ${i}\n  ${replay}\n  ${failure}` })
        }
      }
      console.warn(`random edit sequences: ${count - skipped} checked, ${skipped} skipped as known divergences`)
      if (failures.length) {
        const shortest = failures.sort((a, b) => a.ops.length - b.ops.length).slice(0, 5)
        assert.fail(`${failures.length} of ${count} sequences diverge, shortest:\n${shortest.map(f => f.report).join('\n')}`)
      }
    })
  })

  describe('edit model', () => {
    it('reset clears inserts at and inside the range edges', () => {
      let m = new EditModel('abc')
      m.appendRight(0, 'X')
      m.appendLeft(3, 'Y')
      m.reset(0, 3)
      assert.equal(m.toString(), 'abc')

      m = new EditModel('abcd')
      m.appendLeft(2, 'L')
      m.appendRight(2, 'R')
      m.reset(1, 3)
      assert.equal(m.toString(), 'abcd')
    })

    it('update keeps inserts in the range, overwrite clears them', () => {
      let m = new EditModel('abcd')
      m.appendLeft(2, 'L')
      m.appendRight(2, 'R')
      m.update(1, 3, 'Q')
      assert.equal(m.toString(), 'aQLRd')

      m = new EditModel('abcd')
      m.appendLeft(2, 'L')
      m.appendRight(2, 'R')
      m.appendRight(1, 'I')
      m.appendLeft(3, 'O')
      m.overwrite(1, 3, 'Q')
      assert.equal(m.toString(), 'aQd')
    })

    it('remove keeps inserts at the range edges', () => {
      const m = new EditModel('abcd')
      m.appendRight(1, 'I')
      m.appendLeft(3, 'O')
      m.remove(1, 3)
      assert.equal(m.toString(), 'aIOd')
    })

    it('splitting inside a replacement throws, splitting its emptied tail does not', () => {
      let m = new EditModel('abcd')
      m.appendLeft(2, 'L')
      m.update(0, 4, 'Q')
      assert.throws(() => m.appendLeft(1, 'z'), EditModelError)

      m = new EditModel('abcd')
      m.appendLeft(2, 'L')
      m.update(0, 4, 'Q')
      m.appendLeft(3, 'z')
      assert.equal(m.toString(), 'QLz')
    })

    it('inserts at 0 and n write the string intro and outro', () => {
      const m = new EditModel('abc')
      m.appendLeft(0, 'A')
      m.prependLeft(0, 'P')
      m.appendRight(3, 'Z')
      m.prepend('<')
      assert.equal(m.toString(), '<PAabcZ')
    })
  })
})
