import {
  LineBreakClasses, MAY_BREAK, MUST_BREAK, NO_BREAK, PASS, Rules, eot, sot,
} from '@cto.af/linebreak'

const {
  BA, B2, CL, CP, OP, SP, QU, ZW,
} = LineBreakClasses

// This is a hack on the real UAX #14 line breaking system, which makes this
// use of that algorithm NON-CONFORMANT.
//
// The idea is to limit us to one pass through a target string by also finding
// clumps of whitespace as we go.  Whitespace here is defined very much in a
// Western-European way, and isn't likely to work for all languages.
//
// In the future, this might be expanded to also do grapheme cluster counting
// so that a second pass doesn't have to be made after segmentation; all of
// the necessary data is available in the segmentation pass.

/**
 * For code points of linebreak class BA, some of them just count as "fancy
 * spaces" for line wrapping purposes.
 *
 * @param {string} char
 * @param {number} cls
 * @returns {boolean}
 */
function isFancySpace(char, cls) {
  if (cls === SP) {
    return true
  }
  if (cls !== BA) {
    return false
  }
  // 0009 TAB
  if (char === '\t') {
    return true
  }
  // 1680 OGHAM SPACE MARK, etc.
  return /^\p{gc=Zs}$/u.test(char)
}

/**
 * Before LB02.  Handle spaces at the beginning.
 *
 * @type {import('@cto.af/linebreak').BreakRule} state
 */
function initialSpaces(state) {
  if ((state.cur.cls === sot) &&
       isFancySpace(state.next.char, state.next.cls)) {
    state.extra.fancy = true
  }
  return PASS
}

/**
 * Replace LB03.  Handle spaces at the end.
 *
 * @type {import('@cto.af/linebreak').BreakRule} state
 */
export function trailingSpaces(state) {
  if ((state.next.cls === eot) &&
      ((state.cur.len === 0) || (state.cur.len !== state.prevChunk))) {
    if (state.extra.fancy) {
      state.setProp('space', true)
    }
    return MUST_BREAK
  }
  return PASS
}

/**
 * Before LBspacesStop.  Mark runs of spaces as such.
 *
 * @type {import('@cto.af/linebreak').BreakRule} state
 */
function LBspacesBreak(state) {
  if (state.extra.fancy) {
    if (!isFancySpace(state.next.char, state.next.cls)) {
      state.setProp('space', true)
      state.extra.fancy = false
      return MAY_BREAK
    }
    return NO_BREAK
  }
  return PASS
}

/**
 * Replace LB07.  Break before spaces runs.
 *
 * @type {import('@cto.af/linebreak').BreakRule} state
 */
function LBspacesStart(state) {
  // × ZW
  if (state.next.cls === ZW) {
    return NO_BREAK
  }

  if (state.next.cls === SP) {
    switch (state.cur.cls) {
      case ZW: // See LB8
      case OP: // See LB14
      case QU: // See LB15
      case CL: // See LB16
      case CP: // See LB16
      case B2: // See LB17
        return PASS
      default:
        state.extra.fancy = true
        return MAY_BREAK
    }
  }

  if (isFancySpace(state.next.char, state.next.cls)) {
    state.extra.fancy = true
    return MAY_BREAK
  }

  return PASS
}

/**
 * Replaces LB18.
 * @type {import('@cto.af/linebreak').BreakRule} state
 */
function LBbreakAfterSpace(state) {
  // SP ÷
  if (state.cur.cls === SP) {
    state.setProp('space', true)
    return MAY_BREAK
  }
  return PASS
}

export class SpaceBreaker extends Rules {
  /**
   *
   * @param {ConstructorParameters<typeof Rules>[0]} [opts={}]
   */
  constructor(opts = {}) {
    super({string: true, ...opts})
    this.addRuleBefore('LB02', initialSpaces)
    this.replaceRule('LB03', trailingSpaces)
    this.addRuleBefore('LBspacesStop', LBspacesBreak)
    this.replaceRule('LB07', LBspacesStart)
    this.replaceRule('LB18', LBbreakAfterSpace)
  }

  /**
   *
   * @param {import('@cto.af/linebreak/types/state.d.ts').BreakerState} state
   */
  static _initializeState(state) {
    state.extra.fancy = false
  }
}
