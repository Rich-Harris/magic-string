# Plan 005: Make `Bundle.addSource()` store its own record instead of mutating the caller's object

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat abdc931..HEAD -- src/Bundle.ts src/index.ts tests/Bundle/addSource.test.ts tests/Bundle/trim.test.ts`
> Plan 001 step 5 is expected to have rewritten the option-copy loop in
> `addSource` (lines 96-99 below) into four explicit `if` statements; that is
> fine. Any other mismatch in the excerpts is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-enable-strict-typescript.md (recommended: strict
  mode validates the new record type)
- **Category**: bug
- **Planned at**: commit `abdc931` (v1.4.4, `origin/master`), 2026-10-27

## Why this matters

`bundle.addSource({ content, … })` writes `filename`, `ignoreList`,
`indentExclusionRanges` and `separator` *onto the object the caller passed in*
and then stores that same object in `this.sources`. Later, `trimStart()`/
`trimEnd()` overwrite `source.separator` on it. Consequences, verified on the
v1.4.4 bundle:

- Adding the same `{ content }` object to two bundles with different separators
  → the second bundle emits the first one's separator (`"a;x"` instead of `"a\nx"`).
- `bundle1.trimEnd()` changes `bundle2.toString()` when they share a description
  object, and leaves `desc.separator === ''` behind for the caller.
- The caller's object grows four keys it never set.

Because the stored type is the same optional-everything `BundleSourceDescription`
as the input, every reader has to re-derive `separator` with
`source.separator !== undefined ? source.separator : this.separator` — eight
copies, each carrying its own `/* v8 ignore next -- addSource always normalizes
source.separator */`. Building a dedicated record once removes the aliasing bug
and the eight ternaries together.

## Current state

- `src/Bundle.ts` at `abdc931`:

```ts
// 20-26
interface BundleSourceDescription {
  filename?: string
  content: MagicString
  ignoreList?: boolean
  indentExclusionRanges?: ExclusionRange | ExclusionRange[]
  separator?: string
}
// 52-63
export class Bundle {
  /** @internal */
  declare intro: string
  /** @internal */
  declare separator: string
  /** @internal */
  declare sources: BundleSourceDescription[]
  ...
// 83-123
  addSource(source: MagicString | BundleSourceDescription): this {
    if (source instanceof MagicString) {
      return this.addSource({
        content: source,
        filename: source.filename,
        separator: this.separator,
      })
    }

    if (!isObject(source) || !source.content) {
      throw new MagicStringError('addSource() requires a `content` property that is a MagicString')
    }

    ['filename', 'ignoreList', 'indentExclusionRanges', 'separator'].forEach((option) => {
      if (!hasOwnProp.call(source, option))
        source[option] = source.content[option]
    })

    if (source.separator === undefined) {
      // TODO there's a bunch of this sort of thing, needs cleaning up
      source.separator = this.separator
    }

    if (source.filename) {
      if (!hasOwnProp.call(this.uniqueSourceIndexByFilename, source.filename)) {
        this.uniqueSourceIndexByFilename[source.filename] = this.uniqueSources.length
        this.uniqueSources.push({ filename: source.filename, content: source.content.original })
      }
      else {
        const uniqueSource = this.uniqueSources[this.uniqueSourceIndexByFilename[source.filename]]
        if (source.content.original !== uniqueSource.content) {
          throw new MagicStringError(
            `duplicate filename "${source.filename}" with different content, use unique filenames`,
          )
        }
      }
    }

    this.sources.push(source)
    return this
  }
// 125-132
  append(str: string, options?: BundleOptions): this {
    this.addSource({
      content: new MagicString(str),
      separator: (options && options.separator) || '',
    })
    return this
  }
// 134-151 clone(): rebuilds each source via addSource({ filename, content: clone(), ignoreList, indentExclusionRanges, separator })
```

The eight separator ternaries, each preceded by
`/* v8 ignore next -- addSource always normalizes source.separator */`:
lines 177-178 (`toMagicString`), 306-307 (`_generateMappings`), 421-422
(`indent`), 452-453 (`toString`), 468-469 (`isEmpty`), 481-482 (`length`),
506-507 (`trimStart`, which then assigns `source.separator = separator.replace(rx, '')`),
536-537 (`trimEnd`, same assignment).

- `tests/Bundle/addSource.test.ts:6-13` declares a local `BundleInternals`
  interface to read `b.sources[i].{content,filename,ignoreList,indentExclusionRanges}`
  and asserts `strictEqual` on `content` and `indentExclusionRanges` identity
  (lines 33-35, 45-48, 61-64) — a shallow copy of the *record* keeps these
  passing because the field values are reused, not cloned.
- `src/index.ts` does not export `BundleSourceDescription` (it is the parameter
  type of a public method; plan 010 exports it — do not do it here).
- Conventions: `@antfu/eslint-config`; `hasOwnProp.call(obj, key)` is the
  repo's own-property idiom (line 13); errors via `MagicStringError`.

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Install   | `pnpm install`                            | exit 0              |
| Typecheck | `pnpm run typecheck`                      | exit 0              |
| Tests     | `pnpm test`                               | all pass            |
| Bundle tests | `pnpm exec vitest run tests/Bundle`    | all pass            |
| Coverage  | `pnpm exec vitest run --coverage`         | `src/Bundle.ts` ≥ 99 % statements |
| Lint      | `pnpm run lint`                           | exit 0              |

## Scope

**In scope**:
- `src/Bundle.ts`
- `tests/Bundle/addSource.test.ts` (new tests; update the local `BundleInternals`
  type if needed)
- `tests/Bundle/trim.test.ts` (one new test)
- `tests/Bundle/clone.test.ts` — only its local `BundleInternals` type, which
  (like the one in `addSource.test.ts`) must gain `separator: string` and type
  `content` as the base `MagicString` once `sources` is `BundleSource[]`

**Out of scope**:
- `src/MagicString.ts`, `src/index.ts` (type re-exports are plan 010).
- Changing `uniqueSourceIndexByFilename` to a `Map` — plan 008.
- `toMagicString()` semantics beyond replacing its separator ternary — plan 006.
- Any change to `Bundle`'s public method signatures or to what `toString()`
  produces for well-behaved callers.

## Git workflow

- Worktree off `origin/master`:
  `git -C ~/projects/magic-string/default fetch origin && git -C ~/projects/magic-string/default worktree add ../bundle-source-record -b fix/bundle-add-source-copy origin/master`
- Conventional Commits, e.g. `fix(bundle): stop addSource mutating the caller's source description`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Baseline and red tests

`pnpm install && pnpm exec vitest run tests/Bundle` → all pass.

Add to `tests/Bundle/addSource.test.ts` inside `describe('addSource')`:

```ts
    it('does not mutate the description object it is given', () => {
      const b = new Bundle({ separator: ';' })
      const description = { content: new MagicString('x', { filename: 'x.js' }) }

      b.addSource(description)

      assert.deepEqual(Object.keys(description), ['content'])
    })

    it('does not share state between bundles given the same description', () => {
      const description = { content: new MagicString('x') }
      const b1 = new Bundle({ separator: ';' })
      const b2 = new Bundle({ separator: '\n' })

      b1.addSource(new MagicString('a')).addSource(description)
      b2.addSource(new MagicString('a')).addSource(description)

      assert.equal(b1.toString(), 'a;x')
      assert.equal(b2.toString(), 'a\nx')
    })
```

Add to `tests/Bundle/trim.test.ts` inside `describe('trim')` (content is
shared by reference on purpose, so the test isolates the *separator* with an
empty content that trimming leaves untouched):

```ts
    it('does not trim the separator of a sibling bundle given the same description', () => {
      const description = { content: new MagicString(''), separator: ' \n' }
      const b1 = new Bundle()
      const b2 = new Bundle()

      b1.addSource(new MagicString('a')).addSource(description)
      b2.addSource(new MagicString('a')).addSource(description)

      b1.trimEnd()

      assert.equal(b1.toString(), 'a')
      assert.equal(b2.toString(), 'a \n')
    })
```

**Verify**: `pnpm exec vitest run tests/Bundle/addSource.test.ts tests/Bundle/trim.test.ts`
→ exactly these 3 new tests fail.

### Step 2: Introduce the stored record type

In `src/Bundle.ts`, below `BundleSourceDescription`, add:

```ts
// what `sources` holds: every field resolved once in addSource
interface BundleSource {
  filename: string | undefined
  content: MagicString
  ignoreList: boolean | undefined
  indentExclusionRanges: ExclusionRange | ExclusionRange[] | undefined
  separator: string
}
```

Change the field to `declare sources: BundleSource[]`.

### Step 3: Build the record in `addSource`

Replace everything from the `['filename', …].forEach(…)` loop (or plan 001's
four `if`s) through `this.sources.push(source)` with:

```ts
    const content = source.content
    const record: BundleSource = {
      content,
      filename: hasOwnProp.call(source, 'filename') ? source.filename : content.filename,
      ignoreList: hasOwnProp.call(source, 'ignoreList') ? source.ignoreList : content.ignoreList,
      indentExclusionRanges: hasOwnProp.call(source, 'indentExclusionRanges')
        ? source.indentExclusionRanges
        : content.indentExclusionRanges,
      separator: source.separator ?? this.separator,
    }

    if (record.filename) {
      if (!hasOwnProp.call(this.uniqueSourceIndexByFilename, record.filename)) {
        this.uniqueSourceIndexByFilename[record.filename] = this.uniqueSources.length
        this.uniqueSources.push({ filename: record.filename, content: content.original })
      }
      else {
        const uniqueSource = this.uniqueSources[this.uniqueSourceIndexByFilename[record.filename]]
        if (content.original !== uniqueSource.content) {
          throw new MagicStringError(
            `duplicate filename "${record.filename}" with different content, use unique filenames`,
          )
        }
      }
    }

    this.sources.push(record)
    return this
```

Semantics preserved: `hasOwnProp` means "the caller set the key, even to
`undefined`" — identical to the old loop. `MagicString` has no `separator`
field, so the old fallback `source.content.separator` was always `undefined`;
`source.separator ?? this.separator` is the same result (`append()` passes
`''`, which `??` keeps). Delete the `// TODO there's a bunch of this sort of
thing` comment.

**Verify**: `pnpm run typecheck` → errors only at the eight ternary sites (or
none, if the ternaries still type-check as redundant); `pnpm exec vitest run tests/Bundle/addSource.test.ts` → all pass including the two new tests.

### Step 4: Delete the eight separator ternaries

At each of the eight sites listed in Current state, replace
`source.separator !== undefined ? source.separator : this.separator` with
`source.separator` and delete the preceding `/* v8 ignore next -- addSource
always normalizes source.separator */` line. Where the ternary was assigned to
a `const separator` that is used once, inline it. In `trimStart`/`trimEnd` the
following `source.separator = separator.replace(rx, '')` becomes
`source.separator = source.separator.replace(rx, '')` — it now mutates *our*
record, which is the intended fix for the trim test.

**Verify**: `grep -c "addSource always normalizes" src/Bundle.ts` → `0`;
`grep -c "!== undefined ? source.separator" src/Bundle.ts` → `0`.
`pnpm exec vitest run tests/Bundle` → all pass (3 new tests green).

### Step 5: Full verification

`pnpm run typecheck && pnpm run lint && pnpm test && pnpm exec vitest run --coverage`.

**Verify**: all exit 0; `src/Bundle.ts` coverage ≥ 99 % statements (the
`v8 ignore`s were excusing now-deleted branches, so coverage should not drop).

## Test plan

- New: 2 tests in `tests/Bundle/addSource.test.ts`, 1 in `tests/Bundle/trim.test.ts` (step 1).
- Existing `tests/Bundle/**` (12 files) are the regression net; in particular
  `addSource.test.ts` identity assertions and `clone.test.ts:40,54`.
- Verification: `pnpm test` → all pass; total = baseline + 3.

## Done criteria

- [ ] `grep -c "interface BundleSource\b" src/Bundle.ts` → `1` and `declare sources: BundleSource[]` present
- [ ] `grep -c "addSource always normalizes\|source\[option\]" src/Bundle.ts` → `0`
- [ ] `pnpm run typecheck`, `pnpm run lint`, `pnpm test` exit 0; 3 new tests pass
- [ ] `git status` shows only the three in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A pre-existing `tests/Bundle` test fails after step 3 or 4 (the plan's
  premise is that no caller-visible output changes for non-aliased inputs).
- The strict typecheck requires a type assertion to build `record`.
- `Bundle.clone()` needs anything beyond continuing to call `addSource({...})`
  with the stored record's fields.

## Maintenance notes

- `BundleSourceDescription` stays the public *input* type; plan 010 exports it
  from `src/index.ts`. `BundleSource` is internal — do not export it.
- Plan 006 (`toMagicString`) and plan 008 (`Map` for `uniqueSourceIndexByFilename`)
  touch neighbouring lines; rebase order is 005 → 006 → 008.
- Reviewers: check that `append()`'s `''` separator still survives (`??`, not `||`).
