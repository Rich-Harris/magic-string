import btoa from './btoa';

interface SourceMapProperties {
	file: string
	sources: string[]
	sourcesContent: string[]
	names: string[]
	mappings: string
}

export default class SourceMap {
	version: number
	file: string
	sources: string[]
	sourcesContent: string[]
	names: string[]
	mappings: string

	constructor ( properties: SourceMapProperties ) {
		this.version = 3;

		this.file           = properties.file;
		this.sources        = properties.sources;
		this.sourcesContent = properties.sourcesContent;
		this.names          = properties.names;
		this.mappings       = properties.mappings;
	}

	toString () {
		return JSON.stringify( this );
	}

	toUrl () {
		return 'data:application/json;charset=utf-8;base64,' + btoa( this.toString() );
	}
};
