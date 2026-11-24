export function guessIndent(code: string): string | null {
  // one pass over the line starts, instead of splitting into lines and
  // filtering them with regexps
  let tabbed = 0
  let spaced = 0
  let min = Infinity

  let start = 0
  while (true) {
    const char = code.charCodeAt(start)
    if (char === 9 /* \t */) {
      tabbed++
    }
    else if (char === 32 /* space */ && code.charCodeAt(start + 1) === 32) {
      spaced++
      let end = start + 2
      while (code.charCodeAt(end) === 32) end++
      if (end - start < min)
        min = end - start
    }

    const next = code.indexOf('\n', start)
    if (next === -1)
      break
    start = next + 1
  }

  if (tabbed === 0 && spaced === 0) {
    return null
  }

  // More lines tabbed than spaced? Assume tabs, and
  // default to tabs in the case of a tie (or nothing
  // to go on)
  if (tabbed >= spaced) {
    return '\t'
  }

  // Otherwise, we need to guess the multiple
  return ' '.repeat(min)
}
