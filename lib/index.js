import {Break} from '@cto.af/linebreak'
import {SpaceBreaker} from './spacebreaker.js'

const DEFAULT_LOCALE = new Intl.Segmenter().resolvedOptions().locale
const DEFAULT_IS_NEWLINE = /[^\S\r\n\v\f\x85\u2028\u2029]*[\r\n\v\f\x85\u2028\u2029]+\s*/gu

/**
 * @callback EscapeString
 * @param {string} s String to escape
 * @returns {string} Escaped string
 */

/**
 * Identity transform.
 *
 * @type {EscapeString}
 * @private
 */
function noEscape(s) {
  return s
}

export class LineWrap {
  static OVERFLOW_VISIBLE = Symbol('overflow-visible')
  static OVERFLOW_CLIP = Symbol('overflow-clip')
  static OVERFLOW_ANYWHERE = Symbol('overflow-clip')

  #graphemes
  #rules
  #opts

  /**
   * Indent expanded to string
   * @type {string}
   */
  #indent

  /**
   * Length of indent in graphemes
   * @type {number}
   */
  #indentWidth

  /**
   * Width of #opts.newlineReplacement, in graphemes
   * @type {number}
   */
  #replacementWidth

  /**
   * Width of #opts.ellipsis or #opts.hyphen, in graphemes
   * @type {number}
   */
  #enderWidth

  /**
   * The working area, width - indent.
   * @type {number}
   */
  #workingWidth

  /**
   * @typedef {object} LineWrapOptions
   * @prop {string} [ellipsis='\u{2026}'] String to use when long word is
   *   truncated with LineWrap.OVERFLOW_CLIP.
   * @prop {string} [hyphen='-'] String to use when long word is
   *   truncated split to next line with LineWrap.OVERFLOW_ANYWHERE.
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
   * @prop {RegExp} [isNewline=DEFAULT_IS_NEWLINE] Regular expression that
   *   finds newlines for replacement with `newlineReplacement`.  Ensure you
   *   do not create a regular expression denial of service
   *   ({@link https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS | ReDoS})
   *   attack.  Make sure the expression has the `\g` modifier.  Defaults to
   * @prop {string} [locale] Which locale to use when splitting by words or
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
   * @prop {number} [width=80] Maximum number of graphemes per line,
   *   *including* indentation.
   * @prop {EscapeString} [escape] Function to escape the input string. The
   *   escaping is performed after line breaking, with the intent that in the
   *   final display, those escapes will be replaced appropriately.  Defaults
   *   to an identity transform.
   */

  /**
   * @param {LineWrapOptions} [opts={}]
   */
  constructor(opts = {}) {
    /**
     * @type {Required<LineWrapOptions>}
     */
    this.#opts = {
      escape: noEscape,
      ellipsis: '\u{2026}',
      hyphen: '-',
      indent: '',
      indentChar: ' ',
      indentEmpty: false,
      indentFirst: true,
      isNewline: DEFAULT_IS_NEWLINE,
      locale: DEFAULT_LOCALE,
      newline: '\n',
      newlineReplacement: ' ',
      overflow: LineWrap.OVERFLOW_VISIBLE,
      width: 80,
      ...opts,
    }
    this.#rules = new SpaceBreaker()
    this.#graphemes = new Intl.Segmenter(this.#opts.locale, {
      granularity: 'grapheme',
    })

    this.#indent = (typeof this.#opts.indent === 'number') ?
      ''.padEnd(this.#opts.indent * this.#opts.indentChar.length, this.#opts.indentChar) :
      this.#opts.indent

    this.#indentWidth = this.#graphemeCount(this.#indent)
    this.#workingWidth = this.#opts.width - this.#indentWidth
    if (this.#workingWidth <= 0) {
      throw new Error(`No space to wrap, incompatible width and indent: ${this.#workingWidth}`)
    }
    this.#replacementWidth = this.#graphemeCount(this.#opts.newlineReplacement)
    switch (this.#opts.overflow) {
      case LineWrap.OVERFLOW_VISIBLE:
        this.#enderWidth = NaN
        break
      case LineWrap.OVERFLOW_CLIP:
        this.#enderWidth = this.#graphemeCount(this.#opts.ellipsis)
        break
      case LineWrap.OVERFLOW_ANYWHERE:
        this.#enderWidth = this.#graphemeCount(this.#opts.hyphen)
        break
      default:
        throw new Error(`Invalid overflow style: "${String(this.#opts.overflow)}"`)
    }
  }

  /**
   * How many graphemes are in this string?
   *
   * @param {string} str
   * @returns {number}
   */
  #graphemeCount(str) {
    // TODO: count widths better, including ZW and ea=F
    let ret = 0
    for (const _ of this.#graphemes.segment(str)) {
      ret++
    }
    return ret
  }

  /**
   * Handle words that are longer than width - #indentWidth according to
   * #opts.overflow.
   *
   * @param {Break} brk
   */
  *#fragments(brk) {
    const seg = /** @type {string} */ (brk.string)
    const graphemes = this.#graphemeCount(seg)
    if (graphemes < this.#workingWidth) {
      // Fits
      brk.props = {
        space: Boolean(brk.props?.space),
        graphemes,
      }
      yield brk
      return
    }
    if (brk.props?.space) {
      // More spaces than width
      const b = new Break(-1, false)
      b.string = this.#opts.newlineReplacement
      b.props = {
        space: true,
        graphemes: this.#replacementWidth,
      }
      yield b
      return
    }
    // Long word
    switch (this.#opts.overflow) {
      case LineWrap.OVERFLOW_VISIBLE:
        brk.props = {graphemes}
        yield brk
        break
      case LineWrap.OVERFLOW_CLIP: {
        // Clip it, and end with an ellipsis
        const b = new Break(-1, false)
        b.string = [...this.#graphemes.segment(seg)]
          .slice(0, this.#workingWidth - this.#enderWidth)
          .map(s => s.segment)
          .join('') +
          this.#opts.ellipsis
        b.props = {graphemes: this.#workingWidth}
        yield b
        break
      }
      case LineWrap.OVERFLOW_ANYWHERE: {
        const g = [...this.#graphemes.segment(seg)]
        const page = this.#workingWidth - this.#enderWidth
        // Might be more that one line long.
        for (let offset = 0; offset < g.length; offset += page) {
          const b = new Break(-1, false)
          const pg = g.slice(offset, offset + page)
          b.string = pg.map(s => s.segment).join('')
          b.props = {graphemes: pg.length}
          if (offset + page < g.length) {
            b.string += this.#opts.hyphen
            b.props.graphemes += this.#enderWidth
          }
          yield b
        }
        break
      }
    }
  }

  /**
   * Split a string into chunks.  Each existing newline in the input creates a
   * chunk boundary.  Each URL is a chunk.  Each remaining linebreak segment
   * is a chunk, which has had the escape function performed on it.
   *
   * @param {string} text
   */
  *#chunks(text) {
    const texts = this.#opts.isNewline ?
      text.split(this.#opts.isNewline) :
      [text]
    let first = true
    for (const line of texts) {
      if (first) {
        first = false
      } else if (this.#opts.newlineReplacement) {
        yield *this.#rules.breaks(this.#opts.newlineReplacement)
      }
      let offset = 0
      // Stupid simple/fast regexp + real URL parser
      // Doesn't handle mailto: or xmpp:, but we can add those later.
      for (const m of line.matchAll(/[a-z]{2,8}:\/\/\S+/g)) {
        const ind = /** @type {number} */(m.index)
        if (ind > offset) {
          yield *this.#rules.breaks(
            this.#opts.escape(line.slice(offset, m.index))
          )
        }
        try {
          const _u = new URL(m[0])
          const b = new Break(-1) // Fake break segment.  Don't escape.
          ;[b.string] = m
          yield b
        } catch {
          yield *this.#rules.breaks(
            this.#opts.escape(m[0])
          )
        }
        offset = ind + m[0].length
      }
      if (offset < line.length) {
        yield *this.#rules.breaks(
          this.#opts.escape(line.slice(offset, line.length))
        )
      }
    }
  }

  /**
   * Yield a succession of lines that fit, as best as possible, into the
   * possible width configured.  Lines will not have newlines appended,
   * but will be indented.
   *
   * @param {string} text The input string
   */
  *lines(text) {
    if (text.length === 0) {
      if (this.#opts.indentFirst) {
        yield this.#indent
      }
      return
    }

    let line = this.#opts.indentFirst ? this.#indent : ''
    let cur = this.#indentWidth // Either way
    let spaces = ''
    let spLen = 0
    for (const chunk of this.#chunks(text)) {
      for (const frag of this.#fragments(chunk)) {
        // All fragments are either shorter than the working width, or we're
        // configured to go over.
        const seg = /** @type {string} */ (frag.string)
        if (frag.props?.space) {
          spaces += seg
          spLen += /** @type {number} */ (frag.props?.graphemes ?? NaN)
        } else {
          const nonSpLen = /** @type {number} */ (frag.props?.graphemes ?? NaN)
          if (cur === this.#indentWidth) {
            // Beginning of line.  Always add something.
            line += seg
            cur += nonSpLen
            spaces = ''
            spLen = 0
          } else if (cur + spLen + nonSpLen <= this.#opts.width) {
            // Still room.  Add pending spaces then this word.
            line += spaces
            cur += spLen
            line += seg
            cur += nonSpLen
            spaces = ''
            spLen = 0
          } else {
            // No room.  Yield the previous line and then always add something.
            yield line

            line = this.#indent + seg
            cur = this.#indentWidth + nonSpLen
            spaces = '' // Lose any pending spaces
            spLen = 0
          }
        }
      }
    }
    // Left-overs
    if (cur > this.#indentWidth) {
      yield line
    }
  }

  /**
   * Wrap text.  No newline added at the end.
   *
   * @param {string} text
   * @returns {string}
   */
  wrap(text) {
    return [...this.lines(text)].join(this.#opts.newline)
  }
}
