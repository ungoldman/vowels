import assert from 'node:assert/strict'
import { test } from 'node:test'
import { register, VowelSynth } from '../synth.js'

const RATE = 48000
const BLOCK = 128

function render(synth, blocks) {
  const out = new Float32Array(BLOCK * blocks)
  for (let b = 0; b < blocks; b++) synth.render(out.subarray(b * BLOCK, (b + 1) * BLOCK))
  return out
}

const peak = (x) => x.reduce((max, v) => Math.max(max, Math.abs(v)), 0)

// level in dB of one frequency, by a single-bin Fourier sum
function level(x, hz) {
  const w = (2 * Math.PI * hz) / RATE
  let re = 0
  let im = 0
  for (let n = 0; n < x.length; n++) {
    re += x[n] * Math.cos(w * n)
    im -= x[n] * Math.sin(w * n)
  }
  return 20 * Math.log10(Math.hypot(re, im) / x.length + 1e-12)
}

// a steady voice with no wobble or noise, so harmonics sit on exact multiples
const steady = { on: true, breath: 0, jitter: 0, shimmer: 0, drift: 0 }

test('it is silent until switched on', () => {
  assert.equal(peak(render(new VowelSynth(RATE), 50)), 0)
})

test('it sounds when on, stays bounded, and fades when off', () => {
  const synth = new VowelSynth(RATE)
  synth.set({ on: true })
  const sounding = render(synth, 200)
  assert.ok(sounding.every(Number.isFinite))
  assert.ok(peak(sounding) > 0.1 && peak(sounding) <= 1)
  synth.set({ on: false })
  render(synth, 200)
  assert.ok(peak(render(synth, 10)) < 1e-3)
})

test('the spectrum peaks at the formants it was given', () => {
  const synth = new VowelSynth(RATE)
  const f0 = 120
  synth.set({ ...steady, f0, formants: [840, 1560, 2520, 3300, 3750] })
  render(synth, 200)
  const x = render(synth, 300)
  // harmonics on a formant against harmonics in the valleys beside them
  for (const [on, off] of [
    [840, 480],
    [1560, 1200],
    [2520, 2040]
  ]) {
    assert.ok(level(x, on) > level(x, off) + 6, `${on} over ${off}`)
  }
})

test('tilt takes the top off the spectrum', () => {
  const high = (tilt) => {
    const synth = new VowelSynth(RATE)
    synth.set({ ...steady, tilt })
    render(synth, 200)
    return level(render(synth, 300), 3000)
  }
  assert.ok(high(0) > high(24) + 12)
})

test('the tilt coefficient gives the asked loss at 3 kHz', () => {
  const synth = new VowelSynth(RATE)
  assert.equal(synth.tiltCoefficient(0), 0)
  const b = synth.tiltCoefficient(6)
  const w = (2 * Math.PI * 3000) / RATE
  const gain = (1 - b) / Math.sqrt(1 - 2 * b * Math.cos(w) + b * b)
  assert.ok(Math.abs(20 * Math.log10(gain) + 6) < 1e-6)
})

test('a longer open phase strengthens the first harmonic over the second', () => {
  const h1h2 = (openQuotient) => {
    const synth = new VowelSynth(RATE)
    synth.set({ ...steady, tilt: 0, openQuotient, formants: [850, 1610, 2500, 3300, 3750] })
    render(synth, 200)
    const x = render(synth, 300)
    const band = (hz) => Math.max(...[-3, -2, -1, 0, 1, 2, 3].map((d) => level(x, hz + d)))
    return band(120) - band(240)
  }
  assert.ok(h1h2(0.67) > h1h2(0.33) + 3)
})

test('a whisper is noise with no pitch', () => {
  const synth = new VowelSynth(RATE)
  synth.set({ on: true, voicing: 0, breath: 0.5, openBandwidth: 150 })
  render(synth, 200)
  const x = render(synth, 300)
  assert.ok(peak(x) > 0.01)
  // no harmonic stands out from its neighbours the way a voiced one does
  assert.ok(level(x, 120) < level(x, 180) + 12)
})

test('breathy and creaky settings render without blowing up', () => {
  for (const params of [
    { openQuotient: 0.77, tilt: 16, breath: 0.24, voicing: 0.8, openBandwidth: 150 },
    { openQuotient: 0.33, f0: 72, jitter: 0.045, shimmer: 0.21, diplophonia: 0.35 }
  ]) {
    const synth = new VowelSynth(RATE)
    synth.set({ on: true, ...params })
    const x = render(synth, 400)
    assert.ok(x.every(Number.isFinite))
    assert.ok(peak(x) > 0.05 && peak(x) <= 1)
  }
})

test('weakening alternate pulses puts energy at half the pitch', () => {
  const sub = (diplophonia) => {
    const synth = new VowelSynth(RATE)
    synth.set({ ...steady, diplophonia })
    render(synth, 200)
    return level(render(synth, 300), 60)
  }
  assert.ok(sub(0.5) > sub(0) + 10)
})

test('formants glide to a new target instead of jumping', () => {
  const synth = new VowelSynth(RATE)
  synth.set({ on: true, formants: [300, 900, 2200, 3300, 3750], smooth: 0.04 })
  render(synth, 1)
  assert.ok(synth.formants[0] > 300 && synth.formants[0] < 500)
  render(synth, 400)
  assert.ok(Math.abs(synth.formants[0] - 300) < 1)
})

test('the formants above F5 fill in the top of the spectrum', () => {
  const top = (formants) => {
    const synth = new VowelSynth(RATE)
    synth.set({ ...steady, formants })
    render(synth, 200)
    // tapered, or the strong low harmonics leak over the quiet top
    const x = render(synth, 100).map((v, n, all) => v * Math.sin((Math.PI * n) / all.length) ** 2)
    // harmonics that high move with the flutter, so take the whole band
    let power = 0
    for (let hz = 5000; hz < 7000; hz += 25) power += 10 ** (level(x, hz) / 10)
    return 10 * Math.log10(power)
  }
  const five = [500, 1500, 2500, 3300, 3750]
  assert.ok(top([...five, 4900, 5900, 6900, 7900, 8900]) > top(five) + 12)
})

test('the pitch wanders a little, and not at all when told not to', () => {
  const synth = new VowelSynth(RATE)
  synth.set({ on: true })
  render(synth, 400)
  assert.ok(synth.wander[1] !== 0 && Math.abs(synth.wander[1]) < 10)
  // with no wobble of any kind the pitch is exact, so a harmonic stays put
  const still = new VowelSynth(RATE)
  still.set({ ...steady, f0: 100 })
  render(still, 200)
  const x = render(still, 750)
  assert.ok(level(x, 2000) > level(x, 2020) + 6)
})

test('a note starts under its pitch, settles, and holds it as it ends', () => {
  // count pulses by the flips of the alternate-pulse flag
  const pulses = (synth, blocks) => {
    let count = 0
    for (let b = 0; b < blocks; b++) {
      const was = synth.odd
      render(synth, 1)
      if (synth.odd !== was) count++
    }
    return count
  }
  const synth = new VowelSynth(RATE)
  synth.set({ ...steady, f0: 300, scoop: 0.3 })
  const early = pulses(synth, 30)
  render(synth, 400)
  assert.ok(Math.abs(synth.settle - 1) < 1e-3)
  const settled = pulses(synth, 30)
  synth.set({ on: false })
  const late = pulses(synth, 30)
  assert.ok(early < settled, `${early} ${settled}`)
  assert.ok(Math.abs(late - settled) <= 1, `${late} ${settled}`)
  // once it has died away, the next note scoops again
  render(synth, 400)
  assert.equal(synth.settle, 0)
})

test('a formant above half the sample rate is left out', () => {
  const synth = new VowelSynth(8000)
  synth.set({ on: true })
  const x = render(synth, 100)
  assert.ok(x.every(Number.isFinite))
  // F5 at 3750 Hz fits under 4 kHz and is tuned, a formant pushed past it is not
  const untuned = new VowelSynth(8000)
  untuned.set({ on: true, formants: [500, 1500, 2500, 3300, 9000], smooth: 0.0001 })
  render(untuned, 100)
  assert.equal(untuned.resonators[4].b, 0)
})

test('it registers as an audio worklet when it loads inside one', () => {
  let registered
  register({
    sampleRate: RATE,
    AudioWorkletProcessor: class {
      port = {}
    },
    registerProcessor: (name, processor) => {
      registered = { name, processor }
    }
  })
  assert.equal(registered.name, 'vowel')
  const node = new registered.processor()
  node.port.onmessage({ data: { on: true } })
  const out = new Float32Array(BLOCK * 4)
  for (let i = 0; i < 100; i++) assert.equal(node.process([], [[out]]), true)
  assert.ok(peak(out) > 0.05)
})

test('outside a worklet, loading it registers nothing', () => {
  assert.doesNotThrow(() => register({}))
})
