import { encode } from 'vlq';

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

	this.raw = [];
	let rawSegments = this.raw[ generatedCodeLine ] = [];

	let pending = null;

	this.addEdit = ( sourceIndex, content, original, loc, nameIndex ) => {
		if ( content.length ) {
			rawSegments.push({
				generatedCodeColumn,
				sourceCodeLine: loc.line,
				sourceCodeColumn: loc.column,
				sourceCodeName: nameIndex,
				sourceIndex
			});
		} else if ( pending ) {
			rawSegments.push( pending );
		}

		this.advance( content );
		pending = null;
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

		pending = {
			generatedCodeColumn,
			sourceCodeLine: loc.line,
			sourceCodeColumn: loc.column,
			sourceCodeName: -1,
			sourceIndex
		};
	};

	this.advance = str => {
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
