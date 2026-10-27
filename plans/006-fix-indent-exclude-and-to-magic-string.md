# Plan 006: Fix `indent({ exclude })` on moved edited chunks, carry per-source state through `Bundle.toMagicString()`, and indent CRLF bundle intros correctly

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat abdc931..HEAD -- src/MagicString.ts src/Bundle.ts README.md tests/MagicString/indent.test.ts tests/Bundle/toMagicString.test.ts tests/Bundle/indent.test.ts tests/MagicString/replace-all.test.ts`
> Plans 001–005 are expected to have touched the two source files. Confirm
> each excerpt below still matches the live code (the three regions this plan
> edits are not changed by those plans). Any other mismatch is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/005-copy-bundle-source-descriptions.md (so
  `toMagicString` reads `source.separator` directly; if 005 has not landed,
  keep the existing ternary at that one line)
- **Category**: bug
- **Planned at**: commit `abdc931` (v1.4.4, `origin/master`), 2026-10-27

## Why this matters

Three small, independent defects in the indent/flatten area, all verified on
the v1.4.4 bundle:

1. **`indent({ exclude })` checks the wrong index for an edited chunk after
   `move()`.** For an edited chunk the exclusion test is `isExcluded[charIndex]`,
   where `charIndex` was set to the *previous chunk in list order*'s `end`.
   That equals `chunk.start` only while list order is original order.
   `s.overwrite(4, 7, 'X\nY'); s.move(4, 7, 0); s.indent('  ', { exclude: [[4, 7]] })`
   on `'abc\ndef'` → `"  X\n  Yabc\n"` (the excluded replacement is indented);
   without the `move` it is correctly `"  abc\nX\nY"`. `Bundle.indent()` feeds
   `indentExclusionRanges` through this path, so hoisted code in a bundle loses
   its protection.
2. **`Bundle.toMagicString()` drops `indentExclusionRanges`** (and
   `ignoreList`). Flatten-then-`indent()` — the README's own use case — indents
   the inside of template literals the sources had excluded:
   `"  abc\n  `x\n  y`"` vs the bundle's own `"  abc\n`x\ny`"`. It also copies
   `Chunk.replacesUntil`/`replacedFrom` (added in #367) **without shifting them
   by the source offset**, so on the flattened string `replace`/`replaceAll`
   skip matches over multi-chunk overwrites: a second source
   `'aabb'` with `appendLeft(2,''); update(0,4,'Q')` flattened after `'xxxx'`,
   then `replaceAll(/a+b+/g, 'P')` → `"xxxx\nQ"` instead of `"xxxx\nP"`.
3. **`Bundle.indent()` indents the `\r` of blank CRLF lines in the intro**: it
   uses `/^[^\n]/gm` where `MagicString.indent()` uses `/^[^\r\n]/gm`.
   `new Bundle({ intro: 'a\r\n\r\nb\n' })…indent('  ')` → `"  a\r\n  \r\n  b\n  x"`
   (trailing whitespace on the blank line).

## Current state

- `src/MagicString.ts:525-537, 583-587` (`indent`, abdc931):
  ```ts
      while (chunk) {
        const end = chunk.end

        // content added with `appendRight`/`prependRight` is emitted before the
        // chunk itself, so it has to be indented before the chunk is walked
        if (!isExcluded[chunk.start])
          chunk.intro = indentPiece(chunk.intro)

        if (chunk.edited) {
          if (!isExcluded[charIndex]) {
            chunk.content = indentPiece(chunk.content)
          }
        }
        else if (options.exclude) {
          charIndex = chunk.start
          ...
        // ...and content added with `appendLeft`/`prependLeft` is emitted after it
        if (!isExcluded[chunk.end - 1])
          chunk.outro = indentPiece(chunk.outro)

        charIndex = chunk.end
        chunk = chunk.next
      }
  ```
  Note the intro check uses `chunk.start` and the outro check `chunk.end - 1`;
  only the edited-content check uses the stale `charIndex`.

- `src/Bundle.ts:163-258` (`toMagicString`), relevant lines:
  ```ts
  // 164
      const combined = new MagicString(this.sources.map(source => source.content.original).join(''))
  // 166
      let offset = 0
  // 194-207  (chunk copy loop)
        while (originalChunk) {
          const chunk = originalChunk.clone()
          chunk.start += offset
          chunk.end += offset
          chunk.previous = previous
          chunk.next = null
          ...
  // 223-237
        for (let index = 0; index < magicString.original.length; index += 1) {
          if (magicString.sourcemapLocations.has(index))
            combined.sourcemapLocations.add(index + offset)
        }
        Object.keys(magicString.storedNames).forEach((name) => { … })
        if (magicString.hasMovedChunks)
          hasMovedChunks = true

        offset += magicString.original.length
      })
  ```
  JSDoc at 153-162 and `README.md:442` say only `filename` is not carried over.
  `Chunk.clone()` (`src/Chunk.ts:57-69`) copies `replacesUntil`/`replacedFrom`
  verbatim; both are `-1` when unset.

- `src/Bundle.ts:433-439` (`indent`):
  ```ts
      if (this.intro) {
        this.intro
          = indentStr
            + this.intro.replace(/^[^\n]/gm, (match, index) => {
              return index > 0 ? indentStr + match : match
            })
      }
  ```
  `src/MagicString.ts:454` uses `const pattern = /^[^\r\n]/gm`.

- `MagicStringOptions.indentExclusionRanges` is `ExclusionRange | ExclusionRange[]`
  where `ExclusionRange = [number, number]` (`src/MagicString.ts:14-21`);
  `indent()` normalises a bare tuple via `typeof options.exclude[0] === 'number'`
  (line 477).

- Tests: `tests/MagicString/indent.test.ts` (exclude tests at 67-95),
  `tests/Bundle/toMagicString.test.ts` (uses `assertIntegrity(flat)` helper
  defined at its top and plain `MagicString` from `src/index.ts`),
  `tests/Bundle/indent.test.ts`, `tests/MagicString/replace-all.test.ts`.

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Install   | `pnpm install`                            | exit 0              |
| Typecheck | `pnpm run typecheck`                      | exit 0              |
| Tests     | `pnpm test`                               | all pass            |
| Focused   | `pnpm exec vitest run tests/MagicString/indent.test.ts tests/Bundle` | all pass |
| Lint      | `pnpm run lint`                           | exit 0              |

## Scope

**In scope**:
- `src/MagicString.ts` — one token in `indent()`.
- `src/Bundle.ts` — `toMagicString()` (exclusion ranges + `replaces*` shift,
  JSDoc), `indent()` regex.
- `README.md` — the `toMagicString` paragraph (line ~442).
- Tests: `tests/MagicString/indent.test.ts`, `tests/Bundle/toMagicString.test.ts`,
  `tests/Bundle/indent.test.ts`.

**Out of scope**:
- Carrying `ignoreList` into the flattened string: a `MagicString` has a single
  boolean while sources may disagree; document it as dropped alongside
  `filename` (step 4) rather than inventing a rule.
- The per-character `sourcemapLocations` loop (perf; plan 008).
- `src/Chunk.ts`.

## Git workflow

- Worktree off `origin/master`:
  `git -C ~/projects/magic-string/default fetch origin && git -C ~/projects/magic-string/default worktree add ../indent-flatten -b fix/indent-exclude-and-flatten origin/master`
- One commit per defect, Conventional Commits, e.g.
  `fix: exclude moved edited chunks from indent by their own start`,
  `fix(bundle): carry exclusion ranges and overwrite spans through toMagicString`,
  `fix(bundle): do not indent the \r of blank CRLF intro lines`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Baseline

`pnpm install && pnpm test` → all pass.

### Step 2: `indent` — test and fix

Add to `tests/MagicString/indent.test.ts` next to "should not indent an
excluded chunk intro":

```ts
    it('should not indent an excluded edited chunk that was moved', () => {
      const s = new MagicString('abc\ndef')
      s.overwrite(4, 7, 'X\nY')
      s.move(4, 7, 0)

      s.indent('  ', { exclude: [[4, 7]] })
      assert.equal(s.toString(), 'X\nYabc\n')
    })
```

Run it → fails with `"  X\n  Yabc\n"`.

Fix: in `src/MagicString.ts` `indent()`, change `if (!isExcluded[charIndex])`
in the `if (chunk.edited)` branch to `if (!isExcluded[chunk.start])`.

**Verify**: `pnpm exec vitest run tests/MagicString/indent.test.ts tests/Bundle/indent.test.ts` → all pass.

### Step 3: `toMagicString` — tests and fix

Add to `tests/Bundle/toMagicString.test.ts`:

```ts
    it('carries indent exclusion ranges into the flattened string', () => {
      const b = new Bundle()
      b.addSource(new MagicString('a\n`x\ny`', { indentExclusionRanges: [2, 7] }))
      b.addSource(new MagicString('b\n`z`', { indentExclusionRanges: [[2, 5]] }))

      const flat = b.toMagicString()
      flat.indent('  ')

      assert.strictEqual(flat.toString(), b.clone().indent('  ').toString())
      assert.strictEqual(flat.toString(), '  a\n`x\ny`\n  b\n`z`')
    })

    it('keeps replace working over an overwrite that spanned several chunks', () => {
      const b = new Bundle()
      b.addSource(new MagicString('xxxx'))
      const s = new MagicString('aabb')
      s.appendLeft(2, '')
      s.update(0, 4, 'Q')
      b.addSource(s)

      const flat = b.toMagicString()
      flat.replaceAll(/a+b+/g, 'P')

      assert.strictEqual(flat.toString(), 'xxxx\nP')
      assertIntegrity(flat)
    })
```

Run them → both fail (`'  a\n  `x\n  y`\n  b\n  `z`'` and `'xxxx\nQ'`).

Fix, in `src/Bundle.ts` `toMagicString()`:

1. In the chunk copy loop, after `chunk.end += offset`, add:
   ```ts
        if (chunk.replacesUntil !== -1)
          chunk.replacesUntil += offset
        if (chunk.replacedFrom !== -1)
          chunk.replacedFrom += offset
   ```
2. Declare `const indentExclusionRanges: ExclusionRange[] = []` next to
   `let offset = 0`. Inside the per-source callback, after the
   `sourcemapLocations` loop, add:
   ```ts
        const sourceRanges = source.indentExclusionRanges
        if (sourceRanges) {
          const ranges = typeof sourceRanges[0] === 'number'
            ? [sourceRanges as ExclusionRange] // a bare [start, end] tuple, as indent() accepts
            : sourceRanges as ExclusionRange[]
          for (const [start, end] of ranges)
            indentExclusionRanges.push([start + offset, end + offset])
        }
   ```
   (`ExclusionRange` is already imported as a type at the top of `Bundle.ts`.
   The two `as` casts mirror `MagicString.indent()` lines 477-479, which do
   the same tuple-vs-array disambiguation; keep the comment.) Put this block
   after the `if (magicString.original.length === 0) { …; return }` early
   return, next to the `sourcemapLocations` copy — an empty source has no
   original to exclude.
3. Before the final `return combined` (both the `!first` early return and the
   normal one), set
   `combined.indentExclusionRanges = indentExclusionRanges.length ? indentExclusionRanges : undefined`.
   Simplest: assign once right after the `forEach` and before `if (!first)`.
4. Update the JSDoc (153-162): "Because a `MagicString` maps to a single
   source, per-source `filename`s and `ignoreList` flags are not carried over;
   indent exclusion ranges are, shifted into the combined coordinate space."

**Verify**: `pnpm exec vitest run tests/Bundle/toMagicString.test.ts tests/MagicString/replace-all.test.ts` → all pass.

### Step 4: README

In `README.md` under `### bundle.toMagicString()` (line ~442), change
"Because a `MagicString` maps to a single source, per-source `filename`s are
not carried over" to "…per-source `filename`s and `ignoreList` hints are not
carried over, while `indentExclusionRanges` are (shifted to the combined
positions)".

**Verify**: `grep -n "indentExclusionRanges\` are" README.md` → 1 match.

### Step 5: `Bundle.indent` CRLF — test and fix

Add to `tests/Bundle/indent.test.ts`:

```ts
    it('should not indent the carriage return of a blank CRLF line in the intro', () => {
      const b = new Bundle({ intro: 'a\r\n\r\nb\n' })
      b.addSource(new MagicString('x'))

      b.indent('  ')
      assert.equal(b.toString(), '  a\r\n\r\n  b\n  x')
    })
```

Run → fails with `'  a\r\n  \r\n  b\n  x'`.

Fix: in `src/Bundle.ts` `indent()`, change `/^[^\n]/gm` to `/^[^\r\n]/gm`.

**Verify**: `pnpm exec vitest run tests/Bundle/indent.test.ts` → all pass.

### Step 6: Full verification

`pnpm run typecheck && pnpm run lint && pnpm test`.

**Verify**: all exit 0; total = baseline + 4.

## Test plan

- New: 1 in `tests/MagicString/indent.test.ts`, 2 in `tests/Bundle/toMagicString.test.ts`,
  1 in `tests/Bundle/indent.test.ts`.
- Patterns: `tests/MagicString/indent.test.ts:88-95` ("should not indent an
  excluded chunk intro"), `tests/Bundle/toMagicString.test.ts:150-166`
  ("preserves per-source sourcemap locations").
- Verification: `pnpm test` → all pass.

## Done criteria

- [ ] `grep -c "isExcluded\[charIndex\]" src/MagicString.ts` → `1` (only the unedited-branch use at ~line 542 remains)
- [ ] `grep -c "replacesUntil += offset" src/Bundle.ts` → `1`
- [ ] `grep -c "/^\[^\\\\n\]/gm" src/Bundle.ts` → `0` (use `grep -n 'gm' src/Bundle.ts` and eyeball: the only `gm` regex is `/^[^\r\n]/gm`)
- [ ] `pnpm run typecheck`, `pnpm run lint`, `pnpm test` exit 0; 4 new tests pass
- [ ] `git status` shows only the seven in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A red test from steps 2, 3 or 5 produces output different from the "fails
  with" value quoted — the diagnosis may be wrong.
- `Chunk.replacesUntil`/`replacedFrom` do not exist (repo older than `abdc931`);
  skip step 3.1 and report.
- Any pre-existing `indent`/`toMagicString`/`replace*` test changes outcome.

## Maintenance notes

- Any future per-chunk field that holds an *original-string position* must be
  shifted in `toMagicString()`'s copy loop (step 3.1 is the pattern) — add
  that sentence as a comment above the loop.
- Reviewers: the `indent()` fix is one token; check the unedited branch at
  ~542 still uses `charIndex` (it iterates per character there, which is correct).
- Deferred: `ignoreList` on the flattened string (documented as dropped).
