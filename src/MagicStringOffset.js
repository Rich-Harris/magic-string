import MagicString from './MagicString.js';

export default class MagicStringOffset {
	constructor(
		str,
		options = {},
		prototype = typeof str === 'string' ? MagicString : str.constructor,
	) {
		this.s = typeof str === 'string' ? new prototype(str, options) : str;
		this.offset = options.offset || 0;
		this.prototype = prototype;

		return new Proxy(this.s, {
			get: (target, p, receiver) => {
				if (Reflect.has(this, p)) return Reflect.get(this, p, receiver);

				let result = Reflect.get(target, p, receiver);
				if (typeof result === 'function') result = result.bind(target);
				return result;
			},
			set: (target, p, value, receiver) => {
				if (Reflect.has(this, p)) return Reflect.set(this, p, value);

				return Reflect.set(target, p, value, receiver);
			},
		});
	}

	appendLeft(index, content) {
		this.s.appendLeft(index + this.offset, content);
		return this;
	}

	prependLeft(index, content) {
		this.s.prependLeft(index + this.offset, content);
		return this;
	}

	appendRight(index, content) {
		this.s.appendRight(index + this.offset, content);
		return this;
	}

	prependRight(index, content) {
		this.s.prependRight(index + this.offset, content);
		return this;
	}

	move(start, end, index) {
		this.s.move(start + this.offset, end + this.offset, index);
		return this;
	}

	overwrite(start, end, content, options) {
		this.s.overwrite(start + this.offset, end + this.offset, content, options);
		return this;
	}

	update(start, end, content, options) {
		this.s.update(start + this.offset, end + this.offset, content, options);
		return this;
	}

	remove(start, end) {
		this.s.remove(start + this.offset, end + this.offset);
		return this;
	}

	reset(start, end) {
		this.s.reset(start + this.offset, end + this.offset);
		return this;
	}

	slice(start = 0, end = this.s.original.length - this.offset) {
		return this.s.slice(start + this.offset, end + this.offset);
	}

	snip(start, end) {
		let newS = this.s.snip(start + this.offset, end + this.offset);
		return new MagicStringOffset(newS, { offset: this.offset }, this.prototype);
	}

	clone() {
		return new MagicStringOffset(this.s.clone(), { offset: this.offset }, this.prototype);
	}

	toString() {
		return this.s.toString();
	}
}
