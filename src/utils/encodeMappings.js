import { encode } from 'vlq';

export default function encodeMappings ( original, intro, patches, hires, sourcemapLocations, sourceIndex, offsets, names ) {
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

	for ( let i = 0; i < patches.length; i += 1 ) {
		const patch = patches[i];
		const addSegmentForPatch = patch.storeName || patch.start > originalCharIndex;

		addSegmentsUntil( patch.start );

		if ( addSegmentForPatch ) {
			rawSegments.push({
				generatedCodeLine,
				generatedCodeColumn,
				sourceCodeLine,
				sourceCodeColumn,
				sourceCodeName: patch.storeName ? names.indexOf( patch.original ) : -1,
				sourceIndex
			});
		}

		let lines = patch.content.split( '\n' );
		let lastLine = lines.pop();

		if ( lines.length ) {
			generatedCodeLine += lines.length;
			rawLines[ generatedCodeLine ] = rawSegments = [];
			generatedCodeColumn = lastLine.length;
		} else {
			generatedCodeColumn += lastLine.length;
		}

		lines = patch.original.split( '\n' );
		lastLine = lines.pop();

		if ( lines.length ) {
			sourceCodeLine += lines.length;
			sourceCodeColumn = lastLine.length;
		} else {
			sourceCodeColumn += lastLine.length;
		}

		originalCharIndex = patch.end;
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
