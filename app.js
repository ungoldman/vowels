import {
  BANDWIDTHS,
  clamp,
  formants,
  GLIDES,
  geo,
  KEY_POS,
  lerp,
  nearest,
  PHONATIONS,
  toUV,
  toXY,
  VOICES,
  VOWELS
} from './vowels.js'

const RANDOM_KEY = 'Slash'
// how long a random sound rings on after its button is let go
const RING = 600
// a held random key shuffles this often, long enough for a diphthong to land
const RANDOM_EVERY = 550
// a random spot is at least this far from the last one, in chart units
const FAR = 0.3
// random pitch lands within this many semitones of the voice's own
const PITCH_SPREAD = 3
// a held cycling key steps again this often
const CYCLE_EVERY = 450
const NUDGE = 0.02
const SEMITONE = 2 ** (1 / 12)

const chart = document.getElementById('chart')
const dot = document.getElementById('dot')
const readout = document.getElementById('readout')
const pitch = document.getElementById('pitch')
const tilt = document.getElementById('tilt')
const breath = document.getElementById('breath')
const round = document.getElementById('round')
const latch = document.getElementById('latch')
const voice = document.getElementById('voice')
const phonation = document.getElementById('phonation')

// The synthesizer runs in an audio worklet, see synth.js. The context stays
// suspended until the first gesture.
const ctx = new AudioContext()
let synth

const send = (params) => synth?.port.postMessage(params)
const wake = () => ctx.resume()

// rounded is 0 to 1, so a glide between a spread and a rounded vowel can
// pass through the shapes in between
function sound(freqs, u, v, label, rounded, smooth = 0.015) {
  send({ formants: freqs, bandwidths: BANDWIDTHS, smooth })
  shape = { u, v, rounded }
  const [x, y] = toXY(u, v)
  dot.setAttribute('cx', x)
  dot.setAttribute('cy', y)
  const numbers = freqs
    .slice(0, 3)
    .map((f, i) => `F${i + 1} ${Math.round(f)}`)
    .join('   ')
  readout.textContent = `${label}   ${numbers}`
}

function svgPoint(event) {
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
    chart.getScreenCTM().inverse()
  )
  return [p.x, p.y]
}

// one position and one voice, driven by the pointer, the keys, or the latch
let pos = [0.5, 0.5]
let randomPos = pos
let ringTimer = 0
let randomTimer = 0
let randomHeld = false
let lastGlide = ''
let cycleTimer = 0
// what the face mouths, which trails pos during a glide
let shape = { u: 0.5, v: 0.5, rounded: 0 }
let sounding = false
let shift = false
let held = false
let gliding = 0
const keys = []

// Held keys sound the point midway between them, which reaches the symbols
// that sit between two rows: T and G make ə, A and Z make æ.
function chord() {
  const points = keys.map((code) => (code === RANDOM_KEY ? randomPos : KEY_POS.get(code)))
  return [0, 1].map((i) => points.reduce((sum, p) => sum + p[i], 0) / points.length)
}

// formants at a point, in the current voice
const voiced = (u, v, rounded) => formants(u, v, rounded, VOICES[voice.value].scale)

// Shift flips whatever the checkbox says, so it works from either state
const isRounded = () => round.checked !== shift

function refresh(smooth) {
  const rounded = isRounded()
  sound(voiced(...pos, rounded), ...pos, nearest(...pos, rounded), rounded ? 1 : 0, smooth)
}

function voiceOn(on) {
  sounding = on
  send({ on })
}

function gate() {
  voiceOn(held || randomHeld || latch.checked || keys.length > 0)
}

function follow(event) {
  pos = toUV(...svgPoint(event))
  shift = event.shiftKey
  refresh()
}

chart.addEventListener('pointerdown', (event) => {
  wake()
  cancelAnimationFrame(gliding)
  held = true
  chart.setPointerCapture(event.pointerId)
  follow(event)
  gate()
})

chart.addEventListener('pointermove', (event) => {
  if (held) follow(event)
})

function release() {
  held = false
  gate()
}

chart.addEventListener('pointerup', release)
chart.addEventListener('pointercancel', release)

const HOLD = 90,
  TRAVEL = 320

// Sit on the first vowel, travel, sit on the second. The ends can differ in
// rounding, so the formants are blended directly and the dot just follows.
function glide(label, from, to) {
  wake()
  cancelAnimationFrame(gliding)
  const [, u0, v0, r0] = VOWELS.find(([symbol]) => symbol === from)
  const [, u1, v1, r1] = VOWELS.find(([symbol]) => symbol === to)
  const f0 = voiced(u0, v0, r0)
  const f1 = voiced(u1, v1, r1)
  pos = [u1, v1]
  const start = performance.now()
  voiceOn(true)
  const step = (now) => {
    const t = clamp((now - start - HOLD) / TRAVEL)
    const eased = t * t * (3 - 2 * t)
    sound(
      f0.map((f, i) => geo(f, f1[i], eased)),
      lerp(u0, u1, eased),
      lerp(v0, v1, eased),
      label,
      lerp(r0, r1, eased)
    )
    if (now - start < HOLD * 2 + TRAVEL) gliding = requestAnimationFrame(step)
    else gate()
  }
  gliding = requestAnimationFrame(step)
}

const other = (select) => {
  let i
  do i = Math.floor(Math.random() * select.length)
  while (i === select.selectedIndex)
  return i
}

const anyVowel = () => VOWELS[Math.floor(Math.random() * VOWELS.length)]

// Change everything, and never to what it was: another voice, another
// phonation, the other rounding, and a pitch near the new voice's own. Tilt
// and breath follow from the presets. Then half the time one vowel, at a
// spot well away from the last, and half the time a diphthong between any
// two of the 28 symbols, which is 756 of them.
function shuffle() {
  cancelAnimationFrame(gliding)
  voice.selectedIndex = other(voice)
  phonation.selectedIndex = other(phonation)
  round.checked = !round.checked
  const semitones = (Math.random() * 2 - 1) * PITCH_SPREAD
  pitch.value = Math.round(VOICES[voice.value].pitch * SEMITONE ** semitones)

  if (Math.random() < 0.5) {
    const last = randomPos
    do randomPos = [Math.random(), Math.random()]
    while (Math.hypot(randomPos[0] - last[0], randomPos[1] - last[1]) < FAR)
    pos = keys.length ? chord() : randomPos
    applyPresets()
    return
  }

  let from, to
  do [from, to] = [anyVowel(), anyVowel()]
  while (from === to || from[0] + to[0] === lastGlide)
  lastGlide = from[0] + to[0]
  // start where the glide starts, and leave the key resting where it ends
  pos = [from[1], from[2]]
  randomPos = [to[1], to[2]]
  applyPresets()
  glide(lastGlide, from[0], to[0])
}

// shuffle now, and again on every beat for as long as it is held
function startRandom() {
  wake()
  cancelAnimationFrame(gliding)
  clearTimeout(ringTimer)
  clearInterval(randomTimer)
  shuffle()
  randomTimer = setInterval(shuffle, RANDOM_EVERY)
}

const randomButton = document.getElementById('random')

randomButton.addEventListener('pointerdown', (event) => {
  randomButton.setPointerCapture(event.pointerId)
  randomHeld = true
  startRandom()
  voiceOn(true)
})

function stopRandomButton() {
  randomHeld = false
  clearInterval(randomTimer)
  clearTimeout(ringTimer)
  ringTimer = setTimeout(gate, RING)
}

randomButton.addEventListener('pointerup', stopRandomButton)
randomButton.addEventListener('pointercancel', stopRandomButton)
// a click with no pointer behind it came from the keyboard
randomButton.addEventListener('click', (event) => {
  if (event.detail !== 0) return
  startRandom()
  voiceOn(true)
  stopRandomButton()
})

const glides = document.getElementById('glides')
for (const [label, from, to] of GLIDES) {
  const button = document.createElement('button')
  button.textContent = label
  button.addEventListener('click', () => glide(label, from, to))
  glides.append(button)
}

function setPitch(hz) {
  pitch.value = hz
  document.getElementById('hz').textContent = pitch.value
  send({ f0: Number(pitch.value) * PHONATIONS[phonation.value].pitch })
}

// tilt and breath come from the sliders, so a preset can be bent by hand
function sendSource() {
  const speaker = VOICES[voice.value]
  const fold = PHONATIONS[phonation.value]
  document.getElementById('db').textContent = tilt.value
  send({
    openQuotient: fold.openQuotient + speaker.openQuotient,
    tilt: Number(tilt.value),
    breath: Number(breath.value),
    voicing: fold.voicing,
    jitter: speaker.jitter * fold.rough,
    shimmer: speaker.shimmer * fold.rough,
    diplophonia: fold.diplophonia,
    openBandwidth: fold.openBandwidth
  })
}

function applyPresets() {
  const speaker = VOICES[voice.value]
  const fold = PHONATIONS[phonation.value]
  tilt.value = fold.tilt + speaker.tilt
  breath.value = fold.breath + speaker.breath
  setPitch(pitch.value)
  sendSource()
  refresh()
}

function setVoice() {
  pitch.value = VOICES[voice.value].pitch
  applyPresets()
}

function setLatch() {
  wake()
  refresh()
  gate()
}

pitch.addEventListener('input', () => setPitch(pitch.value))
voice.addEventListener('change', setVoice)
phonation.addEventListener('change', applyPresets)
tilt.addEventListener('input', sendSource)
breath.addEventListener('input', sendSource)
round.addEventListener('change', () => refresh())
latch.addEventListener('change', setLatch)

// A control that keeps focus after a click would swallow the shortcuts, so
// hand focus back. Tabbing to one still leaves its native keys working.
for (const control of document.querySelectorAll('input, select, button')) {
  control.addEventListener('pointerup', () => control.blur())
  control.addEventListener('change', () => control.blur())
}

const ARROWS = {
  ArrowLeft: [-NUDGE, 0],
  ArrowRight: [NUDGE, 0],
  ArrowUp: [0, -NUDGE],
  ArrowDown: [0, NUDGE]
}

// keys that step through a menu, and keep stepping while held
const CYCLES = {
  Backslash() {
    voice.selectedIndex = (voice.selectedIndex + 1) % voice.length
    setVoice()
  },
  KeyP() {
    phonation.selectedIndex = (phonation.selectedIndex + 1) % phonation.length
    applyPresets()
  }
}

const ACTIONS = {
  Space() {
    latch.checked = !latch.checked
    setLatch()
  },
  Minus: () => setPitch(Math.round(pitch.value / SEMITONE)),
  Equal: () => setPitch(Math.round(pitch.value * SEMITONE)),
  BracketLeft() {
    tilt.stepDown()
    sendSource()
  },
  BracketRight() {
    tilt.stepUp()
    sendSource()
  },
  Semicolon() {
    breath.stepDown()
    sendSource()
  },
  Quote() {
    breath.stepUp()
    sendSource()
  },
  Backquote() {
    round.checked = !round.checked
    refresh()
  },
  Escape() {
    latch.checked = false
    clearInterval(cycleTimer)
    clearInterval(randomTimer)
    clearTimeout(ringTimer)
    randomHeld = false
    keys.length = 0
    cancelAnimationFrame(gliding)
    gate()
  }
}

window.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.target.matches('input, select, button')) return
  const { code } = event

  if (code === 'ShiftLeft' || code === 'ShiftRight') {
    shift = true
    refresh()
    return
  }

  if (code in CYCLES) {
    event.preventDefault()
    if (event.repeat) return
    wake()
    CYCLES[code]()
    clearInterval(cycleTimer)
    cycleTimer = setInterval(CYCLES[code], CYCLE_EVERY)
    return
  }

  if (KEY_POS.has(code) || code === RANDOM_KEY) {
    event.preventDefault()
    if (event.repeat) return
    wake()
    cancelAnimationFrame(gliding)
    if (!keys.includes(code)) keys.push(code)
    if (code === RANDOM_KEY) startRandom()
    pos = chord()
    // slower than the pointer, so moving between keys glides
    refresh(0.04)
    gate()
    return
  }

  if (code in ARROWS) {
    event.preventDefault()
    wake()
    const [du, dv] = ARROWS[code]
    pos = [clamp(pos[0] + du), clamp(pos[1] + dv)]
    refresh()
    return
  }

  if (code in ACTIONS) {
    event.preventDefault()
    if (event.repeat && ['Space', 'Backquote'].includes(code)) return
    wake()
    ACTIONS[code]()
  }
})

window.addEventListener('keyup', (event) => {
  const { code } = event
  if (code === 'ShiftLeft' || code === 'ShiftRight') {
    shift = false
    refresh()
    return
  }
  if (code in CYCLES) clearInterval(cycleTimer)
  if (code === RANDOM_KEY) clearInterval(randomTimer)
  const i = keys.indexOf(code)
  if (i === -1) return
  keys.splice(i, 1)
  if (keys.length) {
    pos = chord()
    refresh(0.04)
  }
  gate()
})

// a key released while the window is unfocused never sends keyup
window.addEventListener('blur', () => {
  clearInterval(cycleTimer)
  clearInterval(randomTimer)
  randomHeld = false
  keys.length = 0
  shift = false
  held = false
  gate()
})

ctx.audioWorklet.addModule('synth.js').then(() => {
  synth = new AudioWorkletNode(ctx, 'vowel', { numberOfInputs: 0, outputChannelCount: [1] })
  synth.connect(ctx.destination)
  // catch up on anything set while the module was loading
  setPitch(pitch.value)
  sendSource()
  refresh()
  gate()
})

// The face in the gap beside the chart, a front view that mouths the vowel.
// Jaw and lip opening follow height, lip width follows backness, rounding
// purses the lips, and the brows follow pitch. The eyes watch the dot, and
// their lids follow phonation, pitch, and the squint of a spread vowel. The
// nostrils flare with breath and with an open mouth.
// It is a cartoon of the visible articulators, not a measured model, and
// the tongue, which does most of the work, cannot be seen from the front.
const FACE_X = 100,
  FACE_Y = 305
// Reduced motion stops the blink, the one movement nobody asked for. The
// mouth still eases, since it only moves in answer to the controls.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
// How fast each part of the face settles, as a spring rate per second. A
// jaw takes about a sixth of a second, brows drift, and a blink is quick.
const RATES = {
  open: 26,
  width: 26,
  lips: 26,
  jaw: 22,
  brow: 10,
  voice: 14,
  blink: 45,
  gazeX: 16,
  gazeY: 16,
  lid: 14,
  flare: 12
}
// how far the lids sit open for each phonation, 1 being ordinary
const LIDS = { modal: 1, breathy: 0.8, creaky: 0.55, whisper: 1.15 }
const EYE_X = 24,
  EYE_Y = -17
const BLINK_EVERY = 4200,
  BLINK_FOR = 130
const head = Object.fromEntries(
  ['mesh', 'nodes', 'outline', 'features', 'mouth'].map((id) => [id, document.getElementById(id)])
)
const face = {
  open: 0,
  width: 0.8,
  lips: 0,
  jaw: 0,
  brow: 0,
  voice: 0,
  blink: 0,
  gazeX: 0,
  gazeY: 0,
  lid: 1,
  flare: 0
}
const speed = Object.fromEntries(Object.keys(face).map((key) => [key, 0]))
let lastFrame = performance.now()
let nextBlink = performance.now() + BLINK_EVERY

// The right half of the face as triangles over named points, mirrored when
// drawn. The mesh lines are the edges of these.
const TRIANGLES = `
  crown a1 m1, a1 b1 m1, a1 a2 b1, a2 b2 b1, a2 a3 b2, b1 b2 b3, b1 b3 m1, m1 b3 m2,
  a3 e1 b2, b2 e1 e2, b2 e2 b3, b3 e2 e3, b3 e3 m2, m2 e3 m3,
  a3 a4 e1, e1 a4 c1, e1 c1 e4, e4 c1 e3, e3 c1 n1, e3 n1 m3, m3 n1 m4, m4 n1 m5,
  a4 a5 c1, c1 a5 c2, c1 c2 n1, n1 c2 upper, n1 upper m5, m5 upper lipTop,
  c2 corner upper, a5 a6 c2, c2 a6 c3, c2 c3 corner, corner c3 lower,
  c3 a6 a7, c3 a7 lower, lower a7 m8, lower m8 lipBottom, a7 chin m8
`
  .split(',')
  .map((triangle) => triangle.trim().split(' '))
const EDGES = [
  ...new Set(
    TRIANGLES.flatMap(([a, b, c]) =>
      [
        [a, b],
        [b, c],
        [c, a]
      ].map((edge) => edge.sort().join(' '))
    )
  )
].map((edge) => edge.split(' '))
const OUTLINE = ['crown', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'chin']

function faceTarget(now) {
  const { u, v, rounded } = shape
  const spread = 1 - 0.15 * v - 0.12 * u
  const pursed = 0.32 + 0.25 * v
  if (now > nextBlink + BLINK_FOR) nextBlink = now + BLINK_EVERY * (0.5 + Math.random())
  const brow = (pitch.value - pitch.min) / (pitch.max - pitch.min)
  // where the dot is, as seen from between the eyes
  const [dotX, dotY] = toXY(u, v)
  // a close spread vowel pulls the cheeks up into the eyes, as a smile does
  const squint = sounding ? 0.25 * (1 - rounded) * (1 - v) : 0
  return {
    // the mouth rests closed when nothing is sounding
    open: sounding ? lerp(0.12 + 0.88 * v, 0.18 + 0.6 * v, rounded) : 0,
    width: sounding ? lerp(spread, pursed, rounded) : 0.8,
    lips: sounding ? rounded : 0,
    jaw: sounding ? v : 0,
    brow,
    gazeX: Math.max(-1, Math.min(1, (dotX - FACE_X) / 300)),
    gazeY: Math.max(-1, Math.min(1, (dotY - FACE_Y - EYE_Y) / 180)),
    lid: LIDS[phonation.value] + 0.15 * brow - squint,
    flare: (0.7 * breath.value) / breath.max + (sounding ? 0.3 * v : 0),
    voice: sounding ? 1 : 0,
    blink: !still && now > nextBlink ? 1 : 0
  }
}

function facePoints() {
  const jaw = 14 * face.jaw
  const lift = 6 * face.brow
  const lid = Math.max(0, face.lid) * (1 - face.blink)
  const flare = Math.max(0, face.flare)
  const spread = Math.max(0, face.width - 0.8) * face.voice
  // both eyes look the same way, so the pupils are not mirrored
  const pupil = (side) => {
    const x = side * EYE_X + 5 * face.gazeX
    const y = EYE_Y + 2.5 * face.gazeY * lid
    return [
      [x - 1.6, y],
      [x, y - 1.8 * lid],
      [x + 1.6, y],
      [x, y + 1.8 * lid]
    ]
  }
  const my = 36 + jaw * 0.45
  const w = 26 * face.width
  const inner = 12 * Math.max(0, face.open)
  const outer = inner + 3 + 2 * face.lips
  return {
    crown: [0, -78],
    m1: [0, -52],
    m2: [0, -28],
    m3: [0, -10],
    m4: [0, 10 - flare],
    // a spread lip lifts the base of the nose
    m5: [0, 17 - 6 * spread],
    m8: [0, 57 + jaw * 0.9],
    chin: [0, 71 + jaw],
    a1: [26, -74],
    a2: [46, -56],
    a3: [54, -28],
    a4: [55, 0],
    a5: [51, 24 + jaw * 0.3],
    a6: [42, 46 + jaw * 0.6],
    a7: [22, 64 + jaw],
    b1: [24, -50],
    b2: [38, -29 - lift],
    b3: [12, -30 - lift * 1.3],
    e1: [36, -17],
    e2: [EYE_X, EYE_Y - 5 * lid],
    e3: [13, -16],
    e4: [EYE_X, EYE_Y + 5 * lid],
    c1: [34, 6],
    c2: [24, 25 + jaw * 0.3],
    c3: [31, 45 + jaw * 0.6],
    n1: [9 + 3.5 * flare, 12 - 1.5 * flare],
    corner: [w, my],
    upper: [w / 2, my - outer],
    lower: [w / 2, my + outer],
    lipTop: [0, my - outer * 0.85],
    lipBottom: [0, my + outer * 1.05],
    innerCorner: [w * 0.85, my],
    innerUpper: [w * 0.4, my - inner],
    innerLower: [w * 0.4, my + inner],
    pupils: [pupil(1), pupil(-1)]
  }
}

function drawFace(now) {
  const target = faceTarget(now)
  const dt = Math.min(0.05, (now - lastFrame) / 1000)
  lastFrame = now
  // A critically damped spring per value, solved exactly so a long frame
  // cannot blow it up. It eases in as well as out, and a change of target
  // mid-move bends the motion instead of restarting it.
  for (const key in target) {
    const rate = RATES[key]
    const gap = face[key] - target[key]
    const push = (speed[key] + rate * gap) * dt
    const decay = Math.exp(-rate * dt)
    face[key] = target[key] + (gap + push) * decay
    speed[key] = (speed[key] - rate * push) * decay
  }

  const p = facePoints()
  const at = ([x, y]) => `${(FACE_X + x).toFixed(1)},${(FACE_Y + y).toFixed(1)}`
  const flip = ([x, y]) => [-x, y]
  const ring = (points) => `M${points.map(at).join('L')}Z`
  const line = (a, b) => `M${at(a)}L${at(b)}`
  // a zero-length stroke with round caps draws as a dot
  const node = (a) => `M${at(a)}h0`
  const both =
    (draw) =>
    (...points) =>
      draw(...points) + draw(...points.map(flip))
  const rings = (points) => ring(points) + ring(points.map(flip))
  const names = (...list) => list.map((name) => p[name])

  head.mesh.setAttribute('d', EDGES.map(([a, b]) => both(line)(p[a], p[b])).join(''))
  head.nodes.setAttribute(
    'd',
    [...new Set(EDGES.flat())].map((name) => both(node)(p[name])).join('')
  )
  head.outline.setAttribute(
    'd',
    ring([
      ...names(...OUTLINE),
      ...names(...OUTLINE)
        .map(flip)
        .reverse()
    ])
  )
  head.features.setAttribute(
    'd',
    [
      rings(names('e1', 'e2', 'e3', 'e4')),
      both(line)(p.b2, p.b3),
      both(line)(p.m3, p.n1),
      both(line)(p.n1, p.m5),
      both(line)(p.n1, p.m4),
      ...p.pupils.map(ring)
    ].join('')
  )
  head.mouth.setAttribute(
    'd',
    [
      ring([
        ...names('lipTop', 'upper', 'corner', 'lower', 'lipBottom'),
        ...names('lower', 'corner', 'upper').map(flip)
      ]),
      ring([
        ...names('innerUpper', 'innerCorner', 'innerLower'),
        ...names('innerLower', 'innerCorner', 'innerUpper').map(flip)
      ])
    ].join('')
  )
  head.mouth.style.setProperty('--voice', face.voice.toFixed(2))

  requestAnimationFrame(drawFace)
}

requestAnimationFrame(drawFace)

const SVG = 'http://www.w3.org/2000/svg'

const keycaps = document.getElementById('keycaps')
const keyName = (code) => ({ Comma: ',', Period: '.' })[code] ?? code.replace(/^(Key|Digit)/, '')
for (const [code, [u, v]] of KEY_POS) {
  const [x, y] = toXY(u, v)
  const text = document.createElementNS(SVG, 'text')
  text.setAttribute('class', 'key')
  text.setAttribute('x', x)
  // below the point, clear of the IPA symbols beside it
  text.setAttribute('y', y + 17)
  text.textContent = keyName(code)
  keycaps.append(text)
}
const labels = document.getElementById('labels')
const marked = new Set()
for (const [symbol, u, v, rounded] of VOWELS) {
  const [x, y] = toXY(u, v)
  const paired = VOWELS.some(([other, ou, ov]) => other !== symbol && ou === u && ov === v)
  // as on the printed chart: unrounded left of the point, rounded right,
  // and a lone central symbol sits on the point itself
  const centered = !paired && u === 0.5
  if (!centered && !marked.has(`${u},${v}`)) {
    marked.add(`${u},${v}`)
    const mark = document.createElementNS(SVG, 'circle')
    mark.setAttribute('class', 'anchor')
    mark.setAttribute('cx', x)
    mark.setAttribute('cy', y)
    mark.setAttribute('r', 3)
    labels.append(mark)
  }
  const text = document.createElementNS(SVG, 'text')
  text.setAttribute('class', 'ipa')
  text.setAttribute('x', x + (centered ? 0 : rounded ? 16 : -16))
  text.setAttribute('y', y)
  text.textContent = symbol
  labels.append(text)
}
