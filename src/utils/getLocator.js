export default function getLocator ( source ) {
	let originalLines = source.split( '\n' );

	let start = 0;
	let lineRanges = originalLines.map( ( line, i ) => {
		const end = start + line.length + 1;
		const range = { start, end, line: i };

		start = end;
		return range;
	});

	let i = 0;

	function rangeContains ( range, index ) {
		return range.start <= index && index < range.end;
	}

	function getLocation ( range, index ) {
		return { line: range.line, column: index - range.start };
	}

	return function locate ( index ) {
		let range = lineRanges[i];

		if ( rangeContains( range, index ) ) return getLocation( range, index );

		// go forwards (most likely) or backwards
		if ( index >= range.end ) {
			for ( ; i < lineRanges.length; i += 1 ) {
				range = lineRanges[i];
				if ( rangeContains( range, index ) ) return getLocation( range, index );
			}
		}

		else {
			for ( ; i > 0; i -= 1 ) {
				range = lineRanges[i];
				if ( rangeContains( range, index ) ) return getLocation( range, index );
			}
		}
	};
}
