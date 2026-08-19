import fs from 'node:fs/promises'
import Benchmark from 'benchmark'
import MagicString from '../dist/index.mjs'

Benchmark.support.decompilation = false

const results = []
const total = 10
const isTTY = process.stdout.isTTY
let current = 0

function run(name, options) {
  current++
  const progress = `[${current}/${total}] ${name}`
  if (isTTY) {
    process.stdout.write(`\r\x1b[2K${progress}`)
  }
  else {
    console.log(progress)
  }
  return new Promise((resolve, reject) => {
    new Benchmark(name, options)
      .on('complete', (event) => {
        const { hz, stats } = event.target
        results.push({ name, hz, rme: stats.rme, samples: stats.sample.length })
        resolve()
      })
      .on('error', (event) => {
        reject(event.target.error)
      })
      .run()
  })
}

function runWithInstance(name, inputs, func, setup) {
  const ss = []
  return run(name, {
    setup: () => {
      for (const [i, input] of inputs.entries()) {
        ss[i] = new MagicString(input)
        if (setup) {
          setup(ss[i])
        }
      }
    },
    fn: () => {
      for (const i of inputs.keys()) {
        func(ss[i])
      }
    },
  })
}

function printResults() {
  if (isTTY) {
    process.stdout.write('\r\x1b[2K')
  }
  console.log('')
  const nameWidth = Math.max(...results.map(r => r.name.length), 4)
  const header = `${'name'.padEnd(nameWidth)}  ${'hz'.padStart(20)}  ${'rme'.padStart(8)}  ${'samples'.padStart(7)}`
  console.log(header)
  console.log('-'.repeat(header.length))

  for (const { name, hz, rme, samples } of results) {
    const hzStr = hz.toLocaleString('en-US', { maximumFractionDigits: 2 })
    console.log(
      `${name.padEnd(nameWidth)}  ${hzStr.padStart(20)}  ${(`±${rme.toFixed(2)}%`).padStart(8)}  ${String(samples).padStart(7)}`,
    )
  }
}

async function bench() {
  const inputs = await Promise.all(
    ['data.js', 'data-min.js'].map(file => fs.readFile(new URL(file, import.meta.url), 'utf-8')),
  )

  console.log(`node ${process.version}`)

  await run('construct', {
    fn: () => {
      for (const input of inputs) {
        new MagicString(input)
      }
    },
  })

  await runWithInstance('append', inputs, (s) => {
    s.append(';"append";')
  })
  await runWithInstance('indent', inputs, (s) => {
    s.indent()
  })

  await runWithInstance('generateMap (no edit)', inputs, (s) => {
    s.generateMap()
  })
  await runWithInstance(
    'generateMap (edit)',
    inputs,
    (s) => {
      s.generateMap()
    },
    (s) => {
      s.replace(/replacement/g, 'replacement\nReplacement')
    },
  )

  await runWithInstance('generateDecodedMap (no edit)', inputs, (s) => {
    s.generateDecodedMap()
  })
  await runWithInstance(
    'generateDecodedMap (edit)',
    inputs,
    (s) => {
      s.generateDecodedMap()
    },
    (s) => {
      s.replace(/replacement/g, 'replacement\nReplacement')
    },
  )

  const size = 1000000
  await runWithInstance('overwrite', ['a'.repeat(size)], (s) => {
    for (let i = 1; i < size; i += 2) {
      s.overwrite(i, i + 1, 'b')
    }
  })

  await runWithInstance('hasChanged (no edit)', inputs, (s) => {
    s.hasChanged()
  })
  await runWithInstance(
    'hasChanged (edit)',
    inputs,
    (s) => {
      s.hasChanged()
    },
    (s) => {
      s.replace(/replacement/g, 'replacement\nReplacement')
    },
  )

  printResults()
}

bench()
