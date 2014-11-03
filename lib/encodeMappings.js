var vlq = require( 'vlq' );

module.exports = function encodeMappings ( original, str, mappings, hires ) {
	var lineStart,
		locations,
		lines,
		encoded,
		inverseMappings,
		charOffset = 0,
		sourceCodeLine,
		sourceCodeColumn;

	// store locations, for fast lookup
	lineStart = 0;
	locations = original.split( '\n' ).map( function ( line ) {
		var start = lineStart;
		lineStart += line.length + 1; // +1 for the newline

		return start;
	});

	inverseMappings = invert( str, mappings );

	lines = str.split( '\n' ).map( function ( line, lineIndex ) {
		var segments, segment, len, char, origin, lastOrigin, i, sourceCodeLine, sourceCodeColumn;

		segments = [];

		len = line.length;
		for ( i = 0; i < len; i += 1 ) {
			char = i + charOffset;
			origin = inverseMappings[ char ];

			if ( origin === -1 ) {
				if ( lastOrigin === -1 ) {
					// do nothing
				} else {
					segments.push({
						generatedCodeColumn: i,
						sourceCodeLine: 0,
						sourceCodeColumn: 0
					});
				}
			}

			else {
				if ( !hires && ( origin === lastOrigin + 1 ) ) {
					// do nothing
				} else {
					location = getLocation( locations, origin );

					segments.push({
						generatedCodeColumn: i,
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

	sourceCodeLine = 0;
	sourceCodeColumn = 0;

	encoded = lines.map( function ( segments ) {
		var generatedCodeColumn = 0;

		return segments.map( function ( segment ) {
			var arr = [
				segment.generatedCodeColumn - generatedCodeColumn,
				0,
				segment.sourceCodeLine - sourceCodeLine,
				segment.sourceCodeColumn - sourceCodeColumn
			];

			generatedCodeColumn = segment.generatedCodeColumn;
			sourceCodeLine = segment.sourceCodeLine;
			sourceCodeColumn = segment.sourceCodeColumn;

			return vlq.encode( arr );
		}).join( ',' );
	}).join( ';' );

	return encoded;
};


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
	var i, len = locations.length;

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