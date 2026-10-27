export class EditModelError extends Error {
  override name = 'EditModelError'
}

/**
 * Reference model of MagicString's edit API (no `move`/`trim`/`indent`/`replace`),
 * kept per original character instead of per chunk. See README.md for the rules.
 */
export class EditModel {
  readonly original: string
  /** Output owned by each original char: '' when removed or emptied, the replacement on a holder */
  text: string[]
  edited: boolean[]
  /** For the holder of a non-empty replacement, the end of its first chunk at edit time; -1 otherwise */
  holderEnd: number[]
  /** Inserts left of each boundary; `left[0]` is the string intro */
  left: string[]
  /** Inserts right of each boundary; `right[n]` is the string outro */
  right: string[]
  /** Every index a split has happened at */
  boundaries: Set<number>

  constructor(original: string) {
    const n = original.length
    this.original = original
    this.text = [...original]
    this.edited = Array.from<boolean>({ length: n }).fill(false)
    this.holderEnd = Array.from<number>({ length: n }).fill(-1)
    this.left = Array.from<string>({ length: n + 1 }).fill('')
    this.right = Array.from<string>({ length: n + 1 }).fill('')
    this.boundaries = new Set([0, n])
  }

  split(index: number): void {
    if (this.boundaries.has(index))
      return
    if (this.isInsideHolder(index))
      throw new EditModelError('cannot split a chunk that has already been edited')
    this.boundaries.add(index)
  }

  append(content: string): void {
    this.right[this.original.length] += content
  }

  prepend(content: string): void {
    this.left[0] = content + this.left[0]
  }

  appendLeft(index: number, content: string): void {
    this.split(index)
    this.left[index] += content
  }

  prependLeft(index: number, content: string): void {
    this.split(index)
    this.left[index] = content + this.left[index]
  }

  appendRight(index: number, content: string): void {
    this.split(index)
    this.right[index] += content
  }

  prependRight(index: number, content: string): void {
    this.split(index)
    this.right[index] = content + this.right[index]
  }

  remove(start: number, end: number): void {
    if (start === end)
      return
    this.assertOrdered(start, end)
    this.split(start)
    this.split(end)
    this.empty(start, end)
    for (let i = start + 1; i < end; i++) {
      this.left[i] = ''
      this.right[i] = ''
    }
  }

  update(start: number, end: number, content: string, options?: { overwrite?: boolean }): void {
    if (start === end)
      throw new EditModelError('cannot overwrite a zero-length range')
    this.assertOrdered(start, end)
    this.split(start)
    this.split(end)
    let firstEnd = end
    for (let i = start + 1; i < end; i++) {
      if (this.boundaries.has(i)) {
        firstEnd = i
        break
      }
    }
    this.empty(start, end)
    this.text[start] = content
    this.holderEnd[start] = content === '' ? -1 : firstEnd
    if (options?.overwrite)
      this.clearEdgeInserts(start, end)
  }

  overwrite(start: number, end: number, content: string): void {
    this.update(start, end, content, { overwrite: true })
  }

  reset(start: number, end: number): void {
    if (start === end)
      return
    this.assertOrdered(start, end)
    this.split(start)
    this.split(end)
    for (let c = start; c < end; c++) {
      this.text[c] = this.original[c]
      this.edited[c] = false
      this.holderEnd[c] = -1
    }
    this.clearEdgeInserts(start, end)
  }

  toString(): string {
    return this.left[0] + this.between(0, this.original.length) + this.right[this.original.length]
  }

  /** Like MagicString, leaves out the string intro and outro */
  length(): number {
    return this.between(0, this.original.length).length
  }

  hasChanged(): boolean {
    return this.toString() !== this.original
  }

  isEmpty(): boolean {
    return this.toString().trim() === ''
  }

  slice(start: number, end: number): string {
    if (this.isInsideEditedChunk(start) || this.isInsideEditedChunk(end))
      throw new EditModelError('cannot use edited character')
    return this.between(start, end)
  }

  private between(start: number, end: number): string {
    let result = ''
    for (let c = start; c < end; c++)
      result += this.right[c] + this.text[c] + this.left[c + 1]
    return result
  }

  private isInsideHolder(index: number): boolean {
    return this.holderEnd.some((holderEnd, h) => this.text[h] !== '' && h < index && index < holderEnd)
  }

  /** Chunks are edited as a whole, so a non-boundary index shares its chunk with char `index` */
  private isInsideEditedChunk(index: number): boolean {
    return !this.boundaries.has(index) && this.edited[index]
  }

  private assertOrdered(start: number, end: number): void {
    if (start > end)
      throw new EditModelError('end must be greater than start')
  }

  private empty(start: number, end: number): void {
    for (let c = start; c < end; c++) {
      this.text[c] = ''
      this.edited[c] = true
      this.holderEnd[c] = -1
    }
  }

  private clearEdgeInserts(start: number, end: number): void {
    for (let i = start; i < end; i++) {
      this.right[i] = ''
      this.left[i + 1] = ''
    }
  }
}
