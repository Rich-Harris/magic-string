import btoa from '../utils/btoa';

var SourceMap = function ( properties ) {
	this.version = 3;

	this.file           = properties.file;
	this.sources        = properties.sources;
	this.sourcesContent = properties.sourcesContent;
	this.names          = properties.names;
	this.mappings       = properties.mappings;
};

SourceMap.prototype = {
	toString: function () {
		return JSON.stringify( this );
	},

	toUrl: function () {
		return 'data:application/json;charset=utf-8;base64,' + btoa( this.toString() );
	}
};

export default SourceMap;