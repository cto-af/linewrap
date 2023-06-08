import {LineBreak} from '@cto.af/linebreak'
import {SpaceBreaker} from '../lib/spacebreaker.js'
import assert from 'assert/strict'

function points(str) {
  return [...str].map(c => {
    const cp = c.codePointAt(0)
    return `${cp.toString(16).padStart(4, 0)}:${LineBreak.values[LineBreak.get(cp)]}`
  }).join(' ')
}

function assertBreaks(str, expected, opts) {
  const r = new SpaceBreaker(opts)
  const actual = [...r.breaks(str)].map(b => [
    b.position, Boolean(b.props?.space),
  ])
  assert.deepEqual(
    actual,
    expected,
    `${JSON.stringify(str)} ${points(str)}`
  )
}

describe('special space breaking', () => {
  it('marks runs of spaces with extra info', () => {
    assertBreaks(' 1', [[1, true], [2, false]])
    assertBreaks(' a', [[1, true], [2, false]])
    assertBreaks('a ', [[1, false], [2, true]])
    assertBreaks('a\u200Bb', [[2, false], [3, false]])
    assertBreaks('\u2014  \u2014', [[4, false]])
    assertBreaks('utf8 base64" Default:', [[4, false], [5, true], [13, false], [21, false]])
  })
})
