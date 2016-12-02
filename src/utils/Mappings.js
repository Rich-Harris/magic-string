import { encode } from 'vlq';

const nonWhitespace = /\S/;

export default function Mappings ( hires ) {
	const offsets = {
		generatedCodeColumn: 0,
		sourceIndex: 0,
		sourceCodeLine: 0,
		sourceCodeColumn: 0,
		sourceCodeName: 0
	};

	let generatedCodeLine = 0;
	let generatedCodeColumn = 0;
	let hasContent = false;

	this.raw = [];
	let rawSegments = this.raw[ generatedCodeLine ] = [];

	this.addEdit = ( sourceIndex, content, original, loc, nameIndex ) => {
		if ( content.length ) {
			if ( hasContent || ( content.length && nonWhitespace.test( content ) ) ) {
				rawSegments.push({
					generatedCodeColumn,
					sourceCodeLine: loc.line,
					sourceCodeColumn: loc.column,
					sourceCodeName: nameIndex,
					sourceIndex
				});
			}
		}

		let lines = content.split( '\n' );
		let lastLine = lines.pop();

		if ( lines.length ) {
			generatedCodeLine += lines.length;
			this.raw[ generatedCodeLine ] = rawSegments = [];
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

		if ( content ) hasContent = true;
	};

	this.addInsert = str => {
		if ( !str ) return;

		const lines = str.split( '\n' );
		const lastLine = lines.pop();

		if ( lines.length ) {
			generatedCodeLine += lines.length;
			this.raw[ generatedCodeLine ] = rawSegments = [];
			generatedCodeColumn = lastLine.length;
		} else {
			generatedCodeColumn += lastLine.length;
		}
	};

	this.addUneditedChunk = ( sourceIndex, chunk, original, loc, sourcemapLocations ) => {
		let originalCharIndex = chunk.start;
		let first = true;

		while ( originalCharIndex < chunk.end ) {
			if ( sourceIndex !== -1 ) {
				if ( hires || first || sourcemapLocations[ originalCharIndex ] ) {
					rawSegments.push({
						generatedCodeColumn,
						sourceCodeLine: loc.line,
						sourceCodeColumn: loc.column,
						sourceCodeName: -1,
						sourceIndex
					});
				}
			}

			if ( original[ originalCharIndex ] === '\n' ) {
				loc.line += 1;
				loc.column = 0;
				generatedCodeLine += 1;
				this.raw[ generatedCodeLine ] = rawSegments = [];
				generatedCodeColumn = 0;
			} else {
				loc.column += 1;
				generatedCodeColumn += 1;
			}

			originalCharIndex += 1;
			first = false;
		}

		if ( chunk.content ) hasContent = true;
	};

	this.encode = () => {
		return this.raw.map( segments => {
			let generatedCodeColumn = 0;

			return segments.map( segment => {
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
		}).join( ';' );
	};
}
