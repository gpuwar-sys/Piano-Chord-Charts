# Tu Jhoom – Which file matches the YouTube song?

**YouTube:** [Tu Jhoom – Abida Parveen & Naseebo Lal](https://music.youtube.com/watch?v=bDBi3rLoiV0)

---

## What actually matches the song

The **only** part we can reliably match without hearing the recording is the **“Tu jhoom jhoom” hook** and the **chords** (Am F C G or Dm Bb F C). Verse melodies were guessed and can sound wrong (e.g. like a different tune).

| File | What it is |
|------|------------|
| **Tu_Jhoom_Full_Song_Melody.mid** | **Chords** (slow, ~65 BPM) + **only the “Tu jhoom jhoom” melody** at chorus spots. No verse melody. Run `python play_chords_midi.py` to create/update. |
| **Tu_Jhoom_With_Melody.mid** | Chords + the same hook repeated. |
| **Tu_Jhoom_Full_Melody_Notation.md** | Chorus melody is the real hook. Verse lines are **approximate** – learn those by ear from the YouTube video. |

---

## Other Tu Jhoom files

| File | What it is |
|------|------------|
| Tu_Jhoom_Simple.md | Chords + “Tu jhoom” hook (short). |
| Tu_Jhoom_Complete.md | Chords + section-by-section melody (chorus is real; verses approximate). |
| Tu_Jhoom_Chords.mid | Chords only. |
| Tu_Jhoom_Dm_Chords.mid | Chords in D minor (closer to recording key). |

---

## How to get the MIDI

In the **Music** folder run:

```bash
python play_chords_midi.py
```

Then open **Tu_Jhoom_Full_Song_Melody.mid**. You should hear slow chords plus the “Tu jhoom jhoom” hook every so often – like the song, not a different melody.
