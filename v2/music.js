/*
 * Chord Charts V2 — music engine
 * Parses song text written in Indian (Sa Re Ga) or American (C D E) notation,
 * converts between the two, transposes, voices chords and writes MIDI files.
 * Works in the browser (window.Music) and in Node (module.exports).
 */
(function (root) {
  "use strict";

  // ---------- Note names ----------
  const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  // Keys that are normally written with flats
  const FLAT_KEYS = new Set([5, 10, 3, 8, 1]); // F, Bb, Eb, Ab, Db

  // Sargam: uppercase = shuddha (natural), lowercase = komal (flat), "ma" = tivra Ma (sharp)
  const SARGAM_NAMES = ["Sa", "re", "Re", "ga", "Ga", "Ma", "ma", "Pa", "dha", "Dha", "ni", "Ni"];
  const SARGAM_INPUT = {
    Sa: 0, sa: 0, SA: 0,
    re: 1, Re: 2, RE: 2,
    ga: 3, Ga: 4, GA: 4,
    Ma: 5, MA: 5, ma: 6, "Ma#": 6, "MA#": 6,
    Pa: 7, pa: 7, PA: 7,
    dha: 8, Dha: 9, DHA: 9, Dh: 9, dh: 8,
    ni: 10, Ni: 11, NI: 11,
  };
  const WESTERN_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  const KEYS = [
    { pc: 0, label: "C" }, { pc: 1, label: "C# / Db" }, { pc: 2, label: "D" },
    { pc: 3, label: "Eb" }, { pc: 4, label: "E" }, { pc: 5, label: "F" },
    { pc: 6, label: "F# / Gb" }, { pc: 7, label: "G" }, { pc: 8, label: "Ab" },
    { pc: 9, label: "A" }, { pc: 10, label: "Bb" }, { pc: 11, label: "B" },
  ];

  const mod12 = (n) => ((n % 12) + 12) % 12;

  function westernName(midi, keyPc) {
    const names = FLAT_KEYS.has(mod12(keyPc)) ? FLAT_NAMES : SHARP_NAMES;
    return names[mod12(midi)];
  }

  // Octave relative to the middle octave (Sa = keyPc in octave 4).
  function sargamOf(midi, keyPc) {
    const saMidi = 60 + mod12(keyPc);
    const rel = midi - saMidi;
    return { name: SARGAM_NAMES[mod12(rel)], octave: Math.floor(rel / 12) };
  }

  function sargamText(midi, keyPc) {
    const s = sargamOf(midi, keyPc);
    if (s.octave > 0) return s.name + "'".repeat(s.octave);
    if (s.octave < 0) return ",".repeat(-s.octave) + s.name;
    return s.name;
  }

  // ---------- Chords ----------
  const QUALITIES = {
    "": { tones: [0, 4, 7], word: "major", short: "" },
    m: { tones: [0, 3, 7], word: "minor", short: "m" },
    "7": { tones: [0, 4, 7, 10], word: "seven", short: "7" },
    m7: { tones: [0, 3, 7, 10], word: "minor seven", short: "m7" },
    maj7: { tones: [0, 4, 7, 11], word: "major seven", short: "maj7" },
    dim: { tones: [0, 3, 6], word: "diminished", short: "dim" },
    aug: { tones: [0, 4, 8], word: "augmented", short: "aug" },
    sus2: { tones: [0, 2, 7], word: "sus2", short: "sus2" },
    sus4: { tones: [0, 5, 7], word: "sus4", short: "sus4" },
  };

  // Chord text: [C] [Am] [G7] [Bbmaj7] [F#m] or sargam roots: [Pa] [Dham] [Re7] [Dha m]
  function parseChord(text) {
    const t = text.replace(/\s+/g, "");
    let m = /^([A-G])([#b]?)(maj7|m7|min|dim|aug|sus2|sus4|m|7)?$/.exec(t);
    if (m) {
      let pc = WESTERN_PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
      let q = m[3] || "";
      if (q === "min") q = "m";
      return { pc: mod12(pc), quality: q };
    }
    m = /^(Sa|sa|Re|re|Ga|ga|Ma#|Ma|ma|Pa|pa|Dha|dha|Ni|ni)(maj7|m7|min|dim|aug|sus2|sus4|m|7)?$/.exec(t);
    if (m) {
      let q = m[2] || "";
      if (q === "min") q = "m";
      return { pc: SARGAM_INPUT[m[1]], quality: q, sargamRoot: true };
    }
    return null;
  }

  function chordWestern(chord, keyPc) {
    return westernName(chord.pc + keyPc, keyPc) + QUALITIES[chord.quality].short;
  }
  function chordSargam(chord) {
    const q = QUALITIES[chord.quality].short;
    return SARGAM_NAMES[mod12(chord.pc)] + (q ? " " + q : "");
  }
  function chordWords(chord, keyPc) {
    return westernName(chord.pc + keyPc, keyPc) + " " + QUALITIES[chord.quality].word;
  }

  // Voicing in the song's written key (Sa = C); add keyPc to transpose.
  function voiceChord(chord, keyPc) {
    const pcs = QUALITIES[chord.quality].tones.map((i) => mod12(chord.pc + i + keyPc));
    // Right-hand-ish chord between F3 (53) and E4 (64)
    const notes = pcs.map((pc) => { let n = 53 + mod12(pc - 53); return n; }).sort((a, b) => a - b);
    // Bass: root between C2 (36) and B2 (47) ... nudged up to E2-D#3 for warmth
    const rootPc = mod12(chord.pc + keyPc);
    const bass = 40 + mod12(rootPc - 40);
    return { bass, notes };
  }

  // ---------- Note tokens ----------
  // Melody notes are stored as semitones from Sa/C in the middle octave (0 = Sa = C4 in key of C).
  // Octave marks: Sa' (higher), ,Sa or Sa, (lower). Western: C' higher, G, lower.
  // Duration: default 1 beat. Each "-" adds a beat. "_" halves (Sa_ = 1/2, Sa__ = 1/4).
  //           "." makes it dotted (x1.5): Sa. = 1.5, Sa_. = 3/4. "*N" sets beats exactly: Sa*3.
  // Rest: "~" (with the same duration marks), bars: "|"
  const TOKEN_RE = /^(,*)([A-G][#b]?|Ma#|MA#|[A-Za-z]{1,3})(['’,]*)([-_.]*)(?:\*(\d*\.?\d+))?$/;

  function parseDuration(marks, explicit) {
    if (explicit) return parseFloat(explicit);
    let base = 1;
    let extra = 0;
    let dotted = false;
    for (const ch of marks) {
      if (ch === "_") base /= 2;
      else if (ch === "-") extra += 1;
      else if (ch === ".") dotted = true;
    }
    let d = base + extra;
    if (dotted) d *= 1.5;
    return d;
  }

  function parseNoteToken(tok) {
    if (tok[0] === "~") {
      const mm = /^~([-_.]*)(?:\*(\d*\.?\d+))?$/.exec(tok);
      if (!mm) return null;
      return { rest: true, beats: parseDuration(mm[1], mm[2]) };
    }
    const m = TOKEN_RE.exec(tok);
    if (!m) return null;
    const [, pre, name, octMarks, durMarks, explicit] = m;
    let pc;
    let system;
    if (/^[A-G][#b]?$/.test(name)) {
      pc = WESTERN_PC[name[0]] + (name[1] === "#" ? 1 : name[1] === "b" ? -1 : 0);
      system = "western";
    } else if (Object.prototype.hasOwnProperty.call(SARGAM_INPUT, name)) {
      pc = SARGAM_INPUT[name];
      system = "sargam";
    } else return null;
    let octave = 0;
    for (const ch of octMarks) octave += ch === "," ? -1 : 1;
    octave -= pre.length;
    return { rest: false, semi: pc + 12 * octave, beats: parseDuration(durMarks, explicit), system };
  }

  function isNotesLine(line) {
    const toks = tokenizeNotes(line);
    if (!toks.length) return false;
    let good = 0;
    let notes = 0;
    for (const t of toks) {
      if (t === "|" || /^\[.*\]$/.test(t)) { good++; continue; }
      if (parseNoteToken(t)) { good++; notes++; }
    }
    return notes > 0 && good / toks.length >= 0.75;
  }

  function tokenizeNotes(line) {
    // keep [Chord names] together even with a space inside, e.g. [Dha m]
    const out = [];
    const re = /\[[^\]]*\]|\S+/g;
    let m;
    while ((m = re.exec(line))) {
      const t = m[0];
      // allow chord glued to note: [C]Sa
      const glued = /^(\[[^\]]*\])(.+)$/.exec(t);
      if (glued) { out.push(glued[1], glued[2]); } else out.push(t);
    }
    return out;
  }

  // Lyrics: syllables separated by spaces or hyphens. "_" = hold the previous syllable over this note.
  function splitLyrics(line) {
    const out = [];
    for (const word of line.trim().split(/\s+/)) {
      if (!word) continue;
      if (word === "_") { out.push(""); continue; }
      const parts = word.split("-");
      parts.forEach((p, i) => out.push(i < parts.length - 1 ? p + "-" : p));
    }
    return out.filter((s, i, arr) => s !== "-" || arr.length === 1);
  }

  // ---------- Song text ----------
  // Header lines "Title:", "Key:", "Tempo:", "Time:", "Artist:", "Note:" then pairs of
  // (notes line, optional lyrics line). Blank lines separate sections. Lines starting with # are comments.
  function parseSongText(text) {
    const song = { title: "Untitled song", key: 0, tempo: 90, beatsPerBar: 4, lines: [], warnings: [] };
    const raw = text.replace(/\r/g, "").split("\n");
    let pendingNotes = null;
    const flush = () => { if (pendingNotes) { song.lines.push(pendingNotes); pendingNotes = null; } };

    raw.forEach((rawLine, idx) => {
      const line = rawLine.trim();
      const lineNo = idx + 1;
      if (!line) { flush(); return; }
      if (line.startsWith("#")) return;
      const header = /^(title|key|tempo|bpm|time|artist|by|note|source)\s*:\s*(.*)$/i.exec(line);
      if (header) {
        const k = header[1].toLowerCase();
        const v = header[2].trim();
        if (k === "title") song.title = v || song.title;
        else if (k === "key") {
          const c = parseChord(v.replace(/\s*\(.*\)/, "").replace(/major|maj$/i, "").trim());
          if (c && !c.sargamRoot) song.key = c.pc; else song.warnings.push(`Line ${lineNo}: I don't know the key "${v}". Using C.`);
        } else if (k === "tempo" || k === "bpm") {
          const n = parseInt(v, 10);
          if (n >= 30 && n <= 260) song.tempo = n;
        } else if (k === "time") {
          const t = /^(\d+)\s*\/\s*(\d+)/.exec(v);
          if (t) { song.beatsPerBar = (parseInt(t[1], 10) * 4) / parseInt(t[2], 10); song.timeText = `${t[1]}/${t[2]}`; }
        } else if (k === "artist" || k === "by") song.artist = v;
        else song.note = v;
        return;
      }
      const lyricOnly = /^(>|lyrics?:)\s*/i.exec(line);
      if (!lyricOnly && isNotesLine(line)) {
        flush();
        pendingNotes = parseNotesLine(line, lineNo, song.warnings);
        return;
      }
      const lyricText = lyricOnly ? line.slice(lyricOnly[0].length) : line;
      if (pendingNotes) {
        attachLyrics(pendingNotes, lyricText);
        flush();
      } else {
        song.warnings.push(`Line ${lineNo}: words with no notes above them — "${line.slice(0, 40)}"`);
      }
    });
    flush();
    // Build timeline
    let t = 0;
    let currentChord = null;
    song.events = [];
    song.chords = [];
    song.lines.forEach((ln, li) => {
      ln.items.forEach((it) => {
        it.start = t;
        it.line = li;
        if (it.chord) {
          if (currentChord) currentChord.end = t;
          currentChord = { chord: it.chord, start: t, end: null };
          song.chords.push(currentChord);
        }
        t += it.beats;
      });
    });
    if (currentChord) currentChord.end = t;
    song.totalBeats = t;
    return song;
  }

  function parseNotesLine(line, lineNo, warnings) {
    const items = [];
    let pendingChord = null;
    for (const tok of tokenizeNotes(line)) {
      if (tok === "|") { if (items.length) items[items.length - 1].barAfter = true; continue; }
      if (/^\[.*\]$/.test(tok)) {
        const c = parseChord(tok.slice(1, -1));
        if (c) pendingChord = c; else warnings.push(`Line ${lineNo}: unknown chord ${tok}`);
        continue;
      }
      const n = parseNoteToken(tok);
      if (!n) { warnings.push(`Line ${lineNo}: I can't read "${tok}"`); continue; }
      n.chord = pendingChord;
      pendingChord = null;
      n.lyric = "";
      items.push(n);
    }
    if (pendingChord && items.length) {
      // chord at end of line with no note: attach as a held rest of 0? attach to last item instead
      warnings.push(`Line ${lineNo}: a chord at the end of the line has no note after it`);
    }
    return { items };
  }

  function attachLyrics(ln, text) {
    const syl = splitLyrics(text);
    let i = 0;
    ln.items.forEach((it) => {
      if (it.rest) return;
      if (i < syl.length) it.lyric = syl[i++];
    });
    if (i < syl.length) ln.items.length && (ln.items[ln.items.length - 1].lyric += " " + syl.slice(i).join(" "));
  }

  // Convert a parsed song back into text in a chosen notation (for "edit a copy").
  function songToText(song, system) {
    const keyPc = 0; // written in Sa = C
    const lines = [];
    lines.push(`Title: ${song.title}`);
    if (song.artist) lines.push(`By: ${song.artist}`);
    lines.push(`Key: ${KEYS[song.key].label.split(" ")[0]}`);
    lines.push(`Tempo: ${song.tempo}`);
    lines.push(`Time: ${song.timeText || song.beatsPerBar + "/4"}`);
    lines.push("");
    song.lines.forEach((ln) => {
      const notes = [];
      const words = [];
      ln.items.forEach((it) => {
        if (it.chord) notes.push(`[${system === "sargam" ? chordSargam(it.chord).replace(" ", "") : chordWestern(it.chord, keyPc)}]`);
        notes.push(tokenText(it, system));
        if (!it.rest) words.push(it.lyric ? it.lyric.replace(/-$/, "") + (it.lyric.endsWith("-") ? "-" : " ") : "_ ");
        if (it.barAfter) notes.push("|");
      });
      lines.push(notes.join(" "));
      const w = words.join("").replace(/-\s*/g, "-").replace(/(\s*_)+\s*$/, "").trim();
      if (w.replace(/[_\s]/g, "")) lines.push(w);
      lines.push("");
    });
    return lines.join("\n").trim() + "\n";
  }

  function durText(beats) {
    const table = { 1: "", 2: "-", 3: "--", 4: "---", 5: "----", 6: "-----", 0.5: "_", 0.25: "__", 1.5: ".", 0.75: "_." };
    return Object.prototype.hasOwnProperty.call(table, beats) ? table[beats] : `*${beats}`;
  }

  function tokenText(it, system) {
    if (it.rest) return "~" + durText(it.beats);
    const midi = 60 + it.semi;
    const name = system === "sargam" ? sargamText(midi, 0) : westernWithOctave(midi);
    return name + durText(it.beats);
  }

  function westernWithOctave(midi) {
    const oct = Math.floor((midi - 60) / 12);
    const n = SHARP_NAMES[mod12(midi)];
    return oct > 0 ? n + "'".repeat(oct) : oct < 0 ? n + ",".repeat(-oct) : n;
  }

  // ---------- MIDI file writer (Standard MIDI File, format 1) ----------
  function vlq(n) {
    const bytes = [n & 0x7f];
    while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
    return bytes;
  }
  function str(s) { return Array.from(s).map((c) => c.charCodeAt(0) & 0x7f); }
  function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }

  function trackChunk(events) {
    // events: [{tick, bytes}]
    events.sort((a, b) => a.tick - b.tick || a.order - b.order);
    let last = 0;
    const data = [];
    for (const e of events) {
      data.push(...vlq(e.tick - last), ...e.bytes);
      last = e.tick;
    }
    data.push(0, 0xff, 0x2f, 0x00);
    return [...str("MTrk"), ...u32(data.length), ...data];
  }

  // options: {keyPc, tempo, melody: bool, chords: bool}
  function songToMidi(song, options) {
    const o = Object.assign({ keyPc: song.key, tempo: song.tempo, melody: true, chords: true }, options || {});
    const PPQ = 480;
    const tick = (beats) => Math.round(beats * PPQ);
    const tempoUs = Math.round(60000000 / o.tempo);
    const num = song.beatsPerBar === 3 ? 3 : song.beatsPerBar;
    const meta = [
      { tick: 0, order: 0, bytes: [0xff, 0x03, ...vlq(song.title.length), ...str(song.title)] },
      { tick: 0, order: 0, bytes: [0xff, 0x51, 0x03, (tempoUs >> 16) & 255, (tempoUs >> 8) & 255, tempoUs & 255] },
      { tick: 0, order: 0, bytes: [0xff, 0x58, 0x04, Math.round(num), 2, 24, 8] },
    ];
    const tracks = [trackChunk(meta)];

    const mel = [{ tick: 0, order: 0, bytes: [0xff, 0x03, 6, ...str("Melody")] }, { tick: 0, order: 0, bytes: [0xc0, 0] }];
    if (o.melody) {
      song.lines.forEach((ln) => ln.items.forEach((it) => {
        if (it.rest) return;
        const n = 60 + it.semi + o.keyPc;
        const on = tick(it.start);
        const off = tick(it.start + it.beats) - 10;
        mel.push({ tick: on, order: 2, bytes: [0x90, n, 100] });
        mel.push({ tick: Math.max(on + 1, off), order: 1, bytes: [0x80, n, 0] });
      }));
    }
    tracks.push(trackChunk(mel));

    const ch = [{ tick: 0, order: 0, bytes: [0xff, 0x03, 6, ...str("Chords")] }, { tick: 0, order: 0, bytes: [0xc1, 0] }];
    if (o.chords) {
      accompaniment(song, o.keyPc).forEach((e) => {
        const on = tick(e.start);
        const off = tick(e.start + e.beats) - 10;
        ch.push({ tick: on, order: 2, bytes: [0x91, e.midi, e.vel] });
        ch.push({ tick: Math.max(on + 1, off), order: 1, bytes: [0x81, e.midi, 0] });
      });
    }
    tracks.push(trackChunk(ch));

    const header = [...str("MThd"), ...u32(6), 0, 1, 0, tracks.length, (PPQ >> 8) & 255, PPQ & 255];
    const bytes = header.concat(...tracks);
    return new Uint8Array(bytes);
  }

  // Left hand pattern: bass on the chord change and on each bar's first beat,
  // chord on the off-beats (like a simple "oom-pah" keyboard style).
  function accompaniment(song, keyPc) {
    const out = [];
    const bar = song.beatsPerBar || 4;
    song.chords.forEach((c) => {
      const v = voiceChord(c.chord, keyPc);
      // split chord span into bar-aligned pieces
      let t = c.start;
      while (t < c.end - 1e-6) {
        const nextBar = (Math.floor(t / bar + 1e-6) + 1) * bar;
        const segEnd = Math.min(c.end, nextBar);
        const len = segEnd - t;
        out.push({ midi: v.bass, start: t, beats: len, vel: 78 });
        v.notes.forEach((n) => out.push({ midi: n, start: t, beats: len, vel: 58 }));
        t = segEnd;
      }
    });
    return out;
  }

  const Music = {
    KEYS, SARGAM_NAMES, mod12, westernName, sargamOf, sargamText, parseChord, chordWestern,
    chordSargam, chordWords, voiceChord, parseNoteToken, parseSongText, songToText, songToMidi,
    accompaniment, westernWithOctave, isNotesLine,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Music;
  else root.Music = Music;
})(typeof window !== "undefined" ? window : globalThis);
