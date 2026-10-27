# Plan 009: Benchmark the paths downstream actually runs, on `vitest bench`, with a CI run on every PR

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat abdc931..HEAD -- benchmark package.json pnpm-lock.yaml vitest.config.ts .github/workflows eslint.config.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (tooling only; no library code changes)
- **Depends on**: none (plan 002 removes the `DEBUG` define, which is
  irrelevant here because the benchmark imports `dist/`)
- **Category**: dx
- **Planned at**: commit `abdc931` (v1.4.4, `origin/master`), 2026-10-27

## Why this matters

Five `perf:` commits landed in two months (#313, #328, #339, #350, #357), each
justified by ad-hoc measurements in the PR description, and the two
sourcemap-path hot spots plans 007/008 target (`slice` start lookup, `names`
indexing with `storeName`) are invisible to the current suite.
`benchmark/index.mjs` measures `construct`, `append`, `indent`, lo-res
`generateMap`/`generateDecodedMap`, one `overwrite` loop and `hasChanged` —
never `hires: true` or `'boundary'` (what Vite plugins ask for), never
`Bundle`, `slice`, `replaceAll`, `remove` or `move`. It runs on `benchmark@2.1.4`
(last release 2016), is not wired into CI, and prints to the terminal only.
Porting it to `vitest bench` (vitest is already a devDependency) lets every
`perf:` PR show its numbers from the same harness, drops an abandoned
dependency, and gives plans 007/008 something to measure against.

Honest limit: vitest 5's `bench` has no built-in baseline comparison
(`--outputJson`/`--compare` were removed). This plan delivers the cases and a
non-blocking CI run that prints the table on every PR; a numeric regression
gate is deferred (see Maintenance notes).

## Current state

- `benchmark/index.mjs` (150 lines) — bespoke runner on `Benchmark.js`:
  ```js
  import fs from 'node:fs/promises'
  import Benchmark from 'benchmark'
  import MagicString from '../dist/index.mjs'
  ...
  function runWithInstance(name, inputs, func, setup) { /* new MagicString(input) per sample in `setup`, then `func(s)` */ }
  ...
    await run('construct', …)
    await runWithInstance('append', inputs, s => s.append(';"append";'))
    await runWithInstance('indent', inputs, s => s.indent())
    await runWithInstance('generateMap (no edit)', inputs, s => s.generateMap())
    await runWithInstance('generateMap (edit)', inputs, s => s.generateMap(), s => s.replace(/replacement/g, 'replacement\nReplacement'))
    await runWithInstance('generateDecodedMap (no edit)', …)   // and (edit)
    const size = 1000000
    await runWithInstance('overwrite', ['a'.repeat(size)], (s) => { for (let i = 1; i < size; i += 2) s.overwrite(i, i + 1, 'b') })
    await runWithInstance('hasChanged (no edit)', …)            // and (edit)
  ```
  Inputs: `benchmark/data.js` (31 KB, an older build of magic-string itself)
  and `benchmark/data-min.js` (24 KB, minified). Both stay.
- `package.json`: `"bench": "pnpm run build && node benchmark/index.mjs"`,
  devDependency `"benchmark": "^2.1.4"`. Scripts `test: vitest run`,
  `test:dev: vitest`.
- `vitest.config.ts`:
  ```ts
  export default defineConfig({
    define: { DEBUG: 'true' },          // removed by plan 002
    test: {
      environment: 'node',
      isolate: false,
      coverage: { exclude: ['src/**/*.test.ts', 'tests/**', 'dist/**'] },
    },
  })
  ```
  Default `test.include` is `**/*.{test,spec}.?(c|m)[jt]s?(x)`; default
  `benchmark.include` is `**/*.{bench,benchmark}.?(c|m)[jt]s?(x)`.
- `eslint.config.js` ignores `benchmark/**` and `example/app*.js`.
- `.github/workflows/test.yml` calls `sxzz/workflows/.github/workflows/unit-test.yml@main`
  (runs typecheck, lint, build, `pnpm run test` on node 22/24/26 × ubuntu/windows);
  `permissions: {}` at the top level.
- `pnpm-workspace.yaml` has `minimumReleaseAgeExclude` for `tsdown` and
  `@types/node` — adding a devDependency is subject to pnpm 12's default 24 h
  minimum release age; this plan adds none (vitest is present).
- Style: `@antfu/eslint-config` (2-space, no semicolons, single quotes); the
  benchmark dir is currently lint-ignored — the new file should *not* be
  ignored (remove `benchmark/**` from the ignore list and make it lint-clean).

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Install   | `pnpm install`                            | exit 0              |
| Build     | `pnpm run build`                          | `✔ Build complete`  |
| Bench     | `pnpm run bench`                          | a results table with one row per case, exit 0 |
| One case  | `pnpm exec vitest bench --run -t "slice"` | only matching rows  |
| Tests     | `pnpm test`                               | unchanged count, all pass (bench file must not be picked up as a test) |
| Lint      | `pnpm run lint`                           | exit 0              |
| Typecheck | `pnpm run typecheck`                      | exit 0 (bench file is outside `tsconfig*.json` includes; keep it that way or add it to `tsconfig.test.json` — your choice, state it) |

## Scope

**In scope**:
- `benchmark/index.mjs` (delete) → `benchmark/magic-string.bench.ts` (create)
- `benchmark/data.js`, `benchmark/data-min.js` (keep, read via `fs`)
- `package.json` (`bench` script; remove `benchmark` devDependency), `pnpm-lock.yaml`
- `vitest.config.ts` (`benchmark.include`, coverage exclude)
- `eslint.config.js` (stop ignoring `benchmark/**`)
- `.github/workflows/bench.yml` (create)

**Out of scope**:
- Any file under `src/` or `tests/`.
- A numeric regression gate / stored baseline (deferred; see Maintenance notes).
- `example/` (plan 010 deletes it).

## Git workflow

- Worktree off `origin/master`:
  `git -C ~/projects/magic-string/default fetch origin && git -C ~/projects/magic-string/default worktree add ../bench -b chore/vitest-bench origin/master`
- Conventional Commits: `chore: port the benchmark to vitest bench and cover the sourcemap hot paths`,
  `ci: run the benchmark on pull requests`.
- `pnpm install` will rewrite `pnpm-lock.yaml` when the `benchmark` dependency
  is removed — that lockfile change is expected and in scope.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Baseline

`pnpm install && pnpm run bench` → the old table prints (10 rows). Save it to
`/tmp/bench-before.txt` for the PR description.

### Step 2: Write `benchmark/magic-string.bench.ts`

Structure (fill in all cases listed; keep each `bench` body free of setup
that the old runner did in `setup` — build fixtures once at module level
where the operation does not mutate, and construct inside the body where it
does, noting that the construct cost is then included):

```ts
import fs from 'node:fs'
import { bench, describe } from 'vitest'
import MagicString, { Bundle } from '../dist/index.mjs'

const inputs = ['data.js', 'data-min.js'].map(file =>
  fs.readFileSync(new URL(file, import.meta.url), 'utf-8'),
)

function fresh(): MagicString[] {
  return inputs.map(input => new MagicString(input))
}

function edited(): MagicString[] {
  return fresh().map(s => s.replace(/replacement/g, 'replacement\nReplacement'))
}

describe('construct', () => {
  bench('new MagicString', () => {
    for (const input of inputs) new MagicString(input)
  })
})

describe('generateMap', () => {
  const plain = fresh()
  const withEdits = edited()
  bench('lo-res, no edits', () => { for (const s of plain) s.generateMap() })
  bench('lo-res, edits', () => { for (const s of withEdits) s.generateMap() })
  bench('hires: true', () => { for (const s of withEdits) s.generateMap({ hires: true }) })
  bench('hires: boundary', () => { for (const s of withEdits) s.generateMap({ hires: 'boundary' }) })
  bench('hires: experimental-range', () => { for (const s of withEdits) s.generateMap({ hires: 'experimental-range' }) })
  bench('generateDecodedMap, edits', () => { for (const s of withEdits) s.generateDecodedMap() })
})
```

Add these further `describe` blocks (names are the row labels — keep them):

- `'edits'`: `overwrite` (the existing 1 M-char alternating overwrite loop,
  constructing inside the body), `replaceAll regexp` (`fresh()` then
  `s.replaceAll(/\w+/g, m => m)` — many matches, replacer returns the match
  so nothing is overwritten and `_hasRemovedContent` dominates), `remove`
  (remove every 7th character of `data.js` via a loop of `s.remove(i, i + 1)`),
  `move` (split into 100 equal ranges and move each to the end).
- `'reads'`: `slice per node` (a `fresh()` string split with
  `appendLeft(i, '')` every 500 chars, then `slice(i, i + 50)` for `i` stepping
  by 100 over the whole input — this is the case plan 007 targets),
  `toString`, `hasChanged no edits`, `hasChanged edits`, `indent`.
- `'storeName'`: `generateMap with names` — a `fresh()` string where every
  `/\bfunction\b/g` match is `overwrite`n with `'fn'` and `{ storeName: true }`
  (build once outside the bench), then `generateMap()` in the body — this is
  the case plan 008 part A targets.
- `'bundle'`: build once a `Bundle` of 20 sources, each `new MagicString(input, { filename: `${i}.js` })`
  alternating the two inputs, with the same `storeName` overwrites as above;
  benches `generateMap lo-res`, `generateMap hires: true`, `length()`
  (plan 008 part B), `toString()`.

Every `bench` body must do real work on its result (assign to a module-level
`let sink: unknown` or just call the method — vitest does not dead-code
eliminate, so calling is enough).

**Verify**: `pnpm run build && pnpm exec vitest bench --run` → a table with
rows for every case above (≥ 20 rows), no errors. If vitest also lists the
file under *tests*, fix step 3 first.

### Step 3: Wire config and scripts

`vitest.config.ts`:

```ts
  test: {
    ...
    coverage: { exclude: ['src/**/*.test.ts', 'tests/**', 'dist/**', 'benchmark/**'] },
    benchmark: {
      include: ['benchmark/**/*.bench.ts'],
    },
  },
```

(`benchmark` is a key *inside* `test` in vitest's config shape — check
`node_modules/vitest/dist/config.d.ts` if unsure.)

`package.json`:
- `"bench": "pnpm run build && vitest bench --run"`
- remove `"benchmark": "^2.1.4"` from `devDependencies`; run `pnpm install`
  (lockfile updates).
- `git rm benchmark/index.mjs`.

`eslint.config.js`: change `ignores: ['benchmark/**', 'example/app*.js']` to
`ignores: ['benchmark/data*.js', 'example/app*.js']` and make the new bench
file lint-clean.

**Verify**: `pnpm run bench` → exit 0, table printed. `pnpm test` → same
count as before this plan (the bench file is not collected as a test).
`pnpm run lint` → exit 0. `grep -c '"benchmark"' package.json` → `0`.
`pnpm run typecheck` → exit 0 (if the bench file is picked up by
`tsconfig.test.json`'s `include` — it is not, since that lists `src/**`,
`tests/**` and `vitest.config.ts` — leave it out unless the import of
`../dist/index.mjs` typechecks cleanly via `dist/index.d.mts`, which it should
after `pnpm run build`; if you add it, say so in the commit).

### Step 4: CI job

Create `.github/workflows/bench.yml`:

```yaml
name: Benchmark

on:
  pull_request:
    branches: [main, master]
  workflow_dispatch:

permissions: {}

jobs:
  bench:
    runs-on: ubuntu-latest
    steps:
      - uses: sxzz/workflows/setup-js@main
        with:
          persist-credentials: false
      - run: pnpm run bench | tee bench.txt
      - run: |
          { echo '### Benchmark'; echo; echo '```'; cat bench.txt; echo '```'; } >> "$GITHUB_STEP_SUMMARY"
```

(`sxzz/workflows/setup-js@main` is the composite action the existing
`unit-test.yml` uses to install pnpm + deps; it accepts `persist-credentials`.)
The job is informational: it never fails on numbers, only if the bench itself
throws.

**Verify**: `pnpm exec eslint .github/workflows/bench.yml` is not applicable
(YAML is not linted here); instead run the two shell lines locally:
`pnpm run bench | tee /tmp/bench.txt && test -s /tmp/bench.txt` → exit 0.

### Step 5: Record

Put the before (step 1) and after tables in the PR description. Numbers will
differ in shape (hz vs ops/sec, different statistics) — that is expected; the
point is the new rows exist and run.

## Test plan

- No unit tests change. `pnpm test` count must be unchanged.
- The benchmark itself is the deliverable: `pnpm run bench` runs every case
  without throwing; CI job prints it in the step summary.

## Done criteria

- [ ] `benchmark/index.mjs` deleted; `benchmark/magic-string.bench.ts` exists and lints clean
- [ ] `pnpm run bench` exits 0 and prints rows for: construct; generateMap lo-res/edits/hires true/boundary/experimental-range; generateDecodedMap; overwrite; replaceAll; remove; move; slice per node; toString; hasChanged ×2; indent; generateMap with names; bundle generateMap ×2, length, toString
- [ ] `grep -c "benchmark" package.json` → `0` (dependency gone; script says `vitest bench`)
- [ ] `pnpm test` count unchanged; `pnpm run lint`, `pnpm run typecheck` exit 0
- [ ] `.github/workflows/bench.yml` exists with `permissions: {}` and a step-summary upload
- [ ] `git status` shows only in-scope files (plus `pnpm-lock.yaml`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `vitest bench` cannot import `../dist/index.mjs` (e.g. a Vite resolution
  error) — the fallback would be importing `../src/index.ts`, which changes
  what is measured; that is a maintainer decision.
- `pnpm install` refuses to update the lockfile because of the trust/release-age
  policy in `pnpm-workspace.yaml`.
- Any case takes longer than ~60 s per run (reduce iterations via the
  `{ time: 1000 }` option rather than shrinking the input; if still too slow,
  STOP).

## Maintenance notes

- Regression gating: once two or more PRs have run the job, the cheapest gate
  is a small script comparing the `ops/sec` column of `bench.txt` against a
  committed `benchmark/baseline.txt` with a tolerance (e.g. −15 %), run after
  the bench step and allowed to fail softly. Deferred because vitest 5 has no
  native compare and the first value is having the rows at all.
- When plan 002 lands, `dist/` and `src/` behave identically, so a second
  `describe` importing `../src/index.ts` could be added to compare — not
  needed now.
- Reviewers: each `bench` body must not accumulate state across iterations
  (e.g. appending to the same string forever skews later samples); construct
  inside the body or operate read-only on a shared fixture.
