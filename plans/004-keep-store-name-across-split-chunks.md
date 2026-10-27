# Plan 004: Emit the stored name for every `storeName` overwrite, including split ranges and the legacy `overwrite(…, true)` form

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat abdc931..HEAD -- src/MagicString.ts src/Bundle.ts src/Chunk.ts tests/MagicString/generate-map.test.ts tests/MagicString/overwrite.test.ts tests/Bundle/generate-map.test.ts`
> Plans 001–003 are expected to have touched `src/MagicString.ts`; confirm the
> excerpts below still match the live code (the `storeName` lines are not
> changed by those plans). Any other mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-enable-strict-typescript.md (recommended, not required)
- **Category**: bug
- **Planned at**: commit `abdc931` (v1.4.4, `origin/master`), 2026-10-27

## Why this matters

`overwrite(start, end, content, { storeName: true })` promises that the original
text of the range ends up in the sourcemap's `names` array *and* that the
mapping segment for the replacement references it — that is how bundlers let
devtools show the original identifier for a renamed one. Two paths break the
promise, verified on the v1.4.4 bundle:

1. **Range split by an earlier edit.** `update()` records the name as
   `original.slice(start, end)` but puts `storeName = true` only on the *first*
   chunk of the range, and `_generateMappings` later looks the name up with
   `names.indexOf(chunk.original)` — the first chunk's own slice, not the whole
   range's. `s.remove(3, 4); s.overwrite(0, 7, 'baz', { storeName: true })` on
   `'foo.bar'` → `names: ['foo.bar']` but the segment is `[0,0,0,0]` (no name
   index). Without the earlier `remove`, it is `[0,0,0,0,0]`. Any prior insert
   or edit inside the range (an `appendLeft`, a `replace` of a sub-range…)
   triggers this.
2. **Legacy boolean option.** `overwrite(a, b, c, true)` is coerced to `{}` in
   `overwrite()` *before* it reaches `update()`, where the `options === true`
   branch (deprecation warning + `storeName: true`) lives. Result: no warning,
   `names: []`. The warning text itself still says `magicString.overwrite(...)`.
   Only `update(a, b, c, true)` is tested.

Both fixes are a few lines. Since `abdc931` (#367), the first chunk of an
overwrite already records the end of the range in `Chunk.replacesUntil`, which
gives the exact slice to look up without storing the name on the chunk.

## Current state

- `src/Chunk.ts:9-15, 29-32` — fields (at `abdc931`):
  ```ts
    declare storeName: boolean | undefined
    declare edited: boolean
    // An overwrite that spans several chunks stores its replacement on the first
    // of them and empties the rest. The first records where the overwritten range
    // ends in `replacesUntil`, and the rest record where it starts in
    // `replacedFrom`. Both are -1 otherwise
    declare replacesUntil: number
    declare replacedFrom: number
  ```
  `Chunk.edit(content, storeName?, contentOnly?)` (line 95) sets `this.storeName = storeName`.
  `Chunk.reset()` (116-126) sets both `replaces*` to `-1` and `storeName = false`.
  `Chunk.trimEnd`/`trimStart` (186, 215) re-edit with `this.storeName` and do
  not touch `replacesUntil`.
- `src/MagicString.ts`:
  ```ts
  // 759-770
    overwrite(start, end, content, options?: boolean | OverwriteOptions): this {
      const optionObject = typeof options === 'object' && options ? options : {}
      return this.update(start, end, content, {
        ...optionObject,
        overwrite: !optionObject.contentOnly,
      })
    }
  // 816-838 (inside update)
      if (options === true) {
        if (!warned.storeName) {
          console.warn(
            'The final argument to magicString.overwrite(...) should be an options object. See https://github.com/rich-harris/magic-string',
          )
          warned.storeName = true
        }
        options = { storeName: true }
      }
      const optionObject = typeof options === 'object' && options ? options : {}
      const storeName = optionObject.storeName || false
      const overwrite = optionObject.overwrite || false

      if (storeName) {
        const original = this.original.slice(start, end)
        Object.defineProperty(this.storedNames, original, {
          writable: true,
          value: true,
          enumerable: true,
        })
      }
  // 866-868 (end of update, after plan 001's restructure the lines differ but the statements are the same)
      first.edit(content, storeName, !overwrite)
      first.replacesUntil = end
      first.replacedFrom = -1
  // 371-407 _generateMappings
      const names = Object.keys(this.storedNames)
      ...
          mappings.addEdit(
            sourceIndex,
            chunk.content,
            loc,
            chunk.storeName ? names.indexOf(chunk.original) : -1,
          )
  ```
- `src/Bundle.ts:324-331` — the same `chunk.storeName ? names.indexOf(chunk.original) : -1`
  in `Bundle._generateMappings`, with `magicString.original` in scope as the
  source's original.
- Tests using `storeName`: `tests/MagicString/generate-map.test.ts:167-182`
  ("should recover original names", asserts via `SourceMapConsumer`
  `loc.name === 'Foo'`), `tests/Bundle/generate-map.test.ts:220-249, 421`,
  `tests/Bundle/toMagicString.test.ts:142`, `tests/MagicString/update.test.ts:121-154`
  (legacy `true` on `update`, monkey-patches `console.warn`),
  `tests/MagicString/clone.test.ts:92-106`.
- Test conventions: see `tests/MagicString/generate-map.test.ts:167-182` for
  the `SourceMapConsumer` pattern (`import { SourceMapConsumer } from 'source-map-js'`,
  `type RawSourceMap`). `IntegrityCheckingMagicString as MagicString` import.

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Install   | `pnpm install`                            | exit 0              |
| Typecheck | `pnpm run typecheck`                      | exit 0              |
| Tests     | `pnpm test`                               | all pass            |
| One file  | `pnpm exec vitest run tests/MagicString/generate-map.test.ts` | all pass |
| Lint      | `pnpm run lint`                           | exit 0              |

## Scope

**In scope**:
- `src/MagicString.ts` — `overwrite()`, `update()` (warning text only),
  `_generateMappings()`.
- `src/Bundle.ts` — `_generateMappings()` name lookup (one expression).
- `tests/MagicString/generate-map.test.ts`, `tests/MagicString/overwrite.test.ts`,
  `tests/Bundle/generate-map.test.ts` — new tests.

**Out of scope**:
- `src/Chunk.ts` — no new field; `replacesUntil` already holds what is needed.
- Removing the deprecated boolean form or the `warned` object — that is a 2.0
  decision recorded in `plans/README.md`, not this plan.
- Changing `storedNames` from an object to a `Set` — plan 008 does that; keep
  `Object.keys(this.storedNames)` here.
- `Bundle.toMagicString()` — plan 006.

## Git workflow

- Worktree off `origin/master`:
  `git -C ~/projects/magic-string/default fetch origin && git -C ~/projects/magic-string/default worktree add ../store-name -b fix/store-name-split-ranges origin/master`
- Conventional Commits, e.g. `fix: keep the stored name when an overwritten range was split`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Baseline and red tests

Run `pnpm install && pnpm test` → all pass.

Add to `tests/MagicString/generate-map.test.ts`, next to "should recover
original names" (line ~167):

```ts
    it('should recover the original name when the overwritten range was split earlier', () => {
      const s = new MagicString('function Foo () {}')

      s.appendLeft(10, '')
      s.overwrite(9, 12, 'Bar', { storeName: true })

      const map = s.generateMap({ file: 'output.js', source: 'input.js' })
      const smc = new SourceMapConsumer(map as unknown as RawSourceMap)

      assert.deepEqual(map.names, ['Foo'])
      assert.equal(smc.originalPositionFor({ line: 1, column: 9 }).name, 'Foo')
    })

    it('should recover the original name after part of the range was removed', () => {
      const s = new MagicString('foo.bar')

      s.remove(3, 4)
      s.overwrite(0, 7, 'baz', { storeName: true })

      const decoded = s.generateDecodedMap()
      assert.deepEqual(decoded.names, ['foo.bar'])
      assert.deepEqual(decoded.mappings, [[[0, 0, 0, 0, 0]]])
    })
```

Add to `tests/MagicString/overwrite.test.ts` inside `describe('overwrite')`:

```ts
    it('should warn and treat `true` as the legacy storeName option', () => {
      const s = new MagicString('abcdefghijkl')
      const warn = console.warn
      let warned = 0
      console.warn = () => {
        warned += 1
      }
      try {
        s.overwrite(3, 4, 'D', true)
        s.overwrite(6, 7, 'G', true)
      }
      finally {
        console.warn = warn
      }
      assert.isAtMost(warned, 1)
      assert.equal(s.toString(), 'abcDefGhijkl')
      assert.deepEqual(s.generateDecodedMap().names, ['d', 'g'])
    })
```

(`isAtMost(1)` rather than `equal(1)`: the module-level `warned` flag may
already be set by `tests/MagicString/update.test.ts` in the same worker, since
`vitest.config.ts` has `isolate: false`.)

Add to `tests/Bundle/generate-map.test.ts` near the existing `storeName`
tests (~line 220):

```ts
    it('should recover original names when the overwritten range was split earlier', () => {
      const b = new Bundle()
      const one = new MagicString('function one () {}', { filename: 'one.js' })
      one.appendLeft(10, '')
      one.overwrite(9, 12, 'uno', { storeName: true })
      b.addSource(one)

      const decoded = b.generateDecodedMap()
      assert.deepEqual(decoded.names, ['one'])
      assert.deepEqual(decoded.mappings[0].find(segment => segment[0] === 9), [9, 0, 0, 9, 0])
    })
```

**Verify**: `pnpm exec vitest run tests/MagicString/generate-map.test.ts tests/MagicString/overwrite.test.ts tests/Bundle/generate-map.test.ts`
→ exactly these 4 new tests fail; the first two fail on the `names`/segment
assertions, the `overwrite(…, true)` one fails on `names` (`[]`).

### Step 2: Look the name up by the overwritten range, not the chunk's own slice

In `src/MagicString.ts` `_generateMappings`, replace

```ts
            chunk.storeName ? names.indexOf(chunk.original) : -1,
```
with
```ts
            chunk.storeName ? names.indexOf(this.original.slice(chunk.start, chunk.replacesUntil)) : -1,
```

In `src/Bundle.ts` `_generateMappings`, replace the same expression with
`names.indexOf(magicString.original.slice(chunk.start, chunk.replacesUntil))`.

Why this is correct: `update()` sets `first.replacesUntil = end` on exactly the
chunk that receives `storeName`, and `first.start === start`, so the slice is
the same string that was stored in `storedNames`. `Chunk.split()` keeps
`replacesUntil` on the left half (which keeps `storeName`); `reset()` clears
both. A chunk with `storeName === true` and `replacesUntil === -1` cannot
exist: grep `storeName` in `src/Chunk.ts` — `edit()` is the only setter and
`update()` is the only caller passing `true`. If you find another, STOP.

**Verify**: `pnpm exec vitest run tests/MagicString/generate-map.test.ts tests/Bundle/generate-map.test.ts tests/Bundle/toMagicString.test.ts tests/MagicString/clone.test.ts`
→ all pass (3 of the 4 new tests now green; all pre-existing `storeName` tests
unchanged).

### Step 3: Pass the legacy boolean through `overwrite()`

The legacy `overwrite(…, true)` of 0.x meant "store the name, and overwrite
the inserts in the range too" (CHANGELOG 0.20.0: "`storeName: true` is
equivalent to `true` before; `contentOnly` will preserve existing
appends/prepends"). In today's model that is `{ storeName: true, overwrite: true }`.
`update(…, true)` (tested at `update.test.ts:121`) must keep meaning
`{ storeName: true }` with `overwrite: false`, so handle the boolean inside
`overwrite()` and leave `update()`'s own `options === true` branch untouched:

```ts
  overwrite(start, end, content, options?: boolean | OverwriteOptions): this {
    if (options === true) {
      if (!warned.storeName) {
        console.warn(
          'The final argument to magicString.overwrite(...) should be an options object. See https://github.com/rich-harris/magic-string',
        )
        warned.storeName = true
      }
      return this.update(start, end, content, { storeName: true, overwrite: true })
    }
    const optionObject = typeof options === 'object' && options ? options : {}
    return this.update(start, end, content, {
      ...optionObject,
      overwrite: !optionObject.contentOnly,
    })
  }
```

The warning text and the shared `warned.storeName` flag are reused as-is so
a program calling both legacy forms still warns at most once.

**Verify**: `pnpm exec vitest run tests/MagicString/overwrite.test.ts tests/MagicString/update.test.ts` → all pass.

### Step 4: Full verification

`pnpm run typecheck && pnpm run lint && pnpm test`.

**Verify**: all exit 0; test total = baseline + 4.

## Test plan

- New (step 1): 2 in `tests/MagicString/generate-map.test.ts`, 1 in
  `tests/MagicString/overwrite.test.ts`, 1 in `tests/Bundle/generate-map.test.ts`.
- Pattern: `tests/MagicString/generate-map.test.ts:167-182`.
- Existing `storeName` tests (listed in Current state) are the regression net
  for the common unsplit case.
- Verification: `pnpm test` → all pass.

## Done criteria

- [ ] `grep -n "names.indexOf(chunk.original)" src/` → no matches
- [ ] `grep -c "replacesUntil" src/MagicString.ts src/Bundle.ts` → MagicString ≥ 4, Bundle ≥ 1
- [ ] `pnpm run typecheck`, `pnpm run lint`, `pnpm test` exit 0; 4 new tests pass
- [ ] `git status` shows only the five in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `Chunk.replacesUntil` does not exist (the repo is older than `abdc931`) — the
  fix then needs a new `Chunk` field and a maintainer should pick the shape.
- Any pre-existing `storeName` test fails after step 2.
- You find a path that sets `chunk.storeName = true` without setting
  `replacesUntil` (see step 2's grep).
- Plan 008 has already replaced `storedNames` with a `Set` and `names` is built
  differently — adapt only the `indexOf` argument, nothing else; if more seems
  needed, STOP.

## Maintenance notes

- Plan 008 changes how `names` is built (`Set` + `Map` index); the lookup key
  introduced here (`original.slice(chunk.start, chunk.replacesUntil)`) stays.
- Plan 010 deduplicates the two `_generateMappings` walks; the expression from
  step 2 moves with them.
- 2.0 decision (recorded in the index): drop the boolean `options` form and
  the `warned` flag entirely; then step 3's branch disappears.
- Reviewers: confirm `update(…, true)` still yields `overwrite: false` and
  `overwrite(…, true)` yields `overwrite: true` — the legacy semantics differ.
