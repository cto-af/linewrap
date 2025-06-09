import {LineWrap} from '../lib/index.js';
import assert from 'node:assert/strict';
import {test} from 'node:test';

test('line wrapping', async() => {
  await test('handles plain strings', () => {
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

  await test('wraps', () => {
    const lw = new LineWrap({width: 4});
    assert.equal(lw.wrap('foo    bar'), 'foo\nbar');
    assert.equal(lw.wrap('foo\u1680bar'), 'foo\nbar');
    assert.equal(lw.wrap('\u2014  \u2014'), '\u2014  \u2014');
    assert.equal(
      lw.wrap('bar \x1B[32mfoo\x1B[39m \x1B[32mfoo\x1B[0m baz'),
      'bar\n\x1B[32mfoo\x1B[39m\n\x1B[32mfoo\x1B[0m\nbaz'
    );
  });

  await test('keeps newlines', () => {
    const lw = new LineWrap({isNewline: null});
    assert.equal(lw.wrap('foo\nbar'), 'foo\nbar');
  });

  await test('does not split URLs', () => {
    const lw = new LineWrap({width: 4});
    assert.equal(lw.wrap('https://example.com'), 'https://example.com');
    assert.equal(lw.wrap('http://a.0/'), 'http://\na.0/'); // Invalid URL
    assert.equal(lw.wrap('a https://example.com'), 'a\nhttps://example.com');
  });

  await test('indents', () => {
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

  await test('clips overflows', () => {
    const lw = new LineWrap({width: 4, overflow: LineWrap.OVERFLOW_CLIP});
    assert.equal(lw.wrap('abcde'), 'abc…');
  });

  await test('dashes overflows', () => {
    const lw = new LineWrap({width: 4, overflow: LineWrap.OVERFLOW_ANYWHERE});
    assert.equal(lw.wrap('abcde'), 'abc-\nde');
    assert.equal(lw.wrap('\x1B[32mab\x1B[0mcde'), '\x1B[32mab\x1B[0mc-\nde');
  });

  await test('errors on bad overflow', () => {
    assert.throws(() => {
      // eslint-disable-next-line no-new
      new LineWrap({width: 4, overflow: Symbol('bad')});
    });

    assert.throws(() => {
      // eslint-disable-next-line no-new
      new LineWrap({width: 4, indent: 4});
    });
  });

  await test('does verbose logging', () => {
    // eslint-disable-next-line no-console
    const old = console.log;
    const res = [];
    // eslint-disable-next-line no-console
    console.log = (...args) => res.push(args);
    const lw = new LineWrap({width: 4, verbose: true});
    assert.equal(lw.wrap('abcde'), 'abcde');
    assert(res.length > 0);
    // eslint-disable-next-line no-console
    console.log = old;
  });

  await test('handles locale options', () => {
    const lw = new LineWrap({locale: 'ko', isCJK: false});
    assert.equal(lw.locale, 'ko');
    assert.equal(lw.isCJK, false);
  });

  await test('handles includeANSI option', () => {
    const lw = new LineWrap({
      width: 4,
      includeANSI: true,
      overflow: LineWrap.OVERFLOW_ANYWHERE,
    });
    assert.equal(
      lw.wrap('bar\x1B[32mfoo\x1B[39m\x1B[32mfoo\x1B[39mbaz'),
      'bar-\n\x1B[3-\n2mf-\noo\x1B-\n[39-\nm\x1B[-\n32m-\nfoo-\n\x1B[3-\n9mb-\naz'
    );
  });

  await test('unwraps', () => {
    const lw = new LineWrap();
    assert.equal(lw.unwrap('foo\nbar'), 'foo bar');
    assert.equal(lw.unwrap('foo\x85bar'), 'foo bar');
    assert.equal(lw.unwrap('    foo \r\n  bar  '), 'foo bar');
  });

  await test('yields parts', () => {
    const lw = new LineWrap();
    const parts = [...lw.parts('boo', 12)];
    assert.deepEqual(parts, [
      {
        str: 'boo',
        length: 15,
        last: true,
      },
    ]);
  });
});
