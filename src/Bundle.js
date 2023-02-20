import MagicString from './MagicString.js';
import SourceMap from './SourceMap.js';
import getRelativePath from './utils/getRelativePath.js';
import isObject from './utils/isObject.js';
import getLocator from './utils/getLocator.js';
import Mappings from './utils/Mappings.js';

const hasOwnProp = Object.prototype.hasOwnProperty;

export default class Bundle {
	constructor(options = {}) {
		this.intro = options.intro || '';
		this.separator = options.separator !== undefined ? options.separator : '\n';
		this.sources = [];
		this.uniqueSources = [];
		this.uniqueSourceIndexByFilename = {};
	}

	addSource(source) {
		if (source instanceof MagicString) {
			return this.addSource({
				content: source,
				filename: source.filename,
				separator: this.separator,
			});
		}

		if (!isObject(source) || !source.content) {
			throw new Error(
				'bundle.addSource() takes an object with a `content` property, which should be an instance of MagicString, and an optional `filename`'
			);
		}

		['filename', 'ignoreList', 'indentExclusionRanges', 'separator'].forEach((option) => {
			if (!hasOwnProp.call(source, option)) source[option] = source.content[option];
		});

		if (source.separator === undefined) {
			// TODO there's a bunch of this sort of thing, needs cleaning up
			source.separator = this.separator;
		}

		if (source.filename) {
			if (!hasOwnProp.call(this.uniqueSourceIndexByFilename, source.filename)) {
				this.uniqueSourceIndexByFilename[source.filename] = this.uniqueSources.length;
				this.uniqueSources.push({ filename: source.filename, content: source.content.original });
			} else {
				const uniqueSource = this.uniqueSources[this.uniqueSourceIndexByFilename[source.filename]];
				if (source.content.original !== uniqueSource.content) {
					throw new Error(`Illegal source: same filename (${source.filename}), different contents`);
				}
			}
		}

		this.sources.push(source);
		return this;
	}

	append(str, options) {
		this.addSource({
			content: new MagicString(str),
			separator: (options && options.separator) || '',
		});

		return this;
	}

	clone() {
		const bundle = new Bundle({
			intro: this.intro,
			separator: this.separator,
		});

		this.sources.forEach((source) => {
			bundle.addSource({
				filename: source.filename,
				content: source.content.clone(),
				separator: source.separator,
			});
		});

		return bundle;
	}

	generateDecodedMap(options = {}) {
		const names = [];
		let x_google_ignoreList = undefined;
		this.sources.forEach((source) => {
			Object.keys(source.content.storedNames).forEach((name) => {
				if (!~names.indexOf(name)) names.push(name);
			});
		});

		const mappings = new Mappings(options.hires);

		if (this.intro) {
			mappings.advance(this.intro);
		}

		this.sources.forEach((source, i) => {
			if (i > 0) {
				mappings.advance(this.separator);
			}

			const sourceIndex = source.filename ? this.uniqueSourceIndexByFilename[source.filename] : -1;
			const magicString = source.content;
			const locate = getLocator(magicString.original);

			if (magicString.intro) {
				mappings.advance(magicString.intro);
			}

			magicString.firstChunk.eachNext((chunk) => {
				const loc = locate(chunk.start);

				if (chunk.intro.length) mappings.advance(chunk.intro);

				if (source.filename) {
					if (chunk.edited) {
						mappings.addEdit(
							sourceIndex,
							chunk.content,
							loc,
							chunk.storeName ? names.indexOf(chunk.original) : -1
						);
					} else {
						mappings.addUneditedChunk(
							sourceIndex,
							chunk,
							magicString.original,
							loc,
							magicString.sourcemapLocations
						);
					}
				} else {
					mappings.advance(chunk.content);
				}

				if (chunk.outro.length) mappings.advance(chunk.outro);
			});

			if (magicString.outro) {
				mappings.advance(magicString.outro);
			}

			if (source.ignoreList && sourceIndex !== -1) {
				if (x_google_ignoreList === undefined) {
					x_google_ignoreList = [];
				}
				x_google_ignoreList.push(sourceIndex);
			}
		});

		return {
			file: options.file ? options.file.split(/[/\\]/).pop() : undefined,
			sources: this.uniqueSources.map((source) => {
				return options.file ? getRelativePath(options.file, source.filename) : source.filename;
			}),
			sourcesContent: this.uniqueSources.map((source) => {
				return options.includeContent ? source.content : null;
			}),
			names,
			mappings: mappings.raw,
			x_google_ignoreList,
		};
	}

	generateMap(options) {
		return new SourceMap(this.generateDecodedMap(options));
	}

	getIndentString() {
		const indentStringCounts = {};

		this.sources.forEach((source) => {
			const indentStr = source.content._getRawIndentString();

			if (indentStr === null) return;

			if (!indentStringCounts[indentStr]) indentStringCounts[indentStr] = 0;
			indentStringCounts[indentStr] += 1;
		});

		return (
			Object.keys(indentStringCounts).sort((a, b) => {
				return indentStringCounts[a] - indentStringCounts[b];
			})[0] || '\t'
		);
	}

	indent(indentStr) {
		if (!arguments.length) {
			indentStr = this.getIndentString();
		}

		if (indentStr === '') return this; // noop

		let trailingNewline = !this.intro || this.intro.slice(-1) === '\n';

		this.sources.forEach((source, i) => {
			const separator = source.separator !== undefined ? source.separator : this.separator;
			const indentStart = trailingNewline || (i > 0 && /\r?\n$/.test(separator));

			source.content.indent(indentStr, {
				exclude: source.indentExclusionRanges,
				indentStart, //: trailingNewline || /\r?\n$/.test( separator )  //true///\r?\n/.test( separator )
			});

			trailingNewline = source.content.lastChar() === '\n';
		});

		if (this.intro) {
			this.intro =
				indentStr +
				this.intro.replace(/^[^\n]/gm, (match, index) => {
					return index > 0 ? indentStr + match : match;
				});
		}

		return this;
	}

	prepend(str) {
		this.intro = str + this.intro;
		return this;
	}

	toString() {
		const body = this.sources
			.map((source, i) => {
				const separator = source.separator !== undefined ? source.separator : this.separator;
				const str = (i > 0 ? separator : '') + source.content.toString();

				return str;
			})
			.join('');

		return this.intro + body;
	}

	isEmpty() {
		if (this.intro.length && this.intro.trim()) return false;
		if (this.sources.some((source) => !source.content.isEmpty())) return false;
		return true;
	}

	length() {
		return this.sources.reduce(
			(length, source) => length + source.content.length(),
			this.intro.length
		);
	}

	trimLines() {
		return this.trim('[\\r\\n]');
	}

	trim(charType) {
		return this.trimStart(charType).trimEnd(charType);
	}

	trimStart(charType) {
		const rx = new RegExp('^' + (charType || '\\s') + '+');
		this.intro = this.intro.replace(rx, '');

		if (!this.intro) {
			let source;
			let i = 0;

			do {
				source = this.sources[i++];
				if (!source) {
					break;
				}
			} while (!source.content.trimStartAborted(charType));
		}

		return this;
	}

	trimEnd(charType) {
		const rx = new RegExp((charType || '\\s') + '+$');

		let source;
		let i = this.sources.length - 1;

		do {
			source = this.sources[i--];
			if (!source) {
				this.intro = this.intro.replace(rx, '');
				break;
			}
		} while (!source.content.trimEndAborted(charType));

		return this;
	}
}
