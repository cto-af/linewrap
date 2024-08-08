import {Break} from '@cto.af/linebreak';
import {SpaceBreaker} from './spacebreaker.js';
import {StringWidth} from '@cto.af/string-width';

const DEFAULT_LOCALE = new Intl.Segmenter().resolvedOptions().locale;
const DEFAULT_IS_NEWLINE = /[^\S\r\n\v\f\x85\u2028\u2029]*[\r\n\v\f\x85\u2028\u2029]+\s*/gu;

/**
 * @callback EscapeString
 * @param {string} s String to escape
 * @returns {string} Escaped string
 */

/**
 * @typedef {object} LineWrapOptions
 * @prop {string} [ellipsis='\u{2026}'] String to use when long word is
 *   truncated with LineWrap.OVERFLOW_CLIP.
 * @prop {boolean} [example7] Turn on the extra linebreak rules from
 *   Example 7 of UAX #14.
 * @prop {number} [firstCol=NaN] If indentFirst is false, how many columns
 *   was the first line already indented?  If NaN, use the indent width,
 *   in display cells.  If indentFirst is true, this is ignored.
 * @prop {string} [hyphen='-'] String to use when long word is
 *   split to next line with LineWrap.OVERFLOW_ANYWHERE.
 * @prop {boolean} [includeANSI=false] If true, include ANSI escape sequences in the
 *   width of the string.  If false, strips ANSI before calculating width.
 * @prop {number|string} [indent=''] If a string, indent every line with
 *   that string.  If a number, insert that many {@link indentChar}s at the
 *   beginning of each line.  Defaults to `""` (the empty string).
 * @prop {string} [indentChar=SPACE] If {@link indent} is a number, use that
 *   many of this string to indent. Defaults to `" "` (a single space).
 * @prop {boolean} [indentEmpty=false] If the input string is empty, should
 *   we still indent?
 * @prop {boolean} [indentFirst=true] Indent the first line?  If not, treat
 *   the first line as if it was already indented, giving a short first
 *   line.
 * @prop {boolean} [isCJK] If specified, override CJK detection by locale.
 * @prop {RegExp} [isNewline=DEFAULT_IS_NEWLINE] Regular expression that
 *   finds newlines for replacement with `newlineReplacement`.  Ensure you
 *   do not create a regular expression denial of service
 *   ({@link https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS | ReDoS})
 *   attack.  Make sure the expression has the `g` modifier.
 * @prop {string} [locale] Which locale to use when splitting by
 *   graphemes? Defaults to current locale of system, as calculated by the
 *   JS runtime.
 * @prop {string} [newline='\n'] String to insert at the end of every line,
 *   including the last one.
 * @prop {string} [newlineReplacement=SPACE] For every newline found with
 *   {@link isNewline}, insert this string.  Defaults to `" "` (single
 *   space).
 * @prop {LineWrap.OVERFLOW_VISIBLE| LineWrap.OVERFLOW_CLIP|
*   LineWrap.OVERFLOW_ANYWHERE} [overflow=LineWrapOptions.OVERFLOW_VISIBLE]
*   What to do with words that are longer than the line width?
* @prop {boolean} [verbose] Turn on verbose logging for debugging purposes.
* @prop {number} [width=80] Maximum number of graphemes per line,
*   *including* indentation.
* @prop {EscapeString} [escape] Function to escape the input string. The
*   escaping is performed after line breaking, with the intent that in the
*   final display, those escapes will be replaced appropriately.  Defaults
*   to an identity transform.
*/

/**
 * Identity transform.
 *
 * @type {EscapeString}
 * @private
 */
function noEscape(s) {
  return s;
}

export class LineWrap {
  /**
   * If a word is longer than the wrappable area, allow the word to go extend
   * past the width so that it is not broken.  This is the only way for long
   * URLs to still be clickable.
   */
  static OVERFLOW_VISIBLE = Symbol('overflow-visible');

  /**
   * If a word is longer than the wrappable area, cut it to size, dropping
   * the rest of the word, inserting an ellipsis at the end.
   */
  static OVERFLOW_CLIP = Symbol('overflow-clip');

  /**
   * If a word is longer than the wrappable area, split it into chunks that do
   * fit, inserting a hyphen at the end of each line.
   */
  static OVERFLOW_ANYWHERE = Symbol('overflow-anywhere');

  #stringWidth;
  #rules;
  #opts;

  /**
   * How to indent the first line, expanded to string
   * @type {number}
   */
  #firstIndent;

  /**
   * Indent expanded to string
   * @type {string}
   */
  #indent;

  /**
   * Length of indent in display cells
   * @type {number}
   */
  #indentWidth;

  /**
   * Width of #opts.newlineReplacement, in display cells
   * @type {number}
   */
  #replacementWidth;

  /**
   * Width of #opts.ellipsis or #opts.hyphen, in display cells
   * @type {number}
   */
  #enderWidth;

  /**
   * The working area, width - indent.
   * @type {number}
   */
  #workingWidth;

  /**
   * @type {Required<LineWrapOptions>}
   */
  static DEFAULT_OPTIONS = {
    escape: noEscape,
    ellipsis: '\u{2026}',
    example7: false,
    firstCol: NaN,
    hyphen: '-',
    includeANSI: false,
    indent: '',
    indentChar: ' ',
    indentEmpty: false,
    indentFirst: true,
    isCJK: false,
    isNewline: DEFAULT_IS_NEWLINE,
    locale: DEFAULT_LOCALE,
    newline: '\n',
    newlineReplacement: ' ',
    overflow: LineWrap.OVERFLOW_VISIBLE,
    verbose: false,
    width: 80,
  };

  /**
   * @param {LineWrapOptions} [opts={}]
   */
  constructor(opts = {}) {
    /**
     * @type {Required<LineWrapOptions>}
     */
    this.#opts = {
      ...LineWrap.DEFAULT_OPTIONS,
      ...opts,
    };
    this.#rules = new SpaceBreaker({
      example7: this.#opts.example7,
      verbose: this.#opts.verbose,
    });

    /**
     * Don't use this.#opts because it's polluted by the default
     * @type {{locale?: string, includeANSI?: boolean, isCJK?: boolean}}
     */
    const swOpts = {};
    if (typeof opts.locale === 'string') {
      swOpts.locale = opts.locale;
    }
    if (typeof opts.includeANSI === 'boolean') {
      swOpts.includeANSI = opts.includeANSI;
    }
    if (typeof opts.isCJK === 'boolean') {
      swOpts.isCJK = opts.isCJK;
    }
    this.#stringWidth = new StringWidth(swOpts);
    this.#opts.locale = this.#stringWidth.locale;
    this.#opts.isCJK = this.#stringWidth.isCJK;

    if (typeof this.#opts.indent === 'number') {
      this.#indent = ''.padEnd(
        this.#opts.indent * this.#opts.indentChar.length,
        this.#opts.indentChar
      );
      this.#indentWidth = this.#opts.indent;
    } else {
      this.#indent = this.#opts.indent;
      this.#indentWidth = this.#stringWidth.width(this.#indent);
    }
    this.#firstIndent = (this.#opts.indentFirst || isNaN(this.#opts.firstCol)) ?
      this.#indentWidth :
      this.#opts.firstCol;

    this.#workingWidth = this.#opts.width - this.#indentWidth;
    if (this.#workingWidth <= 0) {
      throw new Error(`No space to wrap, incompatible width and indent: ${this.#workingWidth}`);
    }
    this.#replacementWidth = this.#stringWidth.width(
      this.#opts.newlineReplacement
    );
    switch (this.#opts.overflow) {
      case LineWrap.OVERFLOW_VISIBLE:
        this.#enderWidth = 0;
        break;
      case LineWrap.OVERFLOW_CLIP:
        this.#enderWidth = this.#stringWidth.width(this.#opts.ellipsis);
        break;
      case LineWrap.OVERFLOW_ANYWHERE:
        this.#enderWidth = this.#stringWidth.width(this.#opts.hyphen);
        break;
      default:
        throw new Error(`Invalid overflow style: "${String(this.#opts.overflow)}"`);
    }
    if (this.#opts.firstCol > this.#opts.width - this.#enderWidth - 1) {
      throw new Error('No room for first line');
    }
  }

  /**
   * Did we determin that we are in a CJK context?  Useful for testing.
   */
  get isCJK() {
    return this.#opts.isCJK;
  }

  /**
   * The calculated locale.  Useful for testing.
   */
  get locale() {
    return this.#opts.locale;
  }

  /**
   * Handle words that are longer than width - #indentWidth according to
   * #opts.overflow.
   *
   * @param {Break} brk
   * @param {boolean} first
   */
  *#fragments(brk, first) {
    const seg = /** @type {string} */ (brk.string);
    const graphemes = this.#stringWidth.width(seg);
    const width = (first && !this.#opts.indentFirst) ?
      this.#opts.width - this.#firstIndent :
      this.#workingWidth;
    if (graphemes < width) {
      // Fits
      brk.props = {
        ...brk.props,
        space: Boolean(brk.props?.space),
        graphemes,
      };
      yield brk;
      return;
    }
    if (brk.props?.space) {
      // More spaces than width
      const b = new Break(-1, false);
      b.string = this.#opts.newlineReplacement;
      b.props = {
        ...brk.props,
        space: true,
        graphemes: this.#replacementWidth,
      };
      yield b;
      return;
    }
    // Long word
    switch (this.#opts.overflow) {
      case LineWrap.OVERFLOW_VISIBLE:
        brk.props = {...brk.props, graphemes};
        yield brk;
        break;
      case LineWrap.OVERFLOW_CLIP: {
        // Clip it, and end with an ellipsis
        const b = new Break(-1, false);
        const breaks = this.#stringWidth.break(
          seg,
          width - this.#enderWidth
        );
        // Note that breaks[0].cells might be less than width - enderWidth
        // assert(breaks.length > 0)
        // assert(!breaks[0].last)
        b.string = breaks[0].string + this.#opts.ellipsis;
        b.props = {...brk.props, graphemes: breaks[0].cells + this.#enderWidth};
        yield b;
        break;
      }
      case LineWrap.OVERFLOW_ANYWHERE: {
        const breaks = this.#stringWidth.break(
          seg,
          width - this.#enderWidth
        );
        for (const {string, cells, last} of breaks) {
          const b = new Break(-1, false);
          if (last) {
            b.string = string;
            b.props = {...brk.props, graphemes: cells};
          } else {
            b.string = string + this.#opts.hyphen;
            b.props = {...brk.props, graphemes: cells + this.#enderWidth};
          }
          yield b;
        }
      }
    }
  }

  /**
   * Split a string into chunks.  Each existing newline in the input creates a
   * chunk boundary.  Each URL is a chunk.  Each remaining linebreak segment
   * is a chunk
   *
   * @param {string} text
   */
  *#chunks(text) {
    const texts = this.#opts.isNewline ?
      text.split(this.#opts.isNewline) :
      [text];
    let first = true;
    for (const line of texts) {
      if (first) {
        first = false;
      } else if (this.#opts.newlineReplacement) {
        yield *this.#rules.breaks(this.#opts.newlineReplacement);
      }
      let offset = 0;
      // Stupid simple/fast regexp + real URL parser
      // Doesn't handle mailto: or xmpp:, but we can add those later.
      for (const m of line.matchAll(/[a-z]{2,8}:\/\/\S+/g)) {
        const ind = /** @type {number} */(m.index);
        if (ind > offset) {
          yield *this.#rules.breaks(line.slice(offset, m.index));
        }
        try {
          const _u = new URL(m[0]); // Side-effect: throw on invalid URL
          const b = new Break(-1); // Fake break segment.  Don't escape.
          b.string = m[0];
          b.props = {
            verbatim: true,
          };
          yield b;
        } catch {
          yield *this.#rules.breaks(m[0]);
        }
        offset = ind + m[0].length;
      }
      if (offset < line.length) {
        yield *this.#rules.breaks(line.slice(offset, line.length));
      }
    }
  }

  /**
   * Yield a succession of lines that fit, as best as possible, into the
   * possible width configured.  Lines will not have newlines appended,
   * but will be indented.
   *
   * @param {string} text The input string
   * @returns {Generator<string, void, undefined>}
   */
  *lines(text) {
    if (text.length === 0) {
      if (this.#opts.indentFirst) {
        yield this.#indent;
      }
      return;
    }

    let line = this.#opts.indentFirst ? this.#indent : '';
    let cur = this.#firstIndent;
    let spaces = '';
    let spLen = 0;
    let first = true;

    // TODO: if first && indentFirst, first chunk subject to firstCol

    for (const chunk of this.#chunks(text)) {
      for (const frag of this.#fragments(chunk, first)) {
        if (this.#opts.verbose) {
          console.log({frag, line, cur, spaces, spLen});
        }
        const fs = /** @type {string} */ (frag.string);
        // All fragments are either shorter than the working width, or we're
        // configured to go over.
        const seg = frag.props?.verbatim ?
          fs :
          this.#opts.escape.call(this, fs);
        if (frag.props?.space) {
          spaces += seg;
          spLen += /** @type {number} */ (frag.props?.graphemes);
        } else {
          const nonSpLen = /** @type {number} */ (frag.props?.graphemes);
          if (first) {
            // Beginning of line.  Always add something.
            line += seg;
            cur += nonSpLen;
            first = false;
          } else if (cur + spLen + nonSpLen <= this.#opts.width) {
            // Still room.  Add pending spaces then this word.
            line += spaces;
            cur += spLen;
            line += seg;
            cur += nonSpLen;
          } else {
            // No room.  Yield the previous line and then always add something.
            yield line;

            line = this.#indent + seg;
            cur = this.#indentWidth + nonSpLen;
          }
          spaces = ''; // Lose any pending spaces
          spLen = 0;
        }
      }
    }
    // Left-overs.  If !first, input was all spaces.
    if (!first) {
      yield line;
    }
  }

  /**
   * Wrap text, inserting a newline between each line.  No newline added at
   * the end.
   *
   * @param {string} text
   * @returns {string}
   */
  wrap(text) {
    return [...this.lines(text)].join(this.#opts.newline);
  }
}
