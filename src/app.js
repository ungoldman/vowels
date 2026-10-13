import {
  BANDWIDTHS,
  clamp,
  describe,
  formants,
  geo,
  KEY_POS,
  lerp,
  nearest,
  PHONATIONS,
  SONGS,
  toUV,
  toXY,
  VOICES,
  VOWELS
} from './vowels.js'

const RANDOM_KEY = 'Slash'
// ms a random sound rings on after release
const RING = 600
// ms between random sounds while held, enough for a glide to land
const RANDOM_EVERY = 550
// least distance between random spots, in chart units
const FAR = 0.3
// semitones a shuffled pitch may stray from the voice's own
const PITCH_SPREAD = 3
// ms between steps of a held cycling key
const CYCLE_EVERY = 450
const NUDGE = 0.02
// ms a held arrow waits, then ms between nudges
const ARROW_DELAY = 300
const ARROW_EVERY = 33
const SEMITONE = 2 ** (1 / 12)
// smoothing for a struck note, slow enough that key to key glides
const STRUCK = 0.04
// ms a song slides between vowels, and the share of a note a short song sounds
const SONG_SLIDE = 110
const SONG_CUT = 0.6
// ms of quiet between songs
const SONG_GAP = 2000

const chart = document.getElementById('chart')
const dot = document.getElementById('dot')
const readout = Object.fromEntries(
  ['symbol', 'name', 'formants'].map((id) => [id, document.getElementById(id)])
)
const caption = Object.fromEntries(
  ['symbol', 'name', 'formants'].map((id) => [id, document.getElementById(`caption-${id}`)])
)
const pitch = document.getElementById('pitch')
const hzOut = document.getElementById('hz')
const tilt = document.getElementById('tilt')
const breath = document.getElementById('breath')
// the rest of a phonation's settings, each slider named for its synth parameter
const FOLD = ['openQuotient', 'voicing', 'rough', 'diplophonia', 'openBandwidth']
const fold = Object.fromEntries(FOLD.map((id) => [id, document.getElementById(id)]))
const round = document.getElementById('round')
const latch = document.getElementById('latch')
const voice = document.getElementById('voice')
const phonation = document.getElementById('phonation')

// synth.js runs in an audio worklet. The context is suspended until a gesture.
const ctx = new AudioContext()
let synth

const send = (params) => synth?.port.postMessage(params)
const wake = () => ctx.resume()

// rounded runs 0 to 1, so a glide can pass through the lip shapes between
function sound(freqs, u, v, label, rounded, smooth = 0.015) {
  send({ formants: freqs, bandwidths: BANDWIDTHS, smooth })
  shape = { u, v, rounded }
  const [x, y] = toXY(u, v)
  dot.setAttribute('cx', x)
  dot.setAttribute('cy', y)
  const numbers = freqs
    .slice(0, 3)
    .map((f, i) => `F${i + 1} ${Math.round(f)}`)
    .join('  ')
  const name = describe(label)
  readout.symbol.textContent = label
  readout.name.textContent = name
  readout.formants.textContent = numbers
  caption.symbol.textContent = label
  caption.name.textContent = name
  caption.formants.textContent = numbers
}

function svgPoint(event) {
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
    chart.getScreenCTM().inverse()
  )
  return [p.x, p.y]
}

// one position and one voice, driven by pointer, keys, or latch
let pos = [0.5, 0.5]
// what the face mouths, which trails pos during a glide
let shape = { u: 0.5, v: 0.5, rounded: 0 }
let sounding = false
// frame id of a glide or slide in progress
let gliding = 0

// what holds the voice on: a pointer on the chart, and the chart keys
let held = false
let finger = 0
const keys = []
const arrows = new Set()
let arrowTimer = 0
let cycleTimer = 0

let randomPos = pos
let randomHeld = false
let randomTimer = 0
let ringTimer = 0
let lastGlide = ''

// Song player: which song, the beat its current note began on, whether it runs,
// and whether the tune is on a note.
let songIndex = 0
let songBeat = 0
let songPlaying = false
let songVoiced = false
let songTimers = []
let cutTimer = 0
// pitch and rounding to restore when the song ends, set while one is loaded
let songBefore = null
// the same plus the restoring timer, just after a song ends
let songAfter = null
// The choir: a bass and a middle voice, each with its own synth and head. The
// mix drops while a song is loaded so three voices do not clip.
const choir = [VOICES.min, VOICES.low].map(({ scale }) => ({
  scale,
  node: null,
  shape: { u: 0.5, v: 0.5, rounded: 0 },
  sounding: false,
  brow: 0
}))
const CHOIR_GAIN = 0.6
const SONG_GAIN = 0.5
let master

// Held keys sound the point midway between them, which reaches symbols between
// rows: T and G make ə, A and Z make æ.
function chord() {
  const points = keys.map((code) => KEY_POS.get(code))
  return [0, 1].map((i) => points.reduce((sum, p) => sum + p[i], 0) / points.length)
}

const voiced = (u, v, rounded) => formants(u, v, rounded, VOICES[voice.value].scale)

const isRounded = () => round.checked
const vowelOf = (symbol) => VOWELS.find(([other]) => other === symbol)
// a pitch's place on the slider, 0 to 1, which sets brow height
const browOf = (hz) => clamp((hz - pitch.min) / (pitch.max - pitch.min))
const ease = (t) => t * t * (3 - 2 * t)

function refresh(smooth) {
  const rounded = isRounded()
  sound(voiced(...pos, rounded), ...pos, nearest(...pos, rounded), rounded ? 1 : 0, smooth)
  if (songPlaying) {
    for (const singer of choir) if (singer.sounding) choirTune(singer)
  } else accompany()
}

function voiceOn(on) {
  sounding = on
  send({ on })
  accompany()
}

function gate() {
  voiceOn(held || randomHeld || songVoiced || latch.checked || keys.length > 0)
}

function follow(event) {
  pos = toUV(...svgPoint(event))
  refresh()
}

chart.addEventListener('pointerdown', (event) => {
  // the caption is text to select
  if (event.target.closest('#caption')) return
  if (event.button) return
  wake()
  cancelAnimationFrame(gliding)
  held = true
  // a second finger takes over, and lifting the first changes nothing
  finger = event.pointerId
  chart.setPointerCapture(event.pointerId)
  follow(event)
  gate()
})

chart.addEventListener('pointermove', (event) => {
  if (held && event.pointerId === finger) follow(event)
})

function release(event) {
  if (event.pointerId !== finger) return
  held = false
  gate()
}

chart.addEventListener('pointerup', release)
chart.addEventListener('pointercancel', release)

const HOLD = 90,
  TRAVEL = 320
// ms a slide between held keys takes
const SLIDE = 260

// Sit on the first vowel, travel, sit on the second. The ends can differ in
// rounding, so formants are blended directly and the dot follows.
function glide(label, from, to) {
  wake()
  cancelAnimationFrame(gliding)
  const [, u0, v0, r0] = vowelOf(from)
  const [, u1, v1, r1] = vowelOf(to)
  const f0 = voiced(u0, v0, r0)
  const f1 = voiced(u1, v1, r1)
  pos = [u1, v1]
  const start = performance.now()
  voiceOn(true)
  const step = (now) => {
    const eased = ease(clamp((now - start - HOLD) / TRAVEL))
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

// a slide that interrupts another carries on from where that one got to
function slide(to, ms = SLIDE) {
  cancelAnimationFrame(gliding)
  const from = pos
  const start = performance.now()
  const step = (now) => {
    const t = clamp((now - start) / ms)
    pos = [0, 1].map((i) => lerp(from[i], to[i], ease(t)))
    refresh()
    if (t < 1) gliding = requestAnimationFrame(step)
  }
  gliding = requestAnimationFrame(step)
}

const songButton = document.getElementById('song')
const player = document.getElementById('player')
const pauseButton = document.getElementById('pause')
const nowPlaying = document.getElementById('now')
const faces = document.getElementById('head')

function showSong() {
  player.classList.toggle('playing', songBefore !== null)
  faces.classList.toggle('singing', songBefore !== null)
  songButton.setAttribute('aria-pressed', songBefore !== null)
  nowPlaying.textContent = SONGS[songIndex].title
  for (const [i, item] of [...tracks.children].entries()) {
    item.setAttribute('aria-current', songBefore !== null && i === songIndex)
  }
  pauseButton.textContent = songPlaying ? '\u2759\u2759' : '\u25b8'
  pauseButton.setAttribute('aria-label', songPlaying ? 'Pause' : 'Play')
}

// A choir voice takes the page's rounding, phonation, and source sliders. This
// sets its formants for its spot.
function choirTune(singer) {
  const { u, v } = singer.shape
  const rounded = isRounded()
  singer.shape.rounded = rounded ? 1 : 0
  singer.node?.port.postMessage({
    formants: formants(u, v, rounded, singer.scale),
    bandwidths: BANDWIDTHS,
    smooth: STRUCK
  })
}

function choirNote(singer, u, v, hz) {
  singer.sounding = true
  singer.shape = { u, v, rounded: 0 }
  singer.brow = browOf(hz)
  choirTune(singer)
  singer.node?.port.postMessage({ on: true, f0: hz })
}

// a rest, or no note at all, silences the voice
function choirSing(singer, note) {
  if (!note?.hz) {
    singer.sounding = false
    singer.node?.port.postMessage({ on: false })
    return
  }
  const [, u, v] = vowelOf(note.symbol)
  choirNote(singer, u, v, note.hz * PHONATIONS[phonation.value].pitch)
}

// Paused, the choir joins whatever is played by hand: same vowel, on the two
// notes that make a major chord under the played one. The ratios are pure,
// 4:5:6, which ring smoother than a song's tempered notes. A note under the
// pitch slider goes up an octave.
const UNDER = [2 / 3, 5 / 6]
function accompany() {
  if (!songBefore || songPlaying) return
  const f0 = pitch.value * PHONATIONS[phonation.value].pitch
  choir.forEach((singer, i) => {
    if (!sounding) {
      if (singer.sounding) choirSing(singer)
      return
    }
    const hz = f0 * UNDER[i]
    choirNote(singer, ...pos, hz < pitch.min ? hz * 2 : hz)
  })
}

// stop the notes, keep the place
function pauseSong() {
  for (const timer of songTimers) clearTimeout(timer)
  songTimers = []
  clearTimeout(cutTimer)
  cancelAnimationFrame(gliding)
  for (const singer of choir) choirSing(singer)
  songPlaying = false
  songVoiced = false
  gate()
  showSong()
}

function stopSong() {
  if (!songBefore) return
  pauseSong()
  const before = songBefore
  songBefore = null
  // Restore pitch and rounding once the last note has died away, or it would be
  // heard sliding to them. A note held by hand takes them at once.
  const restore = () => {
    songAfter = null
    round.checked = before.rounded
    setPitch(before.pitch)
    refresh()
  }
  if (sounding) restore()
  else songAfter = { before, timer: setTimeout(restore, RING) }
  // they may have joined a held note
  for (const singer of choir) choirSing(singer)
  master?.gain.setTargetAtTime(1, ctx.currentTime, 0.05)
  // the button starts the next one
  songIndex = (songIndex + 1) % SONGS.length
  songBeat = 0
  showSong()
}

// Notes are timed from the start, so the beat cannot drift and the parts stay
// together. Tune notes in one breath slide vowel to vowel. A note after a rest
// starts on its vowel.
function playSong(index, from = 0) {
  pauseSong()
  wake()
  // a song started before the last one's settings went back keeps them
  if (songAfter) {
    clearTimeout(songAfter.timer)
    songBefore = songAfter.before
    songAfter = null
  }
  songBefore ??= { pitch: pitch.value, rounded: round.checked }
  master?.gain.setTargetAtTime(SONG_GAIN, ctx.currentTime, 0.05)
  songIndex = index
  songPlaying = true
  showSong()
  const { beat, short, notes, chords } = SONGS[index]
  const start = performance.now()
  // run one part from the note sounding on that beat
  const run = (part, sing) => {
    let i = 0
    let at = 0
    while (part[i] && at + part[i].beats <= from) at += part[i++].beats
    const next = () => {
      const note = part[i++]
      sing(note, at)
      if (!note) return
      at += note.beats
      songTimers.push(setTimeout(next, start + (at - from) * beat - performance.now()))
    }
    next()
  }
  run(chords.bass, (note) => choirSing(choir[0], note))
  run(chords.mid, (note) => choirSing(choir[1], note))
  run(notes, (note, at) => {
    if (!note) {
      if (index === SONGS.length - 1) return stopSong()
      songVoiced = false
      gate()
      songIndex = index + 1
      songBeat = 0
      showSong()
      songTimers.push(setTimeout(() => playSong(songIndex), SONG_GAP))
      return
    }
    songBeat = at
    if (note.hz) {
      const [, u, v, rounded] = vowelOf(note.symbol)
      setPitch(note.hz)
      round.checked = rounded
      if (songVoiced) slide([u, v], SONG_SLIDE)
      else {
        cancelAnimationFrame(gliding)
        pos = [u, v]
        refresh(STRUCK)
      }
      if (short) {
        cutTimer = setTimeout(
          () => {
            songVoiced = false
            gate()
          },
          note.beats * beat * SONG_CUT
        )
      }
    }
    songVoiced = note.hz > 0
    gate()
  })
}

const turn = (by) => playSong((songIndex + by + SONGS.length) % SONGS.length)
songButton.addEventListener('click', () => {
  // the click ending a long press has already opened the list
  if (pressedLong) pressedLong = false
  else if (songBefore) stopSong()
  else playSong(songIndex)
})
// a paused song resumes at the note it was cut off in
pauseButton.addEventListener('click', () =>
  songPlaying ? pauseSong() : playSong(songIndex, songBeat)
)
document.getElementById('prev').addEventListener('click', () => turn(-1))
document.getElementById('next').addEventListener('click', () => turn(1))

// A long press or right click on the song button lists the songs. The page
// opens and shuts the popover itself, since one the browser manages would close
// on the release of the long press.
const tracks = document.getElementById('tracks')
const LONG_PRESS = 450
let pressTimer = 0
let pressedLong = false
SONGS.forEach(({ title }, i) => {
  const item = document.createElement('button')
  item.textContent = title
  item.addEventListener('click', () => {
    tracks.hidePopover()
    playSong(i)
  })
  tracks.append(item)
})
const tracksOpen = () => tracks.matches(':popover-open')
function openTracks() {
  if (tracksOpen()) return
  // by the button, left edges aligned, on the side with more room
  const { top, bottom, left } = songButton.getBoundingClientRect()
  const above = top > window.innerHeight - bottom
  tracks.style.left = `${left}px`
  tracks.style.top = above ? 'auto' : `${bottom + 6}px`
  tracks.style.bottom = above ? `${window.innerHeight - top + 6}px` : 'auto'
  tracks.style.maxHeight = `${(above ? top : window.innerHeight - bottom) - 16}px`
  tracks.showPopover()
}
songButton.addEventListener('pointerdown', () => {
  pressedLong = false
  pressTimer = setTimeout(() => {
    pressedLong = true
    openTracks()
  }, LONG_PRESS)
})
for (const type of ['pointerup', 'pointerleave', 'pointercancel']) {
  songButton.addEventListener(type, () => clearTimeout(pressTimer))
}
// right click, menu key, or a long touch where the browser sends this in place
// of a click
songButton.addEventListener('contextmenu', (event) => {
  event.preventDefault()
  clearTimeout(pressTimer)
  pressedLong = false
  openTracks()
})
document.addEventListener('pointerdown', (event) => {
  if (tracksOpen() && !tracks.contains(event.target) && event.target !== songButton) {
    tracks.hidePopover()
  }
})

const other = (select) => {
  let i
  do i = Math.floor(Math.random() * select.length)
  while (i === select.selectedIndex)
  return i
}

// every setting changes, and never to what it was
function scramble() {
  voice.selectedIndex = other(voice)
  phonation.selectedIndex = other(phonation)
  round.checked = !round.checked
  const semitones = (Math.random() * 2 - 1) * PITCH_SPREAD
  pitch.value = Math.round(VOICES[voice.value].pitch * SEMITONE ** semitones)
  applyPresets()
}

// One random sound: half the time a vowel well away from the last, half the
// time a glide between two symbols of the current rounding. It moves no control
// unless everything is asked for, which is Shift.
function shuffle(everything) {
  cancelAnimationFrame(gliding)
  if (everything) scramble()
  if (Math.random() < 0.5) {
    const last = randomPos
    do randomPos = [Math.random(), Math.random()]
    while (Math.hypot(randomPos[0] - last[0], randomPos[1] - last[1]) < FAR)
    pos = randomPos
    refresh()
    return
  }

  const pool = VOWELS.filter((vowel) => vowel[3] === isRounded())
  const any = () => pool[Math.floor(Math.random() * pool.length)]
  let from, to
  do [from, to] = [any(), any()]
  while (from === to || from[0] + to[0] === lastGlide)
  lastGlide = from[0] + to[0]
  randomPos = [to[1], to[2]]
  glide(lastGlide, from[0], to[0])
}

function startRandom(everything) {
  wake()
  cancelAnimationFrame(gliding)
  clearTimeout(ringTimer)
  clearInterval(randomTimer)
  shuffle(everything)
  randomTimer = setInterval(() => shuffle(everything), RANDOM_EVERY)
}

// Button and key do the same, down and up. Shift is read on the way down, for
// the whole hold.
function pressRandom(event) {
  randomHeld = true
  startRandom(event.shiftKey)
  voiceOn(true)
}

// rings on, so a quick tap is heard whole
function releaseRandom() {
  randomHeld = false
  clearInterval(randomTimer)
  clearTimeout(ringTimer)
  ringTimer = setTimeout(gate, RING)
}

const randomButton = document.getElementById('random')

randomButton.addEventListener('pointerdown', (event) => {
  randomButton.setPointerCapture(event.pointerId)
  pressRandom(event)
})
randomButton.addEventListener('pointerup', releaseRandom)
randomButton.addEventListener('pointercancel', releaseRandom)
// a click with no pointer behind it came from the keyboard
randomButton.addEventListener('click', (event) => {
  if (event.detail !== 0) return
  pressRandom(event)
  releaseRandom()
})

function setPitch(hz) {
  pitch.value = hz
  // creaky sounds below the slider, so the readout shows what is heard
  const f0 = Number(pitch.value) * PHONATIONS[phonation.value].pitch
  hzOut.textContent = Math.round(f0)
  send({ f0 })
  accompany()
}

// The wheel over the chart bends pitch a semitone a notch. Trackpad deltas are
// small, so they add up to a notch of 100. Firefox counts a mouse wheel in
// lines, three to a notch.
let wheel = 0
chart.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault()
    wheel -= event.deltaY * (event.deltaMode === 1 ? 100 / 3 : 1)
    const notches = Math.trunc(wheel / 100)
    if (!notches) return
    wheel -= notches * 100
    setPitch(Math.round(pitch.value * SEMITONE ** notches))
  },
  { passive: false }
)

// A narrow screen moves the face out of the chart and the one-tap controls out
// of the panel, and crops the chart to its frame. Each mover leaves a marker to
// come back to. The query is index.html's narrow rule. The wide box runs past
// the chart on the left, where the faces are.
const WIDE_BOX = '-60 15 700 410'
const NARROW_BOX = '22 15 553 405'
const narrow = matchMedia(
  '(max-width: 859.98px) and (orientation: portrait), (max-width: 619.98px)'
)
const quick = document.getElementById('quick')
const MOVERS = [
  [faces, document.getElementById('portrait')],
  [document.getElementById('transport'), document.getElementById('stage')],
  [voice.closest('label'), quick],
  [phonation.closest('label'), quick]
].map(([mover, away]) => {
  const home = document.createComment('')
  mover.before(home)
  return [mover, away, home]
})
function arrange() {
  for (const [mover, away, home] of MOVERS) {
    if (narrow.matches) away.append(mover)
    else home.after(mover)
  }
  chart.setAttribute('viewBox', narrow.matches ? NARROW_BOX : WIDE_BOX)
}
narrow.addEventListener('change', arrange)
arrange()

const more = document.getElementById('more')
more.addEventListener('click', () => {
  more.setAttribute('aria-expanded', document.body.classList.toggle('open'))
})

const reset = document.getElementById('reset')
const SOURCE = [tilt, breath, ...Object.values(fold)]
let preset = SOURCE.map((slider) => slider.value)

function showSource() {
  document.getElementById('db').textContent = tilt.value
  for (const slider of [breath, ...Object.values(fold)]) {
    slider.nextElementSibling.textContent = slider.value
  }
  // offered once a slider is off what the presets set
  reset.disabled = SOURCE.every((slider, i) => slider.value === preset[i])
}
showSource()

// the source is read from the sliders, so a preset can be bent by hand
function sendSource() {
  const speaker = VOICES[voice.value]
  const rough = Number(fold.rough.value)
  showSource()
  const source = {
    openQuotient: Number(fold.openQuotient.value),
    tilt: Number(tilt.value),
    breath: Number(breath.value),
    voicing: Number(fold.voicing.value),
    jitter: speaker.jitter * rough,
    shimmer: speaker.shimmer * rough,
    diplophonia: Number(fold.diplophonia.value),
    openBandwidth: Number(fold.openBandwidth.value)
  }
  send(source)
  for (const singer of choir) singer.node?.port.postMessage(source)
}

function applyPresets() {
  const speaker = VOICES[voice.value]
  const held = PHONATIONS[phonation.value]
  tilt.value = held.tilt + speaker.tilt
  breath.value = held.breath + speaker.breath
  for (const id of FOLD) fold[id].value = held[id] + (speaker[id] ?? 0)
  // read back, since a slider rounds to its own step
  preset = SOURCE.map((slider) => slider.value)
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
reset.addEventListener('click', applyPresets)
tilt.addEventListener('input', sendSource)
breath.addEventListener('input', sendSource)
for (const id of FOLD) fold[id].addEventListener('input', sendSource)
round.addEventListener('change', () => refresh())
latch.addEventListener('change', setLatch)

// A clicked control that kept focus would swallow the shortcuts, so hand focus
// back. One reached by keyboard keeps it.
for (const control of document.querySelectorAll('input, select, button')) {
  control.addEventListener('pointerup', () => control.blur())
  control.addEventListener('change', () => {
    if (!control.matches(':focus-visible')) control.blur()
  })
}

const ARROWS = {
  ArrowLeft: [-NUDGE, 0],
  ArrowRight: [NUDGE, 0],
  ArrowUp: [0, -NUDGE],
  ArrowDown: [0, NUDGE]
}

// Held arrows add up: two at right angles move diagonally, two opposed cancel.
// The page repeats them itself, since the system's key repeat only repeats the
// last key pressed.
function nudge(codes) {
  for (const code of codes) {
    const [du, dv] = ARROWS[code]
    pos = [clamp(pos[0] + du), clamp(pos[1] + dv)]
  }
  refresh()
}

const step = (select, by) => {
  select.selectedIndex = (select.selectedIndex + by + select.length) % select.length
}

// 1 steps forward, -1 back, which is Shift
const CYCLES = {
  Backslash(by) {
    step(voice, by)
    setVoice()
  },
  KeyP(by) {
    step(phonation, by)
    applyPresets()
  }
}

function silence() {
  stopSong()
  latch.checked = false
  clearInterval(cycleTimer)
  clearInterval(randomTimer)
  clearTimeout(ringTimer)
  randomHeld = false
  keys.length = 0
  held = false
  cancelAnimationFrame(gliding)
  gate()
}

const ACTIONS = {
  // Shift silences everything
  Backspace(event) {
    if (event.shiftKey) return silence()
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
  }
}

// Keys a focused slider or menu needs for itself. Every other key still plays.
// Space, Enter, and Esc are left to the browser.
const MOVE_KEYS = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown'
]
const ownKeys = (target) => (target.matches?.('select, input[type="range"]') ? MOVE_KEYS : [])

window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape') {
    if (tracksOpen()) tracks.hidePopover()
    document.activeElement?.blur()
    return
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return
  const { code } = event
  if (ownKeys(event.target).includes(code)) return

  if (code in CYCLES) {
    event.preventDefault()
    if (event.repeat) return
    wake()
    // direction is fixed at key down, for the whole hold
    const by = event.shiftKey ? -1 : 1
    CYCLES[code](by)
    clearInterval(cycleTimer)
    cycleTimer = setInterval(() => CYCLES[code](by), CYCLE_EVERY)
    return
  }

  if (code === RANDOM_KEY) {
    event.preventDefault()
    if (!event.repeat) pressRandom(event)
    return
  }

  if (KEY_POS.has(code)) {
    event.preventDefault()
    if (event.repeat) return
    wake()
    cancelAnimationFrame(gliding)
    if (!keys.includes(code)) keys.push(code)
    // a key joining others slides there, making a diphthong
    if (keys.length > 1) slide(chord())
    else {
      pos = chord()
      refresh(STRUCK)
    }
    gate()
    return
  }

  if (code in ARROWS) {
    event.preventDefault()
    if (event.repeat) return
    wake()
    nudge([code])
    // an arrow joining others already moving skips the wait
    if (!arrows.size) {
      const down = performance.now()
      arrowTimer = setInterval(() => {
        if (performance.now() - down > ARROW_DELAY) nudge(arrows)
      }, ARROW_EVERY)
    }
    arrows.add(code)
    return
  }

  if (code in ACTIONS) {
    event.preventDefault()
    if (event.repeat && ['Backspace', 'Backquote'].includes(code)) return
    wake()
    ACTIONS[code](event)
  }
})

window.addEventListener('keyup', (event) => {
  const { code } = event
  if (code in CYCLES) clearInterval(cycleTimer)
  if (code === RANDOM_KEY) releaseRandom()
  if (arrows.delete(code) && !arrows.size) clearInterval(arrowTimer)
  const i = keys.indexOf(code)
  if (i === -1) return
  keys.splice(i, 1)
  if (keys.length) slide(chord())
  gate()
})

// a key released while the window is unfocused sends no keyup
window.addEventListener('blur', () => {
  clearInterval(cycleTimer)
  clearInterval(randomTimer)
  clearInterval(arrowTimer)
  arrows.clear()
  randomHeld = false
  keys.length = 0
  held = false
  gate()
})

// dot and readout show at once, the sound follows when it loads
refresh()

ctx.audioWorklet.addModule('synth.js').then(() => {
  const voiceNode = () =>
    new AudioWorkletNode(ctx, 'vowel', { numberOfInputs: 0, outputChannelCount: [1] })
  master = new GainNode(ctx)
  master.connect(ctx.destination)
  synth = voiceNode()
  synth.connect(master)
  for (const singer of choir) {
    singer.node = voiceNode()
    singer.node.connect(new GainNode(ctx, { gain: CHOIR_GAIN })).connect(master)
  }
  // catch up on anything set while the module loaded
  setPitch(pitch.value)
  sendSource()
  refresh()
  gate()
})

// The face beside the chart, a front view that mouths the vowel. Jaw and lip
// opening follow height, lip width follows backness, rounding purses the lips,
// brows follow pitch. The eyes watch the dot while it sounds and the pointer
// when quiet. Lids follow phonation, pitch, and the squint of a spread vowel.
// Tilt shows as effort. Flat is pressed: brows knit, lids narrow, lips thin,
// jaw muscle stands out. Steep is slack: brows ease, jaw hangs, mouth corners
// drop.
// Breath shows as air let out: nostrils flare, lips part, cheeks draw in, jaw
// hangs, so the head gets longer and leaner, never wider. All of it swells and
// settles on a slow breathing cycle.
// A cartoon of the visible articulators, not a measured model. The tongue does
// most of the work and cannot be seen from the front.
// Two smaller heads either side, each turned a little outward, are the choir's.
// They fade in for a song and each mouths its own part.
const FACE_X = 45,
  FACE_Y = 258
// about where the narrow layout puts the face, in chart coordinates
const UNDER_CHART = [120, 560]
// Reduced motion stops the blink, the one movement nobody asked for. The mouth
// still eases, since it only answers the controls.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
// Spring rate per second for each part of the face. A jaw takes about a sixth
// of a second, brows drift, a blink is quick.
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
  flare: 12,
  effort: 9,
  air: 9
}
// how far open the lids sit per phonation, 1 being ordinary
const LIDS = { modal: 1, breathy: 0.8, creaky: 0.55, whisper: 1.15 }
const EYE_X = 24,
  EYE_Y = -17
const BLINK_EVERY = 4200,
  BLINK_FOR = 130
// one breath every four seconds
const BREATHS_PER_MS = 0.25 / 1000
// how soon the gaze saturates as its target moves away, in SVG units
const GAZE_REACH = 80
// Tilt as a look, 1 pressed to -1 slack. An ordinary voice, 4 to 6 dB, leaves
// the face alone. The thresholds are guesses.
function strain() {
  const db = Number(tilt.value)
  return db < 4 ? 1 - db / 4 : -clamp((db - 6) / 12)
}
const SVG = 'http://www.w3.org/2000/svg'
// the paths of one head, back to front
const HEAD_PATHS = ['mesh', 'nodes', 'outline', 'features', 'mouth']
// a side head's offset from the main one, its size, and its turn in radians
const SIDE_X = 75,
  SIDE_Y = 12,
  SIDE_SCALE = 0.42,
  SIDE_YAW = 0.25
// how far the middle of the face stands out from its edge, for the turn
const HEAD_DEPTH = 34
// drawn where the main head is, then shrunk and moved by its group
function sideHead(side) {
  const group = document.createElementNS(SVG, 'g')
  group.setAttribute('class', 'side-head')
  group.setAttribute(
    'transform',
    `translate(${FACE_X + side * SIDE_X} ${FACE_Y + SIDE_Y}) scale(${SIDE_SCALE}) translate(${-FACE_X} ${-FACE_Y})`
  )
  faces.prepend(group)
  return Object.fromEntries(
    HEAD_PATHS.map((name) => {
      const path = document.createElementNS(SVG, 'path')
      path.setAttribute('class', name)
      group.append(path)
      return [name, path]
    })
  )
}
const restingFace = () => ({
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
  flare: 0,
  effort: strain(),
  air: 0
})
const heads = [
  { paths: Object.fromEntries(HEAD_PATHS.map((id) => [id, document.getElementById(id)])), yaw: 0 },
  ...choir.map((singer, i) => ({
    paths: sideHead(i ? 1 : -1),
    yaw: (i ? 1 : -1) * SIDE_YAW,
    singer
  }))
].map((head) => {
  const face = restingFace()
  return { ...head, face, speed: Object.fromEntries(Object.keys(face).map((key) => [key, 0])) }
})
let lastFrame = performance.now()
let nextBlink = performance.now() + BLINK_EVERY
// where the pointer last was, in chart coordinates
let pointer = null

window.addEventListener('pointermove', (event) => {
  pointer = svgPoint(event)
})

// an octagon, near enough to round at this size
const PUPIL = Array.from({ length: 8 }, (_, i) => [
  Math.cos((i * Math.PI) / 4),
  Math.sin((i * Math.PI) / 4)
])
// The right half of the face as triangles over named points, mirrored when
// drawn. The mesh lines are their edges.
const TRIANGLES = `
  crown a1 m1, a1 b1 m1, a1 a2 b1, a2 t1 b1, a2 a3 t1, t1 a3 b2, b1 t1 b2,
  b1 b2 b4, b1 b4 b3, b1 b3 m1, m1 b3 m2,
  b3 b4 b4l, b3 b4l b3l, b4 b2 b4l,
  a3 e1 b2, b2 e1 e2o, b4l b2 e2o, b4l e2o e2, b4l e2 e2i, b3l b4l e2i, b3l e2i e3,
  m2 b3 b3l, m2 b3l nb, nb b3l e3, m2 nb m3, nb e3 n0, nb n0 m3,
  a3 k1 e1, a3 a4 k1, k1 a4 c1, e1 k1 c1,
  e1 c1 e4o, e4o c1 u1, e4o u1 e4, e4 u1 e4i, e4i u1 e3, e3 u1 n0, n0 u1 n1, u1 c1 n1,
  m3 n0 m4, n0 nt m4, n0 n1 nt, nt n1 n2, nt n2 n4, m4 nt n4, m4 n4 m5,
  a4 a5 c1, c1 a5 c2, c1 c2 n1, n1 c2 upper, n1 upper n2, n2 upper upperIn, n2 upperIn n4,
  n4 upperIn m5, m5 upperIn lipTop,
  c2 corner upper, a5 a6 c2, c2 a6 c3, c2 c3 corner, corner c3 lower,
  c3 a6 a7, c3 a7 ch, c3 ch lower, lower ch lowerIn, lowerIn ch m8, lowerIn m8 lipBottom,
  ch a7 chin, ch chin m8
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

function faceTarget(now, { shape, sounding, brow }) {
  const { u, v, rounded } = shape
  const spread = 1 - 0.15 * v - 0.12 * u
  const pursed = 0.32 + 0.25 * v
  if (now > nextBlink + BLINK_FOR) nextBlink = now + BLINK_EVERY * (0.5 + Math.random())
  // eyes go to the dot while it sounds, and follow the pointer when idle
  const [lookX, lookY] = !sounding && pointer ? pointer : toXY(u, v)
  // on a narrow screen the face sits under the chart and looks up at it
  const [faceX, faceY] = narrow.matches ? UNDER_CHART : [FACE_X, FACE_Y]
  const lookDX = lookX - faceX
  const lookDY = lookY - faceY - EYE_Y
  const reach = Math.hypot(lookDX, lookDY) + GAZE_REACH
  const effort = strain()
  // a square root, so the small breath of an ordinary voice still shows
  const air = Math.sqrt(breath.value / breath.max)
  // a close spread vowel pulls the cheeks up into the eyes, as a smile does
  const squint = sounding ? 0.25 * (1 - rounded) * (1 - v) : 0
  return {
    open: sounding ? lerp(0.12 + 0.88 * v, 0.18 + 0.6 * v, rounded) : 0,
    width: sounding ? lerp(spread, pursed, rounded) : 0.8,
    lips: sounding ? rounded : 0,
    jaw: sounding ? v : 0,
    brow,
    gazeX: lookDX / reach,
    gazeY: lookDY / reach,
    lid: LIDS[phonation.value] + 0.13 + 0.15 * brow - squint - 0.15 * Math.max(0, effort),
    flare: 0.7 * air + (sounding ? 0.3 * v : 0),
    effort,
    air,
    voice: sounding ? 1 : 0,
    blink: !still && now > nextBlink ? 1 : 0
  }
}

function facePoints(face, now) {
  const jaw = 10 * face.jaw
  const lift = 6 * face.brow
  const lid = Math.max(0, face.lid) * (1 - face.blink)
  const effort = clamp(face.effort)
  const lax = clamp(-face.effort)
  // reduced motion holds the breathing still
  const swell = still ? 1 : 1 + 0.25 * Math.sin(2 * Math.PI * BREATHS_PER_MS * now)
  const flare = Math.max(0, face.flare) * swell
  const air = Math.max(0, face.air) * swell
  const spread = Math.max(0, face.width - 0.8) * face.voice
  // both eyes look the same way, so the pupils are not mirrored
  const pupil = (side) => {
    const x = side * EYE_X + 5 * face.gazeX
    const y = EYE_Y + 2.5 * face.gazeY * lid
    return PUPIL.map(([dx, dy]) => [x + 1.7 * dx, y + 1.9 * lid * dy])
  }
  const my = 36 + jaw * 0.45
  const w = 26 * face.width
  // breath parts the lips a little even on a close vowel
  const inner = 9.5 * Math.max(0, face.open) + 2 * air * face.voice
  const outer = inner + Math.max(1.5, 3 + 2 * face.lips - 1.2 * effort + 0.8 * lax)
  const cornerY = my + 3.5 * lax - effort
  return {
    crown: [0, -78],
    m1: [0, -52],
    m2: [0, -28],
    m3: [0, -10],
    m4: [0, 9.5 - 0.5 * flare],
    // a spread lip lifts the base of the nose
    m5: [0, 17 - 6 * spread],
    m8: [0, 55 + jaw * 0.9 + 1.5 * lax + air],
    chin: [0, 67 + jaw + 2 * lax + 1.5 * air],
    a1: [23, -74],
    a2: [41, -56],
    a3: [48, -28],
    a4: [49, 0],
    a5: [45 - 2.5 * air + 2 * effort, 24 + jaw * 0.3],
    a6: [37 - 2 * air + 4 * effort, 45 + jaw * 0.6 + 3 * lax + air],
    a7: [20, 61 + jaw + 2 * lax + 1.5 * air],
    b1: [22, -50],
    // The brow tapers: a thick inner end, an arch, a tail. Effort draws the
    // inner end down and in, ease lets it rise.
    b2: [40, -30 - lift - effort + lax],
    b3: [11.5 - 2.5 * effort, -32 - lift * 1.3 + 3.5 * effort - 2 * lax],
    b3l: [12 - 2.5 * effort, -29 - lift * 1.3 + 3.5 * effort - 2 * lax],
    b4: [27 - effort, -34.5 - lift * 1.2 + effort],
    b4l: [26.5 - effort, -32.3 - lift * 1.2 + effort],
    t1: [41, -41],
    k1: [42.5, -9],
    // each lid is a corner, a shoulder, a peak, a shoulder, a corner
    e1: [36, -17],
    e2o: [30.5, EYE_Y - 4 * lid],
    e2: [EYE_X, EYE_Y - 5.5 * lid],
    e2i: [18, EYE_Y - 4 * lid],
    e3: [13, -16],
    e4i: [18, EYE_Y + 3 * lid],
    e4: [EYE_X, EYE_Y + 4 * lid],
    e4o: [30.5, EYE_Y + 3 * lid],
    u1: [22, 0],
    // slack cheeks sink in and down
    c1: [33 - 3 * air, 6 - 2 * effort + 1.5 * air],
    c2: [24 - 2 * effort, 25 + jaw * 0.3 - 2 * effort + air],
    c3: [28, 45 + jaw * 0.6],
    // The nose from the front is mostly its base. The bridge is two faint mesh
    // lines, and only the wings and underside are drawn bright.
    nb: [3.5, -24],
    n0: [4.5, -5],
    nt: [6.8 + 0.5 * flare, 8 - 0.5 * flare],
    n1: [9.5 + 3 * flare, 11.5 - flare],
    n2: [7.8 + 1.5 * flare, 15 - 4 * spread],
    n4: [3.6, 16 - 5 * spread],
    ch: [10, 51.5 + jaw * 0.9 + 1.5 * lax + air],
    corner: [w, cornerY],
    // the upper lip peaks either side of a dip, the lower is one full curve
    upper: [w * 0.62, my - outer * 0.7],
    upperIn: [w * 0.22, my - outer],
    lipTop: [0, my - outer * 0.82],
    lower: [w * 0.62, my + outer * 0.72],
    lowerIn: [w * 0.26, my + outer * 1.02],
    lipBottom: [0, my + outer * 1.08],
    innerCorner: [w * 0.85, cornerY],
    innerUpperOut: [w * 0.66, my - inner * 0.62],
    innerUpper: [w * 0.34, my - inner],
    innerLowerOut: [w * 0.66, my + inner * 0.62],
    innerLower: [w * 0.34, my + inner],
    pupils: [pupil(1), pupil(-1)]
  }
}

function drawHead({ paths, face, speed, yaw, singer }, now, dt) {
  const target = faceTarget(
    now,
    singer ?? {
      shape,
      sounding,
      brow: browOf(pitch.value)
    }
  )
  // A critically damped spring per value, solved exactly so a long frame cannot
  // blow it up. A change of target mid-move bends the motion.
  for (const key in target) {
    const rate = RATES[key]
    const gap = face[key] - target[key]
    const push = (speed[key] + rate * gap) * dt
    const decay = Math.exp(-rate * dt)
    face[key] = target[key] + (gap + push) * decay
    speed[key] = (speed[key] - rate * push) * decay
  }

  const p = facePoints(face, now)
  const across = Math.cos(yaw)
  const forward = Math.sin(yaw)
  // A turned head is the flat face bent over a dome and seen from the side,
  // so the near half widens, the far half narrows, and the nose leads.
  const at = ([x, y]) => {
    const z = HEAD_DEPTH * Math.sqrt(Math.max(0, 1 - (x / 50) ** 2))
    return `${(FACE_X + x * across + z * forward).toFixed(1)},${(FACE_Y + y).toFixed(1)}`
  }
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

  paths.mesh.setAttribute('d', EDGES.map(([a, b]) => both(line)(p[a], p[b])).join(''))
  paths.nodes.setAttribute(
    'd',
    [...new Set(EDGES.flat())].map((name) => both(node)(p[name])).join('')
  )
  paths.outline.setAttribute(
    'd',
    ring([
      ...names(...OUTLINE),
      ...names(...OUTLINE)
        .map(flip)
        .reverse()
    ])
  )
  paths.features.setAttribute(
    'd',
    [
      rings(names('e1', 'e2o', 'e2', 'e2i', 'e3', 'e4i', 'e4', 'e4o')),
      rings(names('b3', 'b4', 'b2', 'b4l', 'b3l')),
      both(line)(p.nt, p.n1),
      both(line)(p.n1, p.n2),
      both(line)(p.n2, p.n4),
      both(line)(p.n4, p.m5),
      ...p.pupils.map(ring)
    ].join('')
  )
  paths.mouth.setAttribute(
    'd',
    [
      ring([
        ...names('lipTop', 'upperIn', 'upper', 'corner', 'lower', 'lowerIn', 'lipBottom'),
        ...names('lowerIn', 'lower', 'corner', 'upper', 'upperIn').map(flip)
      ]),
      ring([
        ...names('innerUpper', 'innerUpperOut', 'innerCorner', 'innerLowerOut', 'innerLower'),
        ...names('innerLower', 'innerLowerOut', 'innerCorner', 'innerUpperOut', 'innerUpper').map(
          flip
        )
      ])
    ].join('')
  )
  paths.mouth.style.setProperty('--voice', face.voice.toFixed(2))
}

function drawFace(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000)
  lastFrame = now
  for (const head of heads) drawHead(head, now, dt)
  requestAnimationFrame(drawFace)
}

requestAnimationFrame(drawFace)

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
  // as on the printed chart: unrounded left of the point, rounded right, a lone
  // central symbol on the point
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
  // anchored by its near edge, so the gap to the point holds at any type size
  text.setAttribute('class', centered ? 'ipa' : rounded ? 'ipa right' : 'ipa left')
  text.setAttribute('x', x + (centered ? 0 : rounded ? 10 : -10))
  text.setAttribute('y', y)
  text.textContent = symbol
  labels.append(text)
}
