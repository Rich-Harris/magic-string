export default function Patch ( start, end, content, original ) {
	this.start = start;
	this.end = end;
	this.content = content;
	this.original = original || null;
}

Patch.prototype = {
	clone () {
		return new Patch( this.start, this.end, this.content, this.original );
	}
};
