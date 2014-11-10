var assert = require( 'assert' ),
	SourceMapConsumer = require( 'source-map' ).SourceMapConsumer,
	MagicString;

before( function () {
	return require( '../gobblefile' ).build({
		dest: '.tmp',
		force: true
	}).then( function () {
		MagicString = require( '../.tmp/magic-string' );
	}).catch( function ( err ) {
		console.log( 'Error building library:', err );
	});
});

describe( 'MagicString$append', function () {
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
});

describe( 'MagicString$clone', function () {
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

describe( 'MagicString$generateMap', function () {
	it( 'should generate a sourcemap', function () {
		var s, map, smc, loc;

		s = new MagicString( 'abcdefghijkl' );

		s.remove( 3, 9 );
		map = s.generateMap({
			file: 'content.md.map',
			source: 'content.md',
			includeContent: true,
			hires: true
		});

		assert.equal( map.version, 3 );
		assert.equal( map.file, 'content.md.map' );
		assert.deepEqual( map.sources, [ 'content.md' ]);
		assert.deepEqual( map.sourcesContent, [ 'abcdefghijkl' ]);

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
});

describe( 'MagicString$indent', function () {
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

	it( 'should return this', function () {
		var s = new MagicString( 'abcdefghijkl' );
		assert.strictEqual( s.indent(), s );
	});
});

describe( 'MagicString$locate', function () {
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

describe( 'MagicString$locateOrigin', function () {
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

describe( 'MagicString$prepend', function () {
	it( 'should prepend content', function () {
		var s = new MagicString( 'abcdefghijkl' );

		s.prepend( 'xyz' );
		assert.equal( s.toString(), 'xyzabcdefghijkl' );

		s.prepend( 'xyz' );
		assert.equal( s.toString(), 'xyzxyzabcdefghijkl' );
	});

	it( 'should return this', function () {
		var s = new MagicString( 'abcdefghijkl' );
		assert.strictEqual( s.prepend( 'xyz' ), s );
	});
});

describe( 'MagicString$remove', function () {
	it( 'should remove characters from the original string', function () {
		var s = new MagicString( 'abcdefghijkl' );

		s.remove( 1, 5 );
		assert.equal( s.toString(), 'afghijkl' );

		s.remove( 9, 12 );
		assert.equal( s.toString(), 'afghi' );
	});

	it( 'should return this', function () {
		var s = new MagicString( 'abcdefghijkl' );
		assert.strictEqual( s.remove( 3, 4 ), s );
	});
});

describe( 'MagicString$replace', function () {
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
});

describe( 'MagicString$slice', function () {
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

describe( 'MagicString$trim', function () {
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
