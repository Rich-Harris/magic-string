export default class BitSet {
	constructor(arg) {
		this.bits = arg instanceof BitSet ? arg.bits.slice() : [];
	}

	add(n) {
		this.bits[Math.floor(n / BITS)] |= 1 << n % BITS;
	}

	has(n) {
		return !!(this.bits[Math.floor(n / BITS)] & (1 << n % BITS));
	}
}

const BITS = 32;
