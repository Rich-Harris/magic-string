# Edit-model fuzzing

`random-edits.test.ts` runs seeded random edit sequences against both `IntegrityCheckingMagicString` and `EditModel` (`edit-model.ts`), and checks after every op that they agree on throwing, `toString`, `length`, `hasChanged`, `isEmpty`, `slice` and `clone`. The library must also leave the string unchanged when it throws, give the same output when every index is split up front (split-invariance), and produce a hires sourcemap that points inside the original.

## The model

It stores state per original character: output text, an edited flag, and inserts to the left and right of each boundary. `left[0]` is the string intro and `right[n]` the outro. It also keeps the set of indices split so far.

- Inserting at an index splits there. Splitting throws strictly inside the first chunk of a non-empty replacement.
- `remove(a, b)` empties `[a, b)` and drops inserts strictly inside it. Inserts at `a` and `b` stay.
- `update(a, b, s)` empties `[a, b)` and puts `s` on char `a`, keeping every insert. With `overwrite` it also drops `right[a..b-1]` and `left[a+1..b]`.
- `reset(a, b)` restores `[a, b)` and drops the same inserts as `overwrite`.
- `length()` leaves out the string intro and outro.
- `remove` and `reset` with `a === b` do nothing. `update` with `a >= b` throws, and so do `remove` and `reset` with `a > b`.

Refinement found by fuzzing: `slice` throws when either anchor is strictly inside *any* edited chunk, removed ones included, not only inside a replacement.

## Running deep

```sh
FUZZ_SEQUENCES=100000 FUZZ_SEED=2 pnpm exec vitest run tests/fuzz
```

Defaults are seed `1` and 1000 sequences. A failure prints the seed, sequence number and a replayable op list.

## Adding an exclusion

For a confirmed library bug, add an `F-NN` block to `FINDINGS.md`. Then push a predicate onto `knownDivergences` that matches only that shape, with `// F-NN` on it. The fix removes both.

Next ops to model: `move`, `trim`, `indent`, `replace`.
