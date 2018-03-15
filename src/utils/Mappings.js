export default function Mappings(hires) {
	let generatedCodeLine = 0;
	let generatedCodeColumn = 0;

	this.raw = [];
	let rawSegments = (this.raw[generatedCodeLine] = []);

	let pending = null;

	this.addEdit = (sourceIndex, content, loc, nameIndex) => {
		if (content.length) {
			const segment = [generatedCodeColumn, sourceIndex, loc.line, loc.column];
			if (nameIndex >= 0) {
				segment.push(nameIndex);
			}
			rawSegments.push(segment);
		} else if (pending) {
			rawSegments.push(pending);
		}

		this.advance(content);
		pending = null;
	};

	this.addUneditedChunk = (sourceIndex, chunk, original, loc, sourcemapLocations) => {
		let originalCharIndex = chunk.start;
		let first = true;

		while (originalCharIndex < chunk.end) {
			if (hires || first || sourcemapLocations[originalCharIndex]) {
				rawSegments.push([generatedCodeColumn, sourceIndex, loc.line, loc.column]);
			}

			if (original[originalCharIndex] === '\n') {
				loc.line += 1;
				loc.column = 0;
				generatedCodeLine += 1;
				this.raw[generatedCodeLine] = rawSegments = [];
				generatedCodeColumn = 0;
			} else {
				loc.column += 1;
				generatedCodeColumn += 1;
			}

			originalCharIndex += 1;
			first = false;
		}

		pending = [generatedCodeColumn, sourceIndex, loc.line, loc.column];
	};

	this.advance = str => {
		if (!str) return;

		const lines = str.split('\n');

		if (lines.length > 1) {
			for (let i = 0; i < lines.length - 1; i++) {
				generatedCodeLine++;
				this.raw[generatedCodeLine] = rawSegments = [];
			}
			generatedCodeColumn = 0;
		}

		generatedCodeColumn += lines[lines.length - 1].length;
	};
}
