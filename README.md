# vowels

A playable IPA vowel chart. Press anywhere on the chart, or on a key, and a small formant synthesizer says the vowel at that spot while a wireframe face mouths along.

## Run

```
npm install
npm start
```

`npm start` serves the page at http://localhost:4173 and opens it in a browser. Pass `-- --no-open` to skip the browser, or set `PORT` to use another port.

It needs Node 22.12 or later and a browser that supports audio worklets.

## Sources

- Formant frequencies for the sixteen cardinal vowels are from J. C. Catford, *A Practical Introduction to Phonetics*, 2nd ed. (2001), p. 154.
- The synthesizer follows Dennis Klatt, "Software for a cascade/parallel formant synthesizer" (1980), with the glottal pulse and flutter from Klatt and Klatt (1990), J. Acoust. Soc. Am. 87(2), 820–857.
- Voice sizes come from the formant averages in Peterson and Barney, "Control methods used in a study of the vowels" (1952).

Some values are estimates with no source behind them. `AGENTS.md` lists which.

## Contributing

See `CONTRIBUTING.md` for conventions and `AGENTS.md` for how the code is laid out.
