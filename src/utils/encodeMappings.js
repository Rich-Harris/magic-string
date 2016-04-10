import { encode } from 'vlq';

function getLocator ( source ) {
	let originalLines = source.split( '\n' );

	return function locate ( index ) {
		const len = originalLines.length;

		let lineStart = 0;

		for ( let i = 0; i < len; i += 1 ) {
			const line = originalLines[i];
			const lineEnd =  lineStart + line.length + 1; // +1 for newline

			if ( lineEnd > index ) return { line: i, column: index - lineStart };

			lineStart = lineEnd;
		}
	};
}

export default function encodeMappings ( original, intro, chunks, hires, sourcemapLocations, sourceIndex, offsets, names ) {
	let rawLines = [];

	let generatedCodeLine = intro.split( '\n' ).length - 1;
	let rawSegments = rawLines[ generatedCodeLine ] = [];

	let generatedCodeColumn = 0;

	const locate = getLocator( original );

	function addUneditedChunk ( chunk ) {
		let originalCharIndex = chunk.start;
		let first = true;

		let { line, column } = locate( originalCharIndex );

		while ( originalCharIndex < chunk.end ) {
			if ( hires || first || sourcemapLocations[ originalCharIndex ] ) {
				rawSegments.push({
					generatedCodeLine,
					generatedCodeColumn,
					sourceCodeLine: line,
					sourceCodeColumn: column,
					sourceCodeName: -1,
					sourceIndex
				});
			}

			if ( original[ originalCharIndex ] === '\n' ) {
				line += 1;
				column = 0;
				generatedCodeLine += 1;
				rawLines[ generatedCodeLine ] = rawSegments = [];
				generatedCodeColumn = 0;
			} else {
				column += 1;
				generatedCodeColumn += 1;
			}

			originalCharIndex += 1;
			first = false;
		}
	}

	for ( let i = 0; i < chunks.length; i += 1 ) {
		const chunk = chunks[i];
		let { line, column } = locate( chunk.start );

		if ( chunk.edited ) {
			if ( i > 0 || chunk.content.length ) {
				rawSegments.push({
					generatedCodeLine,
					generatedCodeColumn,
					sourceCodeLine: line,
					sourceCodeColumn: column,
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
				line += lines.length;
				column = lastLine.length;
			} else {
				column += lastLine.length;
			}
		} else {
			addUneditedChunk( chunk );
		}
	}

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
