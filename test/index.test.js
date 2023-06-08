import {LineWrap} from '../lib/index.js'
import assert from 'assert/strict'

describe('line wrapping', () => {
  it('handles plain strings', () => {
    const lw = new LineWrap()
    assert.equal(lw.wrap(''), '')
    assert.equal(lw.wrap('foo'), 'foo')
    assert.equal(lw.wrap('foo bar'), 'foo bar')
    assert.equal(lw.wrap('foo\tbar'), 'foo\tbar')
    assert.equal(lw.wrap('foo\nbar'), 'foo bar')
    assert.equal(lw.wrap('foo\u1680bar'), 'foo\u1680bar')
  })

  it('wraps', () => {
    const lw = new LineWrap({width: 4})
    assert.equal(lw.wrap('foo    bar'), 'foo\nbar')
    assert.equal(lw.wrap('foo\u1680bar'), 'foo\nbar')
    assert.equal(lw.wrap('\u2014  \u2014'), '\u2014  \u2014')
  })

  it('keeps newlines', () => {
    const lw = new LineWrap({isNewline: null})
    assert.equal(lw.wrap('foo\nbar'), 'foo\nbar')
  })

  it('does not split URLs', () => {
    const lw = new LineWrap({width: 4})
    assert.equal(lw.wrap('https://example.com'), 'https://example.com')
    assert.equal(lw.wrap('http://a.0/'), 'http://\na.0/') // Invalid URL
    assert.equal(lw.wrap('a https://example.com'), 'a\nhttps://example.com')
  })

  it('indents', () => {
    const lw = new LineWrap({width: 4, indent: 2})
    assert.equal(lw.wrap('ab bc'), '  ab\n  bc')

    const lw2 = new LineWrap({
      width: 4,
      indent: 2,
      indentFirst: false,
      firstCol: 0,
    })
    assert.equal(lw2.wrap('abcd bc'), 'abcd\n  bc')
  })

  it('clips overflows', () => {
    const lw = new LineWrap({width: 4, overflow: LineWrap.OVERFLOW_CLIP})
    assert.equal(lw.wrap('abcde'), 'abc…')
  })

  it('dashes overflows', () => {
    const lw = new LineWrap({width: 4, overflow: LineWrap.OVERFLOW_ANYWHERE})
    assert.equal(lw.wrap('abcde'), 'abc-\nde')
  })

  it('errors on bad overflow', () => {
    assert.throws(() => {
      // eslint-disable-next-line no-new
      new LineWrap({width: 4, overflow: Symbol('bad')})
    })

    assert.throws(() => {
      // eslint-disable-next-line no-new
      new LineWrap({width: 4, indent: 4})
    })
  })

  it('does verbose logging', () => {
    /* eslint-disable no-console */
    const old = console.log
    const res = []
    console.log = (...args) => res.push(args)
    const lw = new LineWrap({width: 4, verbose: true})
    assert.equal(lw.wrap('abcde'), 'abcde')
    assert(res.length > 0)
    console.log = old
    /* eslint-enable no-console */
  })
})
