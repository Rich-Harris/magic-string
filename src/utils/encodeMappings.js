import { encode } from 'vlq';

export default function encodeMappings ( original, str, mappings, hires, sourcemapLocations, sourceIndex, offsets, names, nameLocations ) {
	// store locations, for fast lookup
	let lineStart = 0;
	const locations = original.split( '\n' ).map( line => {
		const start = lineStart;
		lineStart += line.length + 1; // +1 for the newline

		return start;
	});

	const inverseMappings = invert( str, mappings );

	let charOffset = 0;
	const lines = str.split( '\n' ).map( line => {
		let segments = [];

		let char; // TODO put these inside loop, once we've determined it's safe to do so transpilation-wise
		let origin;
		let lastOrigin = -1;
		let location;
		let nameIndex;

		let i;

		const len = line.length;
		for ( i = 0; i < len; i += 1 ) {
			char = i + charOffset;
			origin = inverseMappings[ char ];

			nameIndex = -1;
			location = null;

			// if this character has no mapping, but the last one did,
			// create a new segment
			if ( !~origin && ~lastOrigin ) {
				location = getLocation( locations, lastOrigin + 1 );

				if ( ( lastOrigin + 1 ) in nameLocations ) nameIndex = names.indexOf( nameLocations[ lastOrigin + 1 ] );
			}

			else if ( ~origin && ( hires || ( ~lastOrigin && origin !== lastOrigin + 1 ) || sourcemapLocations[ origin ] ) ) {
				location = getLocation( locations, origin );
			}

			if ( location ) {
				segments.push({
					generatedCodeColumn: i,
					sourceIndex,
					sourceCodeLine: location.line,
					sourceCodeColumn: location.column,
					sourceCodeName: nameIndex
				});
			}

			lastOrigin = origin;
		}

		charOffset += line.length + 1;
		return segments;
	});

	offsets.sourceIndex = offsets.sourceIndex || 0;
	offsets.sourceCodeLine = offsets.sourceCodeLine || 0;
	offsets.sourceCodeColumn = offsets.sourceCodeColumn || 0;
	offsets.sourceCodeName = offsets.sourceCodeName || 0;

	const encoded = lines.map( segments => {
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


function invert ( str, mappings ) {
	let inverted = new Uint32Array( str.length );

	// initialise everything to -1
	let i = str.length;
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
	let i = locations.length;
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
