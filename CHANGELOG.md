## [0.30.8](https://github.com/rich-harris/magic-string/compare/v0.30.7...v0.30.8) (2024-03-03)


### Bug Fixes

* handle last empty line correctly when using update/overwrite ([#274](https://github.com/rich-harris/magic-string/issues/274)) ([29c7bfa](https://github.com/rich-harris/magic-string/commit/29c7bfade8e7d91391c89cf913d65de84b19c3e9))



## [0.30.7](https://github.com/rich-harris/magic-string/compare/v0.30.6...v0.30.7) (2024-02-05)


### Features

* new `reset` method ([#218](https://github.com/rich-harris/magic-string/issues/218)) ([#271](https://github.com/rich-harris/magic-string/issues/271)) ([3dc21e2](https://github.com/rich-harris/magic-string/commit/3dc21e26f04ad4c5314602e511afa210f922d433))



## [0.30.6](https://github.com/rich-harris/magic-string/compare/v0.30.5...v0.30.6) (2024-01-31)


### Features

* support Web Workers by using the global `btoa` ([#269](https://github.com/rich-harris/magic-string/issues/269)) ([8679648](https://github.com/rich-harris/magic-string/commit/86796487f30436cd26291834ae7445fc40ce6139))



## [0.30.5](https://github.com/rich-harris/magic-string/compare/v0.30.4...v0.30.5) (2023-10-12)


### Bug Fixes

* update `sourcesContent` type ([#263](https://github.com/rich-harris/magic-string/issues/263)) ([0e2068d](https://github.com/rich-harris/magic-string/commit/0e2068d6cee9d53c7a242b95f56ea99be3248142))



## [0.30.4](https://github.com/rich-harris/magic-string/compare/v0.30.3...v0.30.4) (2023-09-29)


### Bug Fixes

* correct mappings for update containing new line ([#261](https://github.com/rich-harris/magic-string/issues/261)) ([adaece9](https://github.com/rich-harris/magic-string/commit/adaece9f2370fd1266e89f2fc84c294e1f1b935c))
* use global `btoa`, support services worker, close [#258](https://github.com/rich-harris/magic-string/issues/258) ([#259](https://github.com/rich-harris/magic-string/issues/259)) ([2dea20b](https://github.com/rich-harris/magic-string/commit/2dea20bab7ca0f776013826074d474f476d281bc))



## [0.30.3](https://github.com/rich-harris/magic-string/compare/v0.30.2...v0.30.3) (2023-08-21)


### Bug Fixes

* trim replaced content with space ([#257](https://github.com/rich-harris/magic-string/issues/257)) ([8088f53](https://github.com/rich-harris/magic-string/commit/8088f53873da13c81877a05ab4549fce86f537b5))



## [0.30.2](https://github.com/rich-harris/magic-string/compare/v0.30.1...v0.30.2) (2023-07-28)


### Features

* hires boundary ([#255](https://github.com/rich-harris/magic-string/issues/255)) ([a63d5f2](https://github.com/rich-harris/magic-string/commit/a63d5f25308ff1965ae676e2aa5311417279e7d4))



## [0.30.1](https://github.com/rich-harris/magic-string/compare/v0.30.0...v0.30.1) (2023-07-04)


### Bug Fixes

* expose .d.ts as cjs version ([#253](https://github.com/rich-harris/magic-string/issues/253)) ([262e113](https://github.com/rich-harris/magic-string/commit/262e113ee25e9c7d317282b3015102ec932ae2f5))



# [0.30.0](https://github.com/rich-harris/magic-string/compare/v0.29.0...v0.30.0) (2023-02-22)


### Bug Fixes

* `null` is invalid for `sources` and `file` ([#242](https://github.com/rich-harris/magic-string/issues/242)) ([d4e9c31](https://github.com/rich-harris/magic-string/commit/d4e9c31082491cfa177b31ce725c9ce39491d549))


### Features

* add the ability to ignore-list sources ([#243](https://github.com/rich-harris/magic-string/issues/243)) ([e238f04](https://github.com/rich-harris/magic-string/commit/e238f04be31ec9a3e19b18b75bb5d859f9cb2654))



# [0.29.0](https://github.com/rich-harris/magic-string/compare/v0.28.0...v0.29.0) (2023-02-11)


### Features

* **x_google_ignoreList:** initial support for ignore lists ([3c711cd](https://github.com/rich-harris/magic-string/commit/3c711cd56de6c9735f92e41e457353005c2c0d1c))



# [0.28.0](https://github.com/rich-harris/magic-string/compare/v0.27.0...v0.28.0) (2023-02-11)


### Bug Fixes

* **typings:** sourcesContent may contain null ([#235](https://github.com/rich-harris/magic-string/issues/235)) ([c2b652a](https://github.com/rich-harris/magic-string/commit/c2b652a0d353f183ca991d0b59a7ad0250a52735))



# [0.27.0](https://github.com/rich-harris/magic-string/compare/v0.26.7...v0.27.0) (2022-12-03)


### Performance Improvements

* use @jridgewell/sourcemap-codec ([e68f3e0](https://github.com/rich-harris/magic-string/commit/e68f3e05fe6d87acc1c41eddae97fc32e004320b))



## [0.26.7](https://github.com/rich-harris/magic-string/compare/v0.26.6...v0.26.7) (2022-10-09)


### Bug Fixes

* avoid mutating provided options ([#227](https://github.com/rich-harris/magic-string/issues/227)) ([01d033e](https://github.com/rich-harris/magic-string/commit/01d033e6e8630ef1d0482d9a3899f1da2bf933d5))



## [0.26.6](https://github.com/rich-harris/magic-string/compare/v0.26.5...v0.26.6) (2022-10-05)


### Features

* add `update` method as safer alternative to `overwrite` ([#212](https://github.com/rich-harris/magic-string/issues/212)) ([9a312e3](https://github.com/rich-harris/magic-string/commit/9a312e37a02629f7496c6cfcf307832e991669a3))



## [0.26.5](https://github.com/rich-harris/magic-string/compare/v0.26.4...v0.26.5) (2022-09-30)


### Bug Fixes

* update typescript definition file to contain `replaceAll()` ([#224](https://github.com/rich-harris/magic-string/issues/224)) ([45a4921](https://github.com/rich-harris/magic-string/commit/45a49214ba244b906f4d20450debc8edcc06e2a8))



## [0.26.4](https://github.com/rich-harris/magic-string/compare/v0.26.3...v0.26.4) (2022-09-22)


### Features

* fix `.replace()` when searching string, add `.replaceAll()` ([#222](https://github.com/rich-harris/magic-string/issues/222)) ([04a05bd](https://github.com/rich-harris/magic-string/commit/04a05bdc9bf56e00e616a0ae07923fbd9b63fbd0))


### Performance Improvements

* avoiding use of Object.defineProperty in Chunk constructor ([#219](https://github.com/rich-harris/magic-string/issues/219)) ([130794b](https://github.com/rich-harris/magic-string/commit/130794bb8bfd9f21eb1f50c36a1da8eb5443d256))



## [0.26.3](https://github.com/rich-harris/magic-string/compare/v0.26.2...v0.26.3) (2022-08-30)


### Performance Improvements

* delay guess encoded ([#216](https://github.com/rich-harris/magic-string/issues/216)) ([69b13c7](https://github.com/rich-harris/magic-string/commit/69b13c7a09af742e4f31cf419e8f96e6db32ab5a))



## [0.26.2](https://github.com/rich-harris/magic-string/compare/v0.26.1...v0.26.2) (2022-05-11)


### Bug Fixes

* specify types in exports ([#214](https://github.com/rich-harris/magic-string/issues/214)) ([985e7b4](https://github.com/rich-harris/magic-string/commit/985e7b4d8a6fd5911d2ad2e6524999e9198a6b9f))



## [0.26.1](https://github.com/rich-harris/magic-string/compare/v0.26.0...v0.26.1) (2022-03-03)


### Bug Fixes

* **replace:** match replacer function signature with spec ([902541f](https://github.com/rich-harris/magic-string/commit/902541fdff3998e3c957908de10769d2af1a3c70))



# [0.26.0](https://github.com/rich-harris/magic-string/compare/v0.25.9...v0.26.0) (2022-03-03)

## BREAKING CHANGES

* Support of Node.js v10 is dropped. Now `magic-string` requires Node.js v12 or higher. ([#204](https://github.com/Rich-Harris/magic-string/pull/204))
* ESM bundle is now shipped with `.mjs` extension ([#197](https://github.com/Rich-Harris/magic-string/pull/197))

```diff
-  "module": "dist/magic-string.es.js",
+  "module": "dist/magic-string.es.mjs",
+  "exports": {
+    "./package.json": "./package.json",
+    ".": {
+      "import": "./dist/magic-string.es.mjs",
+      "require": "./dist/magic-string.cjs.js"
+    }
+  },
```

### Features

* new `hasChanged` method ([#202](https://github.com/rich-harris/magic-string/issues/202)) ([5f2dba7](https://github.com/rich-harris/magic-string/commit/5f2dba72774c444538ed10aa5f2096104cb0b4bb))
* support `replace` method ([#203](https://github.com/rich-harris/magic-string/issues/203)) ([cd74ea2](https://github.com/rich-harris/magic-string/commit/cd74ea2e374f526079ae1a9b9f29bc9cc2fd2ac3))



## [0.25.9](https://github.com/rich-harris/magic-string/compare/v0.25.8...v0.25.9) (2022-03-03)


### Bug Fixes

* allowed overwrite across moved content preceded by split ([#192](https://github.com/rich-harris/magic-string/issues/192)) ([403fa86](https://github.com/rich-harris/magic-string/commit/403fa86b3dcc73f6b2eff177218b7bd4d3128f63))
* **types:** make options partial by default ([2815e77](https://github.com/rich-harris/magic-string/commit/2815e77dd20ff9f776282420eaacfb4aa9e70cd7))
* use defineProperty for appending prop in `storeName` ([#194](https://github.com/rich-harris/magic-string/issues/194)) ([96b7cd3](https://github.com/rich-harris/magic-string/commit/96b7cd37016c1e3fd7037b3910ae56f806a9c09f))



## [0.25.8](https://github.com/rich-harris/magic-string/compare/v0.25.7...v0.25.8) (2022-03-02)


### Bug Fixes

* **types:** mark `MagicString` options as optional ([#183](https://github.com/rich-harris/magic-string/issues/183)) ([15c3e66](https://github.com/rich-harris/magic-string/commit/15c3e6691a2cce79d5298af15fd8a2b02facef88))




## 0.25.7

* fix bundle mappings after remove and move in multiple sources ([#172](https://github.com/Rich-Harris/magic-string/issues/172))

## 0.25.6

* Use bitwise operators for small performance boost ([#171](https://github.com/Rich-Harris/magic-string/pull/171))

## 0.25.5

* Use a bitset to reduce memory consumption ([#167](https://github.com/Rich-Harris/magic-string/issues/167))

## 0.25.4

* Clone `intro` and `outro` ([#162](https://github.com/Rich-Harris/magic-string/issues/162))

## 0.25.3

* Fix typing of `SourceMap.version`.

## 0.25.2

* Remove deprecated `new Buffer(...)`
* Handle characters outside Latin1 range when generating a sourcemap in browser ([#154](https://github.com/Rich-Harris/magic-string/issues/154))

## 0.25.1

* Additional types for index.d.ts ([#148](https://github.com/Rich-Harris/magic-string/pull/148))

## 0.25.0

* Add `length` method ([#145](https://github.com/Rich-Harris/magic-string/pull/145))
* Fix trimming chunks with intro/outro ([#144](https://github.com/Rich-Harris/magic-string/pull/144))

## 0.24.1

* Add `lastLine` and `lastChar` methods ([#142](https://github.com/Rich-Harris/magic-string/pull/142))

## 0.24.0

* Add `isEmpty` methods ([#137](https://github.com/Rich-Harris/magic-string/pull/137))
* Fix a potential race condition ([#136](https://github.com/Rich-Harris/magic-string/pull/136))
* Fix CJS/ES bundles inlining `sourcemap-codec` in 0.23.2.

## 0.23.2

* Add `generateDecodedMap` methods ([#134](https://github.com/Rich-Harris/magic-string/pull/134))

## 0.23.1

* Performance ([#132](https://github.com/Rich-Harris/magic-string/pull/132))

## 0.23.0

* Use `sourcemap-codec` for improved performance ([#133](https://github.com/Rich-Harris/magic-string/pull/133))

## 0.22.5

* Add TypeScript interfaces used by rollup ([#131](https://github.com/Rich-Harris/magic-string/pull/131))
* Remove src directory from npm package

## 0.22.4

* `contentOnly` and `storeName` are both optional

## 0.22.3

* Add `original` to TS definitions

## 0.22.2

* Avoid `declare module` ([#127](https://github.com/Rich-Harris/magic-string/pull/127))

## 0.22.1

* Update TypeScript definitions ([#124](https://github.com/Rich-Harris/magic-string/pull/124))

## 0.22.0

* Prevent `overwrite` state corruption ([#115](https://github.com/Rich-Harris/magic-string/issues/115))
* Various bugfixes ([#126](https://github.com/Rich-Harris/magic-string/pull/126))

## 0.21.3

* Clone `indentExclusionRanges` correctly ([#122](https://github.com/Rich-Harris/magic-string/pull/122))
* Fix more typings ([#122](https://github.com/Rich-Harris/magic-string/pull/122))

## 0.21.2

* Add `default` property referencing self in index-legacy.js, to work around TypeScript bug ([#121](https://github.com/Rich-Harris/magic-string/pull/121))

## 0.21.1

* Add typings file to package

## 0.21.0

* Add TypeScript bindings ([#119](https://github.com/Rich-Harris/magic-string/pull/119))

## 0.20.0

* The fourth argument to `overwrite` is a `{storeName, contentOnly}` options object. `storeName: true` is equivalent to `true` before. `contentOnly` will preserve existing appends/prepends to the chunk in question

## 0.19.1

* Prevent overwrites across a split point (i.e. following a `move`)
* Implement `remove` separately to `overwrite`

## 0.19.0

* More accurate bundle sourcemaps ([#114](https://github.com/Rich-Harris/magic-string/pull/114))

## 0.18.0

* Optimisation – remove empty chunks following `overwrite` or `remove` ([#113](https://github.com/Rich-Harris/magic-string/pull/113))

## 0.17.0

* Add `appendLeft`, `appendRight`, `prependLeft`, `prependRight` methods ([#109](https://github.com/Rich-Harris/magic-string/issues/109))
* `insertLeft` and `insertRight` are deprecated in favour of `appendLeft` and `prependRight` respectively

## 0.16.0

* Include inserts in range for `overwrite` and `remove` operations ([#89](https://github.com/Rich-Harris/magic-string/pull/89))
* Make options optional for `bundle.generateMap(...)` ([#73](https://github.com/Rich-Harris/magic-string/pull/73))

## 0.15.2

* Generate correct bundle sourcemap with prepended/appended content

## 0.15.1

* Minor sourcemap fixes

## 0.15.0

* Use named export of `Bundle` in ES build, so ES consumers of magic-string can tree-shake it out

## 0.14.0

* Throw if overwrite of zero-length range is attempted
* Correctly handle redundant move operations

## 0.13.1

* Fix a bevy of `s.slice()` issues ([#62](https://github.com/Rich-Harris/magic-string/pull/62))

## 0.13.0

* Breaking: `insertAfter` is now `insertLeft`, `insertBefore` is now `insertRight`
* Breaking: `insert` is no longer available. Use `insertLeft` and `insertRight`
* Significant performance improvements

## 0.12.1

* Fix sourcemap generation with `insertAfter` and `insertBefore`

## 0.12.0

* Add `insertAfter` and `insertBefore` methods

## 0.11.4

* Fix two regression bugs with `trim()`
* More informative error message on illegal removals

## 0.11.3

* Fix trim methods to ensure correct sourcemaps with trimmed content ([#53](https://github.com/Rich-Harris/magic-string/pull/53))

## 0.11.2

* Support sourcemaps with moved content

## 0.11.1

* Use `findIndex` helper for 0.12 support

## 0.11.0

* Add experimental `move()` method
* Refactor internals to support `move()`

## 0.10.2

* Do not overwrite inserts at the end of patched ranges ([#35](https://github.com/Rich-Harris/magic-string/pull/35))

## 0.10.1

* Zero-length inserts are not removed on adjacent overwrites

## 0.10.0

* Complete rewrite, resulting in ~40x speed increase ([#30](https://github.com/Rich-Harris/magic-string/pull/30))
* Breaking – `magicString.locate` and `locateOrigin` are deprecated
* More forgiving rules about contiguous patches, and which ranges are valid with `magicString.slice(...)`

## 0.9.1

* Update deps

## 0.9.0

* Update build process

## 0.8.0

* Add an ES6 build, change default UMD build to CommonJS (but keeping existing UMD build with bundled dependencies)
* Make properties non-enumerable, for cleaner logging
* Update dependencies

## 0.7.0

* The `names` array is populated when generating sourcemaps, and mappings include name indices where appropriate ([#16](https://github.com/Rich-Harris/magic-string/issues/16))
* Replaced content is mapped correctly in sourcemaps ([#15](https://github.com/Rich-Harris/magic-string/issues/15))

## 0.6.6

* Adjust mappings correctly when removing replaced content
* Error correctly when removed characters are used as slice anchors

## 0.6.5

* Fix `jsnext:main` in package.json

## 0.6.4

* Fix bug with positive integer coercion

## 0.6.3

* Intro content is correctly indented
* Content following an intro with trailing newline is correctly indented

## 0.6.2

* Noop indents are still chainable (fixes bug introduced in 0.6.1)

## 0.6.1

* Indenting with an empty string is a noop

## 0.6.0

* Use rollup for bundling, instead of esperanto

## 0.5.3

* Correct sourcemap generation with bundles containing varied separators
* `s.clone()` clones indent exclusion ranges and sourcemap locations

## 0.5.2

* `s.slice()` accepts negative numbers, and the second argument can be omitted (means 'original string length'), just like `String.prototype.slice`
* More informative error message when trying to overwrite content illegally

## 0.5.1

* Allow bundle separator to be the empty string
* Indenting is handled correctly with empty string separator

## 0.5.0

* `s.replace()` is deprecated in favour of `s.overwrite()` (identical signature)
* `bundle.addSource()` can take a `MagicString` instance as its sole argument, for convenience
* The `options` in `new MagicString(str, options)` can include `filename` and `indentExclusionRanges` options, which will be used when bundling
* New method: `s.snip( start, end )`

## 0.4.9

* `file` option is optional when generating a bundle sourcemap

## 0.4.7

* Repeated insertions at position 0 behave the same as other positions ([#10](https://github.com/Rich-Harris/magic-string/pull/10))

## 0.4.6

* Overlapping ranges can be removed
* Non-string content is rejected ([#9](https://github.com/Rich-Harris/magic-string/pull/9))

## 0.4.5

* Implement `source.addSourcemapLocation()`

## 0.4.4

* Another Windows fix, this time for file paths when bundling

## 0.4.3

* Handle Windows-style CRLF newlines when determining whether a line is empty

## 0.4.2

* Fix typo in package.json (d'oh again)
* Use only relative paths for internal modules - makes bundling with dependents (i.e. esperanto) possible

## 0.4.1

* Includes correct files in npm package (d'oh)

## 0.4.0

* Using experimental Esperanto feature ([esperantojs/esperanto#68](https://github.com/esperantojs/esperanto/issues/68)) to generate version with `vlq` dependency included

## 0.3.1

* Fixes a bug whereby multiple insertions at the same location would cause text to repeat ([#5](https://github.com/Rich-Harris/magic-string/issues/5))

## 0.3.0

* Breaking change - `source.indentStr` is `null` if no lines are indented. Use `source.getIndentString()` for the old behaviour (guess, and if no lines are indented, return `\t`)
* `bundle.getIndentString()` ignores sources with no indented lines when guessing indentation ([#3](https://github.com/Rich-Harris/magic-string/issues/3))

## 0.2.7

* `source.trimLines()` removes empty lines from start/end of source, leaving other whitespace untouched
* Indentation is not added to an empty source

## 0.2.6

* Performance improvement - adjustments are only made when necessary

## 0.2.5

* Single spaces are ignored when guessing indentation - experience shows these are more likely to be e.g. JSDoc comments than actual indentation
* `bundle.addSource()` can take an `indentExclusionRanges` option

## 0.2.4

* Empty lines are not indented

## 0.2.3

* Fixes edge case with bundle sourcemaps

## 0.2.2

* Make `sources` paths in sourcemaps relative to `options.file`

## 0.2.1

* Minor fix for `bundle.indent()`

## 0.2.0

* Implement `MagicString.Bundle` for concatenating magic strings

## 0.1.10

* Fix sourcemap encoding

## 0.1.9

* Better performance when indenting large chunks of code

## 0.1.8

* Sourcemaps generated with `s.generateMap()` have a `toUrl()` method that generates a DataURI

## 0.1.7

* Implement `s.insert( index, content )` - roughly equivalent to `s.replace( index, index, content )`

## 0.1.6

* Version bump for npm's benefit

## 0.1.5

* `s.indent({ exclude: [ x, y ] })` prevents lines between (original) characters `x` and `y` from being indented. Multiple exclusion ranges are also supported (e.g. `exclude: [[a, b], [c, d]]`)

## 0.1.4

* `s.locate()` doesn't throw out-of-bound error if index is equal to original string's length

## 0.1.3

* `s.trim()` returns `this` (i.e. is chainable)

## 0.1.2

* Implement `s.slice()`

## 0.1.1

* Implement `s.trim()`

## 0.1.0

* First release
