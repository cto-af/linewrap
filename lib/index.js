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
   * Length of writable area in graphemes
   * @type {number}
   */
  #width

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
   * @prop {boolean} [indentFirst=true] Indent the first line?
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

    this.#width = this.#opts.width - this.#graphemeCount(this.#indent)
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

    let cur = 0
    let line = this.#opts.indentFirst ? this.#indent : ''
    let spaces = ''
    for (const segment of this.#chunks(text)) {
      const seg = /** @type {string} */ (segment.string)
      if (segment.props?.space) {
        spaces += seg
      } else {
        const spLen = this.#graphemeCount(spaces)
        const nonSpLen = this.#graphemeCount(seg)

        if (cur + spLen + nonSpLen <= this.#width) {
          if (cur > 0) {
            // Don't add spaces at the beginning of the line
            line += spaces
            cur += spLen
          }
          line += seg
          cur += nonSpLen
          spaces = ''
        } else {
          if (cur > 0) {
            // Flush pending, if it exists.
            yield line
          }
          spaces = '' // Lose trailing spaces from previous line
          if (nonSpLen > this.#width) {
            switch (this.#opts.overflow) {
              case LineWrap.OVERFLOW_VISIBLE:
                yield this.#indent + seg
                cur = 0
                break
              case LineWrap.OVERFLOW_CLIP: {
                const elSize = this.#graphemeCount(this.#opts.ellipsis)
                yield this.#indent +
                  [...this.#graphemes.segment(seg)]
                    .slice(0, this.#width - elSize)
                    .map(s => s.segment)
                    .join('') +
                    this.#opts.ellipsis
                cur = 0
                break
              }
              case LineWrap.OVERFLOW_ANYWHERE: {
                const hySize = this.#graphemeCount(this.#opts.hyphen)
                const g = [...this.#graphemes.segment(seg)]
                const page = this.#width - hySize
                // Might be more that one line long.
                for (let offset = 0; offset < g.length; offset += page) {
                  if (cur > 0) {
                    yield line
                  }
                  const pg = g.slice(offset, offset + page)
                  line = this.#indent + pg.map(s => s.segment).join('')
                  cur = pg.length
                  if (offset + page < g.length) {
                    // No hyphen on the last line
                    line += this.#opts.hyphen
                    cur += hySize
                  }
                }
                break
              }
              default:
                throw new Error(`Invalid overflow style: "${String(this.#opts.overflow)}"`)
            }
          } else {
            line = this.#indent + seg
            cur = nonSpLen
          }
        }
      }
    }
    // Left-overs
    if (cur > 0) {
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
