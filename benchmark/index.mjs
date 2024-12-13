import Benchmark from 'benchmark';
import MagicString from '../dist/magic-string.es.mjs';
import fs from 'fs/promises';

Benchmark.support.decompilation = false;

console.log(`node ${process.version}\n`);

function runWithInstance(name, inputs, func, setup) {
	const ss = [];
	new Benchmark(name, {
		setup: () => {
			for (const [i, input] of inputs.entries()) {
				ss[i] = new MagicString(input);
				if (setup) {
					setup(ss[i]);
				}
			}
		},
		fn: () => {
			for (const i of inputs.keys()) {
				func(ss[i]);
			}
		},
	})
		.on('complete', (event) => {
			console.log(String(event.target));
		})
		.on('error', (event) => {
			console.error(event.target.error);
		})
		.run();
}

async function bench() {
	const inputs = await Promise.all(
		['data.js', 'data-min.js'].map((file) => fs.readFile(new URL(file, import.meta.url), 'utf-8')),
	);

	new Benchmark('construct', {
		fn: () => {
			for (const input of inputs) {
				new MagicString(input);
			}
		},
	})
		.on('complete', (event) => {
			console.log(String(event.target));
		})
		.on('error', (event) => {
			console.error(event.target.error);
		})
		.run();

	runWithInstance('append', inputs, (s) => {
		s.append(';"append";');
	});
	runWithInstance('indent', inputs, (s) => {
		s.indent();
	});

	runWithInstance('generateMap (no edit)', inputs, (s) => {
		s.generateMap();
	});
	runWithInstance(
		'generateMap (edit)',
		inputs,
		(s) => {
			s.generateMap();
		},
		(s) => {
			s.replace(/replacement/g, 'replacement\nReplacement');
		},
	);

	runWithInstance('generateDecodedMap (no edit)', inputs, (s) => {
		s.generateDecodedMap();
	});
	runWithInstance(
		'generateDecodedMap (edit)',
		inputs,
		(s) => {
			s.generateDecodedMap();
		},
		(s) => {
			s.replace(/replacement/g, 'replacement\nReplacement');
		},
	);

	const size = 1000000;
	runWithInstance('overwrite', ['a'.repeat(size)], (s) => {
		for (let i = 1; i < size; i += 2) {
			s.overwrite(i, i + 1, 'b');
		}
	});
}

bench();
