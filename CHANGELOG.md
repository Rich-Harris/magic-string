# changelog

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
