/*global require, describe, it, console */
var assert = require( 'assert' );
var SourceMapConsumer = require( 'source-map' ).SourceMapConsumer;
var MagicString = require( '../' );

require( 'source-map-support' ).install();
require( 'console-group' ).install();

describe( 'MagicString', function () {
	describe( 'options', function () {
		it( 'stores source file information', function () {
			var s = new MagicString( 'abc', {
				filename: 'foo.js'
			});

			assert.equal( s.filename, 'foo.js' );
		});
	});

	describe( 'append', function () {
		it( 'should append content', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.append( 'xyz' );
			assert.equal( s.toString(), 'abcdefghijklxyz' );

			s.append( 'xyz' );
			assert.equal( s.toString(), 'abcdefghijklxyzxyz' );
		});

		it( 'should return this', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.strictEqual( s.append( 'xyz' ), s );
		});

		it( 'should throw when given non-string content', function () {
			var s = new MagicString( '' );
			assert.throws(
				function () { s.append( [] ); },
				TypeError
			);
		});
	});

	describe( 'clone', function () {
		it( 'should clone a magic string', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.overwrite( 3, 9, 'XYZ' );
			var c = s.clone();

			assert.notEqual( s, c );
			assert.equal( c.toString(), 'abcXYZjkl' );
		});

		it( 'should clone filename info', function () {
			var s = new MagicString( 'abcdefghijkl', { filename: 'foo.js' });
			var c = s.clone();

			assert.equal( c.filename, 'foo.js' );
		});

		it( 'should clone indentExclusionRanges', function () {
			var array = [ 3, 6 ];
			var source = new MagicString( 'abcdefghijkl', {
				filename: 'foo.js',
				indentExclusionRanges: array
			});

			var clone = source.clone();

			assert.notStrictEqual( source.indentExclusionRanges, clone.indentExclusionRanges );
			assert.deepEqual( source.indentExclusionRanges, clone.indentExclusionRanges );
		});

		it( 'should clone sourcemapLocations', function () {
			var source = new MagicString( 'abcdefghijkl', {
				filename: 'foo.js'
			});

			source.addSourcemapLocation( 3 );

			var clone = source.clone();

			assert.notStrictEqual( source.sourcemapLocations, clone.sourcemapLocations );
			assert.deepEqual( source.sourcemapLocations, clone.sourcemapLocations );
		});
	});

	describe( 'generateMap', function () {
		it( 'should generate a sourcemap', function () {
			var s = new MagicString( 'abcdefghijkl' ).remove( 3, 9 );

			var map = s.generateMap({
				file: 'output.md',
				source: 'input.md',
				includeContent: true,
				hires: true
			});

			assert.equal( map.version, 3 );
			assert.equal( map.file, 'output.md' );
			assert.deepEqual( map.sources, [ 'input.md' ]);
			assert.deepEqual( map.sourcesContent, [ 'abcdefghijkl' ]);
			assert.equal( map.mappings, 'AAAA,CAAC,CAAC,CAAC,AAAM,CAAC,CAAC' );

			assert.equal( map.toString(), '{"version":3,"file":"output.md","sources":["input.md"],"sourcesContent":["abcdefghijkl"],"names":[],"mappings":"AAAA,CAAC,CAAC,CAAC,AAAM,CAAC,CAAC"}' );
			assert.equal( map.toUrl(), 'data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0Lm1kIiwic291cmNlcyI6WyJpbnB1dC5tZCJdLCJzb3VyY2VzQ29udGVudCI6WyJhYmNkZWZnaGlqa2wiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsQ0FBQyxDQUFDLENBQUMsQUFBTSxDQUFDLENBQUMifQ==' );

			var smc = new SourceMapConsumer( map );
			var loc;

			loc = smc.originalPositionFor({ line: 1, column: 0 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 0 );

			loc = smc.originalPositionFor({ line: 1, column: 1 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 1 );

			loc = smc.originalPositionFor({ line: 1, column: 4 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 10 );
		});

		it( 'should generate a correct sourcemap for indented content', function () {
			var s, map, smc, originLoc;

			s = new MagicString( 'var answer = 42;\nconsole.log("the answer is %s", answer);' );

			s.prepend( "'use strict';\n\n" );
			s.indent( '\t' ).prepend( '(function () {\n' ).append( '\n}).call(global);' );

			map = s.generateMap({
				source: 'input.md',
				includeContent: true,
				hires: true
			});

			smc = new SourceMapConsumer( map );

			originLoc = smc.originalPositionFor({ line: 5, column: 1 });
			assert.equal( originLoc.line, 2 );
			assert.equal( originLoc.column, 0 );
		});

		it( 'should generate a sourcemap using specified locations', function () {
			var s, map, smc, loc;

			s = new MagicString( 'abcdefghijkl' );

			s.addSourcemapLocation( 0 );
			s.addSourcemapLocation( 3 );
			s.addSourcemapLocation( 10 );

			s.remove( 6, 9 );
			map = s.generateMap({
				file: 'output.md',
				source: 'input.md',
				includeContent: true
			});

			assert.equal( map.version, 3 );
			assert.equal( map.file, 'output.md' );
			assert.deepEqual( map.sources, [ 'input.md' ]);
			assert.deepEqual( map.sourcesContent, [ 'abcdefghijkl' ]);

			assert.equal( map.toString(), '{"version":3,"file":"output.md","sources":["input.md"],"sourcesContent":["abcdefghijkl"],"names":[],"mappings":"AAAA,GAAG,GAAG,AAAG,CAAC"}' );
			assert.equal( map.toUrl(), 'data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0Lm1kIiwic291cmNlcyI6WyJpbnB1dC5tZCJdLCJzb3VyY2VzQ29udGVudCI6WyJhYmNkZWZnaGlqa2wiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsR0FBRyxHQUFHLEFBQUcsQ0FBQyJ9' );

			smc = new SourceMapConsumer( map );

			loc = smc.originalPositionFor({ line: 1, column: 0 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 0 );

			loc = smc.originalPositionFor({ line: 1, column: 3 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 3 );

			loc = smc.originalPositionFor({ line: 1, column: 7 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 10 );
		});

		it( 'should correctly map inserted content', function () {
			var s = new MagicString( 'function Foo () {}' );

			s.overwrite( 9, 12, 'Bar' );

			map = s.generateMap({
				file: 'output.js',
				source: 'input.js',
				includeContent: true
			});

			smc = new SourceMapConsumer( map );

			loc = smc.originalPositionFor({ line: 1, column: 9 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 9 );
		});

		it( 'should yield consistent results between insertLeft and insertRight', function () {
			var s1 = new MagicString( 'abcdefghijkl' );
			s1.insertLeft( 6, 'X' );

			var s2 = new MagicString( 'abcdefghijkl' );
			s2.insertRight( 6, 'X' );

			var m1 = s1.generateMap({ file: 'output', source: 'input', includeContent: true });
			var m2 = s2.generateMap({ file: 'output', source: 'input', includeContent: true });

			assert.deepEqual( m1, m2 );
		});

		it( 'should recover original names', function () {
			var s = new MagicString( 'function Foo () {}' );

			s.overwrite( 9, 12, 'Bar', true );

			map = s.generateMap({
				file: 'output.js',
				source: 'input.js',
				includeContent: true
			});

			smc = new SourceMapConsumer( map );

			loc = smc.originalPositionFor({ line: 1, column: 9 });
			assert.equal( loc.name, 'Foo' );
		});

		it( 'should generate one segment per replacement', function () {
			var s = new MagicString( 'var answer = 42' );
			s.overwrite( 4, 10, 'number', true );

			map = s.generateMap({
				file: 'output.js',
				source: 'input.js',
				includeContent: true
			});

			smc = new SourceMapConsumer( map );

			var numMappings = 0;
			smc.eachMapping( function ( mapping ) {
				numMappings += 1;
			});

			assert.equal( numMappings, 3 ); // one at 0, one at the edit, one afterwards
		});

		it( 'should generate a sourcemap that correctly locates moved content', function () {
			var s = new MagicString( 'abcdefghijkl' );
			s.move( 3, 6, 9 );

			var result = s.toString();
			var map = s.generateMap({
				file: 'output.js',
				source: 'input.js',
				includeContent: true,
				hires: true
			});

			var smc = new SourceMapConsumer( map );

			'abcdefghijkl'.split( '' ).forEach( function ( letter, i ) {
				var column = result.indexOf( letter );
				var loc = smc.originalPositionFor({ line: 1, column: column });

				assert.equal( loc.line, 1 );
				assert.equal( loc.column, i );
			});
		});

		it( 'generates a map with trimmed content (#53)', function () {
			var s = new MagicString( 'abcdefghijkl ' ).trim();
			var map = s.generateMap({
				file: 'output',
				source: 'input',
				includeContent: true,
				hires: true
			});

			var smc = new SourceMapConsumer( map );
			var loc = smc.originalPositionFor({ line: 1, column: 11 });

			assert.equal( loc.column, 11 );

			s = new MagicString( ' abcdefghijkl' ).trim();
			map = s.generateMap({
				file: 'output',
				source: 'input',
				includeContent: true,
				hires: true
			});

			smc = new SourceMapConsumer( map );
			loc = smc.originalPositionFor({ line: 1, column: 1 });

			assert.equal( loc.column, 2 );
		});

		it( 'skips empty segments at the start', function () {
			var s = new MagicString( 'abcdefghijkl' );
			s.remove( 0, 3 ).remove( 3, 6 );

			var map = s.generateMap();
			var smc = new SourceMapConsumer( map );
			var loc = smc.originalPositionFor({ line: 1, column: 6 });

			assert.equal( loc.column, 6 );
		});
	});

	describe( 'getIndentString', function () {
		it( 'should guess the indent string', function () {
			var s = new MagicString( 'abc\n  def\nghi' );
			assert.equal( s.getIndentString(), '  ' );
		});

		it( 'should return a tab if no lines are indented', function () {
			var s = new MagicString( 'abc\ndef\nghi' );
			assert.equal( s.getIndentString(), '\t' );
		});
	});

	describe( 'indent', function () {
		it( 'should indent content with a single tab character by default', function () {
			var s = new MagicString( 'abc\ndef\nghi\njkl' );

			s.indent();
			assert.equal( s.toString(), '\tabc\n\tdef\n\tghi\n\tjkl' );

			s.indent();
			assert.equal( s.toString(), '\t\tabc\n\t\tdef\n\t\tghi\n\t\tjkl' );
		});

		it( 'should indent content, using existing indentation as a guide', function () {
			var s = new MagicString( 'abc\n  def\n    ghi\n  jkl' );

			s.indent();
			assert.equal( s.toString(), '  abc\n    def\n      ghi\n    jkl' );

			s.indent();
			assert.equal( s.toString(), '    abc\n      def\n        ghi\n      jkl' );
		});

		it( 'should disregard single-space indentation when auto-indenting', function () {
			var s = new MagicString( 'abc\n/**\n *comment\n */' );

			s.indent();
			assert.equal( s.toString(), '\tabc\n\t/**\n\t *comment\n\t */' );
		});

		it( 'should indent content using the supplied indent string', function () {
			var s = new MagicString( 'abc\ndef\nghi\njkl' );

			s.indent( '  ');
			assert.equal( s.toString(), '  abc\n  def\n  ghi\n  jkl' );

			s.indent( '>>' );
			assert.equal( s.toString(), '>>  abc\n>>  def\n>>  ghi\n>>  jkl' );
		});

		it( 'should indent content using the empty string if specified (i.e. noop)', function () {
			var s = new MagicString( 'abc\ndef\nghi\njkl' );

			s.indent( '');
			assert.equal( s.toString(), 'abc\ndef\nghi\njkl' );
		});

		it( 'should prevent excluded characters from being indented', function () {
			var s = new MagicString( 'abc\ndef\nghi\njkl' );

			s.indent( '  ', { exclude: [ 7, 15 ] });
			assert.equal( s.toString(), '  abc\n  def\nghi\njkl' );

			s.indent( '>>', { exclude: [ 7, 15 ] });
			assert.equal( s.toString(), '>>  abc\n>>  def\nghi\njkl' );
		});

		it( 'should not add characters to empty lines', function () {
			var s = new MagicString( '\n\nabc\ndef\n\nghi\njkl' );

			s.indent();
			assert.equal( s.toString(), '\n\n\tabc\n\tdef\n\n\tghi\n\tjkl' );

			s.indent();
			assert.equal( s.toString(), '\n\n\t\tabc\n\t\tdef\n\n\t\tghi\n\t\tjkl' );
		});

		it( 'should not add characters to empty lines, even on Windows', function () {
			var s = new MagicString( '\r\n\r\nabc\r\ndef\r\n\r\nghi\r\njkl' );

			s.indent();
			assert.equal( s.toString(), '\r\n\r\n\tabc\r\n\tdef\r\n\r\n\tghi\r\n\tjkl' );

			s.indent();
			assert.equal( s.toString(), '\r\n\r\n\t\tabc\r\n\t\tdef\r\n\r\n\t\tghi\r\n\t\tjkl' );
		});

		it( 'should indent content with removals', function () {
			var s = new MagicString( '/* remove this line */\nvar foo = 1;' );

			s.remove( 0, 23 );
			s.indent();

			assert.equal( s.toString(), '\tvar foo = 1;' );
		});

		it( 'should not indent patches in the middle of a line', function () {
			var s = new MagicString( 'class Foo extends Bar {}' );

			s.overwrite( 18, 21, 'Baz' );
			assert.equal( s.toString(), 'class Foo extends Baz {}' );

			s.indent();
			assert.equal( s.toString(), '\tclass Foo extends Baz {}' );
		});

		it( 'should return this', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.strictEqual( s.indent(), s );
		});

		it( 'should return this on noop', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.strictEqual( s.indent( '' ), s );
		});
	});

	describe( 'insert', function () {
		it( 'is deprecated', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.throws( function () { s.insert( 6, 'X' ); }, /deprecated/ );
		});

		// TODO move this into insertRight and insertLeft tests

		// it( 'should insert characters in the correct location', function () {
		// 	var s = new MagicString( 'abcdefghijkl' );
		//
		// 	s.insert( 0, '>>>' );
		// 	s.insert( 6, '***' );
		// 	s.insert( 12, '<<<' );
		//
		// 	assert.equal( s.toString(), '>>>abcdef***ghijkl<<<' );
		// });
		//
		// it( 'should return this', function () {
		// 	var s = new MagicString( 'abcdefghijkl' );
		// 	assert.strictEqual( s.insert( 0, 'a' ), s );
		// });
		//
		// it( 'should insert repeatedly at the same position correctly', function () {
		// 	var s = new MagicString( 'ab' );
		// 	assert.equal( s.insert(1, '1').toString(), 'a1b' );
		// 	assert.equal( s.insert(1, '2').toString(), 'a12b' );
		// });
		//
		// it( 'should insert repeatedly at the beginning correctly', function () {
		// 	var s = new MagicString( 'ab' );
		// 	assert.equal( s.insert(0, '1').toString(), '1ab' );
		// 	assert.equal( s.insert(0, '2').toString(), '12ab' );
		// });
		//
		// it( 'should throw when given non-string content', function () {
		// 	var s = new MagicString( '' );
		// 	assert.throws(
		// 		function () { s.insert( 0, [] ); },
		// 		TypeError
		// 	);
		// });
		//
		// it( 'should allow inserting after removed range', function () {
		// 	var s = new MagicString( 'abcd' );
		// 	s.remove( 1, 2 );
		// 	s.insert( 2, 'z' );
		// 	assert.equal( s.toString(), 'azcd' );
		// });
	});

	describe( 'insertLeft', function () {
		it( 'inserts repeatedly in correct order', function () {
			var s = new MagicString( 'ab' );
			assert.equal( s.insertLeft(1, '1').toString(), 'a1b' );
			assert.equal( s.insertLeft(1, '2').toString(), 'a12b' );
		});

		it( 'should return this', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.strictEqual( s.insertLeft( 0, 'a' ), s );
		});
	});

	describe( 'insertRight', function () {
		it( 'inserts repeatedly in correct order', function () {
			var s = new MagicString( 'ab' );
			assert.equal( s.insertRight(1, '1').toString(), 'a1b' );
			assert.equal( s.insertRight(1, '2').toString(), 'a21b' );
		});

		it( 'should return this', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.strictEqual( s.insertLeft( 0, 'a' ), s );
		});
	});

	describe( 'move', function () {
		it( 'moves content from the start', function () {
			var s = new MagicString( 'abcdefghijkl' );
			s.move( 0, 3, 6 );

			assert.equal( s.toString(), 'defabcghijkl' );
		});

		it( 'moves content to the start', function () {
			var s = new MagicString( 'abcdefghijkl' );
			s.move( 3, 6, 0 );

			assert.equal( s.toString(), 'defabcghijkl' );
		});

		it( 'moves content from the end', function () {
			var s = new MagicString( 'abcdefghijkl' );
			s.move( 9, 12, 6 );

			assert.equal( s.toString(), 'abcdefjklghi' );
		});

		it( 'moves content to the end', function () {
			var s = new MagicString( 'abcdefghijkl' );
			s.move( 6, 9, 12 );

			assert.equal( s.toString(), 'abcdefjklghi' );
		});

		it( 'ignores redundant move', function () {
			var s = new MagicString( 'abcdefghijkl' );
			s.insertRight( 9, 'X' );
			s.move( 9, 12, 6 );
			s.insertLeft( 12, 'Y' );
			s.move( 6, 9, 12 ); // this is redundant – [6,9] is already after [9,12]

			assert.equal( s.toString(), 'abcdefXjklYghi' );
		});

		it( 'moves content to the middle', function () {
			var s = new MagicString( 'abcdefghijkl' );
			s.move( 3, 6, 9 );

			assert.equal( s.toString(), 'abcghidefjkl' );
		});

		it( 'handles multiple moves of the same snippet', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.move( 0, 3, 6 );
			assert.equal( s.toString(), 'defabcghijkl' );

			s.move( 0, 3, 9 );
			assert.equal( s.toString(), 'defghiabcjkl' );
		});

		it( 'handles moves of adjacent snippets', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.move( 0, 2, 6 );
			assert.equal( s.toString(), 'cdefabghijkl' );

			s.move( 2, 4, 6 );
			assert.equal( s.toString(), 'efabcdghijkl' );
		});

		it( 'handles moves to same index', function () {
			var s = new MagicString( 'abcdefghijkl' );
			s.move( 0, 2, 6 ).move( 3, 5, 6 );

			assert.equal( s.toString(), 'cfabdeghijkl' );
		});

		it( 'refuses to move a selection to inside itself', function () {
			var s = new MagicString( 'abcdefghijkl' );

			assert.throws( function () {
				s.move( 3, 6, 3 );
			}, /Cannot move a selection inside itself/ );

			assert.throws( function () {
				s.move( 3, 6, 4 );
			}, /Cannot move a selection inside itself/ );

			assert.throws( function () {
				s.move( 3, 6, 6 );
			}, /Cannot move a selection inside itself/ );
		});

		it( 'allows edits of moved content', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.move( 3, 6, 9 );
			s.overwrite( 3, 6, 'DEF' );

			assert.equal( s.toString(), 'abcghiDEFjkl' );

			s = new MagicString( 'abcdefghijkl' );

			s.move( 3, 6, 9 );
			s.overwrite( 4, 5, 'E' );

			assert.equal( s.toString(), 'abcghidEfjkl' );
		});

		// it( 'move follows inserts', function () {
		// 	var s = new MagicString( 'abcdefghijkl' );
		//
		// 	s.insertLeft( 3, 'X' ).move( 6, 9, 3 );
		// 	assert.equal( s.toString(), 'abcXghidefjkl' );
		// });
		//
		// it( 'inserts follow move', function () {
		// 	var s = new MagicString( 'abcdefghijkl' );
		//
		// 	s.insert( 3, 'X' ).move( 6, 9, 3 ).insert( 3, 'Y' );
		// 	assert.equal( s.toString(), 'abcXghiYdefjkl' );
		// });
		//
		// it( 'discards inserts at end of move by default', function () {
		// 	var s = new MagicString( 'abcdefghijkl' );
		//
		// 	s.insert( 6, 'X' ).move( 3, 6, 9 );
		// 	assert.equal( s.toString(), 'abcXghidefjkl' );
		// });

		it( 'moves content inserted at end of range', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.insertLeft( 6, 'X' ).move( 3, 6, 9 );
			assert.equal( s.toString(), 'abcghidefXjkl' );
		});

		it( 'returns this', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.strictEqual( s.move( 3, 6, 9 ), s );
		});
	});

	describe( 'overwrite', function () {
		it( 'should replace characters', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.overwrite( 5, 8, 'FGH' );
			assert.equal( s.toString(), 'abcdeFGHijkl' );
		});

		it( 'should throw an error if overlapping replacements are attempted', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.overwrite( 7, 11, 'xx' );

			assert.throws( function () {
				s.overwrite( 8, 12, 'yy' );
			}, /Cannot split a chunk that has already been edited/ );

			assert.equal( s.toString(), 'abcdefgxxl' );

			s.overwrite( 6, 12, 'yes' );
			assert.equal( s.toString(), 'abcdefyes' );
		});

		it( 'should allow contiguous but non-overlapping replacements', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.overwrite( 3, 6, 'DEF' );
			assert.equal( s.toString(), 'abcDEFghijkl' );

			s.overwrite( 6, 9, 'GHI' );
			assert.equal( s.toString(), 'abcDEFGHIjkl' );

			s.overwrite( 0, 3, 'ABC' );
			assert.equal( s.toString(), 'ABCDEFGHIjkl' );

			s.overwrite( 9, 12, 'JKL' );
			assert.equal( s.toString(), 'ABCDEFGHIJKL' );
		});

		it( 'does not replace zero-length inserts at overwrite start location', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.remove( 0, 6 );
			s.insertRight( 6, 'DEF' );
			s.overwrite( 6, 9, 'GHI' );
			assert.equal( s.toString(), 'DEFGHIjkl' );
		});

		it( 'replaces zero-length inserts inside overwrite', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.insertLeft( 6, 'XXX' );
			s.overwrite( 3, 9, 'DEFGHI' );
			assert.equal( s.toString(), 'abcDEFGHIjkl' );
		});

		it( 'replaces non-zero-length inserts inside overwrite', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.overwrite( 3, 4, 'XXX' );
			s.overwrite( 3, 5, 'DE' );
			assert.equal( s.toString(), 'abcDEfghijkl' );

			s.overwrite( 7, 8, 'YYY' );
			s.overwrite( 6, 8, 'GH' );
			assert.equal( s.toString(), 'abcDEfGHijkl' );
		});

		it( 'should return this', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.strictEqual( s.overwrite( 3, 4, 'D' ), s );
		});

		it( 'should disallow overwriting zero-length ranges', function () {
			var s = new MagicString( 'x' );
			assert.throws( function () {
				s.overwrite( 0, 0, 'anything' );
			}, /Cannot overwrite a zero-length range – use insertLeft or insertRight instead/ );
		});

		it( 'should throw when given non-string content', function () {
			var s = new MagicString( '' );
			assert.throws(
				function () { s.overwrite( 0, 1, [] ); },
				TypeError
			);
		});
	});

	describe( 'prepend', function () {
		it( 'should prepend content', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.prepend( 'xyz' );
			assert.equal( s.toString(), 'xyzabcdefghijkl' );

			s.prepend( '123' );
			assert.equal( s.toString(), '123xyzabcdefghijkl' );
		});

		it( 'should return this', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.strictEqual( s.prepend( 'xyz' ), s );
		});
	});

	describe( 'remove', function () {
		it( 'should remove characters from the original string', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.remove( 1, 5 );
			assert.equal( s.toString(), 'afghijkl' );

			s.remove( 9, 12 );
			assert.equal( s.toString(), 'afghi' );
		});

		it( 'should remove from the start', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.remove( 0, 6 );
			assert.equal( s.toString(), 'ghijkl' );
		});

		it( 'should remove from the end', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.remove( 6, 12 );
			assert.equal( s.toString(), 'abcdef' );
		});

		it( 'should treat zero-length removals as a no-op', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.remove( 0, 0 ).remove( 6, 6 ).remove( 9, -3 );
			assert.equal( s.toString(), 'abcdefghijkl' );
		});

		it( 'should remove overlapping ranges', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.remove( 3, 7 ).remove( 5, 9 );
			assert.equal( s.toString(), 'abcjkl' );

			s = new MagicString( 'abcdefghijkl' );

			s.remove( 3, 7 ).remove( 4, 6 );
			assert.equal( s.toString(), 'abchijkl' );
		});

		it( 'should remove overlapping ranges, redux', function () {
			var s = new MagicString( 'abccde' );

			s.remove( 2, 3 ); // c
			s.remove( 1, 3 ); // bc
			assert.equal( s.toString(), 'acde' );
		});

		it( 'should remove modified ranges', function () {
			var s = new MagicString( 'abcdefghi' );

			s.overwrite( 3, 6, 'DEF' );
			s.remove( 2, 7 ); // cDEFg
			assert.equal( s.slice( 1, 8 ), 'bh' );
			assert.equal( s.toString(), 'abhi' );
		});

		it( 'should not remove content inserted after the end of removed range', function () {
			var s = new MagicString( 'ab.c;' );

			s.insertRight( 0, '(' );
			s.insertRight( 4, ')' );
			s.remove( 2, 4 );
			assert.equal( s.toString(), '(ab);' );
		});

		it( 'should provide a useful error when illegal removals are attempted', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.overwrite( 5, 7, 'XX' );

			assert.throws( function () {
				s.remove( 4, 6 );
			}, /Cannot split a chunk that has already been edited/ );
		});

		it( 'should return this', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.strictEqual( s.remove( 3, 4 ), s );
		});
	});

	describe( 'slice', function () {
		it( 'should return the generated content between the specified original characters', function () {
			var s = new MagicString( 'abcdefghijkl' );

			assert.equal( s.slice( 3, 9 ), 'defghi' );
			s.overwrite( 4, 8, 'XX' );
			assert.equal( s.slice( 3, 9 ), 'dXXi' );
			s.overwrite( 2, 10, 'ZZ' );
			assert.equal( s.slice( 1, 11 ), 'bZZk' );
			assert.equal( s.slice( 2, 10 ), 'ZZ' );

			assert.throws( function () {
				s.slice( 3, 9 );
			});
		});

		it( 'defaults `end` to the original string length', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.equal( s.slice( 3 ), 'defghijkl' );
		});

		it( 'allows negative numbers as arguments', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.equal( s.slice( -3 ), 'jkl' );
			assert.equal( s.slice( 0, -3 ), 'abcdefghi' );
		});

		it( 'includes inserted characters, respecting insertion direction', function () {
			var s = new MagicString( 'abefij' );

			s.insertRight( 2, 'cd' );
			s.insertLeft( 4, 'gh' );

			assert.equal( s.slice(), 'abcdefghij' );
			assert.equal( s.slice( 1, 5 ), 'bcdefghi' );
			assert.equal( s.slice( 2, 4 ), 'cdefgh' );
			assert.equal( s.slice( 3, 4 ), 'fgh' );
			assert.equal( s.slice( 0, 2 ), 'ab' );
			assert.equal( s.slice( 0, 3 ), 'abcde' );
			assert.equal( s.slice( 4, 6 ), 'ij' );
			assert.equal( s.slice( 3, 6 ), 'fghij' );
		});

		it( 'supports characters moved outward', function () {
			var s = new MagicString( 'abcdEFghIJklmn' );

			s.move( 4, 6, 2 );
			s.move( 8, 10, 12 );
			assert.equal( s.toString(), 'abEFcdghklIJmn' );

			assert.equal( s.slice( 1, -1 ), 'bEFcdghklIJm' );
			assert.equal( s.slice( 2, -2 ), 'cdghkl' );
			assert.equal( s.slice( 3, -3 ), 'dghk' );
			assert.equal( s.slice( 4, -4 ), 'EFcdghklIJ' );
			assert.equal( s.slice( 5, -5 ), 'FcdghklI' );
			assert.equal( s.slice( 6, -6 ), 'gh' );
		});

		it( 'supports characters moved inward', function () {
			var s = new MagicString( 'abCDefghijKLmn' );

			s.move( 2, 4, 6 );
			s.move( 10, 12, 8 );
			assert.equal( s.toString(), 'abefCDghKLijmn' );

			assert.equal( s.slice( 1, -1 ), 'befCDghKLijm' );
			assert.equal( s.slice( 2, -2 ), 'CDghKL' );
			assert.equal( s.slice( 3, -3 ), 'DghK' );
			assert.equal( s.slice( 4, -4 ), 'efCDghKLij' );
			assert.equal( s.slice( 5, -5 ), 'fCDghKLi' );
			assert.equal( s.slice( 6, -6 ), 'gh' );
		});

		it( 'supports characters moved opposing', function () {
			var s = new MagicString( 'abCDefghIJkl' );

			s.move( 2, 4, 8 );
			s.move( 8, 10, 4 );
			assert.equal( s.toString(), 'abIJefghCDkl' );

			assert.equal( s.slice( 1, -1 ), 'bIJefghCDk' );
			assert.equal( s.slice( 2, -2 ), '' );
			assert.equal( s.slice( 3, -3 ), '' );
			assert.equal( s.slice( -3, 3 ), 'JefghC' );
			assert.equal( s.slice( 4, -4 ), 'efgh' );
			assert.equal( s.slice( 0, 3 ), 'abIJefghC' );
			assert.equal( s.slice( 3 ), 'Dkl' );
			assert.equal( s.slice( 0, -3 ), 'abI' );
			assert.equal( s.slice( -3 ), 'JefghCDkl' );
		});

		it( 'errors if replaced characters are used as slice anchors', function () {
			var s = new MagicString( 'abcdef' );
			s.overwrite( 2, 4, 'CD' );

			assert.throws( function () {
				s.slice( 2, 3 );
			}, /slice end anchor/ );

			assert.throws( function () {
				s.slice( 3, 4 );
			}, /slice start anchor/ );

			assert.throws( function () {
				s.slice( 3, 5 );
			}, /slice start anchor/ );

			assert.equal( s.slice( 1, 5 ), 'bCDe' );
		});

		it( 'does not error if slice is after removed characters', function () {
			var s = new MagicString( 'abcdef' );

			s.remove( 0, 2 );

			assert.equal( s.slice( 2, 4 ), 'cd' );
		});
	});

	describe( 'snip', function () {
		it( 'should return a clone with content outside `start` and `end` removed', function () {
			var s = new MagicString( 'abcdefghijkl', {
				filename: 'foo.js'
			});

			s.overwrite( 6, 9, 'GHI' );

			var snippet = s.snip( 3, 9 );
			assert.equal( snippet.toString(), 'defGHI' );
			assert.equal( snippet.filename, 'foo.js' );
		});

		it( 'should snip from the start', function () {
			var s = new MagicString( 'abcdefghijkl' );
			var snippet = s.snip( 0, 6 );

			assert.equal( snippet.toString(), 'abcdef' );
		});

		it( 'should snip from the end', function () {
			var s = new MagicString( 'abcdefghijkl' );
			var snippet = s.snip( 6, 12 );

			assert.equal( snippet.toString(), 'ghijkl' );
		});

		it( 'should respect original indices', function () {
			var s = new MagicString( 'abcdefghijkl' );
			var snippet = s.snip( 3, 9 );

			snippet.overwrite( 6, 9, 'GHI' );
			assert.equal( snippet.toString(), 'defGHI' );
		});
	});

	describe( 'trim', function () {
		it( 'should trim original content', function () {
			assert.equal( new MagicString( '   abcdefghijkl   ' ).trim().toString(), 'abcdefghijkl' );
			assert.equal( new MagicString( '   abcdefghijkl' ).trim().toString(), 'abcdefghijkl' );
			assert.equal( new MagicString( 'abcdefghijkl   ' ).trim().toString(), 'abcdefghijkl' );
		});

		it( 'should trim replaced content', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.overwrite( 0, 3, '   ' ).overwrite( 9, 12, '   ' ).trim();
			assert.equal( s.toString(), 'defghi' );
		});

		it( 'should trim original content before replaced content', function () {
			var s = new MagicString( 'abc   def' );

			s.remove( 6, 9 );
			assert.equal( s.toString(), 'abc   ' );

			s.trim();
			assert.equal( s.toString(), 'abc' );
		});

		it( 'should trim original content after replaced content', function () {
			var s = new MagicString( 'abc   def' );

			s.remove( 0, 3 );
			assert.equal( s.toString(), '   def' );

			s.trim();
			assert.equal( s.toString(), 'def' );
		});

		it( 'should trim original content before and after replaced content', function () {
			var s = new MagicString( 'abc   def   ghi' );

			s.remove( 0, 3 );
			s.remove( 12, 15 );
			assert.equal( s.toString(), '   def   ' );

			s.trim();
			assert.equal( s.toString(), 'def' );
		});

		it( 'should trim appended/prepended content', function () {
			var s = new MagicString( ' abcdefghijkl ' );

			s.prepend( '  ' ).append( '  ' ).trim();
			assert.equal( s.toString(), 'abcdefghijkl' );
		});

		it( 'should trim empty string', function () {
			var s = new MagicString( '   ' );

			assert.equal( s.trim().toString(), '' );
		});

		it( 'should return this', function () {
			var s = new MagicString( '  abcdefghijkl  ' );
			assert.strictEqual( s.trim(), s );
		});
	});

	describe( 'trimLines', function () {
		it( 'should trim original content', function () {
			var s = new MagicString( '\n\n   abcdefghijkl   \n\n' );

			s.trimLines();
			assert.equal( s.toString(), '   abcdefghijkl   ' );
		});
	});
});

describe( 'MagicString.Bundle', function () {
	describe( 'addSource', function () {
		it( 'should return this', function () {
			var b = new MagicString.Bundle();
			var source = new MagicString( 'abcdefghijkl' );

			assert.strictEqual( b.addSource({ content: source }), b );
		});

		it( 'should accept MagicString instance as a single argument', function () {
			var b = new MagicString.Bundle();
			var array = [];
			var source = new MagicString( 'abcdefghijkl', {
				filename: 'foo.js',
				indentExclusionRanges: array
			});

			b.addSource( source );
			assert.strictEqual( b.sources[0].content, source );
			assert.strictEqual( b.sources[0].filename, 'foo.js' );
			assert.strictEqual( b.sources[0].indentExclusionRanges, array );
		});

		it( 'respects MagicString init options with { content: source }', function () {
			var b = new MagicString.Bundle();
			var array = [];
			var source = new MagicString( 'abcdefghijkl', {
				filename: 'foo.js',
				indentExclusionRanges: array
			});

			b.addSource({ content: source });
			assert.strictEqual( b.sources[0].content, source );
			assert.strictEqual( b.sources[0].filename, 'foo.js' );
			assert.strictEqual( b.sources[0].indentExclusionRanges, array );
		});
	});

	describe( 'append', function () {
		it( 'should append content', function () {
			var b = new MagicString.Bundle();

			b.addSource({ content: new MagicString( '*' ) });

			b.append( '123' ).append( '456' );
			assert.equal( b.toString(), '*123456' );
		});

		it( 'should append content before subsequent sources', function () {
			var b = new MagicString.Bundle();

			b.addSource( new MagicString( '*' ) );

			b.append( '123' ).addSource( new MagicString( '-' ) ).append( '456' );
			assert.equal( b.toString(), '*123\n-456' );
		});

		it( 'should return this', function () {
			var b = new MagicString.Bundle();
			assert.strictEqual( b.append( 'x' ), b );
		});
	});

	describe( 'clone', function () {
		it( 'should clone a bundle', function () {
			var b = new MagicString.Bundle(),
				s1 = new MagicString( 'abcdef' ),
				s2 = new MagicString( 'ghijkl' ),
				clone;

			b
			.addSource({
				content: s1
			})
			.addSource({
				content: s2
			})
			.prepend( '>>>' )
			.append( '<<<' );

			clone = b.clone();

			assert.equal( clone.toString(), '>>>abcdef\nghijkl<<<' );

			s1.overwrite( 2, 4, 'XX' );
			assert.equal( b.toString(), '>>>abXXef\nghijkl<<<' );
			assert.equal( clone.toString(), '>>>abcdef\nghijkl<<<' );
		});
	});

	describe( 'generateMap', function () {
		it( 'should generate a sourcemap', function () {
			var b, map, smc, loc;

			b = new MagicString.Bundle();

			b.addSource({
				filename: 'foo.js',
				content: new MagicString( 'var answer = 42;' )
			});

			b.addSource({
				filename: 'bar.js',
				content: new MagicString( 'console.log( answer );' )
			});

			map = b.generateMap({
				file: 'bundle.js',
				includeContent: true,
				hires: true
			});

			assert.equal( map.version, 3 );
			assert.equal( map.file, 'bundle.js' );
			assert.deepEqual( map.sources, [ 'foo.js', 'bar.js' ]);
			assert.deepEqual( map.sourcesContent, [ 'var answer = 42;', 'console.log( answer );' ]);

			assert.equal( map.toString(), '{"version":3,"file":"bundle.js","sources":["foo.js","bar.js"],"sourcesContent":["var answer = 42;","console.log( answer );"],"names":[],"mappings":"AAAA,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC;ACAf,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC"}' );
			assert.equal( map.toUrl(), 'data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyJmb28uanMiLCJiYXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsidmFyIGFuc3dlciA9IDQyOyIsImNvbnNvbGUubG9nKCBhbnN3ZXIgKTsiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUNBZixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyJ9' );

			smc = new SourceMapConsumer( map );

			loc = smc.originalPositionFor({ line: 1, column: 0 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 0 );
			assert.equal( loc.source, 'foo.js' );

			loc = smc.originalPositionFor({ line: 1, column: 1 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 1 );
			assert.equal( loc.source, 'foo.js' );

			loc = smc.originalPositionFor({ line: 2, column: 0 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 0 );
			assert.equal( loc.source, 'bar.js' );

			loc = smc.originalPositionFor({ line: 2, column: 1 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 1 );
			assert.equal( loc.source, 'bar.js' );
		});

		it( 'should handle Windows-style paths', function () {
			var b, map, smc, loc;

			b = new MagicString.Bundle();

			b.addSource({
				filename: 'path\\to\\foo.js',
				content: new MagicString( 'var answer = 42;' )
			});

			b.addSource({
				filename: 'path\\to\\bar.js',
				content: new MagicString( 'console.log( answer );' )
			});

			map = b.generateMap({
				file: 'bundle.js',
				includeContent: true,
				hires: true
			});

			assert.equal( map.version, 3 );
			assert.equal( map.file, 'bundle.js' );
			assert.deepEqual( map.sources, [ 'path/to/foo.js', 'path/to/bar.js' ]);
			assert.deepEqual( map.sourcesContent, [ 'var answer = 42;', 'console.log( answer );' ]);

			assert.equal( map.toString(), '{"version":3,"file":"bundle.js","sources":["path/to/foo.js","path/to/bar.js"],"sourcesContent":["var answer = 42;","console.log( answer );"],"names":[],"mappings":"AAAA,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC;ACAf,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC"}' );

			smc = new SourceMapConsumer( map );

			loc = smc.originalPositionFor({ line: 1, column: 0 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 0 );
			assert.equal( loc.source, 'path/to/foo.js' );

			loc = smc.originalPositionFor({ line: 1, column: 1 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 1 );
			assert.equal( loc.source, 'path/to/foo.js' );

			loc = smc.originalPositionFor({ line: 2, column: 0 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 0 );
			assert.equal( loc.source, 'path/to/bar.js' );

			loc = smc.originalPositionFor({ line: 2, column: 1 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 1 );
			assert.equal( loc.source, 'path/to/bar.js' );
		});

		it( 'should handle edge case with intro content', function () {
			var b, map, smc, loc;

			b = new MagicString.Bundle();

			b.addSource({
				filename: 'foo.js',
				content: new MagicString( 'var answer = 42;' )
			});

			b.addSource({
				filename: 'bar.js',
				content: new MagicString( '\nconsole.log( answer );' )
			});

			b.indent().prepend( '(function () {\n' ).append( '\n}());' );

			map = b.generateMap({
				file: 'bundle.js',
				includeContent: true,
				hires: true
			});

			smc = new SourceMapConsumer( map );

			loc = smc.originalPositionFor({ line: 2, column: 1 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 0 );
			assert.equal( loc.source, 'foo.js' );

			loc = smc.originalPositionFor({ line: 2, column: 2 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 1 );
			assert.equal( loc.source, 'foo.js' );

			loc = smc.originalPositionFor({ line: 4, column: 1 });
			assert.equal( loc.line, 2 );
			assert.equal( loc.column, 0 );
			assert.equal( loc.source, 'bar.js' );

			loc = smc.originalPositionFor({ line: 4, column: 2 });
			assert.equal( loc.line, 2 );
			assert.equal( loc.column, 1 );
			assert.equal( loc.source, 'bar.js' );
		});

		it( 'should allow missing file option when generating map', function () {
			var b, map;

			b = new MagicString.Bundle();

			b.addSource({
				filename: 'foo.js',
				content: new MagicString( 'var answer = 42;' )
			});

			map = b.generateMap({
				includeContent: true,
				hires: true
			});
		});

		it( 'should handle repeated sources', function () {
			var b = new MagicString.Bundle();

			var foo = new MagicString( 'var one = 1;\nvar three = 3;', {
				filename: 'foo.js'
			});

			var bar = new MagicString( 'var two = 2;\nvar four = 4;', {
				filename: 'bar.js'
			});

			b.addSource( foo.snip( 0, 12 ) );
			b.addSource( bar.snip( 0, 12 ) );
			b.addSource( foo.snip( 13, 27 ) );
			b.addSource( bar.snip( 13, 26 ) );

			var code = b.toString();
			assert.equal( code, 'var one = 1;\nvar two = 2;\nvar three = 3;\nvar four = 4;' );

			var map = b.generateMap({
				includeContent: true,
				hires: true
			});

			assert.equal( map.sources.length, 2 );
			assert.equal( map.sourcesContent.length, 2 );

			var smc = new SourceMapConsumer( map );
			var loc;

			loc = smc.originalPositionFor({ line: 1, column: 0 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 0 );
			assert.equal( loc.source, 'foo.js' );

			loc = smc.originalPositionFor({ line: 2, column: 0 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 0 );
			assert.equal( loc.source, 'bar.js' );

			loc = smc.originalPositionFor({ line: 3, column: 0 });
			assert.equal( loc.line, 2 );
			assert.equal( loc.column, 0 );
			assert.equal( loc.source, 'foo.js' );

			loc = smc.originalPositionFor({ line: 4, column: 0 });
			assert.equal( loc.line, 2 );
			assert.equal( loc.column, 0 );
			assert.equal( loc.source, 'bar.js' );
		});

		it( 'should recover original names', function () {
			var b = new MagicString.Bundle();

			var one = new MagicString( 'function one () {}', { filename: 'one.js' });
			var two = new MagicString( 'function two () {}', { filename: 'two.js' });

			one.overwrite( 9, 12, 'three', true );
			two.overwrite( 9, 12, 'four', true );

			b.addSource( one );
			b.addSource( two );

			map = b.generateMap({
				file: 'output.js',
				source: 'input.js',
				includeContent: true
			});

			smc = new SourceMapConsumer( map );

			loc = smc.originalPositionFor({ line: 1, column: 9 });
			assert.equal( loc.name, 'one' );

			loc = smc.originalPositionFor({ line: 2, column: 9 });
			assert.equal( loc.name, 'two' );
		});
	});

	describe( 'indent', function () {
		it( 'should indent a bundle', function () {
			var b = new MagicString.Bundle();

			b.addSource({ content: new MagicString( 'abcdef' ) });
			b.addSource({ content: new MagicString( 'ghijkl' ) });

			b.indent().prepend( '>>>\n' ).append( '\n<<<' );
			assert.equal( b.toString(), '>>>\n\tabcdef\n\tghijkl\n<<<' );
		});

		it( 'should ignore non-indented sources when guessing indentation', function () {
			var b = new MagicString.Bundle();

			b.addSource({ content: new MagicString( 'abcdef' ) });
			b.addSource({ content: new MagicString( 'ghijkl' ) });
			b.addSource({ content: new MagicString( '  mnopqr' ) });

			b.indent();
			assert.equal( b.toString(), '  abcdef\n  ghijkl\n    mnopqr' );
		});

		it( 'should respect indent exclusion ranges', function () {
			var b = new MagicString.Bundle();

			b.addSource({
				content: new MagicString( 'abc\ndef\nghi\njkl' ),
				indentExclusionRanges: [ 7, 15 ]
			});

			b.indent( '  ' );
			assert.equal( b.toString(), '  abc\n  def\nghi\njkl' );

			b.indent( '>>' );
			assert.equal( b.toString(), '>>  abc\n>>  def\nghi\njkl' );
		});

		it( 'does not indent sources with no preceding newline, i.e. append()', function () {
			var b = new MagicString.Bundle();

			b.addSource( new MagicString( 'abcdef' ) );
			b.addSource( new MagicString( 'ghijkl' ) );

			b.prepend( '>>>' ).append( '<<<' ).indent();
			assert.equal( b.toString(), '\t>>>abcdef\n\tghijkl<<<' );
		});

		it( 'should noop with an empty string', function () {
			var b = new MagicString.Bundle();

			b.addSource( new MagicString( 'abcdef' ) );
			b.addSource( new MagicString( 'ghijkl' ) );

			b.indent( '' );
			assert.equal( b.toString(), 'abcdef\nghijkl' );
		});

		it( 'indents prepended content', function () {
			var b = new MagicString.Bundle();
			b.prepend( 'a\nb' ).indent();

			assert.equal( b.toString(), '\ta\n\tb' );
		});

		it( 'indents content immediately following intro with trailing newline', function () {
			var b = new MagicString.Bundle({ separator: '\n\n' });

			var s = new MagicString( '2' );
			b.addSource({ content: s });

			b.prepend( '1\n' );

			assert.equal( b.indent().toString(), '\t1\n\t2' );
		});

		it( 'should return this', function () {
			var b = new MagicString.Bundle();
			assert.strictEqual( b.indent(), b );
		});

		it( 'should return this on noop', function () {
			var b = new MagicString.Bundle();
			assert.strictEqual( b.indent( '' ), b );
		});
	});

	describe( 'prepend', function () {
		it( 'should append content', function () {
			var b = new MagicString.Bundle();

			b.addSource({ content: new MagicString( '*' ) });

			b.prepend( '123' ).prepend( '456' );
			assert.equal( b.toString(), '456123*' );
		});

		it( 'should return this', function () {
			var b = new MagicString.Bundle();
			assert.strictEqual( b.prepend( 'x' ), b );
		});
	});

	describe( 'trim', function () {
		it( 'should trim bundle', function () {
			var b = new MagicString.Bundle();

			b.addSource({
				content: new MagicString( '   abcdef   ' )
			});

			b.addSource({
				content: new MagicString( '   ghijkl   ' )
			});

			b.trim();
			assert.equal( b.toString(), 'abcdef   \n   ghijkl' );
		});

		it( 'should handle funky edge cases', function () {
			var b = new MagicString.Bundle();

			b.addSource({
				content: new MagicString( '   abcdef   ' )
			});

			b.addSource({
				content: new MagicString( '   x   ' )
			});

			b.prepend( '\n>>>\n' ).append( '   ' );

			b.trim();
			assert.equal( b.toString(), '>>>\n   abcdef   \n   x' );
		});

		it( 'should return this', function () {
			var b = new MagicString.Bundle();
			assert.strictEqual( b.trim(), b );
		});
	});

	describe( 'toString', function () {
		it( 'should separate with a newline by default', function () {
			var b = new MagicString.Bundle();

			b.addSource( new MagicString( 'abc' ) );
			b.addSource( new MagicString( 'def' ) );

			assert.strictEqual( b.toString(), 'abc\ndef' );
		});

		it( 'should accept separator option', function () {
			var b = new MagicString.Bundle({ separator: '==' });

			b.addSource( new MagicString( 'abc' ) );
			b.addSource( new MagicString( 'def' ) );

			assert.strictEqual( b.toString(), 'abc==def' );
		});

		it( 'should accept empty string separator option', function () {
			var b = new MagicString.Bundle({ separator: '' });

			b.addSource( new MagicString( 'abc' ) );
			b.addSource( new MagicString( 'def' ) );

			assert.strictEqual( b.toString(), 'abcdef' );
		});
	});
});
