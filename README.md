# Piano chord charts & scripts

Personal use – chord charts and simple tools for learning songs on keyboard. Sandbox web app Demo - http://127.0.0.1:8765/ 
v2 app - https://gpuwar-sys.github.io/Piano-Chord-Charts/

## What’s in here

- **Chord charts (markdown):** Frozen, Take a Bow, Tu Jhoom, Indian songs (Sa Re Ga Ma Pa).
- **Tu Jhoom:** Indian notation only (no C/D/E), full melody notation, and “which file to use” guide.
- **play_chords_midi.py:** Generates `.mid` files for chord progressions (needs `pip install midiutil`).
- **Play_Chords.html:** Open in a browser to hear chord progressions (no install).
- **requirements_chords.txt:** `midiutil` for the Python script.

## Quick start

1. **Hear chords in browser:** Open `Play_Chords.html`.
2. **Generate MIDI files:**  
   `pip install -r requirements_chords.txt`  
   `python play_chords_midi.py`  
   Then open the created `.mid` files in any media player.

## Songs

- Frozen (Let It Go, etc.) – Am F C G  
- Take a Bow – Dm Bb F C  
- Tu Jhoom – Am F C G or Dm Bb F C (Indian notation guide included)

For personal learning only; not for distribution.
