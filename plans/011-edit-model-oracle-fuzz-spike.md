# Plan 011 (spike): Check `MagicString` against a reference edit model over random edit sequences, and triage every divergence

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat abdc931..HEAD -- src/MagicString.ts src/Chunk.ts tests/__utils vitest.config.ts package.json`
> This plan adds files and changes no library code, so drift only matters for
> the behaviour table in "Current state": re-run the snippet there against the
> live build and update the table in your copy before writing the oracle.

## Status

- **Priority**: P2
- **Effort**: M (coarse — a spike; the oracle is ~120 lines, triage is the
  open-ended part)
- **Risk**: LOW (additive test infrastructure; no `src/` changes)
- **Depends on**: plans/003-validate-indices-consistently.md (so the oracle
  can assume every index is an in-range integer or the call throws). Works
  without it if the generator only produces in-range integers — which it does.
- **Category**: direction (tests)
- **Planned at**: commit `abdc931` (v1.4.4, `origin/master`), 2026-10-27

## Why this matters

Since August 2026 at least fourteen `fix:` commits (#326, #331, #335, #346–#349,
#352, #357–#359, #361, #362, #364, #366, #367) corrected *interactions* between
`replace`/`update`/`remove`/`move`/`trim`/chunk splitting. Each was found by a
contributor's hand-derived counterexample or a private fuzzer: PR #364 cites
"20,000 random edit sequences … 347,085 calls", PR #366 "19,761 cases",
checked against rules the authors wrote down only in the PR text. None of
that lives in the repo; the in-repo `IntegrityCheckingMagicString` only checks
that the chunk list and the `byStart`/`byEnd` maps agree, not that the output
is *right*. Six 1.4.x patch releases in September alone is the cost.

This spike writes the rules down as an executable reference model (a per-
character slot array), runs thousands of seeded random edit sequences against
it on every `pnpm test`, and produces a triaged list of divergences. It does
**not** fix library bugs — each confirmed divergence becomes a one-line entry
in `plans/011-fuzz-findings.md` for a follow-up plan, and the harness excludes
it (with a reference) so CI stays green until it is fixed.

## Current state

- Public mutating API covered by this spike (all take original-string
  indices, all apply `offset` which the spike keeps at 0): `append`, `prepend`,
  `appendLeft`, `appendRight`, `prependLeft`, `prependRight`, `update` (with
  and without `overwrite: true`), `overwrite`, `remove`, `reset`. Out of scope
  for the first iteration: `move`, `trim*`, `indent`, `replace*`, `snip`,
  `slice` as an op (it is used as a *check*).
- Read API used as checks: `toString()`, `length()`, `hasChanged()`,
  `isEmpty()`, `slice(a, b)`, `clone()`, `generateDecodedMap({ hires: true })`.
- `tests/__utils/IntegrityCheckingMagicString.ts` — wraps every prototype
  method and asserts list/map consistency after each call; use it as the
  class under test so structural corruption is caught too.
- `vitest.config.ts` — `test.environment: 'node'`, `isolate: false`, coverage
  excludes `tests/**`. Default include picks up `tests/**/*.test.ts`.
- `package.json` scripts: `test: vitest run` (with `pretest: pnpm run build`),
  `test:dev: vitest`.
- Test conventions: `describe('magicString') → describe('<topic>') → it(...)`,
  `assert` from vitest, no `vi.mock`.

**Behaviour the model must reproduce** — verified on the v1.4.4 build with this
snippet (re-run it against the live `dist/` before writing the oracle):

```sh
node -e "
import('./dist/index.mjs').then(({ default: MagicString }) => {
  const o = []
  let s = new MagicString('abc'); s.appendRight(0,'X'); s.appendLeft(3,'Y'); s.reset(0,3); o.push(['reset edges', s.toString()])
  s = new MagicString('abcd'); s.appendLeft(2,'L'); s.appendRight(2,'R'); s.reset(1,3); o.push(['reset inner', s.toString()])
  s = new MagicString('abcd'); s.appendLeft(2,'L'); s.appendRight(2,'R'); s.update(1,3,'Q'); o.push(['update inner kept', s.toString()])
  s = new MagicString('abcd'); s.appendLeft(2,'L'); s.appendRight(2,'R'); s.appendRight(1,'I'); s.appendLeft(3,'O'); s.overwrite(1,3,'Q'); o.push(['overwrite clears', s.toString()])
  s = new MagicString('abcd'); s.appendRight(1,'I'); s.appendLeft(3,'O'); s.remove(1,3); o.push(['remove keeps edges', s.toString()])
  s = new MagicString('abcd'); s.appendLeft(2,'L'); s.update(0,4,'Q'); try { s.appendLeft(1,'z'); o.push(['split edited first chunk', s.toString()]) } catch (e) { o.push(['split edited first chunk THROW', e.message]) }
  s = new MagicString('abcd'); s.appendLeft(2,'L'); s.update(0,4,'Q'); try { s.appendLeft(3,'z'); o.push(['split emptied second chunk', s.toString()]) } catch (e) { o.push(['split emptied THROW', e.message]) }
  s = new MagicString('abc'); s.appendLeft(0,'A'); s.prependLeft(0,'P'); s.appendRight(3,'Z'); s.prepend('<'); o.push(['boundary 0/n', s.toString()])
  process.stdout.write(JSON.stringify(o) + '\n')
})"
```

Output at v1.4.4:

| Case | Result | Rule it pins |
|---|---|---|
| `reset edges` | `"abc"` | `reset(a,b)` clears inserts at *and inside* the range edges (`right[a]`, `left[b]`, all inner) |
| `reset inner` | `"abcd"` | same |
| `update inner kept` | `"aQLRd"` | `update` (no `overwrite`) keeps every insert in the range |
| `overwrite clears` | `"aQd"` | `overwrite` clears `right[i]` for `i ∈ [a,b)` and `left[i]` for `i ∈ (a,b]` |
| `remove keeps edges` | `"aIOd"` | `remove` clears only inserts strictly inside `(a,b)`; edge inserts stay |
| `split edited first chunk` | throws `cannot split a chunk that has already been edited (0:1 – "ab")` | splitting inside the *holder* chunk of a non-empty replacement throws |
| `split emptied second chunk` | `"QLz"` | the emptied tail chunks of an overwritten range may be split |
| `boundary 0/n` | `"<PAabcZ"` | `appendLeft(0)`/`prependLeft(0)`/`prepend()` all write the string intro; `appendRight(n)`/`append()` the outro |

Also pinned by plan 003: every index-taking method throws for non-integer or
out-of-range indices, `remove`/`reset` with `start === end` are no-ops,
`update` with `start === end` or `start > end` throws; and by #364: a throwing
`update` leaves the string unchanged.

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Install   | `pnpm install`                            | exit 0              |
| Build     | `pnpm run build`                          | `✔ Build complete`  |
| Typecheck | `pnpm run typecheck`                      | exit 0 (`tsconfig.test.json` includes `tests/**`) |
| Fuzz only | `pnpm exec vitest run tests/fuzz`         | passes within ~5 s at the default iteration count |
| Deep run  | `FUZZ_SEQUENCES=200000 pnpm exec vitest run tests/fuzz` | passes or prints a minimal repro |
| Tests     | `pnpm test`                               | all pass            |
| Lint      | `pnpm run lint`                           | exit 0              |

## Scope

**In scope** (create):
- `tests/fuzz/edit-model.ts` — the reference model (pure, no vitest imports).
- `tests/fuzz/random-edits.test.ts` — generator + property checks.
- `plans/011-fuzz-findings.md` — triage output (create even if empty).
- `tests/fuzz/README.md` — ≤ 30 lines: what the model is, how to run deep,
  how to add an exclusion.

**Out of scope**:
- Any change under `src/`. A divergence that is a library bug is *recorded*,
  not fixed, here.
- `move`, `trim*`, `indent`, `replace*` (listed in the findings file as
  "next ops to model").
- Changing `IntegrityCheckingMagicString`.

## Git workflow

- Worktree off `origin/master`:
  `git -C ~/projects/magic-string/default fetch origin && git -C ~/projects/magic-string/default worktree add ../fuzz -b test/edit-model-fuzz origin/master`
- Conventional Commits: `test: check random edit sequences against a reference edit model`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Baseline

`pnpm install && pnpm run build && pnpm test` → all pass. Run the snippet from
Current state and confirm the table (STOP if any row differs).

### Step 2: Write the reference model (`tests/fuzz/edit-model.ts`)

State, for `original` of length `n`:

```ts
export class EditModel {
  readonly original: string
  text: string[]            // n entries: output text owned by original char c ('' when removed or emptied; the replacement on the holder char)
  edited: boolean[]         // n entries
  holderEnd: number[]       // n entries; for a holder c of a non-empty replacement, the end of its *first chunk* at edit time; -1 otherwise
  left: string[]            // n+1 entries; inserts anchored left of boundary i (appendLeft/prependLeft). left[0] is the string intro
  right: string[]           // n+1 entries; inserts anchored right of boundary i (appendRight/prependRight). right[n] is the string outro
  boundaries: Set<number>   // every index a split has happened at (always includes 0 and n)
}
```

Operations (each must mirror the library exactly; `split(i)` is the shared
precondition):

- `split(i)`: if `i` is already in `boundaries`, nothing. Otherwise, if there
  is a holder `h` with `text[h] !== ''` and `h < i < holderEnd[h]`, throw
  `EditModelError('cannot split a chunk that has already been edited')`.
  Otherwise add `i` to `boundaries`.
- `appendLeft(i, s)`: `split(i)`; `left[i] += s`. `prependLeft`: `left[i] = s + left[i]`.
- `appendRight(i, s)`: `split(i)`; `right[i] += s`. `prependRight`: `right[i] = s + right[i]`.
- `prepend(s)`: `left[0] = s + left[0]`. `append(s)`: `right[n] += s`.
- `remove(a, b)`: if `a === b` return; `split(a); split(b)`; for `c ∈ [a,b)`:
  `text[c] = ''`, `edited[c] = true`, `holderEnd[c] = -1`; for `i ∈ (a,b)`:
  `left[i] = right[i] = ''`.
- `update(a, b, s, overwrite)`: if `a === b` or `a > b` throw
  `EditModelError`; `split(a); split(b)`; compute `firstEnd = min(i ∈ boundaries, a < i ≤ b)`;
  for `c ∈ [a,b)`: `text[c] = ''`, `edited[c] = true`, `holderEnd[c] = -1`;
  `text[a] = s`; `holderEnd[a] = s === '' ? -1 : firstEnd`; if `overwrite`:
  for `i ∈ [a,b)`: `right[i] = ''`; for `i ∈ (a,b]`: `left[i] = ''`.
  (`overwrite(a,b,s)` is `update(a,b,s,true)`; `update(a,b,s)` is `update(a,b,s,false)`.)
- `reset(a, b)`: if `a === b` return; `split(a); split(b)`; for `c ∈ [a,b)`:
  `text[c] = original[c]`, `edited[c] = false`, `holderEnd[c] = -1`; for
  `i ∈ [a,b)`: `right[i] = ''`; for `i ∈ (a,b]`: `left[i] = ''`.

Reads:

- `toString()`: `left[0] + Σ_{c=0}^{n-1} (right[c] + text[c] + left[c+1]) + right[n]`.
- `length()`: same sum **without** `left[0]` and `right[n]` (documented quirk, README "s.length()").
- `hasChanged()`: `toString() !== original`.
- `isEmpty()`: `toString().trim() === ''`.
- `slice(a, b)` for `a < b`: `right[a] + text[a] + left[a+1] + right[a+1] + … + text[b-1] + left[b]`,
  i.e. `Σ_{c=a}^{b-1} (right[c] + text[c] + left[c+1])`, but throw
  `EditModelError('cannot use edited character')` when `a` or `b` falls
  strictly inside a holder's first chunk (`h < a < holderEnd[h]` or
  `h < b < holderEnd[h]` with `text[h] !== ''`). *This rule is a hypothesis*:
  the library's `slice` has more special cases; if the fuzzer shows the
  hypothesis is wrong in a way that is clearly the model's fault, refine the
  model and note the refinement in `tests/fuzz/README.md`.

Keep the file free of vitest imports so it can be reused by a future
`move`-aware model.

**Verify**: `pnpm run typecheck` → exit 0 (the file is under `tests/**`, which
`tsconfig.test.json` includes).

### Step 3: Write the harness (`tests/fuzz/random-edits.test.ts`)

- Deterministic PRNG (mulberry32 or xorshift32, ~10 lines) seeded from
  `FUZZ_SEED` (default `1`), sequence count from `FUZZ_SEQUENCES` (default
  `3000`; must finish in < 5 s under `pnpm test`).
- Per sequence: `original` = a random prefix of `'abcdefghij'` of length 2–8
  (distinct characters make failures readable); 1–8 ops drawn uniformly from
  the ten operations above with in-range integer indices (`a < b` for ranges
  70 % of the time, `a === b` or `a > b` otherwise so error paths are
  exercised); inserted strings from `['', 'X', 'yz', '\n']`.
- Apply each op to **both** `new IntegrityCheckingMagicString(original)` and
  `new EditModel(original)`, catching exceptions on each side independently.
  After every op assert:
  1. both threw or neither threw (compare `MagicStringError` vs `EditModelError`
     presence only, not messages);
  2. if the library threw, its `toString()` equals the value *before* the op
     (atomicity);
  3. `toString()`, `length()`, `hasChanged()`, `isEmpty()` agree with the model;
  4. for three random `(a, b)` with `a < b`: `slice(a,b)` agrees, or both throw;
  5. `clone().toString() === toString()`.
- After the sequence: `generateDecodedMap({ hires: true })` does not throw and
  every segment's `[sourceLine, sourceColumn]` points inside `original`
  (compute line starts once).
- **Split-invariance**: run the same op list against a second
  `IntegrityCheckingMagicString` pre-split with `appendLeft(i, '')` for every
  `0 < i < n`, and assert identical `toString()` and identical throw/no-throw
  per op. (This is the property #366 and #367 violated.)
- On failure, `assert.fail` with a *replayable* message: the seed, the
  `original`, and the op list as JavaScript (e.g. `s.appendLeft(2, 'X'); s.update(0, 3, 'yz', { overwrite: true })`),
  plus expected vs actual.
- Exclusions: a `const knownDivergences: Array<(ops: Op[]) => boolean> = []`
  at the top; a sequence matching any predicate is skipped and counted, and
  the test prints the skipped count. Each entry must have a comment pointing
  at the line in `plans/011-fuzz-findings.md`.

Wrap as:

```ts
describe('magicString', () => {
  describe('random edit sequences', () => {
    it(`agree with the reference edit model (seed ${seed}, ${count} sequences)`, () => { … })
  })
})
```

**Verify**: `pnpm exec vitest run tests/fuzz` runs and either passes or
prints replayable failures; `pnpm run lint` → exit 0.

### Step 4: Triage

Run `FUZZ_SEQUENCES=100000 pnpm exec vitest run tests/fuzz` (and a second
seed). For every distinct failure shape:

1. Reduce it by hand to the shortest op list that still fails (usually ≤ 4 ops).
2. Decide: **model wrong** (the library behaviour matches a documented rule or
   an existing test — fix the model, re-run) or **library bug** (the library
   contradicts README/tests/the pinned table, or two equivalent op lists give
   different output).
3. For library bugs: append to `plans/011-fuzz-findings.md` a block
   ```markdown
   ### F-NN: <one-line title>
   - Repro: `const s = new MagicString('abcd'); s.…; s.…` → `"…"`, expected `"…"` (model) / because <rule>
   - Property violated: toString | atomicity | split-invariance | slice | map-bounds
   - Suggested owner: new plan / existing plan NNN
   ```
   and add a predicate to `knownDivergences` that matches *only* that shape,
   with `// F-NN` on it.
4. For properties that turn out to be unspecified (neither README nor tests
   say), record them under "## Open questions" in the findings file instead
   of excluding them — then pick the library's current behaviour as the
   model's rule so CI is green, and say so.

**Verify**: `pnpm exec vitest run tests/fuzz` passes at the default count with
all `knownDivergences` in place; `plans/011-fuzz-findings.md` exists (possibly
stating "no divergences found at 100k × 2 seeds").

### Step 5: README and wiring

Write `tests/fuzz/README.md` (model summary = the operations list from step 2
in prose, how to run deep, how to add an exclusion, "next ops to model: move,
trim, indent, replace"). No `package.json` change is needed — `pnpm test`
already picks the file up. Confirm `pnpm test` total time grew by < 5 s.

**Verify**: `pnpm test` → all pass; `pnpm run lint && pnpm run typecheck` → exit 0.

## Test plan

- The deliverable *is* a test: `tests/fuzz/random-edits.test.ts` (1 `it`).
- Model unit-sanity: add 3–5 `it`s in the same file that replay the eight
  pinned cases from Current state through `EditModel` and assert the table's
  values — this guards the model itself.
- Verification: `pnpm test` → all pass, `+4..6` tests.

## Done criteria

- [ ] `tests/fuzz/edit-model.ts`, `tests/fuzz/random-edits.test.ts`, `tests/fuzz/README.md`, `plans/011-fuzz-findings.md` exist
- [ ] `pnpm exec vitest run tests/fuzz` passes in < 5 s at defaults; `FUZZ_SEQUENCES=100000` passes (with exclusions) for seeds 1 and 2
- [ ] Every entry in `knownDivergences` references an `F-NN` block in the findings file, and vice versa
- [ ] `git status` shows no changes under `src/`
- [ ] `pnpm test`, `pnpm run lint`, `pnpm run typecheck` exit 0
- [ ] `plans/README.md` status row updated, and each `F-NN` library bug is listed there under "Follow-ups from plan 011"

## STOP conditions

Stop and report back (do not improvise) if:

- The Current-state snippet produces a different table on the live build.
- The harness cannot be made deterministic (same seed → different failures),
  which would point at module state leaking between tests (`vitest.config.ts`
  `isolate: false`).
- More than ~10 distinct divergence shapes appear — the model probably
  encodes a wrong rule; report the first three repros rather than excluding
  everything.
- You are tempted to edit `src/` to make a divergence go away.

## Maintenance notes

- Second iteration (separate plan): add `move(start, end, index, affinity)` to
  the model as a permutation of `[0, n)` segments with the inserts travelling
  with their anchor side, then `trim*`/`indent`/`replace*`. Plan 007's
  moved-content `slice` rule is the first thing that model should pin.
- When a plan fixes an `F-NN`, it must delete the matching `knownDivergences`
  predicate and the findings block in the same PR, so the exclusion list only
  shrinks.
- Reviewers: the generator must never produce indices outside `[0, n]`
  (plan 003 makes those throw on both sides, which would hide real bugs behind
  "both threw").
