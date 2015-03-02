# magic-string

Suppose you have some source code. You want to make some light modifications to it - replacing a few characters here and there, wrapping it with a header and footer, etc - and ideally you'd like to generate a source map at the end of it. You've thought about using something like [recast](https://github.com/benjamn/recast) (which allows you to generate an AST from some JavaScript, manipulate it, and reprint it with a sourcemap without losing your comments and formatting), but it seems like overkill for your needs (or maybe the source code isn't JavaScript).

Your requirements are, frankly, rather niche. But they're requirements that I also have, and for which I made magic-string. It's a small, fast utility for manipulating strings and generating sourcemaps.

## Installation

magic-string works in both node.js and browser environments. For node, install with npm:

```bash
npm i magic-string
```

To use in browser, grab the [magic-string.deps.js](https://raw.githubusercontent.com/Rich-Harris/magic-string/master/dist/magic-string.deps.js) file and add it to your page:

```html
<script src='magic-string.deps.js'></script>
```

(It also works with various module systems, if you prefer that sort of thing - it has a dependency on [vlq](https://github.com/Rich-Harris/vlq).)

## Usage

These examples assume you're in node.js, or something similar:

```js
var MagicString = require( 'magic-string' );
var string = new MagicString( 'problems = 99' );

s.replace( 0, 8, 'answer' );
s.toString(); // 'answer = 99'
s.locate( 9 ); // 7 - the character originally at index 9 ('=') is now at index 7
s.locateOrigin( 7 ); // 9

s.replace( 11, 13, '42' ); // character indices always refer to the original string
s.toString(); // 'answer = 42'

s.prepend( 'var ' ).append( ';' ); // most methods are chainable
s.toString(); // 'var answer = 42;'

var map = s.generateMap({
  source: 'source.js',
  file: 'converted.js.map',
  includeContent: true
}); // generates a v3 sourcemap

require( 'fs' ).writeFile( 'converted.js', s.toString() );
require( 'fs' ).writeFile( 'converted.js.map', map.toString() );
```

## Methods

### s.addSourcemapLocation( index )

Adds the specified character index (with respect to the original string) to sourcemap mappings, if `hires` is `false` (see below).

### s.append( content )

Appends the specified content to the end of the string. Returns `this`.

### s.clone()

Does what you'd expect.

### s.generateMap( options )

Generates a [version 3 sourcemap](https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit). All options are, well, optional:

* `file` - the filename where you plan to write the sourcemap
* `source` - the filename of the file containing the original source
* `includeContent` - whether to include the original content in the map's `sourcesContent` array
* `hires` - whether the mapping should be high-resolution. Hi-res mappings map every single character, meaning (for example) your devtools will always be able to pinpoint the exact location of function calls and so on. With lo-res mappings, devtools may only be able to identify the correct line - but they're quicker to generate and less bulky. If sourcemap locations have been specified with `s.addSourceMapLocation()`, they will be used here.

The `names` property of the sourcemap is not currently populated.

The returned sourcemap has two (non-enumerable) methods attached for convenience:

* `toString` - returns the equivalent of `JSON.stringify(map)`
* `toUrl` - returns a DataURI containing the sourcemap. Useful for doing this sort of thing:

```js
code += '\n//# sourceMappingURL=' + map.toUrl();
```

### s.indent( prefix[, options] )

Prefixes each line of the string with `prefix`. If `prefix` is not supplied, the indentation will be guessed from the original content, falling back to a single tab character. Returns `this`.

The `options` argument can have an `exclude` property, which is an array of `[start, end]` character ranges. These ranges will be excluded from the indentation - useful for (e.g.) multiline strings.

### s.insert( index, content )

Inserts the specified `content` at the `index` in the original string. Returns `this`.

### s.locate( index )

Finds the location, in the generated string, of the character at `index` in the original string. Returns `null` if the character in question has been removed or replaced.

### s.locateOrigin( index )

The opposite of `s.locate()`. Returns `null` if the character in question was inserted with `s.append()`, `s.prepend()` or `s.replace()`.

### s.prepend( content )

Prepends the string with the specified content. Returns `this`.

### s.remove( start, end )

Removes the characters from `start` to `end` (of the original string, **not** the generated string). Removing the same content twice, or making removals that partially overlap, will cause an error. Returns `this`.

### s.replace( start, end, content )

Replaces the characters from `start` to `end` with `content`. The same restrictions as `s.remove()` apply. Returns `this`.

### s.slice( start, end )

Returns the content of the generated string that corresponds to the slice between `start` and `end` of the original string. Throws error if the indices are for characters that were already removed.

### s.toString()

Returns the generated string.

### s.trim([ charType ])

Trims content matching `charType` (defaults to `\s`, i.e. whitespace) from the start and end. Returns `this`.

### s.trimStart([ charType ])

Trims content matching `charType` (defaults to `\s`, i.e. whitespace) from the start. Returns `this`.

### s.trimEnd([ charType ])

Trims content matching `charType` (defaults to `\s`, i.e. whitespace) from the end. Returns `this`.

### s.trimLines()

Removes empty lines from the start and end. Returns `this`.

## Bundling

To concatenate several sources, use `MagicString.Bundle`:

```js
var bundle = new MagicString.Bundle();

bundle.addSource({
  filename: 'foo.js',
  content: new MagicString( 'var answer = 42;' )
});

bundle.addSource({
  filename: 'bar.js',
  content: new MagicString( 'console.log( answer )' )
});

// Advanced: a source can include an `indentExclusionRanges` property
// alongside `filename` and `content`. This will be passed to `s.indent()`
// - see documentation above

bundle.indent() // optionally, pass an indent string, otherwise it will be guessed
  .prepend( '(function () {\n' )
  .append( '}());' );

bundle.toString();
// (function () {
//   var answer = 42;
//   console.log( answer );
// }());

// options are as per `s.generateMap()` above
var map = bundle.generateMap({
  file: 'bundle.js',
  includeContent: true,
  hires: true
});
```

## License

MIT
