export default function guessIndent ( code ) {
	var lines, tabbed, spaced, min;

	lines = code.split( '\n' );

	tabbed = lines.filter( function ( line ) {
		return /^\t+/.test( line );
	});

	spaced = lines.filter( function ( line ) {
		return /^ {2,}/.test( line );
	});

	if ( tabbed.length === 0 && spaced.length === 0 ) {
		return null;
	}

	// More lines tabbed than spaced? Assume tabs, and
	// default to tabs in the case of a tie (or nothing
	// to go on)
	if ( tabbed.length >= spaced.length ) {
		return '\t';
	}

	// Otherwise, we need to guess the multiple
	min = spaced.reduce( function ( previous, current ) {
		var numSpaces = /^ +/.exec( current )[0].length;
		return Math.min( numSpaces, previous );
	}, Infinity );

	return new Array( min + 1 ).join( ' ' );
}
