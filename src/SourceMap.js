import { encode } from '@jridgewell/sourcemap-codec';

let btoa = () => {
	throw new Error('Unsupported environment: `window.btoa` or `Buffer` should be supported.');
};
if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
	btoa = (str) => window.btoa(unescape(encodeURIComponent(str)));
} else if (typeof Buffer === 'function') {
	btoa = (str) => Buffer.from(str, 'utf-8').toString('base64');
}

export default class SourceMap {
	constructor(properties) {
		this.version = 3;
		this.file = properties.file;
		this.sources = properties.sources;
		this.sourcesContent = properties.sourcesContent;
		this.names = properties.names;
		this.mappings = encode(properties.mappings);
	}

	toString() {
		return JSON.stringify(this);
	}

	toUrl() {
		return 'data:application/json;charset=utf-8;base64,' + btoa(this.toString());
	}
}
