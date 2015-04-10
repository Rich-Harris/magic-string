/*global require, before, describe, it, console */
var assert = require( 'assert' ),
	SourceMapConsumer = require( 'source-map' ).SourceMapConsumer,
	MagicString;

before( function () {
	return require( '../gobblefile' ).build({
		dest: '.tmp',
		force: true
	}).then( function () {
		MagicString = require( '../.tmp/dist/magic-string.deps' );
	}).catch( function ( err ) {
		console.log( 'Error building library:', err );
		throw err;
	});
});

describe( 'MagicString', function () {
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
			var s = new MagicString( 'abcdefghijkl' ),
				c;

			s.replace( 3, 9, 'XYZ' );
			c = s.clone();

			assert.notEqual( s, c );
			assert.equal( c.toString(), 'abcXYZjkl' );
			assert.equal( c.locate( 9 ), 6 );
		});
	});

	describe( 'generateMap', function () {
		it( 'should generate a sourcemap', function () {
			var s, map, smc, loc;

			s = new MagicString( 'abcdefghijkl' );

			s.remove( 3, 9 );
			map = s.generateMap({
				file: 'output.md',
				source: 'input.md',
				includeContent: true,
				hires: true
			});

			assert.equal( map.version, 3 );
			assert.equal( map.file, 'output.md' );
			assert.deepEqual( map.sources, [ 'input.md' ]);
			assert.deepEqual( map.sourcesContent, [ 'abcdefghijkl' ]);

			assert.equal( map.toString(), '{"version":3,"file":"output.md","sources":["input.md"],"sourcesContent":["abcdefghijkl"],"names":[],"mappings":"AAAA,CAAC,CAAC,CAAO,CAAC,CAAC"}' );
			assert.equal( map.toUrl(), 'data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0Lm1kIiwic291cmNlcyI6WyJpbnB1dC5tZCJdLCJzb3VyY2VzQ29udGVudCI6WyJhYmNkZWZnaGlqa2wiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsQ0FBQyxDQUFDLENBQU8sQ0FBQyxDQUFDIn0=' );

			smc = new SourceMapConsumer( map );

			loc = smc.originalPositionFor({ line: 1, column: 0 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 0 );

			loc = smc.originalPositionFor({ line: 1, column: 1 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 1 );

			loc = smc.originalPositionFor({ line: 1, column: 3 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 9 );

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

			assert.equal( map.toString(), '{"version":3,"file":"output.md","sources":["input.md"],"sourcesContent":["abcdefghijkl"],"names":[],"mappings":"AAAA,GAAG,GAAM,CAAC"}' );
			assert.equal( map.toUrl(), 'data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0Lm1kIiwic291cmNlcyI6WyJpbnB1dC5tZCJdLCJzb3VyY2VzQ29udGVudCI6WyJhYmNkZWZnaGlqa2wiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsR0FBRyxHQUFNLENBQUMifQ==' );

			smc = new SourceMapConsumer( map );

			loc = smc.originalPositionFor({ line: 1, column: 0 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 0 );

			loc = smc.originalPositionFor({ line: 1, column: 3 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 3 );

			loc = smc.originalPositionFor({ line: 1, column: 6 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 9 );

			loc = smc.originalPositionFor({ line: 1, column: 7 });
			assert.equal( loc.line, 1 );
			assert.equal( loc.column, 10 );
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

		it( 'should return this', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.strictEqual( s.indent(), s );
		});
	});

	describe( 'insert', function () {
		it( 'should insert characters in the correct location', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.insert( 0, '>>>' );
			s.insert( 6, '***' );
			s.insert( 12, '<<<' );

			assert.equal( s.toString(), '>>>abcdef***ghijkl<<<' );
			assert.equal( s.locate( 0 ), 3 );
			assert.equal( s.locate( 5 ), 8 );
			assert.equal( s.locate( 6 ), 12 );
			assert.equal( s.locate( 11 ), 17 );
		});

		it( 'should return this', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.strictEqual( s.insert( 0, 'a' ), s );
		});

		it( 'should insert repeatedly at the same position correctly', function () {
			var s = new MagicString( 'ab' );
			assert.equal( s.insert(1, '1').toString(), 'a1b' );
			assert.equal( s.insert(1, '2').toString(), 'a12b' );
		});

		it( 'should insert repeatedly at the beginning correctly', function () {
			var s = new MagicString( 'ab' );
			assert.equal( s.insert(0, '1').toString(), '1ab' );
			assert.equal( s.insert(0, '2').toString(), '12ab' );
		});

		it( 'should throw when given non-string content', function () {
			var s = new MagicString( '' );
			assert.throws(
				function () { s.insert( 0, [] ); },
				TypeError
			);
		});
	});

	describe( 'locate', function () {
		it( 'should correctly locate characters in an unmodified string', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.equal( s.locate( 0 ), 0 );
			assert.equal( s.locate( 6 ), 6 );
			assert.equal( s.locate( 11 ), 11 );
		});

		it ( 'should throw an error if character is out of bounds', function () {
			var s = new MagicString( 'abcdefghijkl' );

			assert.throws( function () { s.locate( -1 ); });
			assert.throws( function () { s.locate( 13 ); });
		});

		it( 'should correctly locate characters in a string with characters removed', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.remove( 1, 5 );
			assert.equal( s.locate( 0 ), 0 );
			assert.equal( s.locate( 1 ), null );
			assert.equal( s.locate( 2 ), null );
			assert.equal( s.locate( 5 ), 1 );
			assert.equal( s.locate( 11 ), 7 );
		});

		it( 'should correctly locate characters in a string with characters replaced', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.replace( 5, 8, 'FGH' );
			assert.equal( s.locate( 0 ), 0 );
			assert.equal( s.locate( 4 ), 4 );
			assert.equal( s.locate( 5 ), null );
			assert.equal( s.locate( 7 ), null );
			assert.equal( s.locate( 8 ), 8 );

			s.replace( 1, 4, 'X' );
			assert.equal( s.toString(), 'aXeFGHijkl' );
			assert.equal( s.locate( 2 ), null );
			assert.equal( s.locate( 4 ), 2 );
			assert.equal( s.locate( 8 ), 6 );
		});

		it( 'should correctly locate characters in a string that has had content prepended', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.prepend( 'xyz' );
			assert.equal( s.locate( 0 ), 3 );
			assert.equal( s.locate( 11 ), 14 );

			s.prepend( 'xyz' );
			assert.equal( s.locate( 0 ), 6 );
			assert.equal( s.locate( 11 ), 17 );
		});

		it( 'should correctly locate characters in a string that has had content appended', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.append( 'xyz' );
			assert.equal( s.locate( 0 ), 0 );
			assert.equal( s.locate( 11 ), 11 );

			s.append( 'xyz' );
			assert.equal( s.locate( 0 ), 0 );
			assert.equal( s.locate( 11 ), 11 );
		});

		it( 'should correctly locate characters in indented code', function () {
			var s = new MagicString( 'abc\ndef\nghi\njkl' );

			s.indent();

			assert.equal( s.locate( 0 ), 1 );
			assert.equal( s.locate( 4 ), 6 );
			assert.equal( s.locate( 5 ), 7 );
			assert.equal( s.locate( 8 ), 11 );
			assert.equal( s.locate( 12 ), 16 );
			assert.equal( s.locate( 13 ), 17 );

			s.indent();

			assert.equal( s.locate( 0 ), 2 );
			assert.equal( s.locate( 4 ), 8 );
			assert.equal( s.locate( 8 ), 14 );
			assert.equal( s.locate( 12 ), 20 );
		});

		it( 'should correctly locate characters in trimmed original content', function () {
			var s = new MagicString( '   abcdefghijkl   ' );

			s.trim();
			assert.equal( s.locate( 0 ), null );
			assert.equal( s.locate( 2 ), null );
			assert.equal( s.locate( 3 ), 0 );
			assert.equal( s.locate( 14 ), 11 );
			assert.equal( s.locate( 15 ), null );
		});

		it( 'should correctly locate characters in trimmed replaced content', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.replace( 0, 3, '   ' ).replace( 9, 12, '   ' ).trim();
			assert.equal( s.locate( 0 ), null );
			assert.equal( s.locate( 2 ), null );
			assert.equal( s.locate( 3 ), 0 );

			assert.equal( s.locate( 8 ), 5 );
			assert.equal( s.locate( 9 ), null );
		});

		it( 'should correctly locate characters in trimmed appended/prepended content', function () {
			var s = new MagicString( ' abcdefghijkl ' );

			s.prepend( '  ' ).append( '  ' ).trim();
			assert.equal( s.locate( 0 ), null );
			assert.equal( s.locate( 1 ), 0 );
			assert.equal( s.locate( 12 ), 11 );
			assert.equal( s.locate( 13 ), null );
		});
	});

	describe( 'locateOrigin', function () {
		it( 'should locate the origin of characters in the generated string', function () {
			var s = new MagicString( 'abcdefghijkl' );

			assert.equal( s.locateOrigin( 4 ), 4 );
			assert.equal( s.locateOrigin( 11 ), 11 );

			s.remove( 1, 3 );
			assert.equal( s.locateOrigin( 0 ), 0 );
			assert.equal( s.locateOrigin( 1 ), 3 );
			assert.equal( s.locateOrigin( 2 ), 4 );
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

		it( 'should remove overlapping ranges', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.remove( 3, 7 ).remove( 5, 9 );
			assert.equal( s.toString(), 'abcjkl' );

			s = new MagicString( 'abcdefghijkl' );

			s.remove( 3, 7 ).remove( 4, 6 );
			assert.equal( s.toString(), 'abchijkl' );
		});

		it( 'should return this', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.strictEqual( s.remove( 3, 4 ), s );
		});
	});

	describe( 'replace', function () {
		it( 'should replace characters', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.replace( 5, 8, 'FGH' );
			assert.equal( s.toString(), 'abcdeFGHijkl' );
		});

		it( 'should throw an error if overlapping replacements are attempted', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.replace( 7, 11, 'xx' );
			assert.throws( function () {
				s.replace( 8, 12, 'yy' );
			}, /Cannot replace the same content twice/ );
			assert.equal( s.toString(), 'abcdefgxxl' );

			s.replace( 6, 12, 'yes' );
			assert.equal( s.toString(), 'abcdefyes' );
		});

		it( 'should replace characters at the end of the original string', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.replace( 12, 12, '<<<' );
			assert.equal( s.toString(), 'abcdefghijkl<<<' );
		});

		it( 'should return this', function () {
			var s = new MagicString( 'abcdefghijkl' );
			assert.strictEqual( s.replace( 3, 4, 'D' ), s );
		});

		it( 'should throw when given non-string content', function () {
			var s = new MagicString( '' );
			assert.throws(
				function () { s.replace( 0, 1, [] ); },
				TypeError
			);
		});
	});

	describe( 'slice', function () {
		it( 'should return the generated content between the specified original characters', function () {
			var s = new MagicString( 'abcdefghijkl' );

			assert.equal( s.slice( 3, 9 ), 'defghi' );
			s.replace( 4, 8, 'XX' );
			assert.equal( s.slice( 3, 9 ), 'dXXi' );
			s.replace( 2, 10, 'ZZ' );
			assert.equal( s.slice( 1, 11 ), 'bZZk' );

			assert.throws( function () {
				s.slice( 2, 10 );
			});
		});
	});

	describe( 'trim', function () {
		it( 'should trim original content', function () {
			var s = new MagicString( '   abcdefghijkl   ' );

			s.trim();
			assert.equal( s.toString(), 'abcdefghijkl' );
		});

		it( 'should trim replaced content', function () {
			var s = new MagicString( 'abcdefghijkl' );

			s.replace( 0, 3, '   ' ).replace( 9, 12, '   ' ).trim();
			assert.equal( s.toString(), 'defghi' );
		});

		it( 'should trim appended/prepended content', function () {
			var s = new MagicString( ' abcdefghijkl ' );

			s.prepend( '  ' ).append( '  ' ).trim();
			assert.equal( s.toString(), 'abcdefghijkl' );
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
			var b = new MagicString.Bundle(),
				source = new MagicString( 'abcdefghijkl' );

			assert.strictEqual( b.addSource({ content: source }), b );
		});
	});

	describe( 'append', function () {
		it( 'should append content', function () {
			var b = new MagicString.Bundle();

			b.addSource({ content: new MagicString( '*' ) });

			b.append( '123' ).append( '456' );
			assert.equal( b.toString(), '*123456' );
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

			s1.replace( 2, 4, 'XX' );
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

			map = b.generateMap({
				includeContent: true,
				hires: true
			});
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

		it( 'should return this', function () {
			var b = new MagicString.Bundle();
			assert.strictEqual( b.indent(), b );
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
});
