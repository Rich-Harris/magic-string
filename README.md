# magic-string

Suppose you have some source code. You want to make some light modifications to it - replacing a few characters here and there, wrapping it with a header and footer, etc - and ideally you'd like to generate a source map at the end of it. You've thought about using something like [recast](https://github.com/benjamn/recast) (which allows you to generate an AST from some JavaScript, manipulate it, and reprint it with a sourcemap without losing your comments and formatting), but it seems like overkill for your needs (or maybe the source code isn't JavaScript).

Your requirements are, frankly, rather niche. But they're requirements that I also have, and for which I made magic-string. It's a small, fast utility for manipulating strings.

## Installation

Currently, magic-string only works in node.js (this will likely change in future):

```bash
npm i magic-string
```

## Usage

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

### s.append( content )

Appends the specified content to the end of the string. Returns `this`.

### s.clone()

Does what you'd expect.

### s.generateMap( options )

Generates a [version 3 sourcemap](https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit). All options are, well, optional:

* `file` - the filename where you plan to write the sourcemap
* `source` - the filename of the file containing the original source
* `includeContent` - whether to include the original content in the map's `sourcesContent` array
* `hires` - whether the mapping should be high-resolution. Hi-res mappings map every single character, meaning (for example) your devtools will always be able to pinpoint the exact location of function calls and so on. With lo-res mappings, devtools may only be able to identify the correct line - but they're quicker to generate and less bulky.

The `names` property of the source map is not currently populated.

### s.indent( prefix )

Prefixes each line of the string with `prefix`. If `prefix` is not supplied, the indentation will be guessed from the original content, falling back to a single tab character. Returns `this`.

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

## License

MIT