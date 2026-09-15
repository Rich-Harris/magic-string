import { assert, describe, it } from 'vitest'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('move', () => {
    it('moves content from the start', () => {
      const s = new MagicString('abcdefghijkl')
      s.move(0, 3, 6)

      assert.equal(s.toString(), 'defabcghijkl')
    })

    it('moves content to the start', () => {
      const s = new MagicString('abcdefghijkl')
      s.move(3, 6, 0)

      assert.equal(s.toString(), 'defabcghijkl')
    })

    it('moves content from the end', () => {
      const s = new MagicString('abcdefghijkl')
      s.move(9, 12, 6)

      assert.equal(s.toString(), 'abcdefjklghi')
    })

    it('moves content to the end', () => {
      const s = new MagicString('abcdefghijkl')
      s.move(6, 9, 12)

      assert.equal(s.toString(), 'abcdefjklghi')
    })

    it('ignores redundant move', () => {
      const s = new MagicString('abcdefghijkl')
      s.prependRight(9, 'X')
      s.move(9, 12, 6)
      s.appendLeft(12, 'Y')
      s.move(6, 9, 12) // this is redundant – [6,9] is already after [9,12]

      assert.equal(s.toString(), 'abcdefXjklYghi')
    })

    it('moves content to the middle', () => {
      const s = new MagicString('abcdefghijkl')
      s.move(3, 6, 9)

      assert.equal(s.toString(), 'abcghidefjkl')
    })

    it('handles multiple moves of the same snippet', () => {
      const s = new MagicString('abcdefghijkl')

      s.move(0, 3, 6)
      assert.equal(s.toString(), 'defabcghijkl')

      s.move(0, 3, 9)
      assert.equal(s.toString(), 'defghiabcjkl')
    })

    it('handles moves of adjacent snippets', () => {
      const s = new MagicString('abcdefghijkl')

      s.move(0, 2, 6)
      assert.equal(s.toString(), 'cdefabghijkl')

      s.move(2, 4, 6)
      assert.equal(s.toString(), 'efabcdghijkl')
    })

    it('handles moves to same index', () => {
      const s = new MagicString('abcdefghijkl')
      s.move(0, 2, 6).move(3, 5, 6)

      assert.equal(s.toString(), 'cfabdeghijkl')
    })

    it('refuses to move a selection to inside itself', () => {
      const s = new MagicString('abcdefghijkl')

      assert.throws(() => s.move(3, 6, 3), /cannot move a selection inside itself/)

      assert.throws(() => s.move(3, 6, 4), /cannot move a selection inside itself/)

      assert.throws(() => s.move(3, 6, 6), /cannot move a selection inside itself/)
    })

    it('refuses to move a range an earlier move has split', () => {
      // The second move's range spans chunks the first move separated, so they
      // are no longer a forward run in the list. Splicing them anyway used to
      // point a chunk at itself, and toString() then looped forever.
      const s = new MagicString('abcdef')
      s.move(0, 2, 3)

      assert.throws(() => s.move(1, 3, 0), /earlier move split that range/)

      // The first move is still intact and the string is still printable.
      assert.equal(s.toString(), 'cabdef')
    })

    it('allows a later move that still spans a forward run of chunks', () => {
      const s = new MagicString('abcdefgh')
      s.move(0, 2, 8)
      assert.equal(s.toString(), 'cdefghab')

      s.move(2, 6, 0)
      assert.equal(s.toString(), 'ghcdefab')
    })

    it('allows a later move whose walk passes through an intermediate chunk', () => {
      const s = new MagicString('abcdefgh')
      s.move(2, 4, 6)
      assert.equal(s.toString(), 'abefcdgh')

      s.move(0, 6, 8)
      assert.equal(s.toString(), 'cdghabef')
    })

    it('carries the reordering over to a clone', () => {
      // clone() copies the chunks in their current order, so the clone starts
      // out reordered and needs the same check.
      const s = new MagicString('abcdef')
      s.move(0, 2, 3)

      const cloned = s.clone()

      assert.throws(() => cloned.move(1, 3, 0), /earlier move split that range/)
      assert.equal(cloned.toString(), 'cabdef')
    })

    it('does nothing when moving a zero-length range', () => {
      const s = new MagicString('abcdefghijkl')

      assert.doesNotThrow(() => s.move(0, 0, 6))
      assert.doesNotThrow(() => s.move(5, 5, 0))

      assert.equal(s.toString(), 'abcdefghijkl')
    })

    it('does nothing when moving a range to where it already is', () => {
      // The first move puts "d" right before "b", so the second has nothing to
      // do. It used to splice "d" in next to itself, which dropped it from the
      // output and left the chunk list pointing back at itself.
      const s = new MagicString('abcd')
      s.move(3, 4, 1)
      assert.equal(s.toString(), 'adbc')

      s.move(3, 4, 1)
      s.checkIntegrity()
      assert.equal(s.toString(), 'adbc')
    })

    it('does nothing when moving a range to the front where it already is', () => {
      // The same no-op at the very start. The text survived here, but the first
      // chunk became its own previous chunk, so lastLine() looped forever.
      const s = new MagicString('xb')
      s.move(1, 2, 0)
      s.move(1, 2, 0)
      s.checkIntegrity()

      assert.equal(s.toString(), 'bx')
      assert.equal(s.lastLine(), 'bx')
    })

    it('allows edits of moved content', () => {
      const s1 = new MagicString('abcdefghijkl')

      s1.move(3, 6, 9)
      s1.overwrite(3, 6, 'DEF')

      assert.equal(s1.toString(), 'abcghiDEFjkl')

      const s2 = new MagicString('abcdefghijkl')

      s2.move(3, 6, 9)
      s2.overwrite(4, 5, 'E')

      assert.equal(s2.toString(), 'abcghidEfjkl')
    })

    // it( 'move follows inserts', () => {
    //   const s = new MagicString( 'abcdefghijkl' );
    //
    //   s.appendLeft( 3, 'X' ).move( 6, 9, 3 );
    //   assert.equal( s.toString(), 'abcXghidefjkl' );
    // });
    //
    // it( 'inserts follow move', () => {
    //   const s = new MagicString( 'abcdefghijkl' );
    //
    //   s.insert( 3, 'X' ).move( 6, 9, 3 ).insert( 3, 'Y' );
    //   assert.equal( s.toString(), 'abcXghiYdefjkl' );
    // });
    //
    // it( 'discards inserts at end of move by default', () => {
    //   const s = new MagicString( 'abcdefghijkl' );
    //
    //   s.insert( 6, 'X' ).move( 3, 6, 9 );
    //   assert.equal( s.toString(), 'abcXghidefjkl' );
    // });

    it('moves content inserted at end of range', () => {
      const s = new MagicString('abcdefghijkl')

      s.appendLeft(6, 'X').move(3, 6, 9)
      assert.equal(s.toString(), 'abcghidefXjkl')
    })

    it('returns this', () => {
      const s = new MagicString('abcdefghijkl')
      assert.strictEqual(s.move(3, 6, 9), s)
    })

    describe('affinity', () => {
      it('defaults to right affinity', () => {
        const explicit = new MagicString('abcd')
        explicit.move(0, 1, 2).move(3, 4, 2, 'right')

        const implicit = new MagicString('abcd')
        implicit.move(0, 1, 2).move(3, 4, 2)

        assert.equal(implicit.toString(), explicit.toString())
      })

      it('anchors before the content starting at index with right affinity', () => {
        // "a" is moved before "c", then "d" lands before "c" too, so it slots
        // in against the following content.
        const s = new MagicString('abcd')
        s.move(0, 1, 2)
        s.move(3, 4, 2, 'right')
        s.checkIntegrity()

        assert.equal(s.toString(), 'badc')
      })

      it('anchors after the content ending at index with left affinity', () => {
        // Same two moves, but "d" now attaches to "b", the content ending at
        // index 2, rather than the "c" that follows.
        const s = new MagicString('abcd')
        s.move(0, 1, 2)
        s.move(3, 4, 2, 'left')
        s.checkIntegrity()

        assert.equal(s.toString(), 'bdac')
      })

      it('left affinity at the start prepends to the front', () => {
        const s = new MagicString('abc')
        s.move(2, 3, 0, 'left')
        s.checkIntegrity()

        assert.equal(s.toString(), 'cab')
      })

      it('left affinity at the end appends to the back', () => {
        const s = new MagicString('abc')
        s.move(0, 1, 3, 'left')
        s.checkIntegrity()

        assert.equal(s.toString(), 'bca')
      })

      it('does nothing when moving a range to where it already is with left affinity', () => {
        const s = new MagicString('abcd')
        s.move(0, 1, 2, 'left')
        assert.equal(s.toString(), 'bacd')

        s.move(0, 1, 2, 'left')
        s.checkIntegrity()
        assert.equal(s.toString(), 'bacd')
      })
    })
  })
})
