import { encode } from '@jridgewell/sourcemap-codec';

function getBtoa () {
	if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
		return (str) => window.btoa(unescape(encodeURIComponent(str)));
	} else if (typeof Buffer === 'function') {
		return (str) => Buffer.from(str, 'utf-8').toString('base64');
	} else {
		return () => {
			throw new Error('Unsupported environment: `window.btoa` or `Buffer` should be supported.');
		};
	}
}

const btoa = /*#__PURE__*/ getBtoa();

export default class SourceMap {
	constructor(properties) {
		this.version = 3;
		this.file = properties.file;
		this.sources = properties.sources;
		this.sourcesContent = properties.sourcesContent;
		this.names = properties.names;
		this.mappings = encode(properties.mappings);
		if (typeof properties.x_google_ignoreList !== 'undefined') {
			this.x_google_ignoreList = properties.x_google_ignoreList;
		}
	}

	toString() {
		return JSON.stringify(this);
	}

	toUrl() {
		return 'data:application/json;charset=utf-8;base64,' + btoa(this.toString());
	}
}
