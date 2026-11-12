# Chord Charts V2

A kid-friendly practice app: pick a song, read it in **Indian (Sa Re Ga)**, **American (C D E)** or both,
and hear the real tune with chords on a piano sound.

## Run it
Open `v2/index.html` in a browser, or serve the folder:

```
cd v2
python3 -m http.server 8765
```
then go to http://127.0.0.1:8765/

## What's new vs. V1
- V1 only looped four chords with a plain sine tone, so songs never sounded like the real thing.
  V2 plays the **melody note by note** plus a left-hand/right-hand chord accompaniment, on a piano-style synth.
- **Song search** with 10 built-in songs (all traditional / public domain, so the full tune and words are included).
- **Add any song yourself**: type notes in Sa Re Ga *or* C D E, chords in [brackets], and the words underneath.
  The app makes the chart in both systems, can rewrite your text from one system to the other, and saves it in the browser.
- **Key (where Sa sits)**, speed, count-in, beat click, repeat, tap-a-note to hear it, tap-a-chord to hear it.
- **On-screen keyboard** lights up the tune note (orange) and chord notes (purple).
- **MIDI download** for any song in any key/tempo (works when opened from your computer).

## Files
- `music.js` – notation parser, Sa Re Ga ⇄ C D E conversion, transposing, chord voicing, MIDI writer
- `songs.js` – the built-in song library (and the text format, documented at the top)
- `app.js`, `index.html`, `styles.css` – the app
- `midi/` – pre-made MIDI files of the built-in songs (`node v2/tools/export_midi.js` regenerates them)
- `tools/check.js` – prints every song's notes, words and beat counts (quick accuracy check)
