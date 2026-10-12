// The vowel chart as data and arithmetic: where each symbol sits, what it
// sounds like, and which key plays it. Nothing here touches the page.

// the chart's frame, in SVG units
const TOP = 50
const BOTTOM = 400
const RIGHT = 540
const TOP_LEFT = 60
const BOTTOM_LEFT = 300

// [F1, F2] in Hz for the sixteen cardinal vowels, male voice, from Catford,
// A Practical Introduction to Phonetics (2001), p. 154. Each edge runs
// close, close-mid, open-mid, open.
export const CARDINALS = {
  unrounded: {
    front: [
      [240, 2400],
      [390, 2300],
      [610, 1900],
      [850, 1610]
    ], // i e ɛ a
    back: [
      [300, 1390],
      [460, 1310],
      [600, 1170],
      [750, 940]
    ] // ɯ ɤ ʌ ɑ
  },
  rounded: {
    front: [
      [235, 2100],
      [370, 1900],
      [585, 1710],
      [820, 1530]
    ], // y ø œ ɶ
    back: [
      [250, 595],
      [360, 640],
      [500, 700],
      [700, 760]
    ] // u o ɔ ɒ
  }
}

// [symbol, u, v, rounded]. u runs front (0) to back (1), v runs close (0)
// to open (1). Only the sixteen above are measured, the rest are positions
// on the surface interpolated between them.
export const VOWELS = [
  ['i', 0, 0, false],
  ['y', 0, 0, true],
  ['ɨ', 0.5, 0, false],
  ['ʉ', 0.5, 0, true],
  ['ɯ', 1, 0, false],
  ['u', 1, 0, true],
  ['ɪ', 0.2, 1 / 6, false],
  ['ʏ', 0.2, 1 / 6, true],
  ['ʊ', 0.8, 1 / 6, true],
  ['e', 0, 1 / 3, false],
  ['ø', 0, 1 / 3, true],
  ['ɘ', 0.5, 1 / 3, false],
  ['ɵ', 0.5, 1 / 3, true],
  ['ɤ', 1, 1 / 3, false],
  ['o', 1, 1 / 3, true],
  ['ə', 0.5, 0.5, false],
  ['ɛ', 0, 2 / 3, false],
  ['œ', 0, 2 / 3, true],
  ['ɜ', 0.5, 2 / 3, false],
  ['ɞ', 0.5, 2 / 3, true],
  ['ʌ', 1, 2 / 3, false],
  ['ɔ', 1, 2 / 3, true],
  ['æ', 0, 5 / 6, false],
  ['ɐ', 0.5, 5 / 6, false],
  ['a', 0, 1, false],
  ['ɶ', 0, 1, true],
  ['ɑ', 1, 1, false],
  ['ɒ', 1, 1, true]
]

// Klatt's (1980) defaults for F4 and F5, which barely move between vowels,
// and for the bandwidths of F1 to F5
export const UPPER = [3300, 3750]
export const BANDWIDTHS = [50, 70, 110, 250, 200]

// The size of the speaker, in pitch order. Scale multiplies every formant,
// standing in for a shorter vocal tract. Mid and high are the average
// ratios to the low voice in Peterson and Barney (1952). Min and max sit at
// the ends of the pitch slider and their scales are extrapolated.
// The rest are offsets on the phonation below. Klatt and Klatt (1990) found
// their higher-voiced talkers breathier on average, and carrying that up to
// high and max is a guess.
// Jitter and shimmer are the half-width of a uniform per-cycle wobble in
// period and amplitude. The measured figure, the mean change from one cycle
// to the next, comes out at two thirds of this.
// Order matters: the voice key steps through them as listed.
export const VOICES = {
  min: {
    scale: 0.9,
    pitch: 70,
    openQuotient: 0,
    tilt: 0,
    breath: 0,
    jitter: 0.0075,
    shimmer: 0.035
  },
  low: {
    scale: 1,
    pitch: 120,
    openQuotient: 0,
    tilt: 0,
    breath: 0,
    jitter: 0.0075,
    shimmer: 0.035
  },
  mid: {
    scale: 1.18,
    pitch: 210,
    openQuotient: 0.1,
    tilt: 4,
    breath: 0.04,
    jitter: 0.009,
    shimmer: 0.035
  },
  high: {
    scale: 1.39,
    pitch: 265,
    openQuotient: 0.1,
    tilt: 3,
    breath: 0.04,
    jitter: 0.018,
    shimmer: 0.04
  },
  max: {
    scale: 1.5,
    pitch: 320,
    openQuotient: 0.1,
    tilt: 3,
    breath: 0.04,
    jitter: 0.018,
    shimmer: 0.04
  }
}

// How the vocal folds are held. Open quotient is the share of each cycle
// the glottis is open: about a third creaky, half modal, two thirds breathy.
// Tilt is dB lost at 3 kHz, rough multiplies the speaker's jitter and
// shimmer, and pitch multiplies the pitch slider.
export const PHONATIONS = {
  modal: {
    openQuotient: 0.5,
    tilt: 3,
    breath: 0.04,
    voicing: 1,
    rough: 1,
    diplophonia: 0,
    openBandwidth: 0,
    pitch: 1
  },
  breathy: {
    openQuotient: 0.67,
    tilt: 12,
    breath: 0.2,
    voicing: 0.8,
    rough: 1,
    diplophonia: 0,
    openBandwidth: 150,
    pitch: 1
  },
  creaky: {
    openQuotient: 0.33,
    tilt: 0,
    breath: 0.01,
    voicing: 1,
    rough: 6,
    diplophonia: 0.35,
    openBandwidth: 0,
    pitch: 0.6
  },
  whisper: {
    openQuotient: 0.67,
    tilt: 0,
    breath: 0.5,
    voicing: 0,
    rough: 1,
    diplophonia: 0,
    openBandwidth: 150,
    pitch: 1
  }
}

export const GLIDES = [
  ['aɪ', 'a', 'ɪ'],
  ['aʊ', 'a', 'ʊ'],
  ['ɔɪ', 'ɔ', 'ɪ'],
  ['eɪ', 'e', 'ɪ'],
  ['oʊ', 'o', 'ʊ']
]

// The four key rows are the four cardinal heights, close at the top, and
// each runs front to back. The fifth key of a row is the central column.
export const KEY_ROWS = [
  ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period']
]
export const KEY_POS = new Map(
  KEY_ROWS.flatMap((row, r) => row.map((code, c) => [code, [c / 8, r / 3]]))
)
// schwa sits between two rows, so it gets a key of its own
KEY_POS.set('Enter', [0.5, 0.5])

export const clamp = (n) => Math.min(1, Math.max(0, n))
export const lerp = (a, b, t) => a + (b - a) * t
// interpolate in log frequency, closer to how the ear spaces vowels
export const geo = (a, b, t) => a * (b / a) ** t
const leftAt = (v) => lerp(TOP_LEFT, BOTTOM_LEFT, v)

export function toXY(u, v) {
  const left = leftAt(v)
  return [lerp(left, RIGHT, u), lerp(TOP, BOTTOM, v)]
}

export function toUV(x, y) {
  const v = clamp((y - TOP) / (BOTTOM - TOP))
  const left = leftAt(v)
  return [clamp((x - left) / (RIGHT - left)), v]
}

// Walk down the front and back edges to height v, then across to u. Exact
// at every cardinal vowel. Scale is the voice's, see VOICES.
export function formants(u, v, rounded, scale = 1) {
  const { front, back } = CARDINALS[rounded ? 'rounded' : 'unrounded']
  const row = Math.min(2, Math.floor(v * 3))
  const t = v * 3 - row
  const [f1, f2] = [0, 1].map((i) =>
    geo(geo(front[row][i], front[row + 1][i], t), geo(back[row][i], back[row + 1][i], t), u)
  )
  // No F3 in the source. This is an estimate: flat for rounded vowels, and
  // rising with F2 for the front unrounded ones, where it reaches about 3000.
  const f3 = rounded ? 2200 : 2500 + Math.max(0, f2 - 1900)
  return [f1, f2, f3, ...UPPER].map((f) => f * scale)
}

export function nearest(u, v, rounded) {
  let best
  let min = Infinity
  for (const [symbol, vu, vv, vr] of VOWELS) {
    if (vr !== rounded) continue
    const d = Math.hypot(u - vu, v - vv)
    if (d < min) {
      min = d
      best = symbol
    }
  }
  return best
}
