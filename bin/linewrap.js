#!/usr/bin/env node
/* eslint-disable no-console */

import {LineWrap} from '../lib/index.js'
import fs from 'fs'
import os from 'os'
import {parseArgs} from 'util'

const options = {
  options: {
    encoding: {
      short: 'e',
      type: 'string',
      default: 'utf8',
    },
    help: {
      short: 'h',
      type: 'boolean',
    },
    html: {type: 'boolean'},
    indent: {
      short: 'i',
      type: 'string',
      default: '',
    },
    locale: {
      short: 'l',
      type: 'string',
    },
    noTrim: {type: 'boolean'},
    outdentFirst: {type: 'boolean'},
    outFile: {
      short: 'o',
      type: 'string',
    },
    overflow: {
      type: 'string',
      default: 'visible',
    },
    text: {
      short: 't',
      type: 'string',
      multiple: true,
      default: [],
    },
    width: {
      short: 'w',
      type: 'string',
      default: String(process.stdout.columns),
    },
  },
  allowPositionals: true,
}

const {
  values: opts,
  positionals: args,
} = parseArgs(options)

if (opts.help) {
  // TODO: wrap!
  console.error(`\
Usage: wraps [options] [file...]

Wrap some text, either from file, stdin, or given on the command line.  Each
chunk of text is wrapped independently from one another, and streamed to stdout
(or an outFile, if given).  Command line arguments with -t/--text are processed
before files.

Arguments:
  file                          files to wrap and concatenate.  Use "-" for
                                stdin. (default: ["-"])

Options:
  --encoding <encoding>         encoding for files read or written.  stdout is
                                always in the default encoding. (choices:
                                "ascii", "utf8", "utf-8", "utf16le", "ucs2",
                                "ucs-2", "base64", "base64url", "latin1",
                                "binary", "hex", default: "utf8")
  -h, --help                    display help for command
  --html                        escape output for HTML
  -i,--indent <text or number>  indent each line with this text.  If a number,
                                indent that many spaces (default: "")
  -l,--locale <tag>             locale for word and grapheme segmentation
                                (default: Determined from your local
                                environment)
  --noTrim                      do not trim the last line
  -o,--outFile <file>           output to a file instead of stdout
  --outdentFirst                Do not indent the first output line
  -t,--text <text>              wrap this chunk of text.  If used, stdin is not
                                processed unless "-" is used explicitly.  Can
                                be specified multiple times. (default: [])
  -w,--width <number>           maximum line length (default: width of your
                                terminal)
`)
  process.exit(64)
}

if ((opts.text.length === 0) && (args.length === 0)) {
  args.push('-')
}

const overflow = {
  visible: LineWrap.OVERFLOW_VISIBLE,
  clip: LineWrap.OVERFLOW_CLIP,
  anywhere: LineWrap.OVERFLOW_ANYWHERE,
}[opts.overflow]

if (!overflow) {
  console.error(`Invalid overflow type "${opts.overflow}".  Must be one of "visible", "clip", or "anywhere".`)
  process.exit(64)
}

/**
 * Read stdin to completion with the configured encoding.
 *
 * @returns {Promise<string>}
 */
function readStdin() {
  // Below, d will be a string
  process.stdin.setEncoding(opts.encoding)
  return new Promise((resolve, reject) => {
    let s = ''
    process.stdin.on('data', d => (s += d))
    process.stdin.on('end', () => resolve(s))
    process.stdin.on('error', reject)
  })
}

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
  '\xA0': '&nbsp;',
}

/**
 * Escape HTML
 *
 * @param {string} str String containing prohibited characters.
 * @returns {string} Escaped string.
 * @private
 */
function htmlEscape(str) {
  return str.replace(/[&<>\xA0]/g, m => ESCAPES[m])
}

const outstream = opts.outFile ?
  fs.createWriteStream(opts.outFile, opts.encoding) :
  process.stdout // Don't set encoding, will confuse terminal.

async function main() {
  const w = new LineWrap({
    escape: opts.html ? htmlEscape : s => s,
    width: parseInt(opts.width, 10),
    locale: opts.locale,
    indent: parseInt(opts.indent, 10) || opts.indent,
    indentFirst: !opts.outdentFirst,
    newline: os.EOL,
    overflow,
    trim: !opts.noTrim,
  })

  for (const t of opts.text) {
    outstream.write(w.wrap(t))
    outstream.write(os.EOL)
  }

  for (const f of args) {
    const t = f === '-' ?
      await readStdin() :
      await fs.promises.readFile(f, opts.encoding)

    outstream.write(w.wrap(t))
    outstream.write(os.EOL)
  }

  outstream.end()
}

main().catch(e => {
  console.log(e.message)
  process.exit(1)
})
