import { assert, describe, it } from 'vitest'
import { IntegrityCheckingMagicString as MagicString } from '../__utils/IntegrityCheckingMagicString.ts'

describe('magicString', () => {
  describe('insert', () => {
    it('is deprecated', () => {
      const s = new MagicString('abcdefghijkl')
      // @ts-expect-error deprecated runtime API intentionally accepts ignored arguments
      assert.throws(() => s.insert(6, 'X'), /deprecated/)
    })

    it('insertLeft warns and delegates to appendLeft', () => {
      const s = new MagicString('abcdefghijkl')
      const warn = console.warn
      let warned = false
      console.warn = () => {
        warned = true
      }
      try {
        s.insertLeft(6, 'X')
      }
      finally {
        console.warn = warn
      }
      assert.equal(warned, true)
      assert.equal(s.toString(), 'abcdefXghijkl')
    })

    it('insertLeft does not warn again once it already has', () => {
      const s = new MagicString('abcdefghijkl')
      const warn = console.warn
      let warnCount = 0
      console.warn = () => {
        warnCount += 1
      }
      try {
        // the deprecation warning was already emitted by the previous test
        s.insertLeft(6, 'X')
      }
      finally {
        console.warn = warn
      }
      assert.equal(warnCount, 0)
      assert.equal(s.toString(), 'abcdefXghijkl')
    })

    it('insertRight warns and delegates to prependRight', () => {
      const s = new MagicString('abcdefghijkl')
      const warn = console.warn
      let warned = false
      console.warn = () => {
        warned = true
      }
      try {
        s.insertRight(6, 'X')
      }
      finally {
        console.warn = warn
      }
      assert.equal(warned, true)
      assert.equal(s.toString(), 'abcdefXghijkl')
    })

    it('insertRight does not warn again once it already has', () => {
      const s = new MagicString('abcdefghijkl')
      const warn = console.warn
      let warnCount = 0
      console.warn = () => {
        warnCount += 1
      }
      try {
        // the deprecation warning was already emitted by the previous test
        s.insertRight(6, 'X')
      }
      finally {
        console.warn = warn
      }
      assert.equal(warnCount, 0)
      assert.equal(s.toString(), 'abcdefXghijkl')
    })

    // TODO move this into prependRight and appendLeft tests

    // it( 'should insert characters in the correct location', () => {
    //   const s = new MagicString( 'abcdefghijkl' );
    //
    //   s.insert( 0, '>>>' );
    //   s.insert( 6, '***' );
    //   s.insert( 12, '<<<' );
    //
    //   assert.equal( s.toString(), '>>>abcdef***ghijkl<<<' );
    // });
    //
    // it( 'should return this', () => {
    //   const s = new MagicString( 'abcdefghijkl' );
    //   assert.strictEqual( s.insert( 0, 'a' ), s );
    // });
    //
    // it( 'should insert repeatedly at the same position correctly', () => {
    //   const s = new MagicString( 'ab' );
    //   assert.equal( s.insert(1, '1').toString(), 'a1b' );
    //   assert.equal( s.insert(1, '2').toString(), 'a12b' );
    // });
    //
    // it( 'should insert repeatedly at the beginning correctly', () => {
    //   const s = new MagicString( 'ab' );
    //   assert.equal( s.insert(0, '1').toString(), '1ab' );
    //   assert.equal( s.insert(0, '2').toString(), '12ab' );
    // });
    //
    // it( 'should throw when given non-string content', () => {
    //   const s = new MagicString( '' );
    //   assert.throws(
    //     function () { s.insert( 0, [] ); },
    //     TypeError
    //   );
    // });
    //
    // it( 'should allow inserting after removed range', () => {
    //   const s = new MagicString( 'abcd' );
    //   s.remove( 1, 2 );
    //   s.insert( 2, 'z' );
    //   assert.equal( s.toString(), 'azcd' );
    // });
  })
})
