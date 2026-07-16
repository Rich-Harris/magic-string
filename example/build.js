import fs from 'node:fs';
import process from 'node:process';

async function main() {
	const { default: MagicString } = await import('../dist/index.mjs');

	process.chdir(import.meta.dirname);

	const result = await fs.promises.readFile('app.source.js', 'utf-8');
	const source = result.toString();
	const magicString = new MagicString(source);

	const pattern = /foo/g;
	while (true) {
		const match = pattern.exec(source);
		if (!match) break;

		magicString.overwrite(match.index, match.index + 3, 'answer');
	}

	const transpiled = `${magicString.toString()}\n//# sourceMappingURL=app.js.map`;
	const map = magicString.generateMap({
		file: 'app.js.map',
		source: 'app.source.js',
		includeContent: true,
		hires: true,
	});

	fs.writeFileSync('app.js', transpiled);
	fs.writeFileSync('app.js.map', JSON.stringify(map));
	fs.writeFileSync('app.inlinemap.js', `${transpiled}\n//#sourceMappingURL=${map.toUrl()}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
