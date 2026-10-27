# Plan 003: Validate indices the same way in every index-taking method

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat abdc931..HEAD -- src/MagicString.ts tests/MagicString/append.test.ts tests/MagicString/prepend.test.ts tests/MagicString/move.test.ts tests/MagicString/update.test.ts tests/MagicString/remove.test.ts tests/MagicString/reset.test.ts tests/MagicString/slice.test.ts README.md`
> Plans 001 and 002 are *expected* to have changed `src/MagicString.ts`; for
> that file, compare the "Current state" excerpts against the live code and
> proceed if the method bodies still match apart from 001/002's edits. Any
> other mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (two tested-but-accidental behaviours change; see "Why")
- **Depends on**: plans/001-enable-strict-typescript.md (the `move()` guard and
  `update()` dead-branch removal), plans/002-remove-debug-stats-instrumentation.md
  (fewer lines to edit; not strictly required)
- **Category**: bug
- **Planned at**: commit `abdc931` (v1.4.4, `origin/master`), 2026-10-27

## Why this matters

Ten public methods take character indices into `original`, and each validates
them differently. Verified on the built v1.4.4 bundle:

| Call on `new MagicString('abcdef')`      | Today                                                   | Should be |
|------------------------------------------|---------------------------------------------------------|-----------|
| `update(undefined, 2, 'X')`              | returns `"abX"` — **silently drops `cdef`**, map has a `null` column | throws |
| `remove(NaN, 2)`                         | silent no-op                                            | throws |
| `appendLeft(100, 'X')` (on `'abc'`)      | `"Xabc"` — lands at the **start**                       | throws (index > length) |
| `appendLeft(-1, 'X')`                    | `"Xabc"` — lands at the start                           | `"abXc"` (resolved from the end, like `update`) |
| `move(5, 7, 0)` (on `'abc'`)             | raw `TypeError` (plan 001 turns this into a `MagicStringError`) | `MagicStringError` |
| `move(0, 3, 100)`                        | silently moves to the end                               | throws |
| `appendRight(1.5, 'X')` + `generateMap({hires:true})` | mapping column `1.5` in the sourcemap            | throws |
| `update(-3, -1, 'X')`                    | `"abcXf"` (negative = from the end)                     | unchanged |
| `slice(0, 100)`                          | `"abcdef"` (clamps, like `String#slice`)                | unchanged |

A caller handing in an AST node whose `.start` is `undefined` (common with
synthetic nodes) gets a truncated file and a broken map instead of an error, and
the failure surfaces far from the cause. The fix is one shared resolver applied
at every entry point, preserving every existing error message so the current
tests keep passing.

**Two existing tests codify the accidental behaviour and must change** (they
were added by #302 "prevent infinite loop on empty input" as characterization,
not as a spec): `tests/MagicString/append.test.ts:86-104` — "should
append/prepend at end of string when index is out of upper bound" (asserts
`'ABxCD'`, i.e. the `*Left` inserts landed at the *start*, contradicting the
test's own title) and its empty-string twin. This plan replaces them with
"throws when the index is out of bounds" plus a test that `index === length`
still works.

## Current state

- `src/MagicString.ts` — all ten methods. Index handling at `abdc931`:

```ts
// appendLeft (227-253); appendRight (260), prependLeft (900), prependRight (931) are identical in shape
  appendLeft(index: number, content: string): this {
    index = index + this.offset

    if (typeof content !== 'string') {
      throw new MagicStringError(`content must be a string, got ${typeof content}`)
    }
    ...
    this._split(index)

    const chunk = this.byEnd.get(index)

    if (chunk) {
      chunk.appendLeft(content)
    }
    else {
      this.intro += content
    }
```

```ts
// update (779-807)
    start = start + this.offset
    end = end + this.offset

    if (typeof content !== 'string') {
      throw new MagicStringError(`content must be a string, got ${typeof content}`)
    }

    if (this.original.length !== 0) {
      if (start < 0)
        start = Math.max(0, start + this.original.length)
      if (end < 0)
        end = Math.max(0, end + this.original.length)
    }

    if (start < 0) {
      throw new MagicStringError(`start ${start} is out of bounds`)
    }
    if (end > this.original.length) {
      throw new MagicStringError(`end ${end} is out of bounds`)
    }
    if (start === end) {
      throw new MagicStringError(
        `cannot overwrite a zero-length range at ${start}, use appendLeft() or prependRight()`,
      )
    }
    if (start > end) {
      throw new MagicStringError(`end must be greater than start (start: ${start}, end: ${end})`)
    }
```

```ts
// remove (966-986); reset (1019-1039) is identical
    start = start + this.offset
    end = end + this.offset

    if (this.original.length !== 0) {
      if (start < 0)
        start = Math.max(0, start + this.original.length)
      if (end < 0)
        end = Math.max(0, end + this.original.length)
    }

    if (start === end)
      return this

    if (start < 0 || end > this.original.length) {
      throw new MagicStringError(`range ${start}–${end} is out of bounds`)
    }
    if (start > end) {
      throw new MagicStringError(`end must be greater than start (start: ${start}, end: ${end})`)
    }
```

```ts
// move (633-643)
    start = start + this.offset
    end = end + this.offset
    index = index + this.offset

    if (start === end)
      return this

    if (index >= start && index <= end) {
      throw new MagicStringError('cannot move a selection inside itself')
    }
    // ... after plan 001: `if (!first || !last) throw new MagicStringError(`range ${start}–${end} is out of bounds`)`
```

```ts
// slice (1118-1127)
  slice(start: number = 0, end: number = this.original.length - this.offset): string {
    start = start + this.offset
    end = end + this.offset

    if (this.original.length !== 0) {
      if (start < 0)
        start = Math.max(0, start + this.original.length)
      if (end < 0)
        end = Math.max(0, end + this.original.length)
    }
```

- Tests asserting on current messages (must keep passing):
  `tests/MagicString/update.test.ts:96,102,107,112`, `remove.test.ts:181,187`,
  `reset.test.ts:55,60`, `overwrite.test.ts:84`, `move.test.ts:81-85`. Note
  `update.test.ts:102` asserts `(start: 12, end: 5)` — i.e. messages print the
  *resolved* (offset-applied, negative-normalised) indices. Keep that.
- `README.md:79-89` documents `offset` as applying to `slice`, `update`,
  `overwrite`, `appendLeft`, `prependLeft`, `appendRight`, `prependRight`,
  `move`, `reset`, `remove` — the exact ten methods this plan touches.
  `addSourcemapLocation` is deliberately *not* offset-adjusted; leave it alone.
- Test conventions: `tests/MagicString/<method>.test.ts`, `describe('magicString')`
  → `describe('<method>')` → `it('should …')`; import
  `{ IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'`
  and `{ MagicStringError } from '../../src/index.ts'`; assert with
  `assert.throws(() => …, /regex/)` and `assert.equal(s.toString(), …)`.
  Exemplar: `tests/MagicString/update.test.ts:88-113`.
- Errors: `throw new MagicStringError('…')`. Style: `@antfu/eslint-config`.

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Install   | `pnpm install`                            | exit 0              |
| Typecheck | `pnpm run typecheck`                      | exit 0              |
| Tests     | `pnpm test`                               | all pass            |
| One file  | `pnpm exec vitest run tests/MagicString/append.test.ts` | all pass |
| Lint      | `pnpm run lint`                           | exit 0              |
| Build     | `pnpm run build`                          | `✔ Build complete`  |

## Scope

**In scope**:
- `src/MagicString.ts` — the ten methods plus one new `@internal` helper.
- `tests/MagicString/append.test.ts`, `prepend.test.ts`, `move.test.ts`,
  `update.test.ts`, `remove.test.ts`, `reset.test.ts`, `slice.test.ts` — new
  tests; two rewritten tests in `append.test.ts`.
- `README.md` — one sentence under `### s.offset` (step 6).

**Out of scope**:
- `addSourcemapLocation`, `snip` (delegates to `remove`, inherits validation),
  `replace`/`replaceAll` (indices come from `original.matchAll`, never from the
  caller), `indent({ exclude })` ranges, `Bundle.*`.
- Changing `slice`'s clamping of over-long ranges — it mirrors `String#slice`
  and is relied upon (`slice()` default end, `tests/MagicString/slice.test.ts`).
- Changing any existing error message text.
- `src/Chunk.ts`, `_split`, `_splitChunk`.

## Git workflow

- Worktree off `origin/master` (after 001/002 are merged, or stacked on their
  branch if the operator says so):
  `git -C ~/projects/magic-string/default fetch origin && git -C ~/projects/magic-string/default worktree add ../validate-indices -b fix/validate-indices origin/master`
- Conventional Commits, e.g. `fix: reject non-integer and out-of-range indices consistently`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Baseline

`pnpm install && pnpm test` → all pass; record the count.

### Step 2: Add the shared resolver

Add to `MagicString` (next to `_split`, keep the `/** @internal */` tag so it
is stripped from `.d.mts`):

```ts
  /**
   * Applies `offset`, resolves a negative index from the end of `original` as
   * `update`/`remove` always have, and rejects anything that is not an integer.
   * Bounds are checked by the caller, because the methods report them differently.
   *
   * @internal
   */
  _resolveIndex(index: number): number {
    const resolved = index + this.offset
    if (!Number.isInteger(resolved)) {
      throw new MagicStringError(`index must be an integer, got ${index}`)
    }
    if (resolved < 0 && this.original.length !== 0) {
      return Math.max(0, resolved + this.original.length)
    }
    return resolved
  }
```

`Number.isInteger` is `false` for `NaN`, `undefined + offset` (= `NaN`),
`Infinity` and fractions, which is exactly the set we want to reject. The
message prints the *caller's* value (`got undefined`, `got 1.5`) because
printing `NaN` after adding the offset would hide the cause.

**Verify**: `pnpm run typecheck` → exit 0.

### Step 3: Route `update`, `remove`, `reset`, `slice` through it

In each, replace the `start = start + this.offset` / `end = end + this.offset`
pair *and* the `if (this.original.length !== 0) { … }` negative-normalisation
block with:

```ts
    start = this._resolveIndex(start)
    end = this._resolveIndex(end)
```

Leave every subsequent bounds/ordering check and its message untouched. In
`update`, keep the current order: resolve indices first, then the
`typeof content !== 'string'` check (the order only decides which error wins
when both inputs are wrong; no test depends on it, but do not reorder).

**Verify**: `pnpm exec vitest run tests/MagicString/update.test.ts tests/MagicString/remove.test.ts tests/MagicString/reset.test.ts tests/MagicString/slice.test.ts tests/MagicString/overwrite.test.ts tests/MagicString/snip.test.ts` → all pass (no message changed).

### Step 4: Route the four insert methods through it and bounds-check

In `appendLeft`, `appendRight`, `prependLeft`, `prependRight`, replace
`index = index + this.offset` with:

```ts
    index = this._resolveIndex(index)
    if (index < 0 || index > this.original.length) {
      throw new MagicStringError(`index ${index} is out of bounds`)
    }
```

Now `this.byEnd.get(index)` in `appendLeft`/`prependLeft` is `undefined` only
when `index === 0` (→ string-level `intro`, correct), and `this.byStart.get(index)`
in `appendRight`/`prependRight` is `undefined` only when `index === original.length`
(→ string-level `outro`, correct). The `else` branches stay as they are.

Rewrite the two #302 tests in `tests/MagicString/append.test.ts:86-104`:

```ts
    it('should throw when the index is out of upper bound', () => {
      const s = new MagicString('x')

      assert.throws(() => s.prependLeft(6, 'A'), /index 6 is out of bounds/)
      assert.throws(() => s.appendLeft(6, 'B'), /index 6 is out of bounds/)
      assert.throws(() => s.prependRight(6, 'C'), /index 6 is out of bounds/)
      assert.throws(() => s.appendRight(6, 'D'), /index 6 is out of bounds/)
      assert.equal(s.toString(), 'x')
    })

    it('should append/prepend at the end of the string when index equals its length', () => {
      const s = new MagicString('x')
      s.prependLeft(1, 'A')
      s.appendLeft(1, 'B')
      s.prependRight(1, 'C')
      s.appendRight(1, 'D')

      assert.equal(s.toString(), 'xABCD')
    })

    it('should throw on an empty string when the index is out of upper bound', () => {
      const s = new MagicString('')

      assert.throws(() => s.appendLeft(6, 'A'), /index 6 is out of bounds/)
      assert.throws(() => s.appendRight(6, 'D'), /index 6 is out of bounds/)
    })
```

(`'xABCD'`: at index 1 == length, `byEnd.get(1)` is the only chunk, so
`prependLeft`/`appendLeft` go to its outro in order `A`,`B`; `byStart.get(1)` is
`undefined`, so `prependRight`/`appendRight` go to the string-level outro:
`C` then `D` → chunk outro `AB` then string outro `CD`.) Run the test; if the
actual output differs, print it and STOP — do not adjust the expectation to
match.

**Verify**: `pnpm exec vitest run tests/MagicString/append.test.ts tests/MagicString/prepend.test.ts` → all pass.

### Step 5: Route `move` through it and bounds-check all three indices

Replace the three `… + this.offset` lines with:

```ts
    start = this._resolveIndex(start)
    end = this._resolveIndex(end)
    index = this._resolveIndex(index)

    if (start === end)
      return this

    if (start < 0 || end > this.original.length || index < 0 || index > this.original.length) {
      throw new MagicStringError(`range ${start}–${end} is out of bounds`)
    }
    if (start > end) {
      throw new MagicStringError(`end must be greater than start (start: ${start}, end: ${end})`)
    }
    if (index >= start && index <= end) {
      throw new MagicStringError('cannot move a selection inside itself')
    }
```

Keep the `if (!first || !last) throw …` guard that plan 001 added after the
`_split` calls (it is now unreachable in practice but costs nothing and keeps
the strict narrowing); if plan 001 has not landed, add it as described there.

**Verify**: `pnpm exec vitest run tests/MagicString/move.test.ts` → all pass,
including 001's "out of bounds" test.

### Step 6: New tests

Add, following the `describe`/`it` nesting of each file:

`tests/MagicString/update.test.ts`:
- `should throw when an index is not an integer` — `update(Number.NaN, 2, 'X')`
  and `update(1.5, 3, 'X')`; assert `/index must be an integer, got NaN/` and
  `/got 1.5/`, and `s.toString()` unchanged afterwards. (Do not pass
  `undefined` through a type assertion to simulate the JS caller; `NaN` takes
  the same code path.)

`tests/MagicString/remove.test.ts`: `remove(Number.NaN, 2)` throws `/must be an integer/`;
string unchanged.

`tests/MagicString/reset.test.ts`: same for `reset`.

`tests/MagicString/slice.test.ts`: `slice(0.5, 3)` throws `/must be an integer/`;
`slice(0, 100)` on `'abcdef'` still returns `'abcdef'` (clamping preserved);
`slice(-2)` returns `'ef'`.

`tests/MagicString/append.test.ts` (in `describe('appendLeft')`):
- `should resolve a negative index from the end` — `new MagicString('abc').appendLeft(-1, 'X').toString()` → `'abXc'`.
- `should throw on a non-integer index` — `appendLeft(1.5, 'X')` → `/must be an integer, got 1.5/`.
- `should apply the offset before validating` — `new MagicString('abc', { offset: 1 }).appendLeft(2, 'X').toString()` → `'abcX'`; `appendLeft(3, 'X')` → throws `/index 4 is out of bounds/`.

`tests/MagicString/move.test.ts`:
- `should throw when the target index is out of bounds` — `new MagicString('abcdef').move(0, 3, 100)` → `/out of bounds/`, string unchanged.
- `should resolve negative indices from the end` — `new MagicString('abcdef').move(-2, -1, 0).toString()` → `'eabcdf'`.

`README.md` under `### s.offset` (after the example at line 89) add one
paragraph: "Indices must be integers; a negative index counts from the end of
the original string. `update`, `overwrite`, `remove`, `reset`, `move` and the
`append*`/`prepend*` methods throw a `MagicStringError` for an index outside
the original string, while `slice` clamps like `String.prototype.slice`."

**Verify**: `pnpm test` → all pass, and the total is the step 1 baseline plus
the number of tests you added (two replaced by three in `append.test.ts`
counts as +1). State the final count in the commit message.

### Step 7: Full verification

`pnpm run typecheck && pnpm run lint && pnpm test && pnpm run build`.

Then run this smoke script against the build and compare to the table in
"Why this matters":

```sh
node -e "
import('./dist/index.mjs').then(({ default: MagicString }) => {
  const t = (l, f) => { try { console.log(l, JSON.stringify(f())) } catch (e) { console.log(l, 'THROW', e.message) } }
  t('update undefined', () => new MagicString('abcdef').update(undefined, 2, 'X').toString())
  t('remove NaN', () => new MagicString('abcdef').remove(NaN, 2).toString())
  t('appendLeft 100', () => new MagicString('abc').appendLeft(100, 'X').toString())
  t('appendLeft -1', () => new MagicString('abc').appendLeft(-1, 'X').toString())
  t('move oob start', () => new MagicString('abc').move(5, 7, 0).toString())
  t('move oob index', () => new MagicString('abcdef').move(0, 3, 100).toString())
  t('appendRight 1.5', () => new MagicString('abcdef').appendRight(1.5, 'X').toString())
  t('update negative', () => new MagicString('abcdef').update(-3, -1, 'X').toString())
  t('slice clamp', () => new MagicString('abcdef').slice(0, 100))
})"
```

**Verify**: the first three, `move oob start`, `move oob index`, `appendRight 1.5`
print `THROW [MagicString] …`; `appendLeft -1` → `"abXc"`; `update negative` →
`"abcXf"`; `slice clamp` → `"abcdef"`.

## Test plan

- Rewritten: the two #302 tests in `append.test.ts` (step 4).
- New (step 6): ~11 tests across `update`, `remove`, `reset`, `slice`,
  `append`, `move` test files, covering NaN/fraction rejection, negative
  resolution, offset-before-validation, OOB throws, `slice` clamping preserved.
- Pattern: `tests/MagicString/update.test.ts:88-113`.
- Verification: `pnpm test` → all pass.

## Done criteria

- [ ] `grep -c "_resolveIndex(" src/MagicString.ts` → `16` (1 definition + 2 each in `update`, `remove`, `reset`, `slice` + 1 each in the four insert methods + 3 in `move`); every one of the ten public methods calls it
- [ ] `grep -c "index + this.offset\|start + this.offset\|end + this.offset" src/MagicString.ts` → `0`
- [ ] `grep -c "if (this.original.length !== 0)" src/MagicString.ts` → `0`
- [ ] `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, `pnpm run build` exit 0
- [ ] The step 7 smoke script output matches the expected column
- [ ] `git status` shows only in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any test *other than* the two #302 tests in `append.test.ts` fails after
  step 3–5 — the plan's premise is that every existing error message is
  preserved.
- The `'xABCD'` expectation in step 4 does not match what the code produces.
- You find a public method taking an index that is not in the list of ten
  (then the README list is wrong too — report rather than extend scope).
- `replace`/`replaceAll` tests start failing — they call `overwrite`/`appendRight`
  with `match.index - this.offset`; if that path now throws, the offset
  round-trip is broken and needs a maintainer decision.

## Maintenance notes

- **Semver**: this changes two tested behaviours (OOB `append*`/`prepend*` now
  throw instead of silently landing in `intro`/`outro`; OOB `move` target now
  throws instead of moving to the end). Recommend a `fix:` with a CHANGELOG note
  and a 1.x minor, not a patch; the alternative design (clamp OOB inserts to
  `original.length`) was considered and rejected because `update`/`remove`
  already throw for the same input and silent clamping is how the `NaN` data
  loss went unnoticed. A maintainer may still prefer clamping — if so, only
  step 4's bounds check and its tests change.
- Plan 011 (fuzz oracle) relies on the invariant established here: every
  public index-taking method either resolves to `[0, original.length]` or throws.
- Reviewers: check that `_resolveIndex` is `@internal` (so `isolatedDeclarations`
  strips it) and that no message string changed.
