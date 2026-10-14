# Agent Guidelines

- install: `npm install`
- run: `npm start` (port 4173. `PORT` changes it. `-- --no-open` skips browser.)
- test: `npm test`, `npm run coverage`
- format: `npm run format`
- copy to site: `npm run site` (into `../ungoldman.github.io/vowels/`)

Node 22.12+. Browser with audio worklets. Do not alter version.

## Conventions

- Atomic conventional commits, `<topic>: <action>`, 50 chars max. Body only when needed. Wrap at 72.
- No AI attribution in commits.
- Breaking changes discouraged. They need `BREAKING CHANGE:` footer.
- Plain JS modules. No build. Relative paths, so page drops into any static site.
- Number from paper names it in comment. Guess says so.
- Few comments, kept trim.
- 100% coverage on `src/vowels.js`, `src/synth.js`, `src/server.js`. `src/app.js` is checked in browser.

## Layout

- `src/index.html`: markup, styles, Credits popup.
- `src/vowels.js`: chart data and arithmetic. Voices, phonations, key map, songs, harmony. No DOM.
- `src/synth.js`: Klatt-style cascade synth. `VowelSynth` runs in Node and in audio worklet.
- `src/app.js`: input, controls, song player, choir, faces. Keys match `event.code`. Focused slider or menu keeps its navigation keys. All others still play.
- `src/server.js`, `src/start.js`: dev server.

## Songs

`SONGS` in `src/vowels.js`, in play order.

- Tune: `note/beats/vowel` tokens, one bar per line. `-` is rest. Same pitch on new vowel slides in one breath.
- `chords`: `chord/beats` tokens that `harmony` turns into bass and middle parts. Or both parts note by note. `short`: staccato.
- Notes stay within 70 to 320 Hz and under their vowel's F1. Tests enforce both.
- Public domain only. Arrangements carry their own copyright, so take notes from public domain score or openly licensed setting, never recording or game soundtrack.
- Cite source above song and in Credits popup. Keep popup in play order.
- Open vowels overdrive output, so middle part keeps to [ə] and [e].
