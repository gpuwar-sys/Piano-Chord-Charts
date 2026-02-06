"""
Generate MIDI files for chord progressions from your chord charts.
Run: pip install midiutil   then   python play_chords_midi.py
Then open the .mid files (e.g. in Windows Media Player, VLC) to hear the chords.
"""

try:
    from midiutil.MidiFile import MIDIFile
except ImportError:
    print("Please install midiutil first: pip install midiutil")
    exit(1)

# MIDI note numbers (middle C = 60)
# Bass (left hand): octave 2-3. Chord (right hand): octave 4
def add_chord(mf, track, channel, bass_midi, chord_midis, start_beat, duration_beats=4, volume=90):
    """Add one chord: bass note + 3-note chord."""
    mf.addNote(track, channel, bass_midi, start_beat, duration_beats, volume)
    for midi in chord_midis:
        mf.addNote(track, channel, midi, start_beat, duration_beats, volume)

# Chord definitions (bass, [root, third, fifth] in MIDI)
# Using octave 4 for chord notes (60-72 range)
CHORDS = {
    "Am": (57, [60, 64, 67]),   # A2, C4 E4 G4
    "F":  (53, [65, 69, 72]),   # F2, F4 A4 C5
    "C":  (48, [60, 64, 67]),   # C2, C4 E4 G4
    "G":  (55, [67, 71, 74]),   # G2, G4 B4 D5
    "Dm": (50, [62, 65, 69]),   # D2, D4 F4 A4
    "Bb": (58, [70, 74, 77]),   # Bb2, Bb4 D5 F5
}

def write_progression(filename, chord_names, tempo=75, repeats=4):
    """Write a MIDI file with one chord per 4 beats, repeated."""
    mf = MIDIFile(1)
    track, channel = 0, 0
    mf.addTrackName(track, 0, filename.replace(".mid", ""))
    mf.addTempo(track, 0, tempo)

    for r in range(repeats):
        for i, name in enumerate(chord_names):
            start = (r * len(chord_names) + i) * 4
            bass, notes = CHORDS[name]
            add_chord(mf, track, channel, bass, notes, start, 4, 95)

    with open(filename, "wb") as f:
        mf.writeFile(f)
    print("Created:", filename)

def write_tu_jhoom_with_melody(filename, tempo=70, repeats=4):
    """Write Tu Jhoom with chords + melody line (Tu jhoom jhoom pattern)."""
    mf = MIDIFile(2)  # 2 tracks: chords and melody
    track_chords, track_melody = 0, 1
    channel = 0
    
    mf.addTrackName(track_chords, 0, "Chords")
    mf.addTrackName(track_melody, 0, "Melody - Tu Jhoom")
    mf.addTempo(track_chords, 0, tempo)
    
    # Melody: Pa Pa Pa Pa | Dha Dha Pa | Ma Ma Ga | Re Sa
    # Sa = C, so: Pa = G (67), Dha = A (69), Ma = F (65), Ga = E (64), Re = D (62), Sa = C (60)
    melody_pattern = [
        (67, 1), (67, 1), (67, 1), (67, 1),  # Pa Pa Pa Pa
        (69, 1), (69, 1), (67, 2),           # Dha Dha Pa
        (65, 1), (65, 1), (64, 1),           # Ma Ma Ga
        (62, 1), (60, 2)                      # Re Sa
    ]
    
    # Chords progression: Am F C G (4 beats each)
    chord_progression = ["Am", "F", "C", "G"]
    
    melody_time = 0
    for r in range(repeats):
        # Add chords
        for i, chord_name in enumerate(chord_progression):
            chord_start = (r * len(chord_progression) + i) * 4
            bass, notes = CHORDS[chord_name]
            add_chord(mf, track_chords, channel, bass, notes, chord_start, 4, 80)
        
        # Add melody pattern (one pattern per chord progression cycle = 16 beats)
        for note, duration in melody_pattern:
            mf.addNote(track_melody, channel, note, melody_time, duration, 110)
            melody_time += duration
    
    with open(filename, "wb") as f:
        mf.writeFile(f)
    print("Created:", filename)

# Sa=60, Re=62, Ga=64, Ma=65, Pa=67, Dha=69, Ni=71, Sa'=72

def write_tu_jhoom_chords_and_hook_only(filename, tempo=65, total_bars=32, hook_every_bars=8):
    """
    Tu Jhoom: chords throughout + ONLY the real 'Tu jhoom jhoom' hook at chorus points.
    No fake verse melody (that sounded like a different song). Slow, so it feels like the real track.
    """
    mf = MIDIFile(2)
    track_chords, track_melody = 0, 1
    channel = 0
    mf.addTrackName(track_chords, 0, "Chords")
    mf.addTrackName(track_melody, 0, "Tu jhoom jhoom (hook only)")
    mf.addTempo(track_chords, 0, tempo)

    chord_prog = ["Am", "F", "C", "G"]
    beat_per_chord = 4
    total_beats = total_bars * beat_per_chord
    chord_beat = 0
    while chord_beat < total_beats:
        for name in chord_prog:
            if chord_beat >= total_beats:
                break
            bass, notes = CHORDS[name]
            add_chord(mf, track_chords, channel, bass, notes, chord_beat, beat_per_chord, 82)
            chord_beat += beat_per_chord

    # Real hook only: Pa Pa Pa Pa | Dha Dha Pa | Ma Ma Ga | Re Sa (longer notes = slower, more like the song)
    hook_notes = [(67, 1.5), (67, 1.5), (67, 1.5), (67, 1.5), (69, 1.5), (69, 1.5), (67, 2), (65, 1.5), (65, 1.5), (64, 1.5), (62, 1.5), (60, 2.5)]
    bars_per_cycle = 4
    beats_per_hook = 16
    for start_bar in range(0, total_bars, hook_every_bars):
        t = start_bar * beat_per_chord
        for note, dur in hook_notes:
            mf.addNote(track_melody, channel, note, t, dur, 100)
            t += dur

    with open(filename, "wb") as f:
        mf.writeFile(f)
    print("Created:", filename)

if __name__ == "__main__":
    # Frozen: Am F C G
    write_progression("Frozen_Chords.mid", ["Am", "F", "C", "G"], tempo=72, repeats=4)

    # Tu Jhoom: Am F C G (chords only, ~65 BPM like recording)
    write_progression("Tu_Jhoom_Chords.mid", ["Am", "F", "C", "G"], tempo=65, repeats=8)
    
    # Tu Jhoom with melody (chords + "Tu jhoom jhoom" melody)
    write_tu_jhoom_with_melody("Tu_Jhoom_With_Melody.mid", tempo=65, repeats=4)
    
    # Tu Jhoom in D minor (closer to many recordings)
    write_progression("Tu_Jhoom_Dm_Chords.mid", ["Dm", "Bb", "F", "C"], tempo=65, repeats=8)

    # Tu Jhoom: chords + only the real "Tu jhoom jhoom" hook (no fake verse melody)
    write_tu_jhoom_chords_and_hook_only("Tu_Jhoom_Full_Song_Melody.mid", tempo=65, total_bars=32, hook_every_bars=8)

    # Take a Bow: Dm Bb F C
    write_progression("TakeABow_Chords.mid", ["Dm", "Bb", "F", "C"], tempo=70, repeats=4)

    # Do You Want to Build a Snowman: C G Am F
    write_progression("Snowman_Chords.mid", ["C", "G", "Am", "F"], tempo=100, repeats=4)

    print("\nDone. Open the .mid files in Windows Media Player, VLC, or any music app to hear the chords.")
