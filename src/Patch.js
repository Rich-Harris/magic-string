export default function Patch ( start, end, content, original, storeName ) {
	this.start = start;
	this.end = end;
	this.content = content;
	this.original = original || null;

	this.storeName = true;
}

Patch.prototype = {
	clone () {
		return new Patch( this.start, this.end, this.content, this.original );
	}
};
