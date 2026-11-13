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
    if (tok[0] === "+" && tok.length > 1) {
      // "+Pa-" = keep holding the previous note (a tie): no new key press
      const n = parseNoteToken(tok.slice(1));
      if (!n || n.rest) return null;
      n.tie = true;
      return n;
    }
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
      if (it.rest || it.tie) return;
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
        if (!it.rest && !it.tie) words.push(it.lyric ? it.lyric.replace(/-$/, "") + (it.lyric.endsWith("-") ? "-" : " ") : "_ ");
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
    return (it.tie ? "+" : "") + name + durText(it.beats);
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
      melodyNotes(song).forEach((e) => {
        const n = 60 + e.semi + o.keyPc;
        const on = tick(e.start);
        const off = tick(e.start + e.beats) - 10;
        mel.push({ tick: on, order: 2, bytes: [0x90, n, 100] });
        mel.push({ tick: Math.max(on + 1, off), order: 1, bytes: [0x80, n, 0] });
      });
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


  // Melody as sounding notes: tied items ("+Pa") extend the previous note instead of re-striking it.
  function melodyNotes(song) {
    const out = [];
    let last = null;
    song.lines.forEach((ln) => ln.items.forEach((it) => {
      if (it.rest) { last = null; return; }
      if (it.tie && last && last.semi === it.semi && Math.abs(last.start + last.beats - it.start) < 1e-6) {
        last.beats += it.beats;
        last.items.push(it);
        return;
      }
      last = { semi: it.semi, start: it.start, beats: it.beats, items: [it] };
      out.push(last);
    }));
    return out;
  }

  // ---------- MIDI file reader ----------
  function readMidi(buf) {
    const d = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let p = 0;
    const u8 = () => d[p++];
    const u16 = () => (d[p++] << 8) | d[p++];
    const u32r = () => ((d[p++] << 24) >>> 0) + (d[p++] << 16) + (d[p++] << 8) + d[p++];
    const txt = (n) => { let s = ""; for (let i = 0; i < n; i++) s += String.fromCharCode(d[p + i]); p += n; return s; };
    const vlqr = () => { let n = 0, b; do { b = d[p++]; n = (n << 7) | (b & 0x7f); } while (b & 0x80 && p < d.length); return n; };
    if (txt(4) !== "MThd") throw new Error("This doesn't look like a MIDI file (.mid).");
    const hlen = u32r();
    const format = u16(), ntrk = u16(), division = u16();
    p += hlen - 6;
    if (division & 0x8000) throw new Error("This MIDI file uses SMPTE timing, which isn't supported yet.");
    const ppq = division;
    const out = { format, ppq, tempos: [], timeSigs: [], keySigs: [], lyrics: [], tracks: [] };
    for (let t = 0; t < ntrk && p < d.length; t++) {
      const id = txt(4);
      const len = u32r();
      const end = p + len;
      if (id !== "MTrk") { p = end; continue; }
      const tr = { name: "", notes: [], channels: new Set(), program: null };
      const open = new Map();
      let tick = 0, status = 0;
      while (p < end) {
        tick += vlqr();
        let b = d[p];
        if (b & 0x80) { status = b; p++; } else if (!status) { p++; continue; }
        const type = status & 0xf0, ch = status & 0x0f;
        if (status === 0xff) {
          const mt = u8(); const ml = vlqr(); const start = p;
          if (mt === 0x03) tr.name = txt(ml);
          else if (mt === 0x51) out.tempos.push({ tick, us: (d[p] << 16) | (d[p + 1] << 8) | d[p + 2] });
          else if (mt === 0x58) out.timeSigs.push({ tick, num: d[p], den: Math.pow(2, d[p + 1]) });
          else if (mt === 0x59) out.keySigs.push({ tick, sf: (d[p] << 24) >> 24, minor: d[p + 1] === 1 });
          else if (mt === 0x05 || (mt === 0x01 && ml < 40)) {
            const s = txt(ml);
            if (mt === 0x05 || !/^@|^\s*$/.test(s)) out.lyrics.push({ tick, text: s, type: mt });
          }
          p = start + ml;
          status = 0; // running status is cancelled by meta events
          continue;
        }
        if (status === 0xf0 || status === 0xf7) { const l = vlqr(); p += l; status = 0; continue; }
        if (type === 0x80 || type === 0x90) {
          const note = u8(), vel = u8();
          const key = ch * 128 + note;
          if (type === 0x90 && vel > 0) {
            if (open.has(key)) { const o = open.get(key); o.dur = tick - o.start; tr.notes.push(o); }
            open.set(key, { midi: note, start: tick, dur: 0, vel, ch });
            tr.channels.add(ch);
          } else if (open.has(key)) {
            const o = open.get(key); o.dur = tick - o.start; open.delete(key);
            if (o.dur > 0) tr.notes.push(o);
          }
        } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) p += 2;
        else if (type === 0xc0) { const prog = u8(); if (tr.program == null) tr.program = prog; }
        else if (type === 0xd0) p += 1;
        else p++;
      }
      p = end;
      tr.notes.sort((a, b) => a.start - b.start || b.midi - a.midi);
      out.tracks.push(tr);
    }
    // Format 0 / single-track files: split by channel so tune and accompaniment can be told apart
    const expanded = [];
    out.tracks.forEach((tr, i) => {
      if (tr.channels.size > 1) {
        [...tr.channels].sort((a, b) => a - b).forEach((ch) => {
          expanded.push({ name: (tr.name || `Track ${i + 1}`) + ` · channel ${ch + 1}`, notes: tr.notes.filter((n) => n.ch === ch), channels: new Set([ch]) });
        });
      } else expanded.push(tr);
    });
    out.tracks = expanded.filter((t) => t.notes.length).map((t, i) => {
      const drums = t.channels.has(9);
      const avg = t.notes.reduce((a, n) => a + n.midi, 0) / t.notes.length;
      // how often notes overlap (chords) — melodies are mostly one note at a time
      let overlaps = 0;
      for (let k = 1; k < t.notes.length; k++) if (t.notes[k].start < t.notes[k - 1].start + t.notes[k - 1].dur * 0.5) overlaps++;
      return { index: i, name: t.name || `Track ${i + 1}`, notes: t.notes, drums, avgPitch: avg, poly: overlaps / t.notes.length };
    });
    return out;
  }

  // Best guess at which track is the tune: not drums, plenty of notes, mostly one note at a time, higher pitch.
  function guessMelodyTrack(mid) {
    let best = -1, bestScore = -Infinity;
    mid.tracks.forEach((t, i) => {
      if (t.drums || t.notes.length < 6) return;
      const score = t.avgPitch * 1.0 - t.poly * 40 + Math.min(t.notes.length, 200) * 0.05 + (/melod|vocal|voice|lead|tune|sing|right/i.test(t.name) ? 25 : 0) - (/bass|chord|pad|left|accomp|string/i.test(t.name) ? 20 : 0);
      if (score > bestScore) { bestScore = score; best = i; }
    });
    return best;
  }

  const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  function correlate(a, b) {
    const ma = a.reduce((x, y) => x + y, 0) / 12, mb = b.reduce((x, y) => x + y, 0) / 12;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < 12; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return da && db ? num / Math.sqrt(da * db) : 0;
  }
  // Krumhansl–Schmuckler key finding, weighted by note length.
  function detectKey(notes) {
    const h = new Array(12).fill(0);
    notes.forEach((n) => { h[mod12(n.midi)] += n.dur || 1; });
    let best = { pc: 0, minor: false, r: -2 };
    for (let k = 0; k < 12; k++) {
      const rot = h.slice(k).concat(h.slice(0, k));
      const rM = correlate(rot, MAJOR_PROFILE), rm = correlate(rot, MINOR_PROFILE);
      if (rM > best.r) best = { pc: k, minor: false, r: rM };
      if (rm > best.r) best = { pc: k, minor: true, r: rm };
    }
    return best;
  }

  // Chord templates a beginner can play: major, minor, plus dominant 7th.
  const CHORD_CHOICES = [{ q: "", w: 1 }, { q: "m", w: 1 }, { q: "7", w: 0.9 }];
  function pickChord(hist, bassPc, keyPc, minorKey, prev) {
    const total = hist.reduce((a, b) => a + b, 0);
    if (total <= 0) return prev;
    // notes that belong to the key (natural minor uses the relative major's notes, plus the raised 7th)
    const scale = minorKey ? [0, 2, 3, 5, 7, 8, 10, 11] : [0, 2, 4, 5, 7, 9, 11];
    const inKey = new Set(scale.map((x) => mod12(x + keyPc)));
    let best = null, bestScore = -Infinity;
    for (let root = 0; root < 12; root++) {
      for (const c of CHORD_CHOICES) {
        const tones = QUALITIES[c.q].tones.map((x) => mod12(x + root));
        let inW = 0;
        tones.forEach((pc) => { inW += hist[pc]; });
        const outW = total - inW;
        let score = (inW - outW * 0.9) / total;
        if (hist[root] > 0) score += 0.12 * (hist[root] / total) * 3;
        if (bassPc === root) score += 0.18;
        const diatonic = tones.every((pc) => inKey.has(pc));
        if (diatonic) score += 0.15;
        if (c.q === "7") score -= (hist[mod12(root + 10)] / total) < 0.08 ? 0.3 : 0.02;
        if (root === keyPc) score += 0.05;
        if (prev && prev.pc === root && prev.quality === c.q) score += 0.04;
        score *= c.w;
        if (score > bestScore) { bestScore = score; best = { pc: root, quality: c.q }; }
      }
    }
    return best;
  }

  // Turn a read MIDI file into song text this app understands.
  // opts: {title, melodyTrack, chordEvery: 'bar'|'half', barsPerLine, grid}
  function midiToSongText(mid, opts) {
    const o = Object.assign({ title: "Imported song", melodyTrack: guessMelodyTrack(mid), chordEvery: "bar", barsPerLine: 2, grid: 0.25 }, opts || {});
    const mt = mid.tracks[o.melodyTrack];
    if (!mt) throw new Error("I couldn't find a tune in this file.");
    const ppq = mid.ppq;
    const ts = mid.timeSigs[0] || { num: 4, den: 4 };
    const beatsPerBar = (ts.num * 4) / ts.den;
    // Tempo: MIDI files with no tempo mark mean 120 BPM. If the tempo changes, use the one that lasts longest.
    let tempo = 120;
    if (mid.tempos.length) {
      const lastTick = Math.max(...mid.tracks.flatMap((t) => t.notes.map((n) => n.start + n.dur)), 1);
      const tl = mid.tempos.slice().sort((a, b) => a.tick - b.tick);
      const dur = new Map();
      tl.forEach((t, i) => {
        const end = i + 1 < tl.length ? tl[i + 1].tick : lastTick;
        const bpm = Math.round(60000000 / t.us);
        dur.set(bpm, (dur.get(bpm) || 0) + Math.max(0, end - t.tick));
      });
      tempo = [...dur.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
    const g = o.grid;
    const q = (ticks) => Math.round(ticks / ppq / g) * g;

    // 1) Tune: one note at a time (the highest note wins when notes start together)
    const raw = mt.notes.map((n) => ({ midi: n.midi, start: q(n.start), end: q(n.start + n.dur) }));
    const byStart = new Map();
    raw.forEach((n) => { const e = byStart.get(n.start); if (!e || n.midi > e.midi) byStart.set(n.start, n); });
    const mel = [...byStart.values()].sort((a, b) => a.start - b.start);
    for (let i = 0; i < mel.length; i++) {
      const next = mel[i + 1];
      if (next && mel[i].end > next.start) mel[i].end = next.start;
      if (mel[i].end - mel[i].start < g) mel[i].end = mel[i].start + g;
    }
    if (!mel.length) throw new Error("The tune track has no notes.");
    // Start the song at the bar where the tune begins
    const firstBar = Math.floor(mel[0].start / beatsPerBar) * beatsPerBar;
    mel.forEach((n) => { n.start -= firstBar; n.end -= firstBar; });

    // 2) Key: from every pitched note in the file
    const all = [];
    mid.tracks.forEach((t) => { if (!t.drums) t.notes.forEach((n) => all.push({ midi: n.midi, dur: n.dur })); });
    const key = detectKey(all);
    const keyPc = key.pc;
    // Place the tune near the middle octave relative to Sa
    const avg = mel.reduce((a, n) => a + n.midi, 0) / mel.length;
    const saMidi = 60 + keyPc;
    const octShift = Math.round((avg - (saMidi + 5)) / 12) * 12; // keep tune mostly between ,Pa and Pa'
    const semiOf = (m) => m - saMidi - octShift;

    // 3) Chords: from accompaniment tracks if there are any, otherwise from the tune itself
    const accTracks = mid.tracks.filter((t, i) => i !== o.melodyTrack && !t.drums);
    const harmonyNotes = (accTracks.length ? accTracks.flatMap((t) => t.notes) : mt.notes)
      .map((n) => ({ midi: n.midi, start: n.start / ppq - firstBar, end: (n.start + n.dur) / ppq - firstBar }));
    const span = o.chordEvery === "half" ? beatsPerBar / 2 : beatsPerBar;
    const songEnd = Math.ceil(Math.max(...mel.map((n) => n.end)) / beatsPerBar) * beatsPerBar;
    const chordAt = [];
    let prev = null;
    for (let t = 0; t < songEnd; t += span) {
      const hist = new Array(12).fill(0);
      let lowest = 999;
      harmonyNotes.forEach((n) => {
        const ov = Math.min(n.end, t + span) - Math.max(n.start, t);
        if (ov > 0) {
          const w = ov * (n.start >= t - 0.01 && n.start < t + 0.25 ? 1.5 : 1);
          hist[mod12(n.midi)] += w;
          if (n.midi < lowest) lowest = n.midi;
        }
      });
      // the tune counts too, a little
      mel.forEach((n) => { const ov = Math.min(n.end, t + span) - Math.max(n.start, t); if (ov > 0) hist[mod12(n.midi)] += ov * (accTracks.length ? 0.35 : 1); });
      const c = pickChord(hist, lowest < 999 ? mod12(lowest) : null, keyPc, key.minor, prev);
      chordAt.push({ t, chord: c });
      prev = c;
    }
    // drop repeats
    const chordChanges = chordAt.filter((c, i) => c.chord && (i === 0 || !chordAt[i - 1].chord || chordAt[i - 1].chord.pc !== c.chord.pc || chordAt[i - 1].chord.quality !== c.chord.quality));

    // 4) Lyrics embedded in the file (karaoke / lyric events), matched to the nearest tune note
    const lyricByNote = new Map();
    const lyr = mid.lyrics.filter((l) => l.type === 0x05).length ? mid.lyrics.filter((l) => l.type === 0x05) : mid.lyrics;
    lyr.forEach((l) => {
      const tb = l.tick / ppq - firstBar;
      let bestN = null, bd = 1e9;
      mel.forEach((n) => { const dd = Math.abs(n.start - tb); if (dd < bd) { bd = dd; bestN = n; } });
      if (bestN && bd <= 0.75) {
        const clean = l.text.replace(/[\r\n\\\/]+/g, " ").trim();
        if (clean) lyricByNote.set(bestN, (lyricByNote.get(bestN) || "") + clean);
      }
    });

    // 5) Build a timeline of pieces cut at bar lines and chord changes (ties keep long notes sounding)
    const cuts = new Set();
    for (let b = 0; b <= songEnd; b += beatsPerBar) cuts.add(b);
    chordChanges.forEach((c) => cuts.add(c.t));
    const cutList = [...cuts].sort((a, b) => a - b);
    const pieces = [];
    let cursor = 0;
    const pushSpan = (start, end, note) => {
      let s0 = start;
      for (const c of cutList) {
        if (c > s0 + 1e-6 && c < end - 1e-6) { pieces.push({ start: s0, end: c, note, tie: s0 !== start }); s0 = c; }
      }
      pieces.push({ start: s0, end, note, tie: s0 !== start });
    };
    mel.forEach((n) => {
      if (n.start > cursor + 1e-6) pushSpan(cursor, n.start, null);
      pushSpan(n.start, n.end, n);
      cursor = n.end;
    });
    if (cursor < songEnd - 1e-6) pushSpan(cursor, songEnd, null);

    // 6) Write text, a few bars per line
    const fmtBeats = (b) => {
      const table = { 1: "", 2: "-", 3: "--", 4: "---", 0.5: "_", 0.25: "__", 1.5: ".", 0.75: "_." };
      const r = Math.round(b * 1000) / 1000;
      return Object.prototype.hasOwnProperty.call(table, r) ? table[r] : `*${r}`;
    };
    const keyName = SHARP_NAMES[keyPc] === "A#" ? "Bb" : SHARP_NAMES[keyPc] === "D#" ? "Eb" : SHARP_NAMES[keyPc] === "G#" ? "Ab" : SHARP_NAMES[keyPc];
    const lines = [
      `Title: ${o.title}`,
      `By: Imported from a MIDI file — chords worked out automatically`,
      `Key: ${keyName}`,
      `Tempo: ${Math.max(30, Math.min(260, tempo))}`,
      `Time: ${ts.num}/${ts.den}`,
      `# Sa = ${keyName}. The song sounds ${key.minor ? "minor (sad / serious)" : "major (bright / happy)"}.`,
      "",
    ];
    const lineLen = beatsPerBar * o.barsPerLine;
    let ci = 0;
    for (let ls = 0; ls < songEnd; ls += lineLen) {
      const toks = [];
      const words = [];
      let any = false;
      pieces.filter((pc) => pc.start >= ls - 1e-6 && pc.start < ls + lineLen - 1e-6).forEach((pc) => {
        while (ci < chordChanges.length && chordChanges[ci].t <= pc.start + 1e-6) {
          if (Math.abs(chordChanges[ci].t - pc.start) < 1e-6 || chordChanges[ci].t < pc.start) toks.push(`[${SHARP_NAMES[chordChanges[ci].chord.pc].replace("A#", "Bb").replace("D#", "Eb").replace("G#", "Ab")}${chordChanges[ci].chord.quality}]`);
          ci++;
        }
        const dur = fmtBeats(pc.end - pc.start);
        if (!pc.note) { toks.push("~" + dur); }
        else {
          any = true;
          const tok = sargamText(60 + semiOf(pc.note.midi), 0);
          toks.push((pc.tie ? "+" : "") + tok + dur);
          if (!pc.tie) {
            const w = lyricByNote.get(pc.note);
            words.push(w ? w.replace(/\s+/g, "-").replace(/^-|-$/g, "") || "_" : "_");
          }
        }
        if (Math.abs(((pc.end) % beatsPerBar)) < 1e-6 && pc.end < ls + lineLen - 1e-6) toks.push("|");
      });
      if (!toks.length) continue;
      lines.push(toks.join(" "));
      if (any && words.some((w) => w !== "_")) lines.push(words.join(" "));
      lines.push("");
    }
    return { text: lines.join("\n"), key, tempo, beatsPerBar, melodyTrack: o.melodyTrack, notes: mel.length, chords: chordChanges.length, lyrics: lyricByNote.size };
  }

  const Music = {
    KEYS, SARGAM_NAMES, mod12, westernName, sargamOf, sargamText, parseChord, chordWestern,
    chordSargam, chordWords, voiceChord, parseNoteToken, parseSongText, songToText, songToMidi,
    accompaniment, westernWithOctave, isNotesLine, melodyNotes, readMidi, guessMelodyTrack, detectKey, midiToSongText,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Music;
  else root.Music = Music;
})(typeof window !== "undefined" ? window : globalThis);
