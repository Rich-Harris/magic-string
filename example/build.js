var fs = require( 'fs' ),
	MagicString = require( '../' );

process.chdir( __dirname );

fs.readFile( 'app.source.js', function ( err, result ) {
	var source,
		magicString,
		pattern = /foo/g,
		match,
		transpiled,
		map;

	if ( err ) throw err;

	source = result.toString();
	magicString = new MagicString( result.toString() );

	while ( match = pattern.exec( source ) ) {
		magicString.overwrite( match.index, match.index + 3, 'answer' );
	}

	transpiled = magicString.toString() + '\n//# sourceMappingURL=app.js.map';
	map = magicString.generateMap({
		file: 'app.js.map',
		source: 'app.source.js',
		includeContent: true,
		hires: true
	});

	fs.writeFileSync( 'app.js', transpiled );
	fs.writeFileSync( 'app.js.map', map );

	fs.writeFileSync( 'app.inlinemap.js', transpiled + '\n//#sourceMappingURL=' + map.toUrl() );
});
