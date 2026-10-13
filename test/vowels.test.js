import assert from 'node:assert/strict'
import { test } from 'node:test'
import fc from 'fast-check'
import {
  CARDINALS,
  clamp,
  describe,
  formants,
  GLIDES,
  geo,
  KEY_POS,
  KEY_ROWS,
  lerp,
  nearest,
  PHONATIONS,
  toUV,
  toXY,
  VOICES,
  VOWELS
} from '../vowels.js'

const unit = fc.double({ min: 0, max: 1, noNaN: true })

test('the chart has the 28 IPA vowels, each once', () => {
  assert.equal(VOWELS.length, 28)
  assert.equal(new Set(VOWELS.map(([symbol]) => symbol)).size, 28)
})

test('every symbol sits inside the chart', () => {
  for (const [symbol, u, v] of VOWELS) {
    assert.ok(u >= 0 && u <= 1 && v >= 0 && v <= 1, symbol)
  }
})

test('formants are exact at the sixteen cardinal vowels', () => {
  for (const [name, rounded] of [
    ['unrounded', false],
    ['rounded', true]
  ]) {
    for (const [edge, u] of [
      ['front', 0],
      ['back', 1]
    ]) {
      CARDINALS[name][edge].forEach(([f1, f2], row) => {
        const [g1, g2] = formants(u, row / 3, rounded)
        assert.ok(Math.abs(g1 - f1) < 1e-6, `${name} ${edge} ${row} F1`)
        assert.ok(Math.abs(g2 - f2) < 1e-6, `${name} ${edge} ${row} F2`)
      })
    }
  }
})

test('formants return five rising frequencies', () => {
  fc.assert(
    fc.property(unit, unit, fc.boolean(), (u, v, rounded) => {
      const freqs = formants(u, v, rounded)
      assert.equal(freqs.length, 5)
      for (let i = 1; i < freqs.length; i++) assert.ok(freqs[i] > freqs[i - 1])
    })
  )
})

test('F1 and F2 stay within the range of the cardinal vowels', () => {
  const all = Object.values(CARDINALS).flatMap(({ front, back }) => [...front, ...back])
  for (const i of [0, 1]) {
    const low = Math.min(...all.map((pair) => pair[i]))
    const high = Math.max(...all.map((pair) => pair[i]))
    fc.assert(
      fc.property(unit, unit, fc.boolean(), (u, v, rounded) => {
        const f = formants(u, v, rounded)[i]
        assert.ok(f >= low - 1e-6 && f <= high + 1e-6)
      })
    )
  }
})

test('the estimated F3 is flat when rounded and rises with F2 when not', () => {
  assert.equal(formants(0, 0, true)[2], 2200)
  assert.equal(formants(1, 1, false)[2], 2500)
  assert.equal(formants(0, 0, false)[2], 3000)
})

test('scale multiplies every formant', () => {
  const base = formants(0.3, 0.6, false)
  const scaled = formants(0.3, 0.6, false, 1.5)
  scaled.forEach((f, i) => {
    assert.ok(Math.abs(f - base[i] * 1.5) < 1e-9)
  })
})

test('the nearest symbol to a symbol is itself', () => {
  for (const [symbol, u, v, rounded] of VOWELS) assert.equal(nearest(u, v, rounded), symbol)
})

test('nearest only offers symbols with the asked rounding', () => {
  const rounded = new Set(VOWELS.filter((vowel) => vowel[3]).map(([symbol]) => symbol))
  fc.assert(
    fc.property(unit, unit, fc.boolean(), (u, v, r) => {
      assert.equal(rounded.has(nearest(u, v, r)), r)
    })
  )
})

test('chart and screen coordinates round trip', () => {
  fc.assert(
    fc.property(unit, unit, (u, v) => {
      const [u2, v2] = toUV(...toXY(u, v))
      assert.ok(Math.abs(u2 - u) < 1e-9 && Math.abs(v2 - v) < 1e-9)
    })
  )
})

test('a point outside the frame clamps to its edge', () => {
  assert.deepEqual(toUV(-100, -100), [0, 0])
  assert.deepEqual(toUV(9999, 9999), [1, 1])
})

test('the small helpers', () => {
  assert.equal(clamp(-1), 0)
  assert.equal(clamp(2), 1)
  assert.equal(clamp(0.25), 0.25)
  assert.equal(lerp(10, 20, 0.5), 15)
  assert.ok(Math.abs(geo(100, 400, 0.5) - 200) < 1e-9)
})

test('four key rows of nine, plus a key for schwa', () => {
  assert.deepEqual(
    KEY_ROWS.map((row) => row.length),
    [9, 9, 9, 9]
  )
  assert.equal(KEY_POS.size, 37)
  assert.deepEqual(KEY_POS.get('Digit1'), [0, 0])
  assert.deepEqual(KEY_POS.get('Period'), [1, 1])
  assert.deepEqual(KEY_POS.get('Enter'), [0.5, 0.5])
})

test('two keys average to the symbols between rows', () => {
  const mid = (a, b) => [0, 1].map((i) => (KEY_POS.get(a)[i] + KEY_POS.get(b)[i]) / 2)
  assert.equal(nearest(...mid('KeyT', 'KeyG'), false), 'ə')
  assert.equal(nearest(...mid('KeyA', 'KeyZ'), false), 'æ')
  assert.equal(nearest(...mid('KeyG', 'KeyB'), false), 'ɐ')
})

test('the diphthong buttons name real symbols', () => {
  const symbols = new Set(VOWELS.map(([symbol]) => symbol))
  for (const [label, from, to] of GLIDES) {
    assert.ok(symbols.has(from) && symbols.has(to), label)
    assert.equal(label, from + to)
  }
})

test('voices run in pitch order from the bottom of the slider to the top', () => {
  const pitches = Object.values(VOICES).map((voice) => voice.pitch)
  assert.deepEqual(
    pitches,
    [...pitches].sort((a, b) => a - b)
  )
  assert.equal(pitches[0], 70)
  assert.equal(pitches.at(-1), 320)
})

test('every voice with every phonation leaves the glottis some closed time', () => {
  for (const voice of Object.values(VOICES)) {
    for (const fold of Object.values(PHONATIONS)) {
      const open = fold.openQuotient + voice.openQuotient
      assert.ok(open > 0 && open < 1)
    }
  }
})

test('symbols are named as the IPA names them', () => {
  assert.equal(describe('i'), 'close front unrounded')
  assert.equal(describe('ʊ'), 'near-close near-back rounded')
  assert.equal(describe('ɞ'), 'open-mid central rounded')
  assert.equal(describe('ə'), 'mid central')
  assert.equal(describe('ɐ'), 'near-open central')
  assert.equal(describe('aɪ'), '')
  for (const [symbol] of VOWELS) assert.doesNotMatch(describe(symbol), /undefined/)
})
