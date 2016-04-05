import { encode } from 'vlq';

export default function encodeMappings ( original, intro, chunks, hires, sourcemapLocations, sourceIndex, offsets, names ) {
	let rawLines = [];

	let generatedCodeLine = intro.split( '\n' ).length - 1;
	let rawSegments = rawLines[ generatedCodeLine ] = [];

	let originalCharIndex = 0;

	let generatedCodeColumn = 0;
	let sourceCodeLine = 0;
	let sourceCodeColumn = 0;

	function addSegmentsUntil ( end ) {
		let first = true;

		while ( originalCharIndex < end ) {
			if ( hires || first || sourcemapLocations[ originalCharIndex ] ) {
				rawSegments.push({
					generatedCodeLine,
					generatedCodeColumn,
					sourceCodeLine,
					sourceCodeColumn,
					sourceCodeName: -1,
					sourceIndex
				});
			}

			if ( original[ originalCharIndex ] === '\n' ) {
				sourceCodeLine += 1;
				sourceCodeColumn = 0;
				generatedCodeLine += 1;
				rawLines[ generatedCodeLine ] = rawSegments = [];
				generatedCodeColumn = 0;
			} else {
				sourceCodeColumn += 1;
				generatedCodeColumn += 1;
			}

			originalCharIndex += 1;
			first = false;
		}
	}

	for ( let i = 0; i < chunks.length; i += 1 ) {
		const chunk = chunks[i];

		if ( chunk.edited ) {
			if ( i > 0 || chunk.content.length ) {
				rawSegments.push({
					generatedCodeLine,
					generatedCodeColumn,
					sourceCodeLine,
					sourceCodeColumn,
					sourceCodeName: chunk.storeName ? names.indexOf( chunk.original ) : -1,
					sourceIndex
				});
			}

			let lines = chunk.content.split( '\n' );
			let lastLine = lines.pop();

			if ( lines.length ) {
				generatedCodeLine += lines.length;
				rawLines[ generatedCodeLine ] = rawSegments = [];
				generatedCodeColumn = lastLine.length;
			} else {
				generatedCodeColumn += lastLine.length;
			}

			lines = chunk.original.split( '\n' );
			lastLine = lines.pop();

			if ( lines.length ) {
				sourceCodeLine += lines.length;
				sourceCodeColumn = lastLine.length;
			} else {
				sourceCodeColumn += lastLine.length;
			}
		} else {
			addSegmentsUntil( chunk.end );
		}

		originalCharIndex = chunk.end;
	}

	addSegmentsUntil( original.length );

	offsets.sourceIndex = offsets.sourceIndex || 0;
	offsets.sourceCodeLine = offsets.sourceCodeLine || 0;
	offsets.sourceCodeColumn = offsets.sourceCodeColumn || 0;
	offsets.sourceCodeName = offsets.sourceCodeName || 0;

	const encoded = rawLines.map( segments => {
		let generatedCodeColumn = 0;

		return segments.map( segment => {
			let arr = [
				segment.generatedCodeColumn - generatedCodeColumn,
				segment.sourceIndex - offsets.sourceIndex,
				segment.sourceCodeLine - offsets.sourceCodeLine,
				segment.sourceCodeColumn - offsets.sourceCodeColumn
			];

			generatedCodeColumn = segment.generatedCodeColumn;
			offsets.sourceIndex = segment.sourceIndex;
			offsets.sourceCodeLine = segment.sourceCodeLine;
			offsets.sourceCodeColumn = segment.sourceCodeColumn;

			if ( ~segment.sourceCodeName ) {
				arr.push( segment.sourceCodeName - offsets.sourceCodeName );
				offsets.sourceCodeName = segment.sourceCodeName;
			}

			return encode( arr );
		}).join( ',' );
	}).join( ';' );

	return encoded;
}
