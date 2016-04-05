export default function Chunk ( start, end, content ) {
	this.start = start;
	this.end = end;
	this.original = content;

	this.content = content;
	this.storeName = false;
	this.edited = false;
}

Chunk.prototype = {
	clone () {
		const chunk = new Chunk( this.start, this.end, this.original );
		chunk.content = this.content;
		chunk.storeName = this.storeName;
		chunk.edited = this.edited;

		return chunk;
	},

	edit ( content, storeName ) {
		this.content = content;
		this.storeName = storeName;

		this.edited = true;

		return this;
	},

	split ( index ) {
		if ( this.edited ) throw new Error( `Cannot split a chunk that has already been edited ("${this.original}")` );

		if ( index === this.start ) return this;

		const sliceIndex = index - this.start;
		const before = this.content.slice( 0, sliceIndex );
		const after = this.content.slice( sliceIndex );

		const newChunk = new Chunk( index, this.end, after );

		this.end = index;
		this.original = this.content = before;

		return newChunk;
	}
};
