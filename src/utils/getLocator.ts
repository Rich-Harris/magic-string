interface Range {
	start: number
	end: number
	line: number
}

export default function getLocator ( source: string ) {
	const originalLines = source.split( '\n' );

	let start = 0;
	const lineRanges = originalLines.map( ( line, i ) => {
		const end = start + line.length + 1;
		const range: Range = { start, end, line: i };

		start = end;
		return range;
	});

	let i = 0;

	function rangeContains ( range: Range, index: number ) {
		return range.start <= index && index < range.end;
	}

	function getLocation ( range: Range, index: number ) {
		return { line: range.line, column: index - range.start };
	}

	return function locate ( index: number ) {
		let range = lineRanges[i];

		const d = index >= range.end ? 1 : -1;

		while ( range ) {
			if ( rangeContains( range, index ) ) return getLocation( range, index );

			i += d;
			range = lineRanges[i];
		}
	};
}
