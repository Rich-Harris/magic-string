// No regression gate yet: `writeResult` + `bench.from()` can store baselines, but CI-runner noise needs a designated baseline environment first.
/* eslint-disable test/consistent-test-it -- the rule mistakes the context's `bench.compare()` for a `test` call */
import fs from 'node:fs'
import { it } from 'vitest'
// eslint-disable-next-line antfu/no-import-dist -- measure the published build, as downstream runs it
import MagicString, { Bundle } from '../dist/index.mjs'

const options = { time: 500 }

const inputs = ['data.js', 'data-min.js'].map(file =>
  fs.readFileSync(new URL(file, import.meta.url), 'utf-8'),
)
const [data] = inputs

// Results are stored here so the engine cannot eliminate the work.
let _sink: unknown

function fresh(): MagicString[] {
  return inputs.map(input => new MagicString(input))
}

function edited(): MagicString[] {
  return fresh().map(s => s.replace(/replacement/g, 'replacement\nReplacement'))
}

function storeNames(s: MagicString): MagicString {
  for (const match of s.original.matchAll(/\bfunction\b/g))
    s.overwrite(match.index, match.index + match[0].length, 'fn', { storeName: true })
  return s
}

it('construct', async ({ bench }) => {
  await bench('new MagicString', options, () => {
    _sink = fresh()
  }).run()
})

it('generateMap', async ({ bench }) => {
  const plain = fresh()
  const withEdits = edited()
  await bench.compare(
    bench('lo-res, no edits', () => {
      for (const s of plain) _sink = s.generateMap()
    }),
    bench('lo-res, edits', () => {
      for (const s of withEdits) _sink = s.generateMap()
    }),
    bench('hires: true', () => {
      for (const s of withEdits) _sink = s.generateMap({ hires: true })
    }),
    bench('hires: boundary', () => {
      for (const s of withEdits) _sink = s.generateMap({ hires: 'boundary' })
    }),
    bench('hires: experimental-range', () => {
      for (const s of withEdits) _sink = s.generateMap({ hires: 'experimental-range' })
    }),
    bench('generateDecodedMap, edits', () => {
      for (const s of withEdits) _sink = s.generateDecodedMap()
    }),
    options,
  )
})

// Each case mutates, so construction is inside the body and included in the timing.
it('edits', async ({ bench }) => {
  const size = 1_000_000
  const long = 'a'.repeat(size)
  await bench.compare(
    bench('overwrite', () => {
      const s = new MagicString(long)
      for (let i = 1; i < size; i += 2) s.overwrite(i, i + 1, 'b')
      _sink = s
    }),
    bench('replaceAll regexp', () => {
      _sink = fresh().map(s => s.replaceAll(/\w+/g, m => m))
    }),
    bench('remove', () => {
      const s = new MagicString(data)
      for (let i = 0; i < data.length; i += 7) s.remove(i, i + 1)
      _sink = s
    }),
    bench('move', () => {
      const s = new MagicString(data)
      const step = Math.floor(data.length / 100)
      for (let i = 0; i < 100; i++) s.move(i * step, (i + 1) * step, data.length)
      _sink = s
    }),
    options,
  )
})

it('reads', async ({ bench }) => {
  const split = fresh().map((s) => {
    for (let i = 500; i < s.original.length; i += 500) s.appendLeft(i, '')
    return s
  })
  const plain = fresh()
  const withEdits = edited()
  await bench.compare(
    bench('slice per node', () => {
      for (const s of split) {
        for (let i = 0; i + 50 <= s.original.length; i += 100) _sink = s.slice(i, i + 50)
      }
    }),
    bench('toString', () => {
      for (const s of withEdits) _sink = s.toString()
    }),
    bench('hasChanged no edits', () => {
      for (const s of plain) _sink = s.hasChanged()
    }),
    bench('hasChanged edits', () => {
      for (const s of withEdits) _sink = s.hasChanged()
    }),
    // indent mutates, so construction is included in the timing.
    bench('indent', () => {
      _sink = fresh().map(s => s.indent())
    }),
    options,
  )
})

it('storeName', async ({ bench }) => {
  const named = fresh().map(storeNames)
  await bench('generateMap with names', options, () => {
    for (const s of named) _sink = s.generateMap()
  }).run()
})

it('bundle', async ({ bench }) => {
  const bundle = new Bundle()
  for (let i = 0; i < 20; i++)
    bundle.addSource(storeNames(new MagicString(inputs[i % 2], { filename: `${i}.js` })))
  await bench.compare(
    bench('generateMap lo-res', () => {
      _sink = bundle.generateMap()
    }),
    bench('generateMap hires: true', () => {
      _sink = bundle.generateMap({ hires: true })
    }),
    bench('length()', () => {
      _sink = bundle.length()
    }),
    bench('toString()', () => {
      _sink = bundle.toString()
    }),
    options,
  )
})
