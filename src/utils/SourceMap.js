import btoa from './btoa.js';
import { encode } from 'sourcemap-codec';

export default function SourceMap(properties) {
	this.version = 3;

	this.file = properties.file;
	this.sources = properties.sources;
	this.sourcesContent = properties.sourcesContent;
	this.names = properties.names;
	this.mappings = encode(properties.mappings);
}

SourceMap.prototype = {
	toString() {
		return JSON.stringify(this);
	},

	toUrl() {
		return 'data:application/json;charset=utf-8;base64,' + btoa(this.toString());
	}
};
