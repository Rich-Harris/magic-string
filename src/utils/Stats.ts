import process from 'node:process';

export default class Stats {
	declare startTimes: Record<string, [number, number]>;
	[label: string]: unknown;

	constructor() {
		Object.defineProperties(this, {
			startTimes: { value: {} },
		});
	}

	time(label: string): void {
		this.startTimes[label] = process.hrtime();
	}

	timeEnd(label: string): void {
		const elapsed = process.hrtime(this.startTimes[label]);

		if (!this[label]) this[label] = 0;
		this[label] = (this[label] as number) + elapsed[0] * 1e3 + elapsed[1] * 1e-6;
	}
}
