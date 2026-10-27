export class BitSet {
  declare bits: number[]

  constructor(arg?: BitSet) {
    this.bits = arg instanceof BitSet ? arg.bits.slice() : []
  }

  add(n: number): void {
    this.bits[n >> 5] |= 1 << (n & 31)
  }

  has(n: number): boolean {
    return !!(this.bits[n >> 5] & (1 << (n & 31)))
  }

  forEach(fn: (n: number) => void): void {
    const bits = this.bits
    for (let w = 0; w < bits.length; w++) {
      let word = bits[w]
      while (word) {
        const lowest = word & -word
        fn((w << 5) + 31 - Math.clz32(lowest))
        word ^= lowest
      }
    }
  }
}
