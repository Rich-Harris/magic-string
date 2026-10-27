# Plan 001: Compile `src/` under `strict: true` with no new type assertions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat abdc931..HEAD -- tsconfig.json src/MagicString.ts src/Bundle.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `abdc931` (v1.4.4, `origin/master`), 2026-10-27

## Why this matters

`tsconfig.json` sets `strict: false`. The core data structure is a doubly linked
list of `Chunk`s looked up through two `Map<number, Chunk>`s, so almost every
method handles `Chunk | null | undefined` values — exactly what strict null
checks exist for. Today `tsc --strict` reports 50 errors, and several of them
sit on real bugs: `move()` dereferences `byStart.get(start)` without a check and
throws a raw `TypeError` for an out-of-range `start`; `update()` has an
"unreachable" else-branch that *is* reached for `NaN` indices and silently
truncates the string. Later plans (003 index validation, 004 storeName, 007
slice) rewrite these very regions; doing it under strict mode means the compiler
guards the rewrite instead of the test suite alone.

## Current state

- `tsconfig.json` — `"strict": false` (line 10). `isolatedDeclarations`,
  `verbatimModuleSyntax`, `declaration` are on; `tsconfig.test.json` extends it
  and adds `tests/**`.
- `src/MagicString.ts` (1664 lines) — the class; 42 strict errors.
- `src/Bundle.ts` (550 lines) — 8 strict errors.
- `src/Chunk.ts` — `previous: Chunk | null`, `next: Chunk | null` are the
  source of most `Chunk | null` → `Chunk` complaints.

Full error list from `pnpm exec tsc --strict` at `abdc931` (file(line,col)):

```
src/Bundle.ts(98,9) (98,26)            string-indexing a typed object (addSource option copy loop)
src/Bundle.ts(251,5)                   `combined.lastChunk = last` where last: Chunk | null
src/Bundle.ts(398,31) (399,28) (400,26) (405,16) (405,40)   `indentStringCounts = {}` indexed by string
src/MagicString.ts(315,7)              clone(): `originalChunk = nextOriginalChunk` (Chunk | null)
src/MagicString.ts(437,45)             getIndentString(): indentStr may be undefined
src/MagicString.ts(520,9) (587,7)      indent(): `chunk = chunk.next`
src/MagicString.ts(667,9) (667,18) (676,21) (677,22) (722,7) (724,7) (726,10) (727,7) (727,25) (728,10) (729,7) (729,24) (733,5) (734,5) (737,7) (739,7)
                                       move(): first/last from Map.get are Chunk | undefined; cursor loop
src/MagicString.ts(856,9)              update(): `chunk = chunk.next` in the split-point check loop
src/MagicString.ts(875,7) (876,7)      update(): dead "must be inserting at the end" else-branch
src/MagicString.ts(1007,7) (1052,7)    remove()/reset(): `chunk = cond ? byStart.get(..) : null`
src/MagicString.ts(1139,7) (1176,7)    slice(): `chunk = chunk.next`
src/MagicString.ts(1211,7)             _split(): `chunk = searchForward ? byStart.get : byEnd.get`
src/MagicString.ts(1256,7)             toString(): `chunk = chunk.next`
src/MagicString.ts(1326,11) (1330,26) (1330,44) (1331,24) (1331,40) (1336,7)   trimEndAborted(): `chunk.next.start`, `chunk = chunk.previous`
src/MagicString.ts(1370,11) (1373,26) (1373,44) (1374,24) (1374,40) (1379,7)   trimStartAborted(): same shape
src/MagicString.ts(1489,11)            _replaceRegexp(): `match.index` (number | undefined) passed to expandReplacement(position: number)
```

Excerpts (abdc931):

```ts
// src/MagicString.ts:633-677  (move)
  move(start: number, end: number, index: number, affinity: 'left' | 'right' = 'right'): this {
    start = start + this.offset
    end = end + this.offset
    index = index + this.offset
    if (start === end)
      return this
    if (index >= start && index <= end) {
      throw new MagicStringError('cannot move a selection inside itself')
    }
    ...
    this._split(start)
    this._split(end)
    this._split(index)

    const first = this.byStart.get(start)
    const last = this.byEnd.get(end)
    ...
    if (this.hasMovedChunks) {
      let cursor = first
      while (cursor !== last) {
        cursor = cursor.next
        if (!cursor || cursor.start < start || cursor.end > end) {
          throw new MagicStringError(
            `cannot move ${start} to ${end} because an earlier move split that range`,
          )
        }
      }
    }

    const oldLeft = first.previous
    const oldRight = last.next
```

```ts
// src/MagicString.ts:839-879  (update, after validation and _split calls)
    const first = this.byStart.get(start)
    const last = this.byEnd.get(end)

    /* v8 ignore else -- unreachable: a valid start/end always yields a `first` chunk */
    if (first) {
      // check the whole range before editing it, so a call that throws
      // leaves the string as it was
      let chunk = first
      while (chunk !== last) {
        if (chunk.next !== this.byStart.get(chunk.end)) {
          throw new MagicStringError('cannot overwrite across a split point')
        }
        chunk = chunk.next
      }

      chunk = first
      while (chunk !== last) {
        chunk = chunk.next
        // `first` takes the replacement and the rest of the range is emptied.
        // Unless overwriting, inserts on these chunks are kept as they are on
        // `first`, so the result does not depend on where the range was split
        chunk.edit('', false, !overwrite)
        // emptied, not removed: `first` holds the replacement for this chunk too
        chunk.replacesUntil = -1
        chunk.replacedFrom = start
      }

      first.edit(content, storeName, !overwrite)
      first.replacesUntil = end
      first.replacedFrom = -1
    }
    else {
      // must be inserting at the end
      const newChunk = new Chunk(start, end, '').edit(content, storeName)

      // TODO last chunk in the array may not be the last chunk, if it's moved...
      last.next = newChunk
      newChunk.previous = last
    }
```

```ts
// src/Bundle.ts:96-99  (addSource)
    ['filename', 'ignoreList', 'indentExclusionRanges', 'separator'].forEach((option) => {
      if (!hasOwnProp.call(source, option))
        source[option] = source.content[option]
    })
```

```ts
// src/Bundle.ts:389-408  (getIndentString)
  getIndentString(): string {
    const indentStringCounts = {}
    this.sources.forEach((source) => {
      const indentStr = source.content._getRawIndentString()
      if (indentStr === null)
        return
      if (!indentStringCounts[indentStr])
        indentStringCounts[indentStr] = 0
      indentStringCounts[indentStr] += 1
    })
    return (
      Object.keys(indentStringCounts).sort((a, b) => {
        return indentStringCounts[b] - indentStringCounts[a]
      })[0] || '\t'
    )
  }
```

Conventions that apply:

- Code style is `@antfu/eslint-config` (2-space, no semicolons, single quotes);
  `pnpm run lint` must stay green.
- Errors are always `throw new MagicStringError('...')` (`src/MagicStringError.ts`).
- Type assertions (`as`) and non-null assertions (`!`) are a last resort; each
  one you keep or add must carry a one-line `// why` comment explaining the
  invariant that makes it safe. Prefer re-typing a `let` as `Chunk | null`,
  or restructuring the loop, over adding `!`.
- Do not add `unknown`/`any` parameters, `Record<string, unknown>`, or
  `@ts-expect-error`/`@ts-ignore`.

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Install   | `pnpm install`                            | exit 0              |
| Typecheck | `pnpm run typecheck`                      | exit 0 (runs `tsc && tsc -p tsconfig.test.json`) |
| Strict probe (before flipping the flag) | `pnpm exec tsc --strict` | error count shrinking to 0 |
| Tests     | `pnpm test`                               | `Test Files 41 passed`, `Tests 461 passed` (runs `pretest` build first) |
| One file  | `pnpm exec vitest run tests/MagicString/move.test.ts` | all pass |
| Lint      | `pnpm run lint`                           | exit 0, no output   |
| Build     | `pnpm run build`                          | `✔ Build complete`, `[publint] No issues found` |

## Scope

**In scope** (the only files you should modify):
- `tsconfig.json`
- `src/MagicString.ts`
- `src/Bundle.ts`
- `tests/MagicString/move.test.ts` (one new test, step 4)

**Out of scope** (do NOT touch, even though they look related):
- `src/Chunk.ts` — keep `previous`/`next` typed `Chunk | null`; do not widen or
  narrow them.
- `src/utils/**`, `src/SourceMap.ts`, `src/BitSet.ts` — they already compile
  under strict.
- Any behavioural change other than the two listed in step 3 (move throwing a
  `MagicStringError` instead of a `TypeError`; deleting the dead else-branch in
  `update`). In particular do not add index validation — that is plan 003.
- Do not enable `noUncheckedIndexedAccess` (137 further errors; not in scope).
- `tests/__utils/IntegrityCheckingMagicString.ts` — its `as unknown as` casts
  compile under strict already.

## Git workflow

- Create a worktree off `origin/master` (not off the possibly-stale local
  `default` checkout):
  `git -C ~/projects/magic-string/default fetch origin && git -C ~/projects/magic-string/default worktree add ../strict-ts -b chore/strict-typescript origin/master`
- Commit per step; Conventional Commits, matching repo history, e.g.
  `chore: enable strict type checking` / `refactor: narrow chunk lookups in move`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Baseline

Run `pnpm install && pnpm run typecheck && pnpm test`. Then run
`pnpm exec tsc --strict 2>&1 | grep -c "error TS"`.

**Verify**: typecheck exit 0, 461 tests pass, strict probe prints `50`.

### Step 2: Fix the mechanical `Chunk | null` sites by re-typing locals

For each site below, change the declaration of the loop variable rather than
adding `!`:

- `clone()` ~line 298: `let originalChunk: Chunk | null = this.firstChunk`, and annotate
  `const nextOriginalChunk: Chunk | null = originalChunk.next` (otherwise TS7022:
  implicit `any` from the self-referencing initializer).
- `indent()` ~line 507: `let chunk: Chunk | null = this.firstChunk`. The
  `indentAt` closure already uses `chunk!` — keep those four (they are inside a
  closure invoked only while `chunk` is non-null; add one comment above the
  closure saying so).
- `slice()` ~line 1125: `let chunk: Chunk | null = this.firstChunk`.
- `_split()` ~line 1203: `let chunk: Chunk | undefined = this.lastSearchedChunk`
  and `let previousChunk: Chunk | undefined = chunk`.
- `_hasRemovedContent()` ~line 1458: `chunk` is already `Chunk | undefined`
  from `Map.get`; the assignment at 1466 only errors because `lastSearchedChunk`
  is `Chunk` — assign through a `let chunk: Chunk | undefined`.
- `remove()` ~line 989 and `reset()` ~line 1040: replace `: null` with
  `: undefined` in `chunk = end > chunk.end ? this.byStart.get(chunk.end) : undefined`.
- `getIndentString()` line 437: `return this.indentStr ?? '\t'` (after
  `_ensureindentStr()` the value is `string | null`; `??` maps `null` to `'\t'`
  exactly as the ternary did).
- `trimEndAborted()` / `trimStartAborted()` ~lines 1317-1330 / 1361-1373:
  declare `let chunk: Chunk | null = this.lastChunk` (resp. `firstChunk`). Inside
  the `if (chunk.end !== end)` block, `chunk.next` is non-null because
  `Chunk.trimEnd`/`trimStart` just split the chunk (see `src/Chunk.ts:175-176`,
  `204-205`). Capture it once:
  ```ts
  if (chunk.end !== end) {
    const next = chunk.next! // chunk.trimEnd() just split this chunk, so a successor exists
    if (this.lastChunk === chunk)
      this.lastChunk = next
    this.byEnd.set(chunk.end, chunk)
    this.byStart.set(next.start, next)
    this.byEnd.set(next.end, next)
  }
  ```
- `toString()` ~line 1253: `let chunk: Chunk | null = this.firstChunk`.
- `_replaceRegexp()` ~line 1483-1527: the inner `getReplacement(match, str)`
  passes `match.index` (typed `number | undefined`) to `expandReplacement`'s
  `position: number`. Its only caller, `replaceMatch`, has already returned
  when `match.index == null`, so give `getReplacement` the narrowed value:
  change its signature to `getReplacement(match: RegExpMatchArray, index: number, str: string)`,
  use `index` in place of `match.index` inside it (both the `expandReplacement`
  call and the two `replacement(...)` calls), and call it as
  `getReplacement(match, match.index, this.original)` after the null guard.
  Do not use `!`.
- `Bundle.toMagicString()` line 251: `first`/`last` are assigned inside a
  `this.sources.forEach(...)` callback, which TypeScript does not follow, so
  after any guard they narrow to `never`. Convert the `forEach` to
  `for (const [i, source] of this.sources.entries())` (the empty-source
  `return` becomes `continue`), then narrow both at once with
  `if (!first || !last) { combined.intro = pending; return combined }` and drop
  the `!` at 248.

**Verify**: `pnpm exec tsc --strict 2>&1 | grep -c "error TS"` → a number ≤ 26
(only `move`, `update`, and the two `Bundle` indexing groups remain).
`pnpm test` → 461 pass.

### Step 3: Restructure `move()` and `update()`

`move()` (~633-752):

1. After the two `_split` calls, replace
   ```ts
   const first = this.byStart.get(start)
   const last = this.byEnd.get(end)
   ```
   with
   ```ts
   const first = this.byStart.get(start)
   const last = this.byEnd.get(end)
   if (!first || !last) {
     throw new MagicStringError(`range ${start}–${end} is out of bounds`)
   }
   ```
   (Plan 003 later moves this into a shared validator; keep the message text
   exactly as above so that plan's tests stay valid. Note the en dash `–`
   between the numbers — it matches the existing `remove()` message at ~line 981.)
2. `let cursor: Chunk | null = first` in the `hasMovedChunks` loop.
3. Lines ~735-738 (`if (!first.previous) this.firstChunk = last.next` and
   `this.lastChunk = first.previous`): these are `Chunk | null` into `Chunk`.
   The values are non-null because a moved range can never be the whole string
   (if it were, `index` would lie inside it and the guard at the top throws).
   Use `oldRight!` / `oldLeft!` with that reason as a comment, e.g.
   ```ts
   if (!oldLeft)
     this.firstChunk = oldRight! // the range is not the whole string: `index` would be inside it
   if (!oldRight) {
     this.lastChunk = oldLeft! // same reason
     this.lastChunk.next = null
   }
   ```
   (`oldLeft`/`oldRight` were captured from `first.previous`/`last.next` before
   any relinking, so they equal what the original code read.)

`update()` (~839-879):

1. Replace the `if (first) { ... } else { ... }` with a flat body: the else-branch
   is unreachable (start < end ≤ original.length, so `_split(start)` always
   yields a chunk starting at `start`) — delete it together with its `v8 ignore`
   comment and the `TODO`.
2. Avoid depending on `last` being defined by walking on `chunk.end < end`:
   ```ts
   const first = this.byStart.get(start)! // start < end <= original.length, so _split(start) left a chunk here

   // check the whole range before editing it, so a call that throws
   // leaves the string as it was
   for (let chunk = first; chunk.end < end;) {
     const next = chunk.next
     if (next === null || next !== this.byStart.get(chunk.end)) {
       throw new MagicStringError('cannot overwrite across a split point')
     }
     chunk = next
   }

   for (let chunk = first.next; chunk !== null && chunk.start < end; chunk = chunk.next) {
     // `first` takes the replacement and the rest of the range is emptied.
     // Unless overwriting, inserts on these chunks are kept as they are on
     // `first`, so the result does not depend on where the range was split
     chunk.edit('', false, !overwrite)
     // emptied, not removed: `first` holds the replacement for this chunk too
     chunk.replacesUntil = -1
     chunk.replacedFrom = start
   }

   first.edit(content, storeName, !overwrite)
   first.replacesUntil = end
   first.replacedFrom = -1
   ```
   The chunk set visited is identical to before: chunks tile `original`, so the
   chunk whose `end === end` is the old `last`, and the chunk after it has
   `start === end`. Remove the now-unused `const last = this.byEnd.get(end)`.
   If `Chunk` is no longer referenced as a value in `MagicString.ts` after
   deleting `new Chunk(...)`, change its import to `import type { Chunk }`
   (`verbatimModuleSyntax` requires it, and lint will flag it).

**Verify**: `pnpm exec tsc --strict 2>&1 | grep -c "error TS"` → `8` (all in
`src/Bundle.ts`). `pnpm test` → 461 pass (the behaviour of every existing
update/overwrite/move test is unchanged).

### Step 4: Add the `move` regression test

In `tests/MagicString/move.test.ts`, inside `describe('move', …)`, add:

```ts
it('should throw a MagicStringError when the range is out of bounds', () => {
  const s = new MagicString('abc')

  assert.throws(() => s.move(5, 7, 0), MagicStringError)
  assert.throws(() => s.move(5, 7, 0), /out of bounds/)
  assert.equal(s.toString(), 'abc')
})
```

Import `MagicStringError` from `'../../src/index.ts'` if the file does not
already (see `tests/MagicString/update.test.ts:2` for the pattern).

**Verify**: `pnpm exec vitest run tests/MagicString/move.test.ts` → all pass.
(Before step 3 this test fails with `TypeError`.)

### Step 5: Fix the two `Bundle` indexing groups

`addSource` (~96-99): replace the string-keyed `forEach` with explicit
assignments that keep the exact semantics (`hasOwnProp` means "the caller set
it, even to `undefined`"):

```ts
if (!hasOwnProp.call(source, 'filename'))
  source.filename = source.content.filename
if (!hasOwnProp.call(source, 'ignoreList'))
  source.ignoreList = source.content.ignoreList
if (!hasOwnProp.call(source, 'indentExclusionRanges'))
  source.indentExclusionRanges = source.content.indentExclusionRanges
if (!hasOwnProp.call(source, 'separator'))
  source.separator = undefined
```

Note: `MagicString` has no `separator` field, so `source.content.separator` was
always `undefined`; the fourth line preserves that and the following
`if (source.separator === undefined) source.separator = this.separator` block
still applies. (Plan 005 replaces this whole block with a copied record; keep
this step minimal.)

`getIndentString` (~389-408): type the counter: `const indentStringCounts = new Map<string, number>()`,
`indentStringCounts.set(indentStr, (indentStringCounts.get(indentStr) ?? 0) + 1)`,
and sort `[...indentStringCounts.keys()]` by `indentStringCounts.get(b)! - indentStringCounts.get(a)!`
— or avoid the `!` by sorting `[...indentStringCounts.entries()]` on `[, count]`
and taking `[0]?.[0] ?? '\t'`. Prefer the entries form.

**Verify**: `pnpm exec tsc --strict 2>&1 | grep -c "error TS"` → `0`.
`pnpm exec vitest run tests/Bundle` → all pass.

### Step 6: Flip the flag

In `tsconfig.json` change `"strict": false` to `"strict": true`.

**Verify**: `pnpm run typecheck` → exit 0 (both `tsc` and
`tsc -p tsconfig.test.json`). `pnpm run lint` → exit 0. `pnpm test` → 462 pass.
`pnpm run build` → `✔ Build complete`, publint clean.
`git diff abdc931 -- dist` is not applicable (dist is gitignored) — instead
confirm `grep -c "cannot move" dist/index.mjs` ≥ 2 (the new message is in the bundle).

## Test plan

- New: `tests/MagicString/move.test.ts` — "should throw a MagicStringError when
  the range is out of bounds" (step 4).
- Existing suite is the characterization net: 461 tests must stay green after
  every step. Pay special attention to `tests/MagicString/update.test.ts`,
  `overwrite.test.ts`, `move.test.ts`, `trim.test.ts`, `tests/Bundle/indent.test.ts`
  (getIndentString) and `tests/Bundle/addSource.test.ts`.
- Verification: `pnpm test` → `Tests 462 passed`.

## Done criteria

- [ ] `tsconfig.json` contains `"strict": true`
- [ ] `pnpm run typecheck` exits 0
- [ ] `pnpm run lint` exits 0
- [ ] `pnpm test` exits 0 with 462 tests
- [ ] `grep -n "must be inserting at the end" src/MagicString.ts` → no match
- [ ] `grep -c '!\.' src/MagicString.ts src/Bundle.ts` has not grown by more than
      the sites listed in steps 2–3, and every `!` or `as` you added has a
      trailing `// why` comment
- [ ] `grep -rn "@ts-ignore\|@ts-expect-error\|: any\b" src/` → no new matches
      (`src/MagicString.ts:38` `...args: any[]` and `src/utils/isObject.ts` pre-exist and stay)
- [ ] `git status` shows only the four in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The strict probe at step 1 reports a count other than 50, or lists a file
  other than `src/MagicString.ts` / `src/Bundle.ts` — the code has drifted.
- Fixing a site seems to require changing `Chunk.previous`/`Chunk.next` types,
  changing a public method signature, or editing `src/Chunk.ts`.
- Any existing test changes outcome in a way not explained by step 3's two
  intended behaviour changes (move: `TypeError` → `MagicStringError`; update:
  the dead else-branch removal, which no test exercises).
- You find yourself adding more than six `!` assertions in total.

## Maintenance notes

- Plan 003 (index validation) will fold the `move()` bounds guard into a shared
  validator; it relies on the error message text set here.
- Plan 005 will replace the `addSource` option-copy block from step 5 entirely.
- Reviewers: check that no `!`/`as` was added without a comment, and that the
  `update()` loop restructure visits exactly the same chunks (the second loop's
  bound is `chunk.start < end`).
- Follow-up explicitly deferred: `noUncheckedIndexedAccess` (137 errors, mostly
  in tests and `expandReplacement`).
