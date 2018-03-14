import { encode } from 'sourcemap-codec';

export default function Mappings ( hires ) {
	let generatedCodeLine = 0;
	let generatedCodeColumn = 0;

	this.raw = [];
	let rawSegments = this.raw[ generatedCodeLine ] = [];

	let pending = null;

	this.addEdit = ( sourceIndex, content, original, loc, nameIndex ) => {
		if ( content.length ) {
			const segment = [
				generatedCodeColumn,
				sourceIndex,
				loc.line,
				loc.column
			];
			if ( nameIndex >= 0 ) {
				segment.push( nameIndex );
			}
			rawSegments.push( segment );
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
			if ( hires || first || sourcemapLocations[ originalCharIndex ] ) {
				rawSegments.push([
					generatedCodeColumn,
					sourceIndex,
					loc.line,
					loc.column
				]);
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

		pending = [
			generatedCodeColumn,
			sourceIndex,
			loc.line,
			loc.column
		];
	};

	this.advance = str => {
		if ( !str ) return;

		const lines = str.split( '\n' );
		const lastLine = lines.pop();

		if ( lines.length ) {
			for ( let i = 0; i < lines.length; i++ ) {
				generatedCodeLine++;
				this.raw[generatedCodeLine] = rawSegments = [];
			}
			generatedCodeColumn = lastLine.length;
		} else {
			generatedCodeColumn += lastLine.length;
		}
	};

	this.encode = () => {
		return encode(this.raw);
	};
}
