# Plan 002: Remove the dead `DEBUG`/`Stats` timing instrumentation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat abdc931..HEAD -- src/MagicString.ts src/Chunk.ts src/utils/Stats.ts src/utils/Stats.test.ts tsdown.config.ts vitest.config.ts src/index.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of 001; if 001 has landed, line numbers
  below shift slightly — anchor on the code, not the numbers)
- **Category**: tech-debt
- **Planned at**: commit `abdc931` (v1.4.4, `origin/master`), 2026-10-27

## Why this matters

`MagicString` wraps almost every mutating method in `if (DEBUG) this.stats.time(...)`
/ `timeEnd(...)` pairs backed by `src/utils/Stats.ts` (`process.hrtime`). Nothing
reads the result: not the benchmark (which imports `dist/`, where `DEBUG` is
compiled to `false`), not the tests, not any doc. The labels are already wrong
(`prependLeft` and `prependRight` both time `'insertRight'`; `update` times
`'overwrite'`; `_split` starts a timer that `_splitChunk` ends, so an early
return leaves it dangling) — nobody noticed because nobody looks. The cost is
real: ~60 lines of noise across the hottest file, 22 `/* v8 ignore … DEBUG */`
comments that exist only to excuse it from coverage, every test paying two
`hrtime` calls per call, and the test build exercising a `Chunk` shape
(non-enumerable `previous`/`next`) that production never sees. Removing it
also deletes the only `node:` import in `src/`, so the browser story no longer
depends on tree-shaking.

## Current state

- `src/utils/Stats.ts` — the timer class (`import process from 'node:process'`).
- `src/utils/Stats.test.ts` — its unit test (2 tests).
- `src/MagicString.ts` — `declare const DEBUG: boolean` (line 40);
  `declare stats: Stats` field (~line 169); constructor
  `Object.defineProperty(this, 'stats', { value: new Stats() })` under `if (DEBUG)`
  (lines 197-200); 20 `if (DEBUG) this.stats.time*(...)` pairs, each preceded by
  `/* v8 ignore next 2 -- DEBUG is always true in tests */` at lines 234, 249,
  267, 282, 645, 743, 809, 879, 907, 922, 938, 953, 987, 1010, 1040, 1055,
  1199, 1241 (at `abdc931`); `import { Stats } from './utils/Stats.ts'` (line 12).
- `src/Chunk.ts` — `declare const DEBUG: boolean` (line 1) and, in the
  constructor:
  ```ts
  // src/Chunk.ts:35-46
      /* v8 ignore next 8 -- DEBUG is always true in tests */
      if (DEBUG) {
        // we make these non-enumerable, for sanity while debugging
        Object.defineProperties(this, {
          previous: { writable: true, value: null },
          next: { writable: true, value: null },
        })
      }
      else {
        this.previous = null
        this.next = null
      }
  ```
- `tsdown.config.ts` — `define: { DEBUG: 'false' }`.
- `vitest.config.ts` — `define: { DEBUG: 'true' }`.
- `src/index.test.ts` — tests the built bundle via `import … from 'magic-string'`
  (resolves to `dist/index.mjs`); its test "keeps MagicString internal state
  non-enumerable" asserts `Object.keys(new MagicString('abc'))` is `[]` — that
  is about `MagicString` fields (set via `Object.defineProperties` in the
  constructor, unaffected by this plan), not `Chunk` fields.

Exemplar of a method after cleanup — `append()` at `src/MagicString.ts:213-220`
already has no instrumentation:

```ts
  append(content: string): this {
    if (typeof content !== 'string') {
      throw new MagicStringError(`content must be a string, got ${typeof content}`)
    }

    this.outro += content
    return this
  }
```

Conventions: `@antfu/eslint-config` style (2-space, no semicolons). Coverage
annotations in this repo are `/* v8 ignore next N -- <reason> */`; after this
plan the only ones left in `MagicString.ts` should be the two unrelated ones
(`v8 ignore else -- unreachable…` in `update` if plan 001 has not yet removed
it, and `v8 ignore next 2 -- match.index…` in `_replaceRegexp`).

## Commands you will need

| Purpose   | Command                       | Expected on success |
|-----------|-------------------------------|---------------------|
| Install   | `pnpm install`                | exit 0              |
| Typecheck | `pnpm run typecheck`          | exit 0              |
| Tests     | `pnpm test`                   | all pass; count drops by 2 (Stats tests removed) |
| Coverage  | `pnpm exec vitest run --coverage` | `All files` ≥ 99.5 % statements |
| Lint      | `pnpm run lint`               | exit 0              |
| Build     | `pnpm run build`              | `✔ Build complete`  |

## Scope

**In scope** (the only files you should modify/delete):
- `src/MagicString.ts`
- `src/Chunk.ts`
- `src/utils/Stats.ts` (delete)
- `src/utils/Stats.test.ts` (delete)
- `tsdown.config.ts`
- `vitest.config.ts`

**Out of scope**:
- Any behavioural change. `toString()`, maps, errors must be byte-identical.
- `src/index.test.ts` — should keep passing unchanged; if it fails, STOP.
- `benchmark/**` — does not use `Stats`.
- The other `v8 ignore` comments (`update`'s unreachable else, `_replaceRegexp`'s
  `match.index`, `SourceMap.ts` environment fallbacks, `Bundle.ts` separator
  normalisation) — leave them.

## Git workflow

- Worktree off `origin/master`:
  `git -C ~/projects/magic-string/default fetch origin && git -C ~/projects/magic-string/default worktree add ../remove-stats -b chore/remove-debug-stats origin/master`
- One or two commits, Conventional Commits, e.g.
  `chore: remove the unused DEBUG timing instrumentation`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Baseline

`pnpm install && pnpm test` → note the total test count (461 at `abdc931`).
`grep -c "if (DEBUG)" src/MagicString.ts` → `20` (19 timer sites + the constructor).

### Step 2: Strip `MagicString.ts`

Remove, in `src/MagicString.ts`:

1. `import { Stats } from './utils/Stats.ts'`.
2. `declare const DEBUG: boolean`.
3. The `/** @internal */ declare stats: Stats` field.
4. Lines 197-200 in the constructor (`/* v8 ignore next 3 … */ if (DEBUG) { Object.defineProperty(this, 'stats', …) }`).
5. Every `/* v8 ignore next 2 -- DEBUG is always true in tests */` comment plus
   the two lines that follow it (`if (DEBUG)` / `this.stats.time…(…)`). Watch
   for blank-line pairs left behind; lint enforces at most one blank line.

**Verify**: `grep -c "DEBUG\|stats" src/MagicString.ts` → `0`.
`pnpm run lint` → exit 0.

### Step 3: Strip `Chunk.ts`

Replace the `if (DEBUG) { … } else { … }` block (with its `v8 ignore` comment)
by the two plain assignments:

```ts
    this.previous = null
    this.next = null
```

Remove `declare const DEBUG: boolean` at the top.

Consequence to be aware of: `previous`/`next` become enumerable own properties
in the *test* build — they already were in the production build. Nothing in
`tests/**` or `src/**/*.test.ts` enumerates `Chunk` keys (`grep -rn "Object.keys(.*chunk\|JSON.stringify(.*chunk" tests src` → no matches at `abdc931`).

**Verify**: `grep -c DEBUG src/Chunk.ts` → `0`.

### Step 4: Delete `Stats` and the `define`s

- `git rm src/utils/Stats.ts src/utils/Stats.test.ts`
- `tsdown.config.ts`: remove the `define: { DEBUG: 'false' }` entry (keep
  `entry`, `exports`, `publint`).
- `vitest.config.ts`: remove the `define: { DEBUG: 'true' }` entry.

**Verify**: `grep -rn "DEBUG" src tsdown.config.ts vitest.config.ts` → no
matches. `grep -rn "node:" src` → no matches (the only `node:` import in `src/`
was `Stats.ts`).

### Step 5: Full verification

`pnpm run typecheck && pnpm run lint && pnpm test && pnpm run build`.

**Verify**: typecheck/lint exit 0; tests: `Test Files 40 passed`, `Tests 459 passed`
(461 − 2 Stats tests; if plan 001 landed first, 460); build completes and
`grep -c "hrtime\|node:process" dist/index.mjs` → `0`.

`pnpm exec vitest run --coverage` → `All files` statements ≥ 99.5 %, and the
`src/utils` row no longer lists `Stats.ts`.

## Test plan

- No new tests: this plan deletes dead code and must not change behaviour. The
  existing 459 tests are the characterization net.
- Deleted: `src/utils/Stats.test.ts` (2 tests).
- Verification: `pnpm test` → all pass; `pnpm exec vitest run src/index.test.ts`
  → 3 pass (bundle shape unchanged).

## Done criteria

- [ ] `src/utils/Stats.ts` and `src/utils/Stats.test.ts` no longer exist
- [ ] `grep -rn "DEBUG\|\.stats\b\|Stats" src tsdown.config.ts vitest.config.ts` → no matches
- [ ] `grep -c "v8 ignore" src/MagicString.ts` ≤ 2 and `grep -c "v8 ignore" src/Chunk.ts` → 0
- [ ] `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, `pnpm run build` all exit 0
- [ ] `git status` shows only the six in-scope paths
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `grep -c "if (DEBUG)" src/MagicString.ts` at step 1 is not `20`, or `Stats`
  is referenced from any file other than `src/MagicString.ts` and its own test.
- Any test other than the two deleted `Stats` tests changes outcome.
- `src/index.test.ts` "keeps MagicString internal state non-enumerable" fails
  — that would mean a `MagicString` (not `Chunk`) field became enumerable,
  which this plan must not cause.
- Coverage drops below 99 % statements — a `v8 ignore` you removed was
  covering something other than a `DEBUG` branch.

## Maintenance notes

- Future per-method timing belongs in `benchmark/` (plan 009 reworks it), not
  in the library.
- Reviewers: diff should be pure deletion plus the two `Chunk` assignments;
  no logic lines should change.
