import { encode } from 'vlq';
import getSemis from './getSemis.js';
import getLocator from './getLocator.js';

const nonWhitespace = /\S/;

export default function encodeMappings ( original, intro, outro, chunk, hires, sourcemapLocations, sourceIndex, offsets, names ) {
	const rawLines = [];

	let generatedCodeLine = intro.split( '\n' ).length - 1;
	let rawSegments = rawLines[ generatedCodeLine ] = [];

	let generatedCodeColumn = 0;

	const locate = getLocator( original );

	function addEdit ( content, original, loc, nameIndex, i ) {
		if ( i || ( content.length && nonWhitespace.test( content ) ) ) {
			rawSegments.push({
				generatedCodeLine,
				generatedCodeColumn,
				sourceCodeLine: loc.line,
				sourceCodeColumn: loc.column,
				sourceCodeName: nameIndex,
				sourceIndex
			});
		}

		let lines = content.split( '\n' );
		let lastLine = lines.pop();

		if ( lines.length ) {
			generatedCodeLine += lines.length;
			rawLines[ generatedCodeLine ] = rawSegments = [];
			generatedCodeColumn = lastLine.length;
		} else {
			generatedCodeColumn += lastLine.length;
		}

		lines = original.split( '\n' );
		lastLine = lines.pop();

		if ( lines.length ) {
			loc.line += lines.length;
			loc.column = lastLine.length;
		} else {
			loc.column += lastLine.length;
		}
	}

	function addUneditedChunk ( chunk, loc ) {
		let originalCharIndex = chunk.start;
		let first = true;

		while ( originalCharIndex < chunk.end ) {
			if ( hires || first || sourcemapLocations[ originalCharIndex ] ) {
				rawSegments.push({
					generatedCodeLine,
					generatedCodeColumn,
					sourceCodeLine: loc.line,
					sourceCodeColumn: loc.column,
					sourceCodeName: -1,
					sourceIndex
				});
			}

			if ( original[ originalCharIndex ] === '\n' ) {
				loc.line += 1;
				loc.column = 0;
				generatedCodeLine += 1;
				rawLines[ generatedCodeLine ] = rawSegments = [];
				generatedCodeColumn = 0;
			} else {
				loc.column += 1;
				generatedCodeColumn += 1;
			}

			originalCharIndex += 1;
			first = false;
		}
	}

	let hasContent = false;

	while ( chunk ) {
		const loc = locate( chunk.start );

		if ( chunk.intro.length ) {
			addEdit( chunk.intro, '', loc, -1, hasContent );
		}

		if ( chunk.edited ) {
			addEdit( chunk.content, chunk.original, loc, chunk.storeName ? names.indexOf( chunk.original ) : -1, hasContent );
		} else {
			addUneditedChunk( chunk, loc );
		}

		if ( chunk.outro.length ) {
			addEdit( chunk.outro, '', loc, -1, hasContent );
		}

		if ( chunk.content || chunk.intro || chunk.outro ) hasContent = true;

		const nextChunk = chunk.next;
		chunk = nextChunk;
	}

	offsets.sourceIndex = offsets.sourceIndex || 0;
	offsets.sourceCodeLine = offsets.sourceCodeLine || 0;
	offsets.sourceCodeColumn = offsets.sourceCodeColumn || 0;
	offsets.sourceCodeName = offsets.sourceCodeName || 0;

	return rawLines.map( (segments, generatedLine) => {
		let generatedCodeColumn = 0;

// 		console.log('Generated line:', generatedLine);

		let validSegments = [];
		let prevSegment;

		for (let i=0; i<segments.length; i++) {
			let currSegment = segments[i]

			// Skip segment if it adds the same number of characters exactly after the last segment
			if (prevSegment &&
				prevSegment.sourceCodeLine === currSegment.sourceCodeLine &&
				prevSegment.generatedCodeLine === currSegment.generatedCodeLine &&
				currSegment.sourceCodeColumn - prevSegment.sourceCodeColumn === currSegment.generatedCodeColumn - prevSegment.generatedCodeColumn ) {

				// noop

			} else {
				validSegments.push(prevSegment);
				prevSegment = currSegment;
			}
		}
		validSegments.push(prevSegment);
		validSegments.shift();


		return validSegments.map( (segment) => {

// 			console.log('segment: ', segment.sourceCodeLine, ',', segment.sourceCodeColumn, '→', generatedLine, ',', segment.generatedCodeColumn, ' (', segment.sourceIndex, ')');

			const arr = [
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
	}).join( ';' ) + getSemis(outro);
}
