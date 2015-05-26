import btoa from './btoa';

class SourceMap {
	constructor ( properties ) {
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
}

export default SourceMap;
