# Edit-model fuzz findings

Divergences between `MagicString` and the reference model in `edit-model.ts`.
Each library bug gets an `F-NN` block here and a matching `knownDivergences`
predicate in `random-edits.test.ts`; the plan that fixes it deletes both.

No divergences found at 100k sequences × 2 seeds (`FUZZ_SEED=1` and `FUZZ_SEED=2`).

## Open questions

- **Splitting inside a replacement depends on earlier splits.** After
  `s.update(0, 4, 'Q')` on `'abcd'`, `s.appendLeft(1, 'z')` throws, but it
  succeeds with `"Qz"` if a prior `s.appendLeft(1, '')` split the range. The
  throw is pinned as intended, so the split-invariance check stops comparing a
  sequence at the first op that throws only on the unsplit string. Should the
  result of an op depend on where earlier empty inserts split the string?
- **`slice` anchors inside removed text depend on earlier splits.** After
  `s.remove(0, 4)` on `'abcd'`, `s.slice(1, 3)` throws ("cannot use edited
  character"), but returns `""` if the string was split at `1` and `3` first.
  The model follows the library (an anchor strictly inside any edited chunk
  throws, as the `slice` doc comment says for removed characters), but no test
  pins it.

## Next ops to model

`move`, `trim*`, `indent`, `replace*`.
