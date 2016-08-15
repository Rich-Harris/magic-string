import { encode } from 'vlq';
import getSemis from './getSemis.js';
import getLocator from './getLocator.js';

const nonWhitespace = /\S/;

export default function generateMappings ( original, intro, outro, chunk, hires, sourcemapLocations, sourceIndex, names ) {
	const rawLines = intro.split( '\n' ).map( () => [] );
	let generatedCodeLine = rawLines.length - 1;

	let rawSegments = rawLines[ generatedCodeLine ];

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

	return rawLines.map( segments => {
		return segments.map( segment => {
			const arr = [
				segment.generatedCodeColumn,
				segment.sourceIndex,
				segment.sourceCodeLine,
				segment.sourceCodeColumn
			];

			if ( ~segment.sourceCodeName ) {
				arr.push( segment.sourceCodeName );
			}

			return arr;
		});
	}).concat( outro.split( '\n' ).map( () => [] ).slice( 1 ) );
}
