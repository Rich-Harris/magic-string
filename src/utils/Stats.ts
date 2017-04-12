export default class Stats {
	startTimes: {}

	constructor () {
		Object.defineProperties( this, {
			startTimes: { value: {} }
		});
	}

	time ( label: string ) {
		this.startTimes[ label ] = process.hrtime();
	}

	timeEnd ( label: string ) {
		const elapsed = process.hrtime( this.startTimes[ label ] );

		if ( !this[ label ] ) this[ label ] = 0;
		this[ label ] += elapsed[0] * 1e3 + elapsed[1] * 1e-6;
	}
}
