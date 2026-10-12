# Agent Guidelines

- install: `npm install`
- run: `npm start`
- test: `npm test`
- coverage: `npm run coverage`

Private and unpublished. Do not alter version.

Follow all coding and commit conventions in `CONTRIBUTING.md`.

Omit AI attribution in commits (Co-authored-by). Polluting git history with AI advertising is not allowed.

## Layout

- `index.html` is the markup and styles. The page is these four files and nothing else, with relative paths, so it can be dropped into a subdirectory of a static site.
- `vowels.js` is the chart as data and arithmetic: symbol positions, formant values, voices, phonations, and the key map. It touches no DOM.
- `synth.js` is the synthesizer, a cascade of formant resonators after Klatt. `VowelSynth` renders in Node as well as in an audio worklet.
- `app.js` wires the page: pointer and key input, the controls, the random shuffle, and the face.
- `server.js` and `start.js` are the local dev server. `start.js` is the entry and is covered by a spawn test only.

## Estimates

These have no source and were set by reasoning, not by ear or measurement:

- F3 for every vowel. Catford gives F1 and F2 only.
- The twelve symbols that are not cardinal vowels, which are positions interpolated between the sixteen that are.
- The `min` and `max` voice scales, every voice's pitch, and each phonation's tilt, breath, and roughness.
- The face, which is a cartoon of the visible articulators.
