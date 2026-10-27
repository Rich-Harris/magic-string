# Plan 007: Find `slice()`'s start chunk in O(1) when nothing has moved, and document the moved-content rule

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat abdc931..HEAD -- src/MagicString.ts README.md tests/MagicString/slice.test.ts`
> Plans 001–004 are expected to have touched `src/MagicString.ts`; confirm the
> `slice()` and `_hasRemovedContent()` excerpts below still match (plan 003
> replaces the first lines of `slice` with `_resolveIndex` calls — that is
> fine). Any other mismatch is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (slice has a long bug history; the fast path must be
  provably equivalent)
- **Depends on**: plans/003-validate-indices-consistently.md (index
  resolution; not strictly required), plans/009-benchmark-rework.md
  (recommended first, so the win can be measured)
- **Category**: perf
- **Planned at**: commit `abdc931` (v1.4.4, `origin/master`), 2026-10-27

## Why this matters

`slice(start, end)` locates its start chunk by walking the linked list from
`firstChunk` on every call. Compilers built on magic-string (Vue, Svelte, Vite
plugins) call `s.slice(node.start, node.end)` once per AST node, so a transform
over a file with thousands of edits does O(nodes × chunks) work. `_split()` and
`_hasRemovedContent()` already avoid this by starting from `lastSearchedChunk`
and hopping through `byStart`/`byEnd` (#357 fixed the same quadratic in
`replace`). The walk is only *necessary* after `move()`, because `slice`'s
contract for moved content is defined in list order (below); `hasMovedChunks`
already records whether that ever happened.

**A note on what this plan does not change.** The audit initially flagged that
after `s.move(0, 3, 6)` on `'abcdef'` (output `'defabc'`) `s.slice()` returns
`''`. That is the documented-by-test rule — `tests/MagicString/slice.test.ts:100-116`
("supports characters moved opposing") asserts `slice(2, -2) === ''` when the
chunk holding `end` precedes the chunk holding `start` in the *generated*
string — and it has been the behaviour since `move` existed. It is surprising
for the no-argument call, so this plan writes the rule down in the README and
JSDoc instead of changing it. If a maintainer wants `slice()` after a move to
throw or to concatenate in original order, that is a separate, breaking
decision.

## Current state

- `src/MagicString.ts:1118-1173` — `slice()` at `abdc931`:

```ts
  slice(start: number = 0, end: number = this.original.length - this.offset): string {
    start = start + this.offset
    end = end + this.offset

    if (this.original.length !== 0) {
      if (start < 0)
        start = Math.max(0, start + this.original.length)
      if (end < 0)
        end = Math.max(0, end + this.original.length)
    }

    let result = ''

    // find start chunk
    let chunk = this.firstChunk
    while (chunk && (chunk.start > start || chunk.end <= start)) {
      // found end chunk before start
      if ((chunk.start < end && chunk.end >= end) || (end === 0 && chunk.start === 0)) {
        return result
      }

      chunk = chunk.next
    }

    if (chunk && chunk.edited && chunk.start !== start) {
      throw new MagicStringError(`cannot use edited character ${start} as slice start anchor`)
    }

    const startChunk = chunk
    while (chunk) {
      // for end === 0 the slice ends at the very start of the original, so stop
      // once the walk reaches the chunk holding that position, taking nothing from it
      if (end === 0 && chunk.start === 0) {
        break
      }

      if (chunk.intro && (startChunk !== chunk || chunk.start === start)) {
        result += chunk.intro
      }

      const containsEnd = chunk.start < end && chunk.end >= end
      if (containsEnd && chunk.edited && chunk.end !== end) {
        throw new MagicStringError(`cannot use edited character ${end} as slice end anchor`)
      }

      const sliceStart = startChunk === chunk ? start - chunk.start : 0
      const sliceEnd = containsEnd ? chunk.content.length + end - chunk.end : chunk.content.length

      result += chunk.content.slice(sliceStart, sliceEnd)

      if (chunk.outro && (!containsEnd || chunk.end === end)) {
        result += chunk.outro
      }

      if (containsEnd) {
        break
      }

      chunk = chunk.next
    }

    return result
  }
```

- `src/MagicString.ts:1444-1465` — `_hasRemovedContent()`'s start-chunk lookup
  (the pattern to reuse):

```ts
    let chunk = this.byStart.get(start)
    ...
    if (!chunk) {
      chunk = this.lastSearchedChunk
      const searchForward = start >= chunk.end
      while (chunk && !chunk.contains(start))
        chunk = searchForward ? this.byStart.get(chunk.end) : this.byEnd.get(chunk.start)
      if (chunk)
        this.lastSearchedChunk = chunk
    }
```

  `Chunk.contains(index)` is `this.start < index && index < this.end` (strict
  on both sides), so "`byStart.get(start)` or a chunk that `contains(start)`"
  together mean "the chunk with `chunk.start <= start < chunk.end`".

- `hasMovedChunks: boolean` is set to `true` by `move()` only (line ~741) and
  copied by `clone()` and `Bundle.toMagicString()`.
- Behaviour facts, verified on the v1.4.4 bundle, that the fast path must
  reproduce when `hasMovedChunks === false`:
  - `start >= end` (after resolution) → `''`: `slice(2,2)`, `slice(4,2)`,
    `slice(3,0)`, `slice(0,-100)` all return `''`, with or without chunk
    splits at those positions.
  - `start === original.length` → `''`.
  - `end > original.length` clamps: `slice(0, 100)` on `'abcde'` → `'abcde'`.
  - Edited-anchor errors: `tests/MagicString/slice.test.ts:118-130`.
  - Removed content: `slice` after `remove(0, 2)` from index 2 works
    (`slice.test.ts:131-138`).
- `README.md:265-267` and the JSDoc at 1114-1117 describe `slice` in one
  sentence and say nothing about moved content.
- Test conventions: `tests/MagicString/slice.test.ts` (14 tests), style
  `describe('magicString') → describe('slice') → it('…')`,
  `IntegrityCheckingMagicString as MagicString`.

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Install   | `pnpm install`                            | exit 0              |
| Typecheck | `pnpm run typecheck`                      | exit 0              |
| Tests     | `pnpm test`                               | all pass            |
| Focused   | `pnpm exec vitest run tests/MagicString/slice.test.ts tests/MagicString/move.test.ts tests/MagicString/replace.test.ts tests/MagicString/replace-all.test.ts` | all pass |
| Lint      | `pnpm run lint`                           | exit 0              |
| Bench (if plan 009 landed) | `pnpm run bench`         | prints a `slice` row |

## Scope

**In scope**:
- `src/MagicString.ts` — `slice()`, a new `@internal _chunkAt(index)` helper,
  `_hasRemovedContent()` (switch to the helper), JSDoc of `slice`.
- `README.md` — `### s.slice( start, end )` paragraph.
- `tests/MagicString/slice.test.ts` — new tests.
- `benchmark/` — only if plan 009 has landed: add a `slice` case there
  following its conventions; otherwise skip (do not touch the old
  `benchmark/index.mjs`).

**Out of scope**:
- Changing what `slice` returns for any input (no-argument call after a move
  included).
- `_split()` — it uses strict `contains` on purpose (a boundary index needs no
  split); leave it.
- `Bundle.*`.

## Git workflow

- Worktree off `origin/master`:
  `git -C ~/projects/magic-string/default fetch origin && git -C ~/projects/magic-string/default worktree add ../slice-lookup -b perf/slice-start-lookup origin/master`
- Conventional Commits: `perf: find the slice start chunk without scanning the list`,
  `docs: describe how slice treats moved content`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Baseline and equivalence tests

`pnpm install && pnpm test` → all pass.

Add to `tests/MagicString/slice.test.ts`:

```ts
    it('returns the same result however the string has been split', () => {
      const unsplit = new MagicString('abcdefghij')
      const split = new MagicString('abcdefghij')
      for (let i = 1; i < 10; i += 1)
        split.appendLeft(i, '')
      split.appendLeft(3, '<').appendRight(7, '>')
      unsplit.appendLeft(3, '<').appendRight(7, '>')

      for (let start = 0; start <= 10; start += 1) {
        for (let end = 0; end <= 10; end += 1)
          assert.equal(split.slice(start, end), unsplit.slice(start, end), `slice(${start}, ${end})`)
      }
    })

    it('returns an empty string when start is not before end', () => {
      const s = new MagicString('abcde')
      s.appendLeft(2, 'X')

      assert.equal(s.slice(2, 2), '')
      assert.equal(s.slice(4, 2), '')
      assert.equal(s.slice(5, 5), '')
      assert.equal(s.slice(5), '')
    })

    it('returns an empty string for the whole range when the end precedes the start in the output', () => {
      const s = new MagicString('abcdef')
      s.move(0, 3, 6)

      assert.equal(s.toString(), 'defabc')
      assert.equal(s.slice(), '')
      assert.equal(s.slice(0, 3), 'abc')
      assert.equal(s.slice(3, 6), 'def')
    })
```

(The third test pins the existing moved-content rule so the fast path cannot
accidentally change it.)

**Verify**: `pnpm exec vitest run tests/MagicString/slice.test.ts` → all 17
pass *before* any source change (they are characterization tests).

### Step 2: Extract `_chunkAt`

Add next to `_split()`:

```ts
  /**
   * The chunk whose original range holds `index` (`chunk.start <= index < chunk.end`),
   * or `undefined` when `index` is at or past the end. Searches from the last
   * visited chunk so that scans over nearby indices stay cheap.
   *
   * @internal
   */
  _chunkAt(index: number): Chunk | undefined {
    let chunk = this.byStart.get(index)
    if (chunk)
      return chunk
    chunk = this.lastSearchedChunk
    const searchForward = index >= chunk.end
    while (chunk && !chunk.contains(index))
      chunk = searchForward ? this.byStart.get(chunk.end) : this.byEnd.get(chunk.start)
    if (chunk)
      this.lastSearchedChunk = chunk
    return chunk
  }
```

Rewrite `_hasRemovedContent()`'s lookup to use it, keeping its
`start === end` boundary special-case *before* the call exactly as it is
today (it needs `byStart.get(start)` *and* `byEnd.get(start)`):

```ts
    const atBoundary = this.byStart.get(start)
    if (atBoundary && start === end) {
      // (existing comment)
      const previous = this.byEnd.get(start)
      return !!previous && previous.content === '' && atBoundary.content === ''
    }
    let chunk = this._chunkAt(start)
    while (chunk && chunk.start < end) {
      ...unchanged...
```

**Verify**: `pnpm exec vitest run tests/MagicString/replace.test.ts tests/MagicString/replace-all.test.ts` → all pass; `pnpm run typecheck` → exit 0.

### Step 3: Fast path in `slice`

Replace the "find start chunk" block (from `let chunk = this.firstChunk` through
the end of the first `while` loop) with:

```ts
    let chunk: Chunk | undefined | null
    if (this.hasMovedChunks) {
      // chunks are no longer in original order, so "the chunk holding `end`
      // comes before the chunk holding `start`" has to be discovered by walking
      // the output: that case yields an empty slice
      chunk = this.firstChunk
      while (chunk && (chunk.start > start || chunk.end <= start)) {
        if ((chunk.start < end && chunk.end >= end) || (end === 0 && chunk.start === 0)) {
          return result
        }
        chunk = chunk.next
      }
    }
    else {
      // in original order the end chunk precedes the start chunk exactly when
      // start >= end, which is the empty slice
      if (start >= end)
        return result
      chunk = this._chunkAt(start)
    }
```

Everything after (`if (chunk && chunk.edited && chunk.start !== start)` …) is
unchanged. If plan 001 already typed `chunk` as `Chunk | null`, widen to
`Chunk | null | undefined`.

Why equivalent when `!hasMovedChunks`: the old loop visits chunks in
increasing `start`; it returns `''` iff it meets a chunk with
`chunk.start < end <= chunk.end` (or the `end === 0` case) *before* meeting
the chunk with `chunk.start <= start < chunk.end`. In original order that
happens iff `end <= start` (including `end === 0` with `start >= 0`), and
otherwise it stops at the chunk `_chunkAt(start)` returns; when
`start >= original.length` neither finds a chunk and both yield `''`.

**Verify**: `pnpm exec vitest run tests/MagicString/slice.test.ts tests/MagicString/snip.test.ts` → all pass (including the 3 new ones).

### Step 4: Document the moved-content rule

JSDoc on `slice` (replace the two-line comment):

```ts
  /**
   * Returns the content of the generated string that corresponds to the slice
   * between `start` and `end` of the original string, walking the generated
   * string from the chunk holding `start` to the chunk holding `end`. Throws
   * if either index falls inside replaced content. After `move()`, a range
   * whose end now comes before its start in the output yields `''`.
   */
```

`README.md` `### s.slice( start, end )`: append the sentence "After `s.move(...)`,
the slice follows the generated order: if the content at `end` now sits before
the content at `start`, the result is `''`."

**Verify**: `grep -c "generated order" README.md` → `1`.

### Step 5: Full verification (and measurement if available)

`pnpm run typecheck && pnpm run lint && pnpm test`.

If plan 009 has landed, add a benchmark case "slice per node" that builds a
`MagicString` from `benchmark/data.js`, applies `appendLeft(i, '')` at every
500th index, then calls `slice(i, i + 50)` for `i` stepping by 100; run
`pnpm run bench` before and after step 3 and record the two numbers in the
commit message.

**Verify**: all exit 0; total = baseline + 3.

## Test plan

- New (step 1): three characterization tests in `tests/MagicString/slice.test.ts`
  — split-invariance over all (start, end) pairs, `start >= end` cases, the
  moved-content rule.
- Existing 14 slice tests + `snip`, `replace`, `replace-all` suites are the
  regression net for `_chunkAt`.
- Verification: `pnpm test` → all pass.

## Done criteria

- [ ] `grep -c "_chunkAt(" src/MagicString.ts` → `3` (definition, `slice`, `_hasRemovedContent`)
- [ ] `slice()` contains `if (this.hasMovedChunks)` and the old scan is only inside that branch
- [ ] `pnpm run typecheck`, `pnpm run lint`, `pnpm test` exit 0; 3 new tests pass
- [ ] README and JSDoc both mention the moved-content rule
- [ ] `git status` shows only in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any of the three step 1 tests fails *before* the source change — the
  equivalence argument then rests on a wrong premise.
- Any existing `slice`/`snip`/`replace*` test fails after step 2 or 3.
- You are tempted to change what `slice` returns in any case (including the
  no-argument call after a move) — that needs a maintainer decision.

## Maintenance notes

- `_chunkAt` is the third copy of "find the chunk holding an index"
  (`_split` keeps its own strict-`contains` variant deliberately). If `_split`
  is ever refactored, consider building it on `_chunkAt` + an explicit boundary
  check.
- Plan 011 (fuzz oracle) can assert split-invariance of `slice` over random
  edit sequences, generalising step 1's first test.
- Reviewers: verify the fast-path branch never runs when `hasMovedChunks` is
  true, and that `Bundle.toMagicString()` still propagates `hasMovedChunks`
  (it does at `src/Bundle.ts:255`).
