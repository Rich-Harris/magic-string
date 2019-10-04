export default class Mappings {
	constructor(hires) {
		this.hires = hires;
		this.generatedCodeLine = 0;
		this.generatedCodeColumn = 0;
		this.raw = [];
		this.rawSegments = this.raw[this.generatedCodeLine] = [];
		this.pending = null;
	}

	addEdit(sourceIndex, content, loc, nameIndex) {
		if (content.length) {
			const segment = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];
			if (nameIndex >= 0) {
				segment.push(nameIndex);
			}
			this.rawSegments.push(segment);
		} else if (this.pending) {
			this.rawSegments.push(this.pending);
		}

		this.advance(content);
		this.pending = null;
	}

	addUneditedChunk(sourceIndex, chunk, original, loc, sourcemapLocations) {
		let originalCharIndex = chunk.start;
		let first = true;

		while (originalCharIndex < chunk.end) {
			if (this.hires || first || sourcemapLocations[originalCharIndex]) {
				this.rawSegments.push([this.generatedCodeColumn, sourceIndex, loc.line, loc.column]);
			}

			if (original[originalCharIndex] === '\n') {
				loc.line += 1;
				loc.column = 0;
				this.generatedCodeLine += 1;
				this.raw[this.generatedCodeLine] = this.rawSegments = [];
				this.generatedCodeColumn = 0;
				first = true;
			} else {
				loc.column += 1;
				this.generatedCodeColumn += 1;
				first = false;
			}

			originalCharIndex += 1;
		}

		this.pending = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];
	}

	advance(str) {
		if (!str) return;

		const lines = str.split('\n');

		if (lines.length > 1) {
			for (let i = 0; i < lines.length - 1; i++) {
				this.generatedCodeLine++;
				this.raw[this.generatedCodeLine] = this.rawSegments = [];
			}
			this.generatedCodeColumn = 0;
		}

		this.generatedCodeColumn += lines[lines.length - 1].length;
	}
}
