# @cto.af/linewrap

Wrap lines using Unicode UAX #14 line breaking rules.

## Installation

```sh
npm install @cto.af/linewrap
```

## CLI

A command line interface is available: [@cto.af/linewrap-cli](https://github.com/cto-af/linewrap-cli)

## API

```js
import {LineWrap} from '@cto.af/linewrap'
const w = new LineWrap()
w.wrap('Lorem ipsum dolor sit amet...')  // A string, wrapped to your console length
for (const line of w.lines('Lorem ipsum dolor sit amet...')) {
  // `line` does not have a newline at the end
}
```

Full [API docs](https://cto-af.github.io/linewrap/) are available.

### Methods

<dl>
<dt>wrap(string)</dt>
<dd>Sometimes, you just want text out of the wrapping operation, with newlines
between the lines.  Use <code>wrap()</code> for this.  Note that there is no
newline at the end of the wrapped text.</dd>

<dt>*lines(string)</dt>

<dd>Sometimes, you'll want the lines individually; perhaps you're streaming, or
integrating the lines with other content.  The <code>*lines()</code> method will
return a string generator, where each line is NOT ended with a newline.  The
<code>wrap()</code> method just calls <code>*lines()</code> and joins the result
with your configured newline string.</dd>
</dl>

### Options

Options may be passed into the constructor in an object:

```js
const w = new LineWrap({ width: 40 })
```

The following options are all optional, having the specified defaults:

<dl>
<dt><code>ellipsis: string = '…'</code> (U+2026: HORIZONTAL ELLIPSIS)</dt>
<dd>String to use when long word is truncated with
<code>LineWrap.OVERFLOW_CLIP</code>.</dd>

<dt><code>example7: boolean = false</code></dt>
<dd>Turn on the extra rules for matching numbers from Example 7 of UAX #14</dd>

<dt><code>firstCol: number = NaN</code></dt>
<dd>If indentFirst is false, how many columns was the first line already indented?
If NaN, use the indent width, in graphemes.  If indentFirst is true, this is
ignored.</dd>

<dt><code>hyphen: string = '-'</code> (U+002D: HYPHEN-MINUS)</dt>
<dd>String to use when long word is split to next line with
<code>LineWrap.OVERFLOW_ANYWHERE</code>.</dd>

<dt><code>indent: number | string = ''</code> (empty string)</dt>
<dd>If a string, indent every line (except the first if indentFirst is false) with
that string.  If a number, insert that many <code>indentChar</code>s at the
beginning of each line.</dd>

<dt><code>indentChar: string = ' '</code> (U+0020: SPACE)</dt>
<dd>If <code>indent</code> is a number, use that many of this string to indent.</dd>

<dt><code>indentEmpty: boolean = false</code></dt>
<dd>If the input string is empty, should we still indent?</dd>

<dt><code>indentFirst : boolean = true</code></dt>
<dd>Indent the first line?  If not, treat the first line as if it was already
indented, giving a short first line.  Use <code>firstCol</code> to control how
short the first line should be.</dd>

<dt><code>isCJK : boolean</code></dt>
<dd>Override the locale, forcing strings to be measured in a
Chinese/Japanese/Korean context or not.</dd>

<dt><code>isNewline : RegExp | null = /[^\S\r\n\v\f\x85\u2028\u2029]*[\r\n\v\f\x85\u2028\u2029]+\s*/gu</code></dt>
<dd>Regular expression that finds newlines for replacement with
<code>newlineReplacement</code>.  Ensure you do not create a regular expression
denial of service
(<a href='https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS'>ReDoS</a>)
attack.  Make sure the expression has the `g` modifier.  If null, no newline
replacement is done, and existing newlines will be maintained in the output, no
matter where they were originally.</dd>

<dt><code>locale: string =</code>
[system locale as determined by Intl.Segmenter]</dt>
<dd>Which locale to use when splitting by graphemes? May have a small effect in
some locales.  If you have experience with one of those locales, please file an
issue or PR with examples so this can be tested carefully.</dd>

<dt><code>newline: string = '\n'</code></dt>
<dd>String used to separate lines in the <code>wrap()</code> method.</dd>

<dt><code>newlineReplacement: string = ' '</code></dt>
<dd>For every newline found with <code>isNewline</code>, replace with this
string.</dd>

<dt><code>overflow: Symbol = LineWrapOptions.OVERFLOW_VISIBLE</code></dt>
<dd>What to do with words that are longer than the available width?  There are
three options:
  <ul>
    <li><code>LineWrapOptions.OVERFLOW_VISIBLE</code>: If a word is longer than
    the wrappable area, allow the word to go extend past the width so that it is
    not broken.  This is the only way for long URLs to still be clickable.</li>
    <li><code>LineWrapOptions.OVERFLOW_CLIP</code>: If a word is longer than the
    wrappable area, cut it to size, dropping the rest of the word, inserting an
    ellipsis at the end.</li>
    <li><code>LineWrapOptions.OVERFLOW_ANYWHERE</code>: If a word is longer than
    the wrappable area, split it into chunks that do fit, inserting a hyphen at
    the end of each line.</li>
  </ul>
</dd>

<dt><code>verbose : boolean = false</code></dt>
<dd>Enable output on stdout for deep diagnostic information.  Only useful for
debugging.</dd>

<dt><code>width: number = 80</code></dt>
<dd>Maximum number of graphemes per line, <b>including</b> indentation.</dd>

<dt><code>escape: (x: string) => string = (x) => x</code></dt>
<dd>Function to escape the input string. The escaping is performed after line
breaking and grapheme counting, with the intent that in the final display, those
escapes will be replaced appropriately.  Defaults to an identity transform.</dd>

</dl>

## Visual representation of options

![Visual depiction of linewrap options](https://raw.githubusercontent.com/cto-af/linewrap/main/assets/visual.png)

---
[![Tests](https://github.com/cto-af/linewrap/actions/workflows/node.js.yml/badge.svg)](https://github.com/cto-af/linewrap/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/cto-af/linewrap/branch/main/graph/badge.svg?token=rS0f3lhan5)](https://codecov.io/gh/cto-af/linewrap)
