const fs = require( 'fs' );

const index = fs.readFileSync( 'src/index.js', 'utf-8' );

setInterval( () => {
	fs.writeFileSync( 'src/index.js', index.replace( /x_.*/, `x_${Math.random()}` ) );
}, 200 );
