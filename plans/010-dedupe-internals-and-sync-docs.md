# Plan 010: Share the chunk→mappings walk between `MagicString` and `Bundle`, drop stale leftovers, and bring README/JSDoc/type exports in line with the code

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat abdc931..HEAD -- src/MagicString.ts src/Bundle.ts src/Chunk.ts src/index.ts src/utils/Mappings.ts README.md example eslint.config.js`
> Plans 001–008 are expected to have touched the source files. Confirm each
> excerpt below against the live code; where a plan changed a line (noted
> inline), use the live version. Any other mismatch is a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M (many small edits; no behaviour change)
- **Risk**: LOW
- **Depends on**: plans/004-keep-store-name-across-split-chunks.md,
  plans/005-copy-bundle-source-descriptions.md,
  plans/008-reduce-allocations-on-hot-paths.md (the shared walk must use the
  `replacesUntil` name key and the `Set`/`Map` names index those plans introduce)
- **Category**: tech-debt, docs
- **Planned at**: commit `abdc931` (v1.4.4, `origin/master`), 2026-10-27

## Why this matters

Three kinds of drift accumulated while the code moved fast:

- **Duplicated internals.** `MagicString._generateMappings` and
  `Bundle._generateMappings` contain the same intro → chunks → outro walk
  (`getLocator`, `addEdit`/`addUneditedChunk`, intro/outro `advance`), differing
  only in `sourceIndex` and the Bundle's "no filename → advance only" branch.
  #339 and #350 each had to be threaded through both; plans 004 and 008 touch
  both again. One method on `Mappings` removes the copy.
- **Stale leftovers.** `Chunk.split()` carries a 2017 "TODO is this block
  necessary?" above a block that *is* necessary (without it the new chunk would
  resurrect removed text — the bug class of #352/#358) plus a no-op
  `this.content = ''`; `lastLine()` uses Annex-B `substr` five times; `example/`
  contains committed build artefacts (`app.js`, `app.js.map`, `app.inlinemap.js`)
  that nothing references and that `eslint.config.js` has to ignore.
- **Docs vs. code.** The README license badge links to `LICENSE.md` (the file is
  `LICENSE`); `Bundle.clone/generateDecodedMap/getIndentString/isEmpty/length/trim*`
  have no README entry; `MagicStringError` and `SourceMap` (both exported) are
  never mentioned; `IndentOptions.indentStart` is undocumented; three types
  that appear in public signatures — `BundleSourceDescription`
  (`addSource` parameter), `DecodedSourceMapOrMissingContent`
  (`Bundle.generateDecodedMap` return), `SourceMapRangeMappings`
  (`DecodedSourceMap.rangeMappings`) — are not exported from `src/index.ts`, so
  TypeScript consumers cannot name them; `Bundle` has JSDoc on 3 of 17 methods
  and `clone()`'s is "Does what you'd expect."

## Current state

**Mapping walks** (at `abdc931`; plans 004/008 change the `names.indexOf(...)`
argument and how `names` is built — use the live code):

```ts
// src/MagicString.ts:371-407
  _generateMappings(mappings: Mappings): string[] {
    const sourceIndex = 0
    const names = Object.keys(this.storedNames)
    const locate = getLocator(this.original)

    if (this.intro) {
      mappings.advance(this.intro)
    }

    this.firstChunk.eachNext((chunk) => {
      const loc = locate(chunk.start)

      if (chunk.intro.length)
        mappings.advance(chunk.intro)

      if (chunk.edited) {
        mappings.addEdit(sourceIndex, chunk.content, loc, chunk.storeName ? names.indexOf(…) : -1)
      }
      else {
        mappings.addUneditedChunk(sourceIndex, chunk, this.original, loc, this.sourcemapLocations)
      }

      if (chunk.outro.length)
        mappings.advance(chunk.outro)
    })

    if (this.outro) {
      mappings.advance(this.outro)
    }

    return names
  }
// src/Bundle.ts:289-364 — same walk per source inside `this.sources.forEach((source, i) => { … })`,
// preceded by `if (i > 0) mappings.advance(<separator>)`, with
//   if (source.filename) { if (chunk.edited) addEdit(sourceIndex, …) else addUneditedChunk(sourceIndex, chunk, magicString.original, loc, magicString.sourcemapLocations) }
//   else { mappings.advance(chunk.content) }
// and followed by the x_google_ignoreList bookkeeping (355-360).
```

`src/utils/Mappings.ts` imports only types from `../Chunk.ts`, `../BitSet.ts`,
`../SourceMap.ts`, `./getLocator.ts`; `getLocator` is imported as a value by
both `MagicString.ts` (line 6) and `Bundle.ts` (line 7).

**Leftovers**

```ts
// src/Chunk.ts:142-156 (split)
    if (this.edited) {
      // after split we should save the edit content record into the correct chunk
      // to make sure sourcemap correct
      // For example:
      // '  test'.trim()
      //     split   -> '  ' + 'test'
      //   ✔️ edit    -> '' + 'test'
      //   ✖️ edit    -> 'test' + ''
      // TODO is this block necessary?...
      // content only, so the outro moved over above is kept
      newChunk.edit('', false, true)
      // if an overwrite emptied this chunk, its replacement stands for both halves
      newChunk.replacedFrom = this.replacedFrom
      this.content = ''
    }
```
(`_splitChunk` only lets an edited chunk through when `chunk.content.length === 0`
— `src/MagicString.ts:1222-1229` — so `this.content` is already `''` here.)

`src/MagicString.ts:1079-1105` `lastLine()` — `.substr(lineIndex + 1)` at five sites.

`example/`: `build.js` (imports `../dist/index.mjs`, rewrites `foo` → `answer`
in `app.source.js`, writes `app.js`, `app.js.map`, `app.inlinemap.js`),
`index.html`, `app.source.js`, plus the three generated files. Not referenced by
`package.json`, README, or CI. `eslint.config.js`: `ignores: ['benchmark/**', 'example/app*.js']`
(plan 009 changes the first entry).

**Docs**

- `README.md:7` — `href="https://github.com/Rich-Harris/magic-string/blob/master/LICENSE.md"`; repo file is `LICENSE`.
- `README.md:100-301` — one `### s.<method>(…)` entry per `MagicString` method;
  `README.md:303-442` — Bundling section documents constructor, `addSource`,
  `indent`, `prepend`, `append`, `generateMap` (incl. `includeContent` function),
  `toString`, `toMagicString`. Missing: `clone`, `generateDecodedMap`,
  `getIndentString`, `isEmpty`, `length`, `trim`, `trimStart`, `trimEnd`, `trimLines`.
- `README.md:168` — indent options: "The `options` argument can have an
  `exclude` property…" — no mention of `indentStart` (`src/MagicString.ts:23-26`:
  `indentStart?: boolean`, default `true`; when `false` the first line is not
  indented — used by `Bundle.indent` at `src/Bundle.ts:423-428`).
- `src/index.ts`:
  ```ts
  export { Bundle, MagicString as default, MagicString, MagicStringError, SourceMap }
  export type { BundledSourceFileRecord, BundleOptions, BundleSourceMapOptions } from './Bundle.ts'
  export type { ExclusionRange, IndentOptions, MagicStringOptions, OverwriteOptions, ReplacementFunction, UpdateOptions } from './MagicString.ts'
  export type { DecodedSourceMap, SourceMapOptions, SourceMapSegment } from './SourceMap.ts'
  ```
  `BundleSourceDescription` (`src/Bundle.ts:20`) is a non-exported `interface`;
  `DecodedSourceMapOrMissingContent` (`Bundle.ts:48`) and `SourceMapRangeMappings`
  (`SourceMap.ts:50`) are `export`ed from their modules but not re-exported.
- JSDoc: `src/Bundle.ts` has doc comments on `addSource` (73), `toMagicString`
  (153) and the `includeContent` option (39); none on `append`, `clone`,
  `generateDecodedMap`, `generateMap`, `getIndentString`, `indent`, `prepend`,
  `toString`, `isEmpty`, `length`, `trimLines`, `trim`, `trimStart`, `trimEnd`.
  `src/MagicString.ts`: `clone()` says "Does what you'd expect." (288-290);
  `getIndentString` (435), `lastChar` (1061), `lastLine` (1079), `length` (1285)
  and the constructor have none.
- `tsconfig.json` has `declaration: true`, `isolatedDeclarations: true`,
  `stripInternal: true` — JSDoc on public methods ships in `dist/index.d.mts`.

Conventions: `@antfu/eslint-config`; README method entries are `### s.name( args )`
followed by one or two sentences and "Returns `this`." where applicable (see
`README.md:106-108`).

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Install   | `pnpm install`                            | exit 0              |
| Typecheck | `pnpm run typecheck`                      | exit 0              |
| Tests     | `pnpm test`                               | all pass, count unchanged |
| Lint      | `pnpm run lint`                           | exit 0              |
| Build     | `pnpm run build`                          | `✔ Build complete`, publint clean |

## Scope

**In scope**:
- `src/utils/Mappings.ts` (new method), `src/MagicString.ts` (`_generateMappings`,
  `lastLine`, JSDoc), `src/Bundle.ts` (`_generateMappings`, JSDoc), `src/Chunk.ts`
  (`split` comment + no-op line), `src/index.ts` (three type re-exports)
- `README.md`
- `example/` (delete the directory), `eslint.config.js` (drop the `example/app*.js` ignore)

**Out of scope**:
- Any behaviour change: `toString()`, maps, errors must be byte-identical;
  `pnpm test` count unchanged, no test edits.
- `snip`'s "TODO deprecate this?" — a 2.0 decision listed in `plans/README.md`; leave it.
- `SourceMap` constructor/type triple (`DecodedSourceMap` vs `SourceMap` vs
  `DecodedSourceMapOrMissingContent`) — exporting the type is in scope,
  redesigning it is not.
- `benchmark/**` (plan 009).

## Git workflow

- Worktree off `origin/master`:
  `git -C ~/projects/magic-string/default fetch origin && git -C ~/projects/magic-string/default worktree add ../debt-docs -b chore/dedupe-mappings-and-docs origin/master`
- One commit per step, Conventional Commits:
  `refactor: share the chunk walk between MagicString and Bundle mappings`,
  `chore: drop stale comments, substr and the example directory`,
  `docs: document the remaining Bundle API, exports and indentStart`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Baseline

`pnpm install && pnpm test` → record the count. `pnpm run build` and copy
`dist/index.mjs` to `/tmp/dist-before.mjs` for a later diff.

### Step 2: Move the chunk walk into `Mappings`

In `src/utils/Mappings.ts` add `import type { MagicString } from '../MagicString.ts'`
and `import { getLocator } from './getLocator.ts'` (value import), then add:

```ts
  /**
   * Emits the mappings for one MagicString: its intro, every chunk (with the
   * chunk's own intro/outro) and its outro. `sourceIndex === -1` means the
   * string has no source of its own, so its content only advances the
   * generated position without mapping anything.
   */
  addMagicString(magicString: MagicString, sourceIndex: number, nameIndex: Map<string, number>): void {
    const { original } = magicString
    const locate = getLocator(original)

    if (magicString.intro)
      this.advance(magicString.intro)

    magicString.firstChunk.eachNext((chunk) => {
      if (chunk.intro.length)
        this.advance(chunk.intro)

      if (sourceIndex === -1) {
        this.advance(chunk.content)
      }
      else if (chunk.edited) {
        const name = chunk.storeName ? nameIndex.get(original.slice(chunk.start, chunk.replacesUntil)) : undefined
        this.addEdit(sourceIndex, chunk.content, locate(chunk.start), name ?? -1)
      }
      else {
        this.addUneditedChunk(sourceIndex, chunk, original, locate(chunk.start), magicString.sourcemapLocations)
      }

      if (chunk.outro.length)
        this.advance(chunk.outro)
    })

    if (magicString.outro)
      this.advance(magicString.outro)
  }
```

(Use whatever name-key expression plan 004 left in the live code; above is
its expected form. `locate` is now only called when a mapping is emitted —
the Bundle's no-filename path used to compute it and discard it.)

`src/MagicString.ts`:

```ts
  /** @internal */
  _generateMappings(mappings: Mappings): string[] {
    const names = [...this.storedNames]
    mappings.addMagicString(this, 0, new Map(names.map((name, i) => [name, i])))
    return names
  }
```

`src/Bundle.ts` `_generateMappings` keeps: building `names`/`nameIndex` across
sources (plan 008's form), `if (this.intro) mappings.advance(this.intro)`, and
per source: `if (i > 0) mappings.advance(source.separator)`, then
`mappings.addMagicString(source.content, source.filename ? this.uniqueSourceIndexByFilename.get(source.filename) ?? -1 : -1, nameIndex)`
(adapt to the live `uniqueSourceIndexByFilename` shape), then the
`x_google_ignoreList` block unchanged.

Remove the now-unused `getLocator` imports from `MagicString.ts` and
`Bundle.ts` (lint flags unused imports). `Chunk` may become type-only in
`Mappings.ts` — it already is.

**Verify**: `pnpm run typecheck && pnpm run lint` → exit 0;
`pnpm exec vitest run tests/MagicString/generate-map.test.ts tests/Bundle/generate-map.test.ts tests/Bundle/mappings.test.ts tests/Bundle/toMagicString.test.ts` → all pass;
`grep -c "eachNext" src/MagicString.ts src/Bundle.ts` → `0` for both,
`grep -c "getLocator" src/MagicString.ts src/Bundle.ts` → `0` for both
(unless `_splitChunk`'s error message still uses `getLocator` in
`MagicString.ts:1225` — it does; keep that import if so and expect `1`).

### Step 3: Leftovers

1. `src/Chunk.ts` `split()`: replace the comment block and the no-op with
   ```ts
    if (this.edited) {
      // only an emptied edited chunk can be split (see MagicString#_splitChunk);
      // the new chunk must stay empty too, or it would resurrect removed text.
      // Content only, so the outro moved over above is kept
      newChunk.edit('', false, true)
      // if an overwrite emptied this chunk, its replacement stands for both halves
      newChunk.replacedFrom = this.replacedFrom
    }
   ```
   (deleting `this.content = ''`).
2. `src/MagicString.ts` `lastLine()`: `.substr(lineIndex + 1)` → `.slice(lineIndex + 1)` at all five sites.
3. `git rm -r example` and change `eslint.config.js` ignores to drop
   `'example/app*.js'` (keep whatever plan 009 left for `benchmark`). If the
   `ignores` array becomes empty, remove the `.append({ ignores: [...] })`
   call entirely and export `antfu()`.

**Verify**: `pnpm exec vitest run tests/MagicString/misc.test.ts tests/MagicString/trim.test.ts tests/MagicString/remove.test.ts` → all pass;
`grep -c substr src/MagicString.ts` → `0`; `test ! -d example` → exit 0;
`pnpm run lint` → exit 0.

### Step 4: Type re-exports

`src/Bundle.ts`: `export interface BundleSourceDescription { … }`.
`src/index.ts`:

```ts
export type { BundledSourceFileRecord, BundleOptions, BundleSourceDescription, BundleSourceMapOptions, DecodedSourceMapOrMissingContent } from './Bundle.ts'
...
export type { DecodedSourceMap, SourceMapOptions, SourceMapRangeMappings, SourceMapSegment } from './SourceMap.ts'
```

**Verify**: `pnpm run build` → publint clean; `grep -c "BundleSourceDescription\|DecodedSourceMapOrMissingContent\|SourceMapRangeMappings" dist/index.d.mts` ≥ 3;
`pnpm exec vitest run src/index.test.ts` → passes (runtime export list unchanged).

### Step 5: JSDoc

Add a one- or two-sentence doc comment (copy the README wording where it
exists) to every undocumented public method listed in Current state, in
`src/Bundle.ts` and `src/MagicString.ts`. Replace `clone()`'s with:

```ts
  /**
   * Returns an independent copy: the chunk list, string-level intro/outro,
   * sourcemap locations, stored names, indent exclusion ranges, `offset`,
   * `filename` and `ignoreList` are all copied; later edits to either string
   * do not affect the other.
   */
```

Do not document `@internal` methods.

**Verify**: `pnpm run lint` → exit 0; `pnpm run build` → exit 0; spot-check
`grep -c "^\s*/\*\*" src/Bundle.ts` ≥ 17.

### Step 6: README

1. Line 7: `blob/master/LICENSE.md` → `blob/master/LICENSE`.
2. Under `### s.indent( prefix[, options] )` after the `exclude` sentence add:
   "It can also have an `indentStart` property (default `true`); when `false`,
   the first line is left unindented, which is what `Bundle` uses to join
   sources that do not start on a fresh line."
3. Under `### s.offset` add: "`addSourcemapLocation` and `indent`'s `exclude`
   ranges are not adjusted by `offset`." (Skip if plan 003 already added an
   equivalent sentence; do not duplicate.)
4. In the Bundling section, after `### bundle.toMagicString()`, add entries
   (one line each, matching the `MagicString` entries' phrasing):
   `### bundle.clone()`, `### bundle.generateDecodedMap( options )`,
   `### bundle.getIndentString()` ("the most common indent string among the
   sources, falling back to a tab"), `### bundle.isEmpty()`, `### bundle.length()`
   ("equals `bundle.toString().length`, unlike `s.length()`"), `### bundle.trim([ charType ])`,
   `### bundle.trimStart([ charType ])`, `### bundle.trimEnd([ charType ])`,
   `### bundle.trimLines()`.
5. Add a short `## Errors` section before `## License`: "Every error thrown by
   magic-string is a `MagicStringError` (exported), a subclass of `Error`
   whose message starts with `[MagicString]`." And one sentence under
   `### s.generateMap( options )`: "The returned object is an instance of the
   exported `SourceMap` class."

**Verify**: `grep -c "LICENSE\.md" README.md` → `0`; `grep -c "### bundle\." README.md` → `10`
(toMagicString + 9 new); `grep -c "MagicStringError" README.md` ≥ 1.

### Step 7: Full verification

`pnpm run typecheck && pnpm run lint && pnpm test && pnpm run build`.
Then `node -e "..."` is not needed; instead compare behaviour by diffing the
built output's *logic*: `diff <(sed 's/\s*$//' /tmp/dist-before.mjs) <(sed 's/\s*$//' dist/index.mjs) | head -80`
and confirm the only differences are the mapping-walk relocation, the
`substr`→`slice` swap and the removed `this.content = ''`.

**Verify**: all exit 0; test count unchanged from step 1.

## Test plan

- No new tests; this plan is behaviour-preserving. The full suite (all
  `generate-map`, `mappings`, `toMagicString`, `misc`/`lastLine`, `trim` files
  in particular) is the net.
- Verification: `pnpm test` → same count as step 1, all pass.

## Done criteria

- [ ] `grep -c "addMagicString(" src/utils/Mappings.ts src/MagicString.ts src/Bundle.ts` → `1`, `1`, `1`
- [ ] `grep -c "eachNext\|substr" src/MagicString.ts src/Bundle.ts` → `0` for both
- [ ] `grep -c "TODO is this block necessary" src/Chunk.ts` → `0`
- [ ] `test ! -d example` exits 0; `grep -c example eslint.config.js` → `0`
- [ ] `dist/index.d.mts` contains `BundleSourceDescription`, `DecodedSourceMapOrMissingContent`, `SourceMapRangeMappings`
- [ ] README: badge fixed, 9 new `### bundle.` entries, `indentStart`, `MagicStringError`, `SourceMap` mentioned
- [ ] `pnpm run typecheck`, `pnpm run lint`, `pnpm test` (unchanged count), `pnpm run build` exit 0
- [ ] `git status` shows only in-scope paths
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any test fails after step 2 — the walk must be a pure relocation.
- The `MagicString` ↔ `Mappings` import becomes a *value* cycle (`Mappings.ts`
  must import `MagicString` as `import type` only).
- `publint` or `pnpm run build` complains about the new type exports
  (`isolatedDeclarations` may require explicit annotations somewhere).
- Plans 004/005/008 have not landed and the live `_generateMappings` differs
  from both the excerpt and their expected forms.

## Maintenance notes

- `Mappings.addMagicString` is now the single place mapping semantics live;
  future `perf:` work on the walk happens once.
- The three newly exported types are public API from this release on —
  renaming them later is breaking. `BundleSource` (plan 005's internal
  record) must *not* be exported.
- Reviewers: check that `README` entries and JSDoc say the same thing; they
  are the two places users read.
