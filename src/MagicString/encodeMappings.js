import { encode } from 'vlq';

export default function encodeMappings ( original, str, mappings, hires, sourcemapLocations, sourceIndex, offsets ) {
	// store locations, for fast lookup
	let lineStart = 0;
	const locations = original.split( '\n' ).map( line => {
		var start = lineStart;
		lineStart += line.length + 1; // +1 for the newline

		return start;
	});

	const inverseMappings = invert( str, mappings );

	let charOffset = 0;
	const lines = str.split( '\n' ).map( line => {
		let segments = [];

		let char; // TODO put these inside loop, once we've determined it's safe to do so transpilation-wise
		let origin;
		let lastOrigin;
		let location;

		let i;

		const len = line.length;
		for ( i = 0; i < len; i += 1 ) {
			char = i + charOffset;
			origin = inverseMappings[ char ];

			if ( !~origin ) {
				if ( !~lastOrigin ) {
					// do nothing
				} else {
					segments.push({
						generatedCodeColumn: i,
						sourceIndex: sourceIndex,
						sourceCodeLine: 0,
						sourceCodeColumn: 0
					});
				}
			}

			else {
				if ( !hires && ( origin === lastOrigin + 1 ) && !sourcemapLocations[ origin ] ) {
					// do nothing
				} else {
					location = getLocation( locations, origin );

					segments.push({
						generatedCodeColumn: i,
						sourceIndex: sourceIndex,
						sourceCodeLine: location.line,
						sourceCodeColumn: location.column
					});
				}
			}

			lastOrigin = origin;
		}

		charOffset += line.length + 1;
		return segments;
	});

	offsets = offsets || {};

	offsets.sourceIndex = offsets.sourceIndex || 0;
	offsets.sourceCodeLine = offsets.sourceCodeLine || 0;
	offsets.sourceCodeColumn = offsets.sourceCodeColumn || 0;

	const encoded = lines.map( segments => {
		var generatedCodeColumn = 0;

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

			return encode( arr );
		}).join( ',' );
	}).join( ';' );

	return encoded;
}


function invert ( str, mappings ) {
	var inverted = new Uint32Array( str.length ), i;

	// initialise everything to -1
	i = str.length;
	while ( i-- ) {
		inverted[i] = -1;
	}

	// then apply the actual mappings
	i = mappings.length;
	while ( i-- ) {
		if ( ~mappings[i] ) {
			inverted[ mappings[i] ] = i;
		}
	}

	return inverted;
}

function getLocation ( locations, char ) {
	var i;

	i = locations.length;
	while ( i-- ) {
		if ( locations[i] <= char ) {
			return {
				line: i,
				column: char - locations[i]
			};
		}
	}

	throw new Error( 'Character out of bounds' );
}
