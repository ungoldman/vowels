// A cascade formant synthesizer for sustained vowels, after Klatt (1980),
// "Software for a cascade/parallel formant synthesizer", and Klatt and Klatt
// (1990) for the glottal pulse and the flutter.
//
// Chain: glottal pulse -> tilt -> + aspiration noise -> formants in series.
// In series the formants set each other's relative levels, as they do in a
// vocal tract, so there are no per-formant gains to balance.

const TWO_PI = 2 * Math.PI

const ATTACK = 0.012
const RELEASE = 0.05
const GLIDE = 0.02
const GAIN = 0.35
// Klatt's flutter: three slow sines that never line up, in place of vibrato
const FLUTTER = 0.25
const FLUTTER_RATES = [12.7, 7.1, 4.7]
// The pitch also wanders at random below this rate, and a note takes this
// long to settle onto its pitch. Both are guesses.
const DRIFT_HZ = 1.5
const SETTLE = 0.06
// tilt is specified as attenuation at this frequency
const TILT_AT = 3000
// noise is this much quieter while the glottis is closed
const NOISE_CLOSED = 0.5

const jiggle = (amount) => 1 + amount * (Math.random() * 2 - 1)

// two-pole resonator with unity gain at DC
class Resonator {
  a = 1
  b = 0
  c = 0
  y1 = 0
  y2 = 0

  set(freq, bandwidth, rate) {
    const r = Math.exp((-Math.PI * bandwidth) / rate)
    this.c = -r * r
    this.b = 2 * r * Math.cos((TWO_PI * freq) / rate)
    this.a = 1 - this.b - this.c
  }

  step(x) {
    const y = this.a * x + this.b * this.y1 + this.c * this.y2
    this.y2 = this.y1
    this.y1 = y
    return y
  }
}

// residual that rounds off a one-sample step, so the closure does not alias
function polyBlep(t, dt) {
  if (t < dt) {
    const x = t / dt
    return 2 * x - x * x - 1
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt
    return x * x + 2 * x + 1
  }
  return 0
}

export class VowelSynth {
  constructor(rate) {
    this.rate = rate
    this.target = {
      f0: 120,
      // a shorter list leaves the resonators above it as they were
      formants: [500, 1500, 2500, 3300, 3750, 4900, 5900, 6900, 7900, 8900],
      bandwidths: [50, 70, 110, 250, 200, 1000, 1000, 1000, 1000, 1000],
      // share of each cycle the glottis is open
      openQuotient: 0.5,
      // dB lost at TILT_AT
      tilt: 3,
      // aspiration noise level, and how much of the pulse is left under it
      breath: 0.04,
      voicing: 1,
      // half-width of the per-cycle wobble in period and in amplitude
      jitter: 0.0075,
      shimmer: 0.035,
      // how far every other pulse is weakened, the rattle of creaky voice
      diplophonia: 0,
      // spread of the slow wander in pitch, as a share of the pitch
      drift: 0.005,
      // how far under its pitch a note starts, and falls back as it ends
      scoop: 0.05,
      // Hz added to the F1 bandwidth while the glottis is open, since an
      // open glottis lets energy leak down into the lungs
      openBandwidth: 0,
      smooth: 0.015,
      on: false
    }
    this.f0 = this.target.f0
    this.voicing = this.target.voicing
    this.formants = [...this.target.formants]
    this.bandwidths = [...this.target.bandwidths]
    this.resonators = this.formants.map(() => new Resonator())
    this.level = 0
    this.phase = 0
    this.time = 0
    this.wander = [0, 0]
    this.settle = 0
    this.tiltB = 0
    this.tiltY = 0
    this.periodRate = 1
    this.periodGain = 1
    this.odd = false
    this.damped = false
  }

  set(params) {
    Object.assign(this.target, params)
  }

  // one-pole low-pass coefficient that gives `db` of loss at TILT_AT
  tiltCoefficient(db) {
    if (db <= 0) return 0
    const g2 = 10 ** (-db / 10)
    const cos = Math.cos((TWO_PI * TILT_AT) / this.rate)
    const p = 1 - g2 * cos
    return (p - Math.sqrt(p * p - (1 - g2) ** 2)) / (1 - g2)
  }

  tuneF1() {
    const extra = this.damped ? this.target.openBandwidth : 0
    this.resonators[0].set(this.formants[0], this.bandwidths[0] + extra, this.rate)
  }

  render(out) {
    const { rate, target, resonators } = this
    const n = out.length

    // formants move once per block, which is under 3 ms at 48 kHz
    const k = 1 - Math.exp(-n / (target.smooth * rate))
    for (let i = 0; i < target.formants.length; i++) {
      this.formants[i] += (target.formants[i] - this.formants[i]) * k
      this.bandwidths[i] += (target.bandwidths[i] - this.bandwidths[i]) * k
      // a formant above Nyquist would fold back down, so leave it out
      if (i > 0 && this.formants[i] < rate / 2)
        resonators[i].set(this.formants[i], this.bandwidths[i], rate)
    }
    this.tuneF1()
    this.tiltB = this.tiltCoefficient(target.tilt)

    const w = TWO_PI * this.time
    const flutter =
      1 + (FLUTTER / 50) * FLUTTER_RATES.reduce((sum, hz) => sum + Math.sin(hz * w), 0)
    this.time += n / rate

    // white noise through two one-pole low-passes, scaled back to unit spread
    const a = Math.exp((-TWO_PI * DRIFT_HZ * n) / rate)
    const white = (Math.random() * 2 - 1) * Math.sqrt(3)
    const unit = Math.sqrt((1 - a * a) ** 3 / (1 + a * a)) / (1 - a) ** 2
    this.wander[0] += (white * unit - this.wander[0]) * (1 - a)
    this.wander[1] += (this.wander[0] - this.wander[1]) * (1 - a)
    const drift = 1 + target.drift * this.wander[1]

    const glideK = 1 - Math.exp(-1 / (GLIDE * rate))
    const goal = target.on ? 1 : 0
    const levelK = 1 - Math.exp(-1 / ((target.on ? ATTACK : RELEASE) * rate))
    const settleK = 1 - Math.exp(-1 / (SETTLE * rate))
    const oq = target.openQuotient
    // with no voicing the glottis never closes, as in a whisper
    const whisper = target.voicing === 0

    for (let s = 0; s < n; s++) {
      this.f0 += (target.f0 - this.f0) * glideK
      this.voicing += (target.voicing - this.voicing) * glideK
      this.level += (goal - this.level) * levelK
      this.settle += (goal - this.settle) * settleK
      const scoop = 1 - target.scoop * (1 - this.settle)
      const dt = (this.f0 * flutter * drift * scoop * this.periodRate) / rate
      this.phase += dt
      if (this.phase >= 1) {
        this.phase -= 1
        // the pulse is at zero here, so a new period can change size cleanly
        this.odd = !this.odd
        this.periodRate = jiggle(target.jitter)
        this.periodGain = jiggle(target.shimmer) * (this.odd ? 1 - target.diplophonia : 1)
      }

      // Derivative of the flow pulse x^2 - x^3 over the open phase, which is
      // the flow as heard after lip radiation. It ends on a step up from -1
      // to 0 at closure, and that step is what excites the formants.
      const x = this.phase / oq
      const open = x < 1
      let source = open ? 2 * x - 3 * x * x : 0
      let sinceClosure = this.phase - oq
      if (sinceClosure < 0) sinceClosure += 1
      source += 0.5 * polyBlep(sinceClosure, dt)
      source *= this.periodGain * this.voicing

      const damped = open || whisper
      if (damped !== this.damped) {
        this.damped = damped
        if (target.openBandwidth > 0) this.tuneF1()
      }

      this.tiltY = (1 - this.tiltB) * source + this.tiltB * this.tiltY
      const noise = (Math.random() * 2 - 1) * target.breath * (damped ? 1 : NOISE_CLOSED)

      let y = this.tiltY + noise
      for (let i = 0; i < resonators.length; i++) y = resonators[i].step(y)
      out[s] = Math.tanh(y * this.level * GAIN)
    }
  }
}

// Registers the processor when loaded inside an audio worklet, which is the
// only place these globals exist.
export function register(scope) {
  if (typeof scope.registerProcessor !== 'function') return
  scope.registerProcessor(
    'vowel',
    class extends scope.AudioWorkletProcessor {
      constructor() {
        super()
        this.synth = new VowelSynth(scope.sampleRate)
        this.port.onmessage = (event) => this.synth.set(event.data)
      }

      process(_inputs, outputs) {
        this.synth.render(outputs[0][0])
        return true
      }
    }
  )
}

register(globalThis)
