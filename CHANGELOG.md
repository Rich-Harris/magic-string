# changelog

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
