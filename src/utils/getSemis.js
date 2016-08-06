export default function getSemis ( str ) {
	return new Array( str.split( '\n' ).length ).join( ';' );
}
