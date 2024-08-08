import {LineWrap} from '../lib/index.js';
import assert from 'assert/strict';

describe('line wrapping', () => {
  it('handles plain strings', () => {
    const lw = new LineWrap();
    assert.equal(lw.wrap(''), '');
    assert.equal(lw.wrap('foo'), 'foo');
    assert.equal(lw.wrap('foo bar'), 'foo bar');
    assert.equal(lw.wrap('foo\tbar'), 'foo\tbar');
    assert.equal(lw.wrap('foo\nbar'), 'foo bar');
    assert.equal(lw.wrap('foo\u1680bar'), 'foo\u1680bar');
    assert.equal(
      lw.wrap('bar\x1B[32mfoo\x1B[39m\x1B[32mfoo\x1B[39mbaz'),
      'bar\x1B[32mfoo\x1B[39m\x1B[32mfoo\x1B[39mbaz'
    );
  });

  it('wraps', () => {
    const lw = new LineWrap({width: 4});
    assert.equal(lw.wrap('foo    bar'), 'foo\nbar');
    assert.equal(lw.wrap('foo\u1680bar'), 'foo\nbar');
    assert.equal(lw.wrap('\u2014  \u2014'), '\u2014  \u2014');
    assert.equal(
      lw.wrap('bar \x1B[32mfoo\x1B[39m \x1B[32mfoo\x1B[0m baz'),
      'bar\n\x1B[32mfoo\x1B[39m\n\x1B[32mfoo\x1B[0m\nbaz'
    );
  });

  it('keeps newlines', () => {
    const lw = new LineWrap({isNewline: null});
    assert.equal(lw.wrap('foo\nbar'), 'foo\nbar');
  });

  it('does not split URLs', () => {
    const lw = new LineWrap({width: 4});
    assert.equal(lw.wrap('https://example.com'), 'https://example.com');
    assert.equal(lw.wrap('http://a.0/'), 'http://\na.0/'); // Invalid URL
    assert.equal(lw.wrap('a https://example.com'), 'a\nhttps://example.com');
  });

  it('indents', () => {
    let lw = new LineWrap({width: 4, indent: 2});
    assert.equal(lw.wrap('ab bc'), '  ab\n  bc');

    lw = new LineWrap({
      width: 4,
      indent: 2,
      indentFirst: false,
      firstCol: 0,
    });
    assert.equal(lw.wrap('abcd bc'), 'abcd\n  bc');

    lw = new LineWrap({
      width: 10,
      indent: 2,
      indentFirst: false,
      firstCol: 8,
    });
    assert.equal(lw.wrap('boo'), 'boo');

    lw = new LineWrap({
      width: 10,
      indent: 5,
      indentFirst: false,
      firstCol: 0,
    });
    assert.equal(lw.wrap('boo'), 'boo');
    assert.equal(lw.wrap('   '), '');
    assert.equal(lw.wrap('012345678901234567890'), '012345678901234567890');

    lw = new LineWrap({
      width: 10,
      indent: 5,
      indentFirst: false,
      firstCol: 0,
      overflow: LineWrap.OVERFLOW_CLIP,
    });
    assert.equal(lw.wrap('012345678901234567890'), '012345678\u{2026}');

    assert.throws(() => new LineWrap({
      width: 10,
      indentFirst: false,
      firstCol: 10,
    }));

    assert.throws(() => new LineWrap({
      width: 10,
      indentFirst: false,
      firstCol: 9,
      overflow: LineWrap.OVERFLOW_CLIP,
    }));
  });

  it('clips overflows', () => {
    const lw = new LineWrap({width: 4, overflow: LineWrap.OVERFLOW_CLIP});
    assert.equal(lw.wrap('abcde'), 'abc…');
  });

  it('dashes overflows', () => {
    const lw = new LineWrap({width: 4, overflow: LineWrap.OVERFLOW_ANYWHERE});
    assert.equal(lw.wrap('abcde'), 'abc-\nde');
    assert.equal(lw.wrap('\x1B[32mab\x1B[0mcde'), '\x1B[32mab\x1B[0mc-\nde');
  });

  it('errors on bad overflow', () => {
    assert.throws(() => {
      new LineWrap({width: 4, overflow: Symbol('bad')});
    });

    assert.throws(() => {
      new LineWrap({width: 4, indent: 4});
    });
  });

  it('does verbose logging', () => {
    const old = console.log;
    const res = [];
    console.log = (...args) => res.push(args);
    const lw = new LineWrap({width: 4, verbose: true});
    assert.equal(lw.wrap('abcde'), 'abcde');
    assert(res.length > 0);
    console.log = old;
  });

  it('handles locale options', () => {
    const lw = new LineWrap({locale: 'ko', isCJK: false});
    assert.equal(lw.locale, 'ko');
    assert.equal(lw.isCJK, false);
  });

  it('handles includeANSI option', () => {
    const lw = new LineWrap({width: 4, includeANSI: true, overflow: LineWrap.OVERFLOW_ANYWHERE});
    assert.equal(
      lw.wrap('bar\x1B[32mfoo\x1B[39m\x1B[32mfoo\x1B[39mbaz'),
      'bar-\n\x1B[3-\n2mf-\noo\x1B-\n[39-\nm\x1B[-\n32m-\nfoo-\n\x1B[3-\n9mb-\naz'
    );
  });
});
