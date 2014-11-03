var assert = require( 'assert' ),
	MagicString = require( '../' );

describe( 'MagicString', function () {
	it( 'should correctly locate characters in an unmodified string', function () {
		var s = new MagicString( 'abcdefghijkl' );
		assert.equal( s.locate( 0 ), 0 );
		assert.equal( s.locate( 6 ), 6 );
		assert.equal( s.locate( 11 ), 11 );
	});

	it ( 'should throw an error if character is out of bounds', function () {
		var s = new MagicString( 'abcdefghijkl' );

		assert.throws( function () { s.locate( -1 ); });
		assert.throws( function () { s.locate( 12 ); });
	});

	it( 'should allow characters to be removed', function () {
		var s = new MagicString( 'abcdefghijkl' );

		s.remove( 1, 5 );
		assert.equal( s.toString(), 'afghijkl' );

		s.remove( 9, 12 );
		assert.equal( s.toString(), 'afghi' );
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

	it( 'should allow characters to be replaced', function () {
		var s = new MagicString( 'abcdefghijkl' );

		s.replace( 5, 8, 'FGH' );
		assert.equal( s.toString(), 'abcdeFGHijkl' );
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

	it( 'should allow content to be prepended', function () {
		var s = new MagicString( 'abcdefghijkl' );

		s.prepend( 'xyz' );
		assert.equal( s.toString(), 'xyzabcdefghijkl' );
		assert.equal( s.locate( 0 ), 3 );
		assert.equal( s.locate( 11 ), 14 );

		s.prepend( 'xyz' );
		assert.equal( s.toString(), 'xyzxyzabcdefghijkl' );
		assert.equal( s.locate( 0 ), 6 );
		assert.equal( s.locate( 11 ), 17 );
	});

	it( 'should allow content to be appended', function () {
		var s = new MagicString( 'abcdefghijkl' );

		s.append( 'xyz' );
		assert.equal( s.toString(), 'abcdefghijklxyz' );
		assert.equal( s.locate( 0 ), 0 );
		assert.equal( s.locate( 11 ), 11 );

		s.append( 'xyz' );
		assert.equal( s.toString(), 'abcdefghijklxyzxyz' );
		assert.equal( s.locate( 0 ), 0 );
		assert.equal( s.locate( 11 ), 11 );
	});

	it( 'should locate the origin of characters in the generated string', function () {
		var s = new MagicString( 'abcdefghijkl' );

		assert.equal( s.locateOrigin( 4 ), 4 );
		assert.equal( s.locateOrigin( 11 ), 11 );

		s.remove( 1, 3 );
		assert.equal( s.locateOrigin( 0 ), 0 );
		assert.equal( s.locateOrigin( 1 ), 3 );
		assert.equal( s.locateOrigin( 2 ), 4 );
	});

	it( 'should indent content with a single tab character by default', function () {
		var s = new MagicString( 'abc\ndef\nghi\njkl' );

		s.indent();
		assert.equal( s.toString(), '\tabc\n\tdef\n\tghi\n\tjkl' );

		assert.equal( s.locate( 0 ), 1 );
		assert.equal( s.locate( 4 ), 6 );
		assert.equal( s.locate( 5 ), 7 );
		assert.equal( s.locate( 8 ), 11 );
		assert.equal( s.locate( 12 ), 16 );
		assert.equal( s.locate( 13 ), 17 );

		s.indent();
		assert.equal( s.toString(), '\t\tabc\n\t\tdef\n\t\tghi\n\t\tjkl' );

		assert.equal( s.locate( 0 ), 2 );
		assert.equal( s.locate( 4 ), 8 );
		assert.equal( s.locate( 8 ), 14 );
		assert.equal( s.locate( 12 ), 20 );
	});

	it( 'should indent content, using existing indentation as a guide', function () {
		var s = new MagicString( 'abc\n  def\n    ghi\n  jkl' );

		s.indent();
		assert.equal( s.toString(), '  abc\n    def\n      ghi\n    jkl' );

		s.indent();
		assert.equal( s.toString(), '    abc\n      def\n        ghi\n      jkl' );
	});

	it( 'should allow method calls to be chained', function () {
		var s = new MagicString( 'abcdef\nghijkl' );

		assert.strictEqual( s.prepend( 'xyz' ).append( 'xyz' ).indent().remove( 1, 4 ).remove( 8, 11 ), s );
		assert.equal( s.toString(), '\txyzaef\n\tgklxyz' );
	});

	it( 'should allow the same content to be replaced more than once, barring overlaps', function () {
		var s = new MagicString( 'abcdefghijkl' );

		s.replace( 3, 6, 'DEF' );
		s.replace( 3, 6, '345' );
		assert.equal( s.toString(), 'abc345ghijkl' );

		s.replace( 7, 11, 'xx' );
		s.replace( 6, 12, 'yy' );
		assert.equal( s.toString(), 'abc345yy' );
	});

	it( 'should throw an error if overlapping replacements are attempted', function () {
		var s = new MagicString( 'abcdefghijkl' );

		s.replace( 7, 11, 'xx' );
		assert.throws( function () {
			s.replace( 8, 12, 'yy' );
		}, /Cannot make overlapping replacements/ );
		assert.equal( s.toString(), 'abcdefgxxl' );

		s.replace( 6, 12, 'yes' );
		assert.equal( s.toString(), 'abcdefyes' );
	});

	it( 'should generate a sourcemap', function () {
		assert.equal( false );
	});
});