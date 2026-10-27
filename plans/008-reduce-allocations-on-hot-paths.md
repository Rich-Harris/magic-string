# Plan 008: Remove avoidable allocations and O(n²) lookups on the sourcemap, length, indent and bundle paths

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat abdc931..HEAD -- src/MagicString.ts src/Bundle.ts src/BitSet.ts src/BitSet.test.ts src/utils/Mappings.ts src/SourceMap.ts tests/Bundle/generate-map.test.ts tests/MagicString/clone.test.ts tests/MagicString/generate-map.test.ts`
> Plans 001–007 are expected to have touched `src/MagicString.ts` and
> `src/Bundle.ts`. Confirm each excerpt below still matches the live code
> (plan 004 changed the `names.indexOf` argument — use the live argument).
> Any other mismatch is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M (six small, independent changes)
- **Risk**: LOW–MED (one observable change to `generateDecodedMap()` output,
  see part C)
- **Depends on**: plans/004-keep-store-name-across-split-chunks.md (part A
  touches the same lookup), plans/005-copy-bundle-source-descriptions.md
  (part F edits neighbouring `addSource` lines), plans/009-benchmark-rework.md
  (recommended first, to measure A and C)
- **Category**: perf
- **Planned at**: commit `abdc931` (v1.4.4, `origin/master`), 2026-10-27

## Why this matters

magic-string sits on the hot path of Rollup, Vite, Svelte and Vue; its
maintainers have landed five `perf:` commits in two months (#313, #328, #339,
#350, #357). Six remaining spots do avoidable work that scales with input
size, each a few lines to fix:

- **A.** `storedNames` is a plain object written with `Object.defineProperty`
  (a 2019 prototype-pollution workaround) and `names` is an array searched with
  `indexOf` per renamed chunk and `includes` per name in `Bundle` — O(chunks ×
  names) inside `generateMap`, the single hottest call for bundlers that pass
  `storeName: true` for every renamed identifier.
- **B.** `Bundle.length()` calls `source.content.toString().length` for every
  source — it concatenates the whole bundle to read a number.
- **C.** `Mappings` allocates a `rangeMappings` line array on *every* generated
  line in *every* hires mode, and `SourceMap` then scans them all to find out
  they are empty. `generateDecodedMap()` returns `rangeMappings: [[], [], …]`
  for a lo-res map that never asked for range mappings.
- **D.** `indent({ exclude })` marks excluded characters in a
  `Record<number, boolean>` — one object key per excluded character, so a large
  template literal pushes V8 into dictionary mode — while the repo already has
  a `BitSet` for exactly this.
- **E.** `Bundle.toMagicString()` re-adds sourcemap locations by testing every
  character of every source against a usually-empty `BitSet`.
- **F.** `Bundle.uniqueSourceIndexByFilename` is a plain object; a filename of
  `__proto__` bypasses `hasOwnProp`, pushes a duplicate source and emits a
  non-numeric source index into the map (`[0, {}, 0, 0]`, verified).

## Current state

All at `abdc931`.

**A — stored names**

```ts
// src/MagicString.ts:190           storedNames: { writable: true, value: {} },
// src/MagicString.ts:165           declare storedNames: Record<string, true>
// src/MagicString.ts:327 (clone)   cloned.storedNames = { ...this.storedNames }
// src/MagicString.ts:373 (_generateMappings)
    const names = Object.keys(this.storedNames)
// src/MagicString.ts:391
          chunk.storeName ? names.indexOf(<key>) : -1,
// src/MagicString.ts:830-837 (update)
    if (storeName) {
      const original = this.original.slice(start, end)
      Object.defineProperty(this.storedNames, original, {
        writable: true,
        value: true,
        enumerable: true,
      })
    }
// src/Bundle.ts:227-233 (toMagicString)
      Object.keys(magicString.storedNames).forEach((name) => {
        Object.defineProperty(combined.storedNames, name, { writable: true, value: true, enumerable: true })
      })
// src/Bundle.ts:289-297 (_generateMappings)
    const names: string[] = []
    ...
    this.sources.forEach((source) => {
      Object.keys(source.content.storedNames).forEach((name) => {
        if (!names.includes(name))
          names.push(name)
      })
    })
// src/Bundle.ts:330
              chunk.storeName ? names.indexOf(<key>) : -1,
```
`<key>` is `chunk.original` before plan 004 and
`<magicString|this>.original.slice(chunk.start, chunk.replacesUntil)` after it.
`tests/MagicString/clone.test.ts:96` asserts `notStrictEqual(source.storedNames, clone.storedNames)`.

**B — Bundle.length**

```ts
// src/Bundle.ts:478-486
  length(): number {
    return this.sources.reduce((length, source, i) => {
      const separator = <source.separator>
      return length + (i > 0 ? separator.length : 0) + source.content.toString().length
    }, this.intro.length)
  }
// src/MagicString.ts:1285-1293 — MagicString.length() sums chunk intro+content+outro, excluding the string-level intro/outro (documented at README.md:182-198)
```

**C — range mappings**

```ts
// src/utils/Mappings.ts:21-22, 31-32, 48
  declare rawRangeMappings: SourceMapRangeMappings
  declare rawRangeMappingsIndices: number[]
  ...
    this.rawRangeMappings = []
    this.rawRangeMappingsIndices = this.rawRangeMappings[this.generatedCodeLine] = []
  ...  (in nextLine)
    this.rawRangeMappings[this.generatedCodeLine] = this.rawRangeMappingsIndices = []
// src/utils/Mappings.ts:139-144 — the only push, inside `else if (experimentalRange)`
// src/MagicString.ts:349,366 and src/Bundle.ts:267,282 — `rangeMappings: mappings.rawRangeMappings`
// src/SourceMap.ts:60  rangeMappings?: SourceMapRangeMappings   (already optional)
// src/SourceMap.ts:108-119 — `if (typeof properties.rangeMappings !== 'undefined')` then scans for a non-empty line before encoding
// tests/Bundle/generate-map.test.ts:400-412
    it('does not emit rangeMappings for other hires modes', () => {
      ...
      assert.deepEqual(b.generateDecodedMap().rangeMappings, [[]])
      assert.deepEqual(b.generateDecodedMap({ hires: true }).rangeMappings, [[]])
      assert.deepEqual(b.generateDecodedMap({ hires: 'boundary' }).rangeMappings, [[]])
      assert.equal(b.generateMap().rangeMappings, undefined)
      ...
```

**D — indent exclusions**

```ts
// src/MagicString.ts:473-485
    const isExcluded: Record<number, boolean> = {}
    if (options.exclude) {
      const exclusions = typeof options.exclude[0] === 'number' ? [options.exclude as ExclusionRange] : (options.exclude as ExclusionRange[])
      exclusions.forEach((exclusion) => {
        for (let i = exclusion[0]; i < exclusion[1]; i += 1) {
          isExcluded[i] = true
        }
      })
    }
// reads: `isExcluded[chunk.start]` (530), `isExcluded[chunk.start]` or `[charIndex]` (534, after plan 006), `isExcluded[charIndex]` (542), `isExcluded[chunk.end - 1]` (583)
// src/BitSet.ts — `add(n)`, `has(n)`, copy-constructor; `bits: number[]` of 32-bit words
```

**E — toMagicString sourcemap locations**

```ts
// src/Bundle.ts:223-226
      for (let index = 0; index < magicString.original.length; index += 1) {
        if (magicString.sourcemapLocations.has(index))
          combined.sourcemapLocations.add(index + offset)
      }
```

**F — unique source index**

```ts
// src/Bundle.ts:62,70     declare uniqueSourceIndexByFilename: Record<string, number>   /  = {}
// src/Bundle.ts:106-118   hasOwnProp.call(this.uniqueSourceIndexByFilename, filename) / [filename] = n / this.uniqueSources[this.uniqueSourceIndexByFilename[filename]]
// src/Bundle.ts:310       const sourceIndex = source.filename ? this.uniqueSourceIndexByFilename[source.filename] : -1
```

Conventions: `@antfu/eslint-config`; co-located unit tests for `src/BitSet.ts`
live in `src/BitSet.test.ts` (`describe('bitSet') → it('…')`); public-API tests
under `tests/<Class>/<method>.test.ts`.

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Install   | `pnpm install`                            | exit 0              |
| Typecheck | `pnpm run typecheck`                      | exit 0              |
| Tests     | `pnpm test`                               | all pass            |
| Lint      | `pnpm run lint`                           | exit 0              |
| Bench     | `pnpm run bench`                          | prints a table (see plan 009 for the reworked version) |

## Scope

**In scope**:
- `src/MagicString.ts` (A, D), `src/Bundle.ts` (A, B, E, F),
  `src/utils/Mappings.ts` (C), `src/SourceMap.ts` (C, only if its
  `rangeMappings` handling needs a type tweak), `src/BitSet.ts` + `src/BitSet.test.ts` (E).
- Tests: `tests/Bundle/generate-map.test.ts` (C: update one test),
  `tests/MagicString/generate-map.test.ts` (C: one new test),
  `tests/Bundle/length.test.ts`, `tests/Bundle/addSource.test.ts` (F: one new test),
  `tests/MagicString/clone.test.ts` (A: keep passing).

**Out of scope**:
- `Mappings.addUneditedChunk`'s per-character hires loop and the
  `experimental-range` branch structure (direction item, not this plan).
- `MappingsEncoder`, `getLocator`.
- Changing `MagicString.length()` semantics (documented quirk; 2.0 decision).
- Anything in `slice` (plan 007).

## Git workflow

- Worktree off `origin/master`:
  `git -C ~/projects/magic-string/default fetch origin && git -C ~/projects/magic-string/default worktree add ../perf-allocs -b perf/hot-path-allocations origin/master`
- One commit per part (A–F), Conventional Commits, e.g.
  `perf: index stored names with a Set and Map`, `perf(bundle): compute length without building the output`,
  `perf: allocate range mappings only in experimental-range mode`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Baseline

`pnpm install && pnpm test` → all pass. If plan 009 landed, `pnpm run bench`
and keep the output for comparison.

### Step 2 (A): `storedNames` as a `Set`, `names` indexed by a `Map`

1. `src/MagicString.ts`: field `declare storedNames: Set<string>`; constructor
   `storedNames: { writable: true, value: new Set<string>() }`; `clone()`:
   `cloned.storedNames = new Set(this.storedNames)`; `update()`:
   ```ts
    if (storeName)
      this.storedNames.add(this.original.slice(start, end))
   ```
   (a `Set` cannot be prototype-polluted, which is what the `defineProperty`
   dance guarded against — delete it and its comment if any).
2. `_generateMappings` (MagicString):
   ```ts
    const names = [...this.storedNames]
    const nameIndex = new Map(names.map((name, i) => [name, i]))
    ...
          chunk.storeName ? nameIndex.get(<key>) ?? -1 : -1,
   ```
   where `<key>` is the live lookup expression (see Current state).
3. `src/Bundle.ts` `_generateMappings`:
   ```ts
    const storedNames = new Set<string>()
    this.sources.forEach(source => source.content.storedNames.forEach(name => storedNames.add(name)))
    const names = [...storedNames]
    const nameIndex = new Map(names.map((name, i) => [name, i]))
   ```
   and the same `nameIndex.get(<key>) ?? -1` at the chunk site.
4. `src/Bundle.ts` `toMagicString`: `magicString.storedNames.forEach(name => combined.storedNames.add(name))`.

Ordering note: `Object.keys` puts integer-like keys (`"42"`) first in numeric
order; a `Set` keeps pure insertion order. `names` order is therefore
unchanged unless a stored name is an integer-like string — an edge case no
test covers and an improvement (names now follow edit order). Mention it in
the commit message.

**Verify**: `grep -c "defineProperty(this.storedNames\|defineProperty(combined.storedNames" src/` → `0`;
`pnpm exec vitest run tests/MagicString/generate-map.test.ts tests/Bundle/generate-map.test.ts tests/MagicString/clone.test.ts tests/Bundle/toMagicString.test.ts` → all pass.

### Step 3 (B): `Bundle.length()` without `toString()`

Replace `source.content.toString().length` with
`source.content.length() + source.content.intro.length + source.content.outro.length`
(`intro`/`outro` are `@internal` fields the Bundle already reads elsewhere,
e.g. `_generateMappings`). `MagicString.length()` is exactly the sum of chunk
`intro + content + outro` lengths, so adding the string-level intro/outro
equals `toString().length` by construction.

**Verify**: `pnpm exec vitest run tests/Bundle/length.test.ts` → all pass
(every test there asserts `b.length() === b.toString().length`).

### Step 4 (C): allocate range mappings only in `experimental-range` mode

`src/utils/Mappings.ts`:

```ts
  declare rawRangeMappings: SourceMapRangeMappings | undefined
  declare rawRangeMappingsIndices: number[]
  ...
  constructor(...) {
    ...
    this.rawRangeMappingsIndices = []
    // only the experimental-range mode produces range mappings; the other modes
    // must not pay for a per-line array nor advertise an empty `rangeMappings`
    this.rawRangeMappings = hires === 'experimental-range' ? [this.rawRangeMappingsIndices] : undefined
    ...
  }

  private nextLine(): void {
    ...
    this.generatedCodeColumn = 0
    if (this.rawRangeMappings)
      this.rawRangeMappings[this.generatedCodeLine] = this.rawRangeMappingsIndices = []
  }
```

The push at `addUneditedChunk` (~141) is inside `else if (experimentalRange)`
so `rawRangeMappingsIndices` is always the live line array there; when not in
range mode the initial `[]` is never pushed to. The four
`rangeMappings: mappings.rawRangeMappings` sites now pass `undefined` in
non-range modes; `SourceMap`'s constructor already guards on
`typeof properties.rangeMappings !== 'undefined'`, and `DecodedSourceMap.rangeMappings`
is already optional — check `pnpm run typecheck`; if `DecodedSourceMapOrMissingContent`
or a return type complains, widen only that type to `| undefined`.

Update `tests/Bundle/generate-map.test.ts:400-412`: the three
`deepEqual(…rangeMappings, [[]])` lines become `assert.equal(…rangeMappings, undefined)`
(the test's own title already says "does not emit rangeMappings").

Add to `tests/MagicString/generate-map.test.ts`:

```ts
    it('does not emit rangeMappings unless hires is experimental-range', () => {
      const s = new MagicString('a\nb')

      assert.equal(s.generateDecodedMap().rangeMappings, undefined)
      assert.equal(s.generateDecodedMap({ hires: true }).rangeMappings, undefined)
      assert.deepEqual(s.generateDecodedMap({ hires: 'experimental-range' }).rangeMappings, [[0], []])
      assert.equal(s.generateMap({ hires: true }).rangeMappings, undefined)
    })
```

(`[[0], []]` is what v1.4.4 produces for this input — the single-character
second line gets a plain segment, not a range. If the value differs after your
change, STOP: range-mode output must be byte-identical to before.)

**Verify**: `pnpm exec vitest run tests/MagicString/generate-map.test.ts tests/Bundle/generate-map.test.ts` → all pass; `pnpm run typecheck` → exit 0.

### Step 5 (D): `indent` exclusions in a `BitSet`

```ts
    const isExcluded = new BitSet()
    if (options.exclude) {
      ...
      exclusions.forEach((exclusion) => {
        for (let i = exclusion[0]; i < exclusion[1]; i += 1)
          isExcluded.add(i)
      })
    }
```

and change the four reads from `isExcluded[x]` to `isExcluded.has(x)`.
`BitSet.has(-1)` (possible via `chunk.end - 1` on an empty string) returns
`false`, as the object lookup did. `BitSet` is already imported in
`MagicString.ts`.

**Verify**: `grep -c "isExcluded\[" src/MagicString.ts` → `0`;
`pnpm exec vitest run tests/MagicString/indent.test.ts tests/Bundle/indent.test.ts` → all pass.

### Step 6 (E): iterate set bits in `toMagicString`

Add to `src/BitSet.ts`:

```ts
  forEach(fn: (n: number) => void): void {
    const bits = this.bits
    for (let w = 0; w < bits.length; w++) {
      let word = bits[w]
      while (word) {
        const lowest = word & -word
        fn((w << 5) + 31 - Math.clz32(lowest))
        word ^= lowest
      }
    }
  }
```

(This is the same lowest-set-bit walk `Mappings.addUneditedChunk` uses at
`src/utils/Mappings.ts:165-178`.) Add to `src/BitSet.test.ts`:

```ts
  it('visits set bits in ascending order', () => {
    const set = new BitSet()
    for (const n of [70, 0, 31, 32, 5])
      set.add(n)

    const visited: number[] = []
    set.forEach(n => visited.push(n))

    assert.deepEqual(visited, [0, 5, 31, 32, 70])
  })
```

Replace the per-character loop in `toMagicString` with
`magicString.sourcemapLocations.forEach(index => combined.sourcemapLocations.add(index + offset))`.

**Verify**: `pnpm exec vitest run src/BitSet.test.ts tests/Bundle/toMagicString.test.ts` → all pass
("preserves per-source sourcemap locations" at `toMagicString.test.ts:150` covers the behaviour).

### Step 7 (F): `uniqueSourceIndexByFilename` as a `Map`

`declare uniqueSourceIndexByFilename: Map<string, number>`; constructor
`new Map()`; in `addSource`:

```ts
    if (record.filename) {   // `source.filename` if plan 005 has not landed
      const index = this.uniqueSourceIndexByFilename.get(record.filename)
      if (index === undefined) {
        this.uniqueSourceIndexByFilename.set(record.filename, this.uniqueSources.length)
        this.uniqueSources.push({ filename: record.filename, content: content.original })
      }
      else if (content.original !== this.uniqueSources[index].content) {
        throw new MagicStringError(`duplicate filename "${record.filename}" with different content, use unique filenames`)
      }
    }
```

and in `_generateMappings`: `const sourceIndex = source.filename ? this.uniqueSourceIndexByFilename.get(source.filename)! : -1`
— avoid the `!` by `?? -1` (a filename present in `sources` is always in the
map, so the fallback is unreachable but harmless). If `hasOwnProp` is now
unused in `Bundle.ts`, delete the `const hasOwnProp` line.

Add to `tests/Bundle/addSource.test.ts`:

```ts
    it('treats a filename of __proto__ like any other', () => {
      const b = new Bundle()
      b.addSource(new MagicString('a', { filename: '__proto__' }))
      b.addSource(new MagicString('a', { filename: '__proto__' }))

      const map = b.generateDecodedMap()
      assert.deepEqual(map.sources, ['__proto__'])
      assert.deepEqual(map.mappings[1], [[0, 0, 0, 0]])
    })
```

**Verify**: `pnpm exec vitest run tests/Bundle` → all pass.

### Step 8: Full verification

`pnpm run typecheck && pnpm run lint && pnpm test`. If plan 009 landed, run
`pnpm run bench` again and put the before/after rows for the `generateMap`
(storeName) and `Bundle.length` cases in the PR description.

**Verify**: all exit 0; total = baseline + 3 (C, E, F each add one test).

## Test plan

- New: `tests/MagicString/generate-map.test.ts` (C), `src/BitSet.test.ts` (E),
  `tests/Bundle/addSource.test.ts` (F). Updated: `tests/Bundle/generate-map.test.ts:400-412` (C).
- Regression net: `tests/Bundle/length.test.ts` (B), `tests/MagicString/indent.test.ts`
  + `tests/Bundle/indent.test.ts` (D), `tests/MagicString/clone.test.ts` and
  all `storeName` tests (A), `tests/Bundle/toMagicString.test.ts` (A, E).
- Verification: `pnpm test` → all pass.

## Done criteria

- [ ] `grep -rn "Object.defineProperty" src/` matches only `src/MagicString.ts`'s constructor (`Object.defineProperties(this, …)`)
- [ ] `grep -c "toString().length" src/Bundle.ts` → `0`
- [ ] `grep -c "rawRangeMappings\[this.generatedCodeLine\]" src/utils/Mappings.ts` → `1` (inside the `if`)
- [ ] `grep -c "isExcluded\[" src/MagicString.ts` → `0`
- [ ] `grep -c "hasOwnProp.call(this.uniqueSourceIndexByFilename" src/Bundle.ts` → `0`
- [ ] `pnpm run typecheck`, `pnpm run lint`, `pnpm test` exit 0
- [ ] `git status` shows only in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any existing `generate-map`, `length`, `indent`, `clone` or `toMagicString`
  test fails other than the three `[[]]` assertions you were told to update.
- `SourceMap`'s `rangeMappings` type change ripples into `src/index.ts` exports
  or the `.d.mts` in a way that removes a public type.
- `names` order changes for any existing test (would indicate a stored name
  that is integer-like — report, do not special-case).

## Maintenance notes

- Plan 010 deduplicates the two `_generateMappings` walks; the `Set`/`Map`
  from part A is what it should build once and pass in.
- Direction item D (`experimental-range` graduation) can now move the range
  branch out of the hot loop without affecting other modes' allocation profile.
- Reviewers: part C is the only user-visible change (`generateDecodedMap().rangeMappings`
  is `undefined` instead of `[[], …]` outside range mode); it should be called
  out in the CHANGELOG line.
