// The vowel chart as data and arithmetic. Nothing here touches the page.

// the chart's frame, in SVG units
const TOP = 50
const BOTTOM = 400
const RIGHT = 540
const TOP_LEFT = 60
const BOTTOM_LEFT = 300

// [F1, F2] in Hz for the sixteen cardinal vowels, male voice. Catford, A
// Practical Introduction to Phonetics (2001), p. 154. Each edge runs close,
// close-mid, open-mid, open.
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

// [symbol, u, v, rounded]. u runs front (0) to back (1), v close (0) to open
// (1). Only the sixteen above are measured. The rest are interpolated.
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

// Klatt's (1980) defaults for F4 to F6 and for the bandwidths of F1 to F6. He
// stopped there, sampling at 10 kHz. The four above F6 are a guess: one more
// per kHz as in a uniform tube, each as wide as F6. Without them nothing sounds
// above 4 kHz.
export const UPPER = [3300, 3750, 4900, 5900, 6900, 7900, 8900]
export const BANDWIDTHS = [50, 70, 110, 250, 200, 1000, 1000, 1000, 1000, 1000]

// Speaker size, in pitch order. Scale multiplies every formant, standing in for
// a shorter vocal tract. Mid and high are the average ratios to the low voice
// in Peterson and Barney (1952). Min and max sit at the ends of the pitch
// slider, their scales extrapolated.
// The rest are offsets on the phonation below. Klatt and Klatt (1990) found
// higher-voiced talkers breathier on average. Carrying that up to high and max
// is a guess.
// Jitter and shimmer are the half-width of a uniform per-cycle wobble in period
// and amplitude. The measured figure, the mean change between cycles, is two
// thirds of this.
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

// How the vocal folds are held. Open quotient is the share of each cycle the
// glottis is open: about a third creaky, half modal, two thirds breathy. Tilt
// is dB lost at 3 kHz, rough multiplies the speaker's jitter and shimmer, and
// pitch multiplies the pitch slider.
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

// The four key rows are the four cardinal heights, close at the top, each
// running front to back. A row's fifth key is the central column.
export const KEY_ROWS = [
  ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period']
]
export const KEY_POS = new Map(
  KEY_ROWS.flatMap((row, r) => row.map((code, c) => [code, [c / 8, r / 3]]))
)
// schwa sits between two rows, so it has its own key
KEY_POS.set('Digit0', [0.5, 0.5])

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

// Walk down the front and back edges to height v, then across to u. Exact at
// every cardinal vowel. Scale is the voice's, see VOICES.
export function formants(u, v, rounded, scale = 1) {
  const { front, back } = CARDINALS[rounded ? 'rounded' : 'unrounded']
  const row = Math.min(2, Math.floor(v * 3))
  const t = v * 3 - row
  const [f1, f2] = [0, 1].map((i) =>
    geo(geo(front[row][i], front[row + 1][i], t), geo(back[row][i], back[row + 1][i], t), u)
  )
  // No F3 in the source. An estimate: flat for rounded vowels, rising with F2
  // for front unrounded ones, where it reaches about 3000.
  const f3 = rounded ? 2200 : 2500 + Math.max(0, f2 - 1900)
  return [f1, f2, f3, ...UPPER].map((f) => f * scale)
}

const HEIGHTS = ['close', 'near-close', 'close-mid', 'mid', 'open-mid', 'near-open', 'open']
const BACKNESS = new Map([
  [0, 'front'],
  [0.2, 'near-front'],
  [0.5, 'central'],
  [0.8, 'near-back'],
  [1, 'back']
])

// A symbol's name in IPA terms, or nothing for a string that is not one, such
// as a diphthong. The lone central symbols, ə and ɐ, are not specified for
// rounding, so theirs is left out.
export function describe(symbol) {
  const vowel = VOWELS.find(([other]) => other === symbol)
  if (!vowel) return ''
  const [, u, v, rounded] = vowel
  const paired = VOWELS.some(([other, ou, ov]) => other !== symbol && ou === u && ov === v)
  const lips = u === 0.5 && !paired ? '' : rounded ? ' rounded' : ' unrounded'
  return `${HEIGHTS[Math.round(v * 6)]} ${BACKNESS.get(u)}${lips}`
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

const STEPS = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }
const BENDS = { '#': 1, b: -1 }
// a note's pitch in Hz, such as A2, C#3, or Bb3, with A4 at 440
export function noteHz(name) {
  const bend = name.length === 3 ? BENDS[name[1]] : 0
  return 440 * 2 ** ((STEPS[name[0]] + bend + (name.at(-1) - 4) * 12) / 12)
}

// note/beats/vowel, with a dash for a rest
const score = (text) =>
  text
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [note, beats, symbol] = token.split('/')
      return { hz: note === '-' ? 0 : noteHz(note), beats: Number(beats), symbol }
    })

// fold a pitch by octaves into the octave starting at low
const fold = (hz, low) => hz * 2 ** -Math.floor(Math.log2(hz / low))
// The bass keeps to the octave from D2. The middle voice picks its own notes
// between G2 and G#3.
const BASS_LOW = 73
const MID_LOW = 98
const MID_HIGH = 208
// a repeated note takes the second vowel, so it is heard again
const turn = (part, hz, [first, second]) =>
  part.at(-1)?.hz === hz && part.at(-1).symbol === first ? second : first

// The middle voice's chord tone nearest its last note, so it keeps a note two
// chords share and otherwise moves by the smallest step. It sings thirds and
// fifths and leaves roots to the bass.
function nearestTone(root, third, last, skip) {
  let best
  for (const step of [third, 7]) {
    for (const octave of [0.5, 1, 2]) {
      const hz = root * octave * 2 ** (step / 12)
      if (hz < MID_LOW || hz > MID_HIGH || hz === skip) continue
      if (!best || Math.abs(Math.log(hz / last)) < Math.abs(Math.log(best / last))) best = hz
    }
  }
  return best
}

// The chord's note a minor third or more under a note of the tune, as near as
// the chord allows. Never under the middle voice's floor, so under a very low
// note it comes out above.
function under(root, third, hz) {
  const tones = [0, third, 7]
    .flatMap((step) => [1, 2, 4].map((octave) => root * octave * 2 ** (step / 12)))
    .filter((tone) => tone >= MID_LOW)
  const below = tones.filter((tone) => tone <= hz / 2 ** (3 / 12) + 1e-9)
  return below.length ? Math.max(...below) : Math.min(...tones)
}

// Two parts under a tune from its chords, written chord/beats with a dash for a
// rest. The song falls into quarters. First: the bass takes the front of each
// chord and the middle voice answers on the back. Second and last: the bass
// holds each root while the middle voice sings along under the tune, in its
// rhythm, or answers as before if no tune is given. Third: both hold while one
// or the other moves to another note of the chord. Both hold the last chord. A
// chord under two beats is sung whole.
// The middle voice keeps to [ə] and [e], which sound at an even level. An open
// vowel such as [ɑ] is several times louder and overdrives.
export function harmony(text, tune = []) {
  const chords = text
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [name, length] = token.split('/')
      const minor = name.endsWith('m')
      return {
        root: name === '-' ? 0 : fold(noteHz(`${minor ? name.slice(0, -1) : name}4`), BASS_LOW),
        third: minor ? 3 : 4,
        beats: Number(length)
      }
    })
  const total = chords.reduce((sum, chord) => sum + chord.beats, 0)
  const final = chords.findLast((chord) => chord.root)
  // when each note of the tune starts and ends, in beats
  const spans = []
  for (const { hz, beats } of tune) {
    const from = spans.at(-1)?.[1] ?? 0
    spans.push([from, from + beats, hz])
  }
  const bass = []
  const mid = []
  const low = (hz, beats) => bass.push({ hz, beats, symbol: turn(bass, hz, 'ou') })
  const high = (hz, beats) => mid.push({ hz, beats, symbol: turn(mid, hz, 'əe') })
  let at = 0
  let last = 147
  let moves = 0
  for (const chord of chords) {
    const { root, third, beats } = chord
    const start = at
    const quarter = Math.floor((4 * at) / total)
    at += beats
    if (!root) {
      low(0, beats)
      high(0, beats)
      continue
    }
    const tone = nearestTone(root, third, last)
    last = tone
    if (chord === final) {
      low(root, beats)
      high(tone, beats)
    } else if (quarter % 2 && spans.length) {
      low(root, beats)
      for (const [from, to, hz] of spans) {
        const length = Math.min(to, at) - Math.max(from, start)
        if (length > 0) high(hz && under(root, third, hz), length)
      }
    } else if (beats < 2) {
      low(root, beats)
      high(tone, beats)
    } else if (quarter === 2) {
      if (moves++ % 2) {
        // the middle voice moves to the chord's other note
        last = nearestTone(root, third, tone, tone)
        low(root, beats)
        high(tone, beats / 2)
        high(last, beats / 2)
      } else {
        // the bass moves to the fifth
        low(root, beats / 2)
        low(fold(root * 2 ** (7 / 12), BASS_LOW), beats / 2)
        high(tone, beats)
      }
    } else {
      // the first beat of three, or the first half
      const front = beats % 3 ? beats / 2 : beats / 3
      low(root, front)
      low(0, beats - front)
      high(0, front)
      high(tone, beats - front)
    }
  }
  return { bass, mid }
}

// a bass and a middle part given note by note, then any parts from harmony
const parts = (bass, mid, rest = { bass: [], mid: [] }) => ({
  bass: [...score(bass), ...rest.bass],
  mid: [...score(mid), ...rest.mid]
})

// The songs, in play order. A tune is a bar to a line, with the length of a
// beat in ms. Every note is on the pitch slider and under its vowel's F1, so
// high notes take open vowels, as a singer's do. A short song cuts every note
// off early. All are public domain tunes, each in a key that fits the slider.
// The chords are for the two voices that join in, see harmony. A song can give
// those parts note by note instead, see parts.
export const SONGS = [
  // Korobeiniki, a Russian folk song, the tune twice. Each note is sung on the
  // vowel of its syllable in the first verse of the Russian words, fitted to
  // the tune by ear.
  {
    title: 'Korobeiniki',
    chords: `
      G#/4 C#m/4 G#/4 C#m/4 F#m/4 E/4 G#/4 C#m/4
      G#/4 C#m/4 G#/4 C#m/4 F#m/4 E/4 G#/4 C#m/4
    `,
    beat: 400,
    short: true,
    tune: `
      G#3/1/o Eb3/.5/o E3/.5/ɨ F#3/1/o E3/.5/a Eb3/.5/a
      C#3/1/o C#3/.5/a E3/.5/o G#3/1/o F#3/.5/u E3/.5/a
      Eb3/1.5/e E3/.5/i F#3/1/i G#3/1/ɨ
      E3/1/i C#3/1/a C#3/2/a
      -/.5 F#3/1/o A3/.5/a C#4/1/e B3/.5/u A3/.5/a
      G#3/1.5/a E3/.5/o G#3/1/u F#3/.5/a E3/.5/a
      Eb3/1/o Eb3/.5/o E3/.5/e F#3/1/o G#3/1/o
      E3/1/e C#3/1/a C#3/1/a -/1
      G#3/1/o Eb3/.5/o E3/.5/ɨ F#3/1/o E3/.5/a Eb3/.5/a
      C#3/1/o C#3/.5/a E3/.5/o G#3/1/o F#3/.5/u E3/.5/a
      Eb3/1.5/e E3/.5/i F#3/1/i G#3/1/ɨ
      E3/1/i C#3/1/a C#3/2/a
      -/.5 F#3/1/o A3/.5/a C#4/1/e B3/.5/u A3/.5/a
      G#3/1.5/a E3/.5/o G#3/1/u F#3/.5/a E3/.5/a
      Eb3/1/o Eb3/.5/o E3/.5/e F#3/1/o G#3/1/o
      E3/1/e C#3/1/a C#3/1/a -/1
    `
  },
  // Strauss, the first waltz, moved to F. The tune is the page's own voice
  // and the two high chords that answer each phrase are the choir's, read
  // from the right hand of the piano score. Once the answers stop, the choir
  // goes back to harmony from the chords.
  {
    title: 'Blue Danube',
    chords: parts(
      `
        -/1
        -/5 A3/1/ə A3/2/e F3/1/ə F3/2/e -/1
        -/5 Bb3/1/ə Bb3/2/e E3/1/ə E3/2/e -/1
        -/5 Bb3/1/ə Bb3/2/e E3/1/ə E3/2/e -/1
        -/5 A3/1/ə A3/2/e F3/1/ə F3/2/e -/1
        -/5 C4/1/ə C4/2/e A3/1/ə A3/2/e -/1
        -/5 D4/1/ə D4/2/e Bb3/1/ə Bb3/2/e -/1
      `,
      `
        -/1
        -/5 C4/1/ə C4/2/e A3/1/ə A3/2/e -/1
        -/5 C4/1/ə C4/2/e Bb3/1/ə Bb3/2/e -/1
        -/5 D4/1/ə D4/2/e Bb3/1/ə Bb3/2/e -/1
        -/5 D4/1/ə D4/2/e A3/1/ə A3/2/e -/1
        -/5 F4/1/ə F4/2/e C4/1/ə C4/2/e -/1
        -/5 F4/1/ə F4/2/e D4/1/ə D4/2/e -/1
      `,
      harmony('Gm/3 C/3 C/3 F/3 F/3 Bb/3 C/3 F/3 F/1')
    ),
    beat: 330,
    tune: `
      F2/1/o
      F2/1/u A2/1/ɑ C3/1/o
      C3/2/ɔ -/1
      -/3
      -/2 F2/1/o
      F2/1/u A2/1/ɑ C3/1/o
      C3/2/ɔ -/1
      -/3
      -/2 E2/1/i
      E2/1/e G2/1/e D3/1/ɔ
      D3/2/o -/1
      -/3
      -/2 E2/1/i
      E2/1/e G2/1/e D3/1/ɔ
      D3/2/o -/1
      -/3
      -/2 F2/1/o
      F2/1/u A2/1/ɑ C3/1/o
      F3/2/ɛ -/1
      -/3
      -/2 F2/1/o
      F2/1/u A2/1/ɑ C3/1/o
      F3/2/ɛ -/1
      -/3
      -/2 G2/1/e
      G2/1/i Bb2/1/i D3/1/ɔ
      D3/4/o B2/1/u C3/1/o
      A3/4/e F3/1/ɛ A2/1/ɑ
      A2/2/a G2/1/e
      D3/2/ɔ C3/1/o
      F2/1.5/o F3/.5/ɛ F3/1/e
      F3/1/ɛ
    `
  },
  // What Shall We Do with the Drunken Sailor, a traditional shanty in the
  // dorian mode, two verses and the chorus after each. Each note is sung on
  // the vowel of its syllable in the words.
  {
    title: 'Drunken Sailor',
    chords: `
      C#m/4 B/4 C#m/4 B/2 C#m/2 C#m/4 B/4 C#m/4
      B/2 C#m/2 C#m/4 B/4 C#m/4 B/2 C#m/2 C#m/4
      B/4 C#m/4 B/2 C#m/2
    `,
    beat: 440,
    short: true,
    tune: `
      G#3/.5/ʌ G#3/.25/æ G#3/.25/i G#3/.5/u G#3/.25/ɪ G#3/.25/ə G#3/.5/ʌ C#3/.5/ə E3/.5/e G#3/.5/ə
      F#3/.5/ʌ F#3/.25/æ F#3/.25/i F#3/.5/u F#3/.25/ɪ F#3/.25/ə F#3/.5/ʌ B2/.5/ə Eb3/.5/e F#3/.5/ə
      G#3/.5/ʌ G#3/.25/æ G#3/.25/i G#3/.5/u G#3/.25/ɪ G#3/.25/ə G#3/.5/ʌ Bb3/.5/ə B3/.5/e C#4/.5/ə
      B3/.5/ɜ G#3/.5/i F#3/.5/ɪ Eb3/.5/ə C#3/1/ɔ C#3/1/ɪ
      G#3/1/e G#3/.5/e G#3/.5/æ G#3/.5/ʌ C#3/.5/i E3/.5/a G#3/.5/ɪ
      F#3/1/e F#3/.5/e F#3/.5/æ F#3/.5/ʌ B2/.5/i Eb3/.5/a F#3/.5/ɪ
      G#3/1/e G#3/.5/e G#3/.5/æ G#3/.5/ʌ Bb3/.5/i B3/.5/a C#4/.5/ɪ
      B3/.5/ɜ G#3/.5/i F#3/.5/ɪ Eb3/.5/ə C#3/1/ɔ C#3/1/ɪ
      G#3/.5/ʊ G#3/.25/ɪ G#3/.25/ɪ G#3/.5/ə G#3/.25/ɔ G#3/.25/o G#3/.5/ɪ C#3/.5/i E3/.5/o G#3/.5/ə
      F#3/.5/ʊ F#3/.25/ɪ F#3/.25/ɪ F#3/.5/ə F#3/.25/ɔ F#3/.25/o F#3/.5/ɪ B2/.5/i Eb3/.5/o F#3/.5/ə
      G#3/.5/ʊ G#3/.25/ɪ G#3/.25/ɪ G#3/.5/ə G#3/.25/ɔ G#3/.25/o G#3/.5/ɪ Bb3/.5/i B3/.5/o C#4/.5/ə
      B3/.5/ɜ G#3/.5/i F#3/.5/ɪ Eb3/.5/ə C#3/1/ɔ C#3/1/ɪ
      G#3/1/e G#3/.5/e G#3/.5/æ G#3/.5/ʌ C#3/.5/i E3/.5/a G#3/.5/ɪ
      F#3/1/e F#3/.5/e F#3/.5/æ F#3/.5/ʌ B2/.5/i Eb3/.5/a F#3/.5/ɪ
      G#3/1/e G#3/.5/e G#3/.5/æ G#3/.5/ʌ Bb3/.5/i B3/.5/a C#4/.5/ɪ
      B3/.5/ɜ G#3/.5/i F#3/.5/ɪ Eb3/.5/ə C#3/1/ɔ C#3/1/ɪ
    `
  },
  // Offenbach, the galop from Orpheus in the Underworld, two beats to a bar
  {
    title: 'Can-Can',
    chords: `
      D/2 A/2 D/2 D/2 A/2 A/2 D/2 A/2
      D/2 A/2 D/2 D/2 A/2 A/2 D/1 A/1
      D/1 -/1
    `,
    beat: 380,
    tune: `
      D3/2/ɔ
      E3/.5/i G3/.5/o F#3/.5/e E3/.5/i
      A3/1/e A3/1/ɛ
      A3/.5/e B3/.5/ɛ F#3/.5/e G3/.5/o
      E3/1/i E3/1/e
      E3/.5/i G3/.5/o F#3/.5/e E3/.5/i
      D3/.5/ɔ D4/.5/a C#4/.5/ɑ B3/.5/ɛ
      A3/.5/e G3/.5/o F#3/.5/e E3/.5/i
      D3/2/ɔ
      E3/.5/i G3/.5/o F#3/.5/e E3/.5/i
      A3/1/e A3/1/ɛ
      A3/.5/e B3/.5/ɛ F#3/.5/e G3/.5/o
      E3/1/i E3/1/e
      E3/.5/i G3/.5/o F#3/.5/e E3/.5/i
      D3/.5/ɔ A3/.5/e E3/.5/i F#3/.5/e
      D3/1/ɔ -/1
    `
  },
  // Grieg, from Peer Gynt, moved to D minor
  {
    title: 'Mountain King',
    chords: `
      Dm/4 E/2 Eb/2 Dm/4 F/4 Dm/4 E/2 Eb/2
      Dm/4 F/4 A/4 Db/2 A/2 A/4 Db/2 A/2
      Dm/4 E/2 Eb/2 Dm/4 F/4
    `,
    beat: 430,
    short: true,
    tune: `
      D3/.5/ɔ E3/.5/i F3/.5/ɛ G3/.5/o A3/.5/e F3/.5/ɛ A3/1/e
      G#3/.5/ɔ E3/.5/i G#3/1/ɔ G3/.5/o Eb3/.5/e G3/1/o
      D3/.5/ɔ E3/.5/i F3/.5/ɛ G3/.5/o A3/.5/e F3/.5/ɛ A3/.5/e D4/.5/a
      C4/.5/a A3/.5/e F3/.5/ɛ A3/.5/e C4/2/a
      D3/.5/ɔ E3/.5/i F3/.5/ɛ G3/.5/o A3/.5/e F3/.5/ɛ A3/1/e
      G#3/.5/ɔ E3/.5/i G#3/1/ɔ G3/.5/o Eb3/.5/e G3/1/o
      D3/.5/ɔ E3/.5/i F3/.5/ɛ G3/.5/o A3/.5/e F3/.5/ɛ A3/.5/e D4/.5/a
      C4/.5/a A3/.5/e F3/.5/ɛ A3/.5/e C4/2/a
      A2/.5/ɑ B2/.5/u C#3/.5/u D3/.5/ɔ E3/.5/i C#3/.5/u E3/1/i
      F3/.5/ɛ C#3/.5/u F3/1/ɛ E3/.5/i C#3/.5/u E3/1/i
      A2/.5/ɑ B2/.5/u C#3/.5/u D3/.5/ɔ E3/.5/i C#3/.5/u E3/1/i
      F3/.5/ɛ C#3/.5/u F3/1/ɛ E3/2/i
      D3/.5/ɔ E3/.5/i F3/.5/ɛ G3/.5/o A3/.5/e F3/.5/ɛ A3/1/e
      G#3/.5/ɔ E3/.5/i G#3/1/ɔ G3/.5/o Eb3/.5/e G3/1/o
      D3/.5/ɔ E3/.5/i F3/.5/ɛ G3/.5/o A3/.5/e F3/.5/ɛ A3/.5/e D4/.5/a
      C4/.5/a A3/.5/e F3/.5/ɛ A3/.5/e C4/2/a
    `
  },
  // Waldteufel, the first waltz, an octave down
  {
    title: "Skaters' Waltz",
    chords: `
      A/3 A/3 E/3 E/3 E/3 E/3 A/3 A/3
      F#m/3 F#m/3 Bm/3 Bm/3 E/3 E/3 A/3 A/1
      -/2
    `,
    beat: 312,
    tune: `
      C#3/3/u
      E3/2/i F#3/1/e
      F#3/3/i F#3/3/e
      D3/3/ɔ
      F#3/2/e G#3/1/ɔ
      G#3/3/o G#3/3/ɔ
      B3/3/ɛ
      A3/2/e C#3/1/u
      E3/3/i
      F#3/2/e C#3/1/u
      G#3/3/ɔ
      G#3/3/o
      A3/4/e -/2
    `
  },
  // Soon May the Wellerman Come, a New Zealand whaling song, verse and
  // chorus. The notes follow a setting on The Session. Each note is sung on
  // the vowel of its syllable in the words.
  {
    title: 'Wellerman',
    chords: `
      -/1 Bbm/4 Bbm/4 Ebm/4 Bbm/4 Bbm/4 Bbm/4 Ebm/2
      Bbm/1 F/1 Bbm/3 -/1 F#/4 C#/4 Ebm/4 Bbm/4
      F#/4 C#/4 F/4 Bbm/3
    `,
    beat: 380,
    short: true,
    tune: `
      F3/1/ɛ
      Bb2/1/ʌ Bb2/.5/ʌ Bb2/.5/ə Bb2/1/ɪ C#3/.5/æ C#3/.5/ʊ
      F3/1/u F3/1/i F3/1/i F3/.5/æ F3/.5/ə
      F#3/1/e Eb3/.5/ə Eb3/.5/ə Eb3/1/ɪ F#3/.5/ə F#3/.5/ə
      Bb3/.5/ɪ Bb3/.5/i F3/1/ə F3/1/i F3/1/ə
      Bb2/1/ɪ C3/.5/u C3/.5/ʌ C#3/1/ɜ Eb3/.5/a Eb3/.5/ɪ
      F3/1/a F3/1/o F3/1/o F3/.5/a F3/.5/ɪ
      F#3/1/ʊ Eb3/1/i C#3/.5/ɔ C#3/.5/ɪ C3/1/o
      Bb2/3/o -/1
      Bb3/2/u Bb3/1.5/e F#3/.5/ə
      G#3/.5/ɛ G#3/.5/ə C#3/1/æ C#3/1.5/ʌ C#3/.5/u
      F#3/1/ɪ Eb3/1/ʌ Eb3/.5/ʊ F3/.5/ə F#3/1/æ
      F3/1/i C#3/1/æ Bb2/2/ʌ
      Bb3/2/ʌ Bb3/1/e G#3/.5/ɛ F#3/.5/ə
      G#3/.5/ʌ G#3/.5/ɪ C#3/1/ɪ C#3/1/ʌ C#3/1/i
      F3/1/e Eb3/1/a C#3/1/i C3/1/æ
      Bb2/3/o
    `
  },
  // Molly Malone, or Cockles and Mussels, a Dublin song from 1884, a verse and
  // two rounds of the chorus, three beats to a bar. Notes follow a setting on
  // The Session.
  {
    title: 'Molly Malone',
    chords: `
      G/3 G/3 D/3 D/3 D/3 G/3 G/2 D/1
      D/3 G/3 G/3 D/3 D/3 G/3 D/3 C/1
      G/2 D/1 G/2 G/3 G/3 D/3 D/3 G/3
      D/3 C/1 G/2 D/1 G/2
    `,
    beat: 340,
    tune: `
      D3/1/ɔ G3/2/o
      G3/1/u G3/.5/o B3/1.5/ɛ
      G3/1/o A3/2/e
      A3/1/ɛ A3/.5/e C4/1.5/a
      A3/1/e B3/1/ɛ A3/1/e
      G3/1/o D4/1/a C4/1/a
      B3/1/ɛ B3/.5/a A3/1.5/e
      G3/1/o A3/2/e
      D3/1/ɔ G3/2/o
      G3/1/u G3/.5/o B3/1.5/ɛ
      G3/1/o A3/2/e
      A3/1/ɛ A3/.5/e C4/1.5/a
      B3/.5/ɛ A3/.5/e B3/.5/ɛ D4/1.5/a
      C4/1/a B3/.5/ɛ D4/1.5/a
      C4/1/a B3/1.5/ɛ G3/.5/o
      A3/1/e G3/2/o
      D3/1/ɔ G3/2/o
      G3/1/u G3/.5/o B3/1.5/ɛ
      G3/1/o A3/2/e
      A3/1/ɛ A3/.5/e C4/1.5/a
      B3/.5/ɛ A3/.5/e B3/.5/ɛ D4/1.5/a
      C4/1/a B3/.5/ɛ D4/1.5/a
      C4/1/a B3/1.5/ɛ G3/.5/o
      A3/1/e G3/2/o
    `
  },
  // Bach, French Suite no. 3, BWV 814, the first half of the menuet, three
  // beats to a bar, moved to D minor
  {
    title: 'Menuet',
    chords: `
      Dm/3 Dm/3 Dm/3 Dm/3 Dm/2 Gm/1 C/2 F/1
      Bb/2 Gm/1 A/3 Dm/3 Dm/3 Dm/3 Dm/3 Dm/2
      Gm/1 C/3 F/3 F/3
    `,
    beat: 400,
    tune: `
  F3/.5/ɛ A3/.5/e D4/.5/a A3/.5/e E3/.5/i A3/.5/e
  F3/.5/ɛ A3/.5/e D3/.5/ɔ A3/.5/e C#3/.5/u A3/.5/e
  D3/.5/ɔ A3/.5/e D4/.5/a A3/.5/e E3/.5/i A3/.5/e
  F3/.5/ɛ A3/.5/e D3/.5/ɔ A3/.5/e C#3/.5/u A3/.5/e

  F3/.5/ɛ A3/.5/e F3/.5/ɛ D3/.5/ɔ Bb3/.5/ɑ G3/.5/o
  E3/.5/i G3/.5/o E3/.5/i C3/.5/o A3/.5/e F3/.5/ɛ
  D3/.5/ɔ A3/.5/e G3/.5/o F3/.5/ɛ E3/.5/i D3/.5/ɔ
  C#3/.5/u A2/.5/ɑ C#3/.5/u E3/.5/i A3/.5/e G3/.5/o

  F3/.5/ɛ A3/.5/e D4/.5/a A3/.5/e E3/.5/i A3/.5/e
  F3/.5/ɛ A3/.5/e D3/.5/ɔ A3/.5/e C#3/.5/u A3/.5/e
  D3/.5/ɔ A3/.5/e D4/.5/a A3/.5/e E3/.5/i A3/.5/e
  F3/.5/ɛ A3/.5/e D3/.5/ɔ A3/.5/e C#3/.5/u A3/.5/e

  F3/.5/ɛ A3/.5/e F3/.5/ɛ D3/.5/ɔ Bb3/.5/ɑ G3/.5/o
  E3/.5/i G3/.5/o E3/.5/i C3/.5/o C4/.5/a G3/.5/o
  A3/.5/e C4/.5/a A3/.5/e F3/.5/ɛ C3/.5/o E3/.5/i
  F3/3/ɛ
`
  },
  // Bella Ciao, an Italian folk song, two verses, moved to D minor. Notes and
  // chords follow a setting on The Session. Each note is sung on the vowel
  // of its syllable in the Italian words, and each "ciao" slides from [a] to
  // [o]. The key keeps the top note under the first formant of [i].
  {
    title: 'Bella Ciao',
    chords: `
      -/2 Dm/4 Dm/4 Dm/4 A/4 Gm/4 Dm/4 A/4
      Dm/2 -/2 Dm/4 Dm/4 Dm/4 A/4 Gm/4 Dm/4
      A/4 Dm/2
    `,
    beat: 400,
    tune: `
      -/.5 A2/.5/u D3/.5/a E3/.5/a
      F3/.5/i D3/2/a A2/.5/i D3/.5/o E3/.5/e
      F3/.5/a D3/2/o A2/.5/o D3/.5/ɛ E3/.5/a
      F3/.5/a F3/.5/o E3/.5/ɛ D3/.5/a F3/.5/a F3/.5/o E3/.5/ɛ D3/.5/a
      A3/.5/a A3/.5/o A3/.5/a A3/.5/o A3/.25/a A3/.25/o A3/.5/u G3/.5/a A3/.5/a
      Bb3/.5/i Bb3/2/a Bb3/.5/i A3/.5/o G3/.5/e
      Bb3/.5/a A3/2/o A3/.5/e G3/.5/ɔ F3/.5/o
      E3/1/a A3/1/o F3/1/i E3/1/a
      D3/2/o
      -/.5 A2/.5/o D3/.5/a E3/.5/i
      F3/.5/a D3/2/o A2/.5/o D3/.5/a E3/.5/i
      F3/.5/i D3/2/a A2/.5/o D3/.5/ɛ E3/.5/a
      F3/.5/a F3/.5/o E3/.5/ɛ D3/.5/a F3/.5/a F3/.5/o E3/.5/ɛ D3/.5/a
      A3/.5/a A3/.5/o A3/.5/a A3/.5/o A3/.25/a A3/.25/o A3/.5/o G3/.5/a A3/.5/i
      Bb3/.5/a Bb3/2/o Bb3/.5/o A3/.5/a G3/.5/i
      Bb3/.5/i A3/2/a A3/.5/e G3/.5/i F3/.5/e
      E3/1/o A3/1/i F3/1/o E3/1/i
      D3/2/i
    `
  },
  // Scarborough Fair, an English ballad in the dorian mode, three beats to a
  // bar. Notes and chords follow a setting on The Session. Each note is sung
  // on the vowel of its syllable in the words, and the long notes of "fair",
  // "thyme", and "mine" end on their second vowel.
  {
    title: 'Scarborough Fair',
    chords: `
      Cm/3 Cm/3 Bb/3 Cm/3 Cm/3 Cm/3 F/3 Cm/3
      Cm/3 Cm/3 Eb/3 Eb/3 Bb/3 Bb/3 Cm/3 Bb/3
      Bb/3 Cm/3 Cm/3
    `,
    beat: 380,
    tune: `
      C3/2/ɑ C3/1/u
      G3/2/o G3/1/ɪ
      D3/1.5/u Eb3/.5/ɑ D3/1/ə
      C3/3.5/ɛ C3/.5/ə
      G3/1/ɑ Bb3/1/i
      C4/2/e Bb3/1/o
      G3/1/ɛ A3/1/i F3/1/æ
      G3/4.5/a G3/.5/ɪ
      C4/1/ɪ
      C4/2/ɛ C4/1/ə
      Bb3/2/i G3/1/u
      G3/1/ʌ F3/1/u Eb3/1/ɪ
      D3/1/ɛ Bb2/5/ɛ
      C3/2/i G3/1/ʌ
      F3/2/ʌ Eb3/1/ə
      D3/1/u C3/1/ʌ Bb2/1/ə
      C3/5.5/a C3/.5/ɪ
    `
  },
  // Pachelbel, Canon in D, moved to B flat. It is a true canon, as written:
  // the bass sings the eight-note ground over and over, the page's voice comes
  // in with the tune after two bars, and the middle voice sings the same tune
  // two bars behind it. These are the first six bars of the tune, and the
  // page's voice goes round to its start again while the other catches up.
  {
    title: 'Canon',
    chords: parts(
      `
        Bb2/1/o F2/1/u G2/1/o D2/1/u
        Eb2/1/o Bb2/1/u Eb2/1/o F2/1/u
        Bb2/1/o F2/1/u G2/1/o D2/1/u
        Eb2/1/o Bb2/1/u Eb2/1/o F2/1/u
        Bb2/1/o F2/1/u G2/1/o D2/1/u
        Eb2/1/o Bb2/1/u Eb2/1/o F2/1/u
        Bb2/1/o F2/1/u G2/1/o D2/1/u
        Eb2/1/o Bb2/1/u Eb2/1/o F2/1/u
        Bb2/1/o F2/1/u G2/1/o D2/1/u
        Eb2/1/o Bb2/1/u Eb2/1/o F2/1/u
        Bb2/4/o
      `,
      `
        -/16
        D4/1/ə C4/1/ə Bb3/1/ə A3/1/ə
        G3/1/ə F3/1/ə G3/1/ə A3/1/ə
        Bb3/1/ə A3/1/ə G3/1/ə F3/1/ə
        Eb3/1/ə D3/1/ə Eb3/1/ə C3/1/ə
        Bb2/.5/ə D3/.5/ə F3/.5/ə Eb3/.5/ə D3/.5/ə Bb2/.5/ə D3/.5/ə C3/.5/ə
        Bb2/.5/ə G2/.5/ə Bb2/.5/ə F3/.5/ə Eb3/.5/ə G3/.5/ə F3/.5/ə Eb3/.5/ə
        D3/4/ə
      `
    ),
    beat: 650,
    tune: `
      -/8
      D4/1/a C4/1/a Bb3/1/ɑ A3/1/e
      G3/1/o F3/1/ɛ G3/1/o A3/1/e
      Bb3/1/ɑ A3/1/e G3/1/o F3/1/ɛ
      Eb3/1/e D3/1/ɔ Eb3/1/e C3/1/o
      Bb2/.5/i D3/.5/ɔ F3/.5/ɛ Eb3/.5/e D3/.5/ɔ Bb2/.5/i D3/.5/ɔ C3/.5/o
      Bb2/.5/i G2/.5/e Bb2/.5/i F3/.5/ɛ Eb3/.5/e G3/.5/o F3/.5/ɛ Eb3/.5/e
      D4/1/a C4/1/a Bb3/1/ɑ A3/1/e
      G3/1/o F3/1/ɛ G3/1/o A3/1/e
      Bb3/4/ɑ
    `
  },
  // The Parting Glass, a Scots and Irish song of farewell, both halves once.
  // Notes follow a setting on The Session.
  {
    title: 'The Parting Glass',
    chords: `
      -/1 Dm/4 F/2 C/2 Dm/2 C/2 Dm/2 Am/2
      Dm/4 F/2 C/2 Dm/2 C/2 Dm/3 -/1 C/4
      Dm/4 C/2 Dm/2 Am/4 Dm/4 F/2 C/2 Dm/2
      C/2 Dm/3
    `,
    beat: 520,
    tune: `
      A3/.75/e G3/.25/o
      F3/1/ɛ E3/.75/i F3/.25/ɛ D3/1/ɔ D3/.5/o E3/.5/i
      F3/.5/ɛ G3/.5/o A3/.5/e F3/.5/ɛ G3/1/o F3/.5/ɛ G3/.5/o
      A3/1/e D4/.5/a B3/.5/ɛ C4/.5/a Bb3/.5/ɑ A3/.5/e G3/.5/o
      F3/1/ɛ D4/1/a C4/1/a A3/.75/e G3/.25/o
      F3/1/ɛ E3/.75/i F3/.25/ɛ D3/1/ɔ D3/.5/o E3/.5/i
      F3/.5/ɛ G3/.5/o A3/.5/e F3/.5/ɛ G3/1/o F3/.5/ɛ G3/.5/o
      A3/1/e D4/.5/a Bb3/.5/ɑ C4/.5/a Bb3/.5/ɑ A3/.5/e G3/.5/o
      F3/1/ɛ D3/1/ɔ D3/1/o
      A3/.75/e Bb3/.25/ɑ
      C4/.5/a Bb3/.5/ɑ C4/.5/a D4/.5/a C4/.5/a Bb3/.5/ɑ A3/.5/e G3/.5/o
      A3/1/e D3/1/ɔ D3/1/o E3/.75/i D3/.25/ɔ
      C4/.5/a Bb3/.5/ɑ A3/.5/e G3/.5/o F3/.5/ɛ E3/.5/i F3/.5/ɛ G3/.5/o
      A3/1/e C3/1/o C3/1/ɔ A3/.75/e G3/.25/o
      F3/1/ɛ E3/.75/i F3/.25/ɛ D3/1/ɔ D3/.5/o E3/.5/i
      F3/.5/ɛ G3/.5/o A3/.5/e F3/.5/ɛ G3/1/o F3/.5/ɛ G3/.5/o
      A3/1/e D4/.5/a Bb3/.5/ɑ C4/.5/a Bb3/.5/ɑ A3/.5/e G3/.5/o
      F3/1/ɛ D3/1/ɔ D3/1/o
    `
  }
].map(({ tune, chords, ...song }) => {
  const notes = score(tune)
  return { ...song, notes, chords: typeof chords === 'string' ? harmony(chords, notes) : chords }
})
