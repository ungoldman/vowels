# Agent Guidelines

- install: `npm install`
- run: `npm start`
- test: `npm test`
- coverage: `npm run coverage`
- format: `npm run format`
- copy to site: `npm run site`

Needs Node 22.12 or later and a browser with audio worklets. `npm start` serves http://localhost:4173 and opens it. `-- --no-open` skips the browser and `PORT` changes the port.

Private repo, not yet published. `npm run site` copies the four page files from `src/` into `../ungoldman.github.io/vowels/`. Do not alter version.

## Conventions

- Atomic commits in conventional style, `<topic>: <action>`, 50 characters at most. A body only when needed, wrapped at 72.
- No AI attribution in commits, such as Co-authored-by.
- Breaking changes are discouraged and need a `BREAKING CHANGE:` footer.
- Plain JavaScript modules with no build step, so any static host can serve the page.
- A number from a paper names the paper in a comment beside it. A guess says it is one.
- Few comments, kept trim.
- Coverage stays at 100% on `src/vowels.js`, `src/synth.js`, and `src/server.js`. `app.js` is page wiring and is checked in a browser.

## Layout

Source is in `src/`, tests in `test/`.

- `index.html`: markup, styles, and the Credits popup. The page is these four files with relative paths, so it drops into a subdirectory of a static site.
- `vowels.js`: the chart as data and arithmetic. Symbol positions, formants, voices, phonations, the key map, the songs, and the harmony under them. No DOM.
- `synth.js`: the synthesizer, a cascade of formant resonators after Klatt. `VowelSynth` renders in Node as well as in an audio worklet.
- `app.js`: page wiring. Pointer, key, and wheel input, the controls, the random shuffle, the song player, the choir, and the faces.
- `server.js`, `start.js`: the local dev server. `start.js` is the entry and has a spawn test only.

## Keys

Matched by physical position, `event.code`.

- Four rows from `1` to `.` are the chart, close at the top, each running front to back. `0` is schwa. Two or more held keys slide to the point between them.
- Arrows move the dot. The wheel over the chart bends pitch.
- `\` voice, `P` phonation, `/` random. Shift steps the first two back and makes random shuffle every setting.
- `-` `=` pitch, `[` `]` tilt, `;` `'` breath, `` ` `` rounded.
- Backspace toggles Hold. Shift with Backspace silences everything.
- Space, Enter, and Esc are left to the browser. Esc also lets go of a focused control.
- A focused slider or menu keeps the arrows, Home, End, Page Up, and Page Down. Every other key still plays.

## Songs

`SONGS` in `src/vowels.js`, in play order. The player sings them in turn with a gap between.

- A tune is `note/beats/vowel` tokens, a bar to a line, with `-` for a rest. A repeated pitch on a new vowel is one breath with the vowel sliding.
- `chords` is either `chord/beats` tokens, from which `harmony` writes a bass and a middle part, or those two parts given note by note.
- `short` cuts every note off early, for staccato.
- Every note must sit on the pitch slider, 70 to 320 Hz, and under its vowel's F1. The test enforces both, and lists each song's beats in play order.
- Only public domain tunes. Take the notes from a score or a setting, not from a game's arrangement, and say which in the comment above the song.
- The Credits popup in `src/index.html` names every song and its source, in play order. Keep it in step with `SONGS`.
- The page's voice sings the tune. The choir is two more synths, a bass and a middle voice, each with a small head that shows only while a song is loaded. Paused, they harmonise with whatever is played by hand.
- Loudness varies several times over between vowels. Open ones such as [ɑ] overdrive the output, so the generated middle part keeps to [ə] and [e].

## Sources

- Formants for the sixteen cardinal vowels: J. C. Catford, *A Practical Introduction to Phonetics*, 2nd ed. (2001), p. 154.
- Synthesizer: Dennis Klatt, "Software for a cascade/parallel formant synthesizer" (1980). Glottal pulse and flutter: Klatt and Klatt (1990), J. Acoust. Soc. Am. 87(2), 820–857.
- Voice sizes: Peterson and Barney, "Control methods used in a study of the vowels" (1952).
- Song scores and settings: the comment above each song, and the Credits popup.

## Estimates

No source. Set by reasoning, not by ear or measurement:

- F3 for every vowel. Catford gives F1 and F2 only.
- The four formants above F6 and their bandwidths. Klatt stops at F6.
- The slow drift in pitch, and the scoop in pitch as a note starts.
- The twelve symbols that are not cardinal vowels, which are interpolated between the sixteen that are.
- The `min` and `max` voice scales, every voice's pitch, and each phonation's tilt, breath, and roughness.
- The faces, which are a cartoon of the visible articulators.
- Song tempos, the chords where a source gave none, and the rules `harmony` follows.
