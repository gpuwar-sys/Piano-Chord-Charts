/* Chord Charts V2 — UI, chart rendering and piano playback */
(function () {
  "use strict";
  const M = window.Music;
  const LIB = window.SongLibrary.SONGS;
  const $ = (id) => document.getElementById(id);

  // ---------- storage (safe) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  // ---------- state ----------
  const prefs = store.get("cc2.prefs", {});
  const state = {
    songs: [],
    current: null,          // { id, mine, text, parsed }
    notation: prefs.notation || "both",
    devanagari: !!prefs.devanagari,
    keyPc: 0,
    tempo: 96,
    melody: prefs.melody !== false,
    chords: prefs.chords !== false,
    click: !!prefs.click,
    countIn: prefs.countIn !== false,
    loop: !!prefs.loop,
    playing: false,
    startBeat: 0,
  };
  const savePrefs = () => store.set("cc2.prefs", {
    notation: state.notation, devanagari: state.devanagari, melody: state.melody, chords: state.chords,
    click: state.click, countIn: state.countIn, loop: state.loop,
  });

  function loadSongs() {
    const mine = store.get("cc2.mySongs", []);
    state.songs = LIB.map((s) => ({ id: s.id, emoji: s.emoji, level: s.level, text: s.text, mine: false }))
      .concat(mine.map((s) => ({ id: s.id, emoji: "📝", level: "My song", text: s.text, mine: true })));
    state.songs.forEach((s) => { s.parsed = M.parseSongText(s.text); });
  }

  // ---------- notation helpers ----------
  const DEVA = { Sa: "सा", Re: "रे", Ga: "ग", Ma: "म", Pa: "प", Dha: "ध", Ni: "नि" };
  function indianHTML(midi) {
    const s = M.sargamOf(midi, state.keyPc);
    const komal = ["re", "ga", "dha", "ni"].includes(s.name);
    const tivra = s.name === "ma";
    let label = s.name;
    if (state.devanagari) {
      const base = s.name.charAt(0).toUpperCase() + s.name.slice(1);
      label = DEVA[base] + (tivra ? "॑" : "");
    }
    const cls = ["sw-note"];
    if (s.octave === 1) cls.push("up"); else if (s.octave >= 2) cls.push("up", "up2");
    if (s.octave === -1) cls.push("down"); else if (s.octave <= -2) cls.push("down", "down2");
    if (komal && state.devanagari) cls.push("komal");
    return `<span class="${cls.join(" ")}">${label}</span>`;
  }
  function americanHTML(midi) {
    const name = M.westernName(midi, state.keyPc);
    return name;
  }
  function chordIndian(chord) {
    const t = M.chordSargam(chord);
    if (!state.devanagari) return t;
    const [root, q] = t.split(" ");
    const base = root.charAt(0).toUpperCase() + root.slice(1);
    return DEVA[base] + (q ? " " + q : "");
  }
  function swaraLabel(midi) {
    const n = M.sargamOf(midi, state.keyPc).name;
    return state.devanagari ? DEVA[cap(n)] + (n === "ma" ? "॑" : "") : n;
  }
  // The three (or four) chord keys a beginner presses, low to high
  function handNotes(v) { return (v.notes.length && v.bass < v.notes[0] - 11 ? v.notes : [v.bass].concat(v.notes)); }
  function chordTones(chord) {
    const v = M.voiceChord(chord, state.keyPc);
    return v;
  }

  // ---------- song list ----------
  function renderCards(filter) {
    const q = (filter || "").trim().toLowerCase();
    const list = state.songs.filter((s) => !q || s.parsed.title.toLowerCase().includes(q) ||
      (s.parsed.artist || "").toLowerCase().includes(q));
    $("cards").innerHTML = list.map((s) => `
      <button type="button" class="card" role="listitem" data-id="${s.id}" aria-current="${state.current && state.current.id === s.id}">
        <span class="em" aria-hidden="true">${s.emoji}</span>
        <span class="t">${esc(s.parsed.title)}</span>
        <span class="l ${s.mine ? "mine" : ""}">${esc(s.level)}</span>
      </button>`).join("");
    const nf = $("notfound");
    if (q && !list.length) {
      nf.hidden = false;
      $("nf-title").textContent = `“${filter.trim()}”`;
    } else nf.hidden = true;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // ---------- open a song ----------
  function openSong(id, keepKey) {
    stop();
    const s = state.songs.find((x) => x.id === id) || state.songs[0];
    state.current = s;
    if (!keepKey) state.keyPc = s.parsed.key;
    state.tempo = s.parsed.tempo;
    state.startBeat = 0;
    store.set("cc2.last", s.id);
    $("song-title").textContent = s.parsed.title;
    $("song-by").textContent = s.parsed.artist || (s.mine ? "Added by you" : "");
    $("key").value = String(state.keyPc);
    $("tempo").value = String(state.tempo);
    $("bpm").textContent = `${state.tempo} BPM`;
    $("edit-copy").textContent = s.mine ? "✎ Edit song" : "✎ Edit a copy";
    renderCards($("search").value);
    renderAll();
  }

  function renderAll() {
    renderChart($("chart"), state.current.parsed, true);
    renderChordList();
    buildKeyboard();
    renderLegend();
    $("chart").className = "chart " + state.notation;
  }

  function renderLegend() {
    const sa = M.westernName(60 + state.keyPc, state.keyPc);
    $("legend").innerHTML = `Sa = ${sa}. A dot above a note means the higher octave, a dot below means the lower one ` +
      `(in typing: Sa' and ,Pa). Small letters re ga dha ni are komal (flat); ma is tivra Ma. ` +
      `The coloured bar under a note shows how long to hold it.`;
  }

  function renderChart(el, song, interactive) {
    const html = [];
    song.lines.forEach((ln, li) => {
      html.push(`<div class="cline" data-line="${li}">`);
      ln.items.forEach((it, ii) => {
        const w = Math.max(46, Math.round(it.beats * 46));
        let chd = "";
        if (it.chord) {
          const am = M.chordWestern(it.chord, state.keyPc);
          const ind = chordIndian(it.chord);
          if (state.notation === "american") chd = `<span class="w">${am}</span>`;
          else if (state.notation === "indian") chd = `<span class="w">${esc(ind)}</span>`;
          else chd = `<span class="w">${am}</span><span class="i">${esc(ind)}</span>`;
        }
        let nt;
        if (it.rest) nt = `<span>–</span>`;
        else {
          const midi = 60 + it.semi + state.keyPc;
          const ind = `<span class="ind">${indianHTML(midi)}</span>`;
          const am = `<span class="am">${americanHTML(midi)}</span>`;
          nt = state.notation === "indian" ? ind : state.notation === "american" ? am : ind + am;
        }
        html.push(`<button type="button" class="cell ${it.rest ? "rest" : ""} ${it.tie ? "tie" : ""} ${it.barAfter ? "bar" : ""}" style="min-width:${w}px"
          data-line="${li}" data-i="${ii}" ${interactive ? "" : 'tabindex="-1"'}
          aria-label="${it.rest ? "rest" : esc((it.lyric || "") + " " + M.sargamText(60 + it.semi + state.keyPc, state.keyPc) + " " + M.westernName(60 + it.semi + state.keyPc, state.keyPc))}">
          <span class="chd">${chd}</span><span class="nt">${nt}</span>
          <span class="hold" style="width:${Math.max(8, Math.round(it.beats * 38))}px"></span>
          <span class="ly">${esc(it.lyric || "")}</span></button>`);
      });
      html.push(`</div>`);
    });
    if (!song.lines.length) html.push(`<p class="muted">No notes yet — type a line of notes on the left.</p>`);
    el.innerHTML = html.join("");
  }

  function renderChordList() {
    const seen = new Map();
    state.current.parsed.chords.forEach((c) => {
      const k = c.chord.pc + "|" + c.chord.quality;
      if (!seen.has(k)) seen.set(k, c.chord);
    });
    $("chord-list").innerHTML = [...seen.values()].map((c, i) => {
      const v = chordTones(c);
      const am = M.chordWestern(c, state.keyPc);
      const ind = chordIndian(c);
      const lh = handNotes(v);
      const handsAm = `Left hand: ${lh.map((n) => M.westernName(n, state.keyPc)).join(" ")}`;
      const handsIn = `Left hand: ${lh.map(swaraLabel).join(" ")}`;
      return `<button type="button" class="chip" data-chord="${i}">
        <div class="cn">${state.notation === "indian" ? esc(ind) : am}</div>
        ${state.notation === "both" ? `<div class="ci">${esc(ind)}</div>` : ""}
        <div class="ct">${state.notation === "indian" ? handsIn : handsAm}</div>
        ${state.notation === "both" ? `<div class="ct">${handsIn}</div>` : ""}
      </button>`;
    }).join("") || `<span class="muted">No chords written for this song.</span>`;
    $("chord-list")._chords = [...seen.values()];
  }

  // ---------- keyboard ----------
  let kbKeys = new Map();
  function buildKeyboard() {
    const song = state.current.parsed;
    let lo = 48, hi = 84;
    song.lines.forEach((ln) => ln.items.forEach((it) => {
      if (it.rest) return;
      const m = 60 + it.semi + state.keyPc;
      lo = Math.min(lo, m); hi = Math.max(hi, m);
    }));
    song.chords.forEach((c) => { const v = chordTones(c.chord); lo = Math.min(lo, v.bass); });
    lo = lo - M.mod12(lo); // start on a C
    hi = hi + (11 - M.mod12(hi)) + 1; // end on a C
    const whites = [];
    for (let m = lo; m <= hi; m++) if (![1, 3, 6, 8, 10].includes(M.mod12(m))) whites.push(m);
    const box = $("keyboard");
    const W = Math.max(22, Math.min(34, Math.floor((box.clientWidth || 1000) / whites.length)));
    const wrap = document.createElement("div");
    wrap.className = "keys";
    wrap.style.width = whites.length * W + "px";
    kbKeys = new Map();
    let wi = 0;
    for (let m = lo; m <= hi; m++) {
      const black = [1, 3, 6, 8, 10].includes(M.mod12(m));
      const k = document.createElement("div");
      k.className = "key " + (black ? "black" : "white") + (M.mod12(m - state.keyPc) === 0 ? " sa" : "");
      if (black) { k.style.left = wi * W - W * 0.32 + "px"; k.style.width = W * 0.64 + "px"; }
      else { k.style.left = wi * W + "px"; k.style.width = W + "px"; wi++; }
      const lab = state.notation === "american" ? M.westernName(m, state.keyPc)
        : state.devanagari ? (DEVA[cap(M.sargamOf(m, state.keyPc).name)] || "") : M.sargamOf(m, state.keyPc).name;
      if (!black || W > 26) k.textContent = black ? "" : lab;
      if (M.mod12(m) === 0 && state.notation !== "indian") k.title = "C" + (Math.floor(m / 12) - 1);
      kbKeys.set(m, k);
      wrap.appendChild(k);
    }
    box.innerHTML = "";
    box.appendChild(wrap);
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function lightKeys(melodyMidi, chordMidis) {
    kbKeys.forEach((k) => k.classList.remove("mel", "chord"));
    (chordMidis || []).forEach((m) => kbKeys.get(m) && kbKeys.get(m).classList.add("chord"));
    if (melodyMidi != null && kbKeys.get(melodyMidi)) {
      const k = kbKeys.get(melodyMidi);
      k.classList.add("mel");
      const box = $("keyboard");
      const left = k.offsetLeft;
      if (left < box.scrollLeft + 40 || left > box.scrollLeft + box.clientWidth - 60) box.scrollLeft = left - box.clientWidth / 2;
    }
  }

  // ---------- audio: a simple piano-like synth ----------
  let ctx = null, master = null, wet = null, wave = null;
  function ensureAudio() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    ctx = new C();
    master = ctx.createGain(); master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    // small room reverb
    const conv = ctx.createConvolver();
    const len = ctx.sampleRate * 1.6;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    conv.buffer = ir;
    wet = ctx.createGain(); wet.gain.value = 0.18;
    wet.connect(conv); conv.connect(comp);
    // piano-ish harmonic recipe
    const real = new Float32Array(10), imag = new Float32Array(10);
    [0, 1, 0.55, 0.32, 0.22, 0.12, 0.09, 0.05, 0.035, 0.02].forEach((a, i) => { imag[i] = a; });
    wave = ctx.createPeriodicWave(real, imag);
  }
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // Each playback run gets its own output "bus" so stopping silences ONLY that run's queued notes.
  let bus = null;
  function newBus() {
    const b = ctx.createGain();
    b.gain.value = 1;
    b.connect(master);
    b.connect(wet);
    b.oscs = [];
    return b;
  }
  function killBus(b) {
    if (!b) return;
    const now = ctx.currentTime;
    b.gain.cancelScheduledValues(now);
    b.gain.setValueAtTime(b.gain.value, now);
    b.gain.linearRampToValueAtTime(0, now + 0.03);
    b.oscs.forEach((o) => { try { o.stop(now + 0.05); } catch (e) { /* already stopped */ } });
    b.oscs = [];
    setTimeout(() => { try { b.disconnect(); } catch (e) { /* ignore */ } }, 200);
  }
  function pianoNote(midi, when, dur, vel, out) {
    const f = hz(midi);
    const g = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.Q.value = 0.6;
    const bright = Math.min(14000, f * 9);
    filt.frequency.setValueAtTime(bright, when);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f * 2.2, 400), when + 0.6);
    const decay = midi < 52 ? 2.6 : midi < 64 ? 1.8 : midi < 76 ? 1.2 : 0.8;
    const peak = vel * (midi < 48 ? 0.5 : 0.36);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.006);
    g.gain.exponentialRampToValueAtTime(peak * 0.35, when + 0.18);
    g.gain.exponentialRampToValueAtTime(peak * 0.04, when + 0.18 + decay);
    const end = when + Math.max(0.08, dur);
    g.gain.cancelScheduledValues(end);
    g.gain.setTargetAtTime(0.0001, end, 0.06);
    const o1 = ctx.createOscillator(); o1.setPeriodicWave(wave); o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.setPeriodicWave(wave); o2.frequency.value = f; o2.detune.value = 4;
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    o1.connect(filt); o2.connect(g2); g2.connect(filt);
    filt.connect(g);
    if (out) { g.connect(out); out.oscs.push(o1, o2); }
    else { g.connect(master); g.connect(wet); }
    o1.start(when); o2.start(when);
    o1.stop(end + 0.5); o2.stop(end + 0.5);
  }
  function clickSound(when, accent, out) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = accent ? 1500 : 1000;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.2, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    o.connect(g); g.connect(out || master);
    if (out) out.oscs.push(o);
    o.start(when); o.stop(when + 0.06);
  }

  // ---------- transport ----------
  let schedTimer = 0, raf = 0, events = [], evIdx = 0, t0 = 0, playFrom = 0, countBeats = 0;
  const spb = () => 60 / state.tempo;

  function buildEvents(fromBeat) {
    const song = state.current.parsed;
    const ev = [];
    if (state.melody) M.melodyNotes(song).forEach((it) => {
      if (it.start + it.beats <= fromBeat + 1e-6) return;
      const st = Math.max(it.start, fromBeat);
      ev.push({ beat: st, dur: it.start + it.beats - st, midi: 60 + it.semi + state.keyPc, vel: 1, type: "mel" });
    });
    if (state.chords) M.accompaniment(song, state.keyPc).forEach((e) => {
      if (e.start + e.beats <= fromBeat + 1e-6) return;
      const st = Math.max(e.start, fromBeat);
      ev.push({ beat: st, dur: e.start + e.beats - st, midi: e.midi, vel: e.vel / 127 * 0.9, type: "chd" });
    });
    if (state.click) {
      const bar = song.beatsPerBar;
      for (let b = Math.ceil(fromBeat); b < song.totalBeats; b++) ev.push({ beat: b, type: "click", accent: b % bar === 0 });
    }
    ev.sort((a, b) => a.beat - b.beat);
    return ev;
  }

  function play(fromBeat) {
    ensureAudio();
    if (state.playing) stop(true);
    clearInterval(schedTimer);
    cancelAnimationFrame(raf);
    bus = newBus();
    const song = state.current.parsed;
    if (!song.totalBeats) { toast("This song has no notes yet."); return; }
    playFrom = Math.min(fromBeat || 0, song.totalBeats - 0.01);
    events = buildEvents(playFrom);
    evIdx = 0;
    countBeats = state.countIn ? Math.round(song.beatsPerBar) : 0;
    t0 = ctx.currentTime + 0.12 + countBeats * spb();
    for (let i = 0; i < countBeats; i++) clickSound(ctx.currentTime + 0.12 + i * spb(), i === 0, bus);
    state.playing = true;
    setPlayUI(true);
    if (countBeats) $("status").textContent = "Get ready… " + Array.from({ length: countBeats }, (_, i) => i + 1).join(" ");
    schedule();
    schedTimer = setInterval(schedule, 30);
    raf = requestAnimationFrame(tick);
  }
  function schedule() {
    const horizon = ctx.currentTime + 0.25;
    while (evIdx < events.length) {
      const e = events[evIdx];
      const when = t0 + (e.beat - playFrom) * spb();
      if (when > horizon) break;
      if (e.type === "click") clickSound(when, e.accent, bus);
      else pianoNote(e.midi, Math.max(when, ctx.currentTime), e.dur * spb() * (e.type === "mel" ? 0.95 : 0.98), e.vel, bus);
      evIdx++;
    }
  }
  function currentBeat() { return playFrom + (ctx.currentTime - t0) / spb(); }
  let lastCell = null;
  function tick() {
    if (!state.playing) return;
    const song = state.current.parsed;
    const b = currentBeat();
    if (b >= song.totalBeats) {
      if (state.loop) { stop(true); play(0); return; }
      stop(); state.startBeat = 0; $("status").textContent = "Finished! Press Play to hear it again."; return;
    }
    if (b >= playFrom) {
      // find the active melody item
      let found = null;
      for (const ln of song.lines) for (const it of ln.items) if (b >= it.start && b < it.start + it.beats) { found = it; break; }
      const chord = song.chords.find((c) => b >= c.start && b < c.end);
      const cell = found ? $("chart").querySelector(`.cell[data-line="${found.line}"][data-i="${song.lines[found.line].items.indexOf(found)}"]`) : null;
      if (cell !== lastCell) {
        if (lastCell) lastCell.classList.remove("active");
        $("chart").querySelectorAll(".cline.now").forEach((n) => n.classList.remove("now"));
        if (cell) {
          cell.classList.add("active");
          cell.parentElement.classList.add("now");
          const r = cell.getBoundingClientRect();
          if (r.top < 80 || r.bottom > window.innerHeight - 160) cell.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        lastCell = cell;
        const melMidi = found && !found.rest && state.melody ? 60 + found.semi + state.keyPc : null;
        const ch = chord && state.chords ? [chordTones(chord.chord).bass, ...chordTones(chord.chord).notes] : [];
        lightKeys(melMidi, ch);
        if (found) $("status").textContent = found.lyric ? `♪ ${found.lyric}` : "♪";
      }
    }
    raf = requestAnimationFrame(tick);
  }
  function stop(silent) {
    if (!state.playing) return;
    state.playing = false;
    clearInterval(schedTimer);
    cancelAnimationFrame(raf);
    killBus(bus);
    bus = null;
    if (lastCell) lastCell.classList.remove("active");
    lastCell = null;
    lightKeys(null, []);
    setPlayUI(false);
    if (!silent) $("status").textContent = "Stopped. Tap a note to start from there, or press Play.";
  }
  function setPlayUI(on) {
    $("play").classList.toggle("is-playing", on);
    $("i-play").hidden = on; $("i-stop").hidden = !on;
    $("play-label").textContent = on ? "Stop" : "Play";
    $("play").setAttribute("aria-label", on ? "Stop" : "Play");
  }

  // ---------- MIDI download ----------
  function downloadMidi() {
    const s = state.current.parsed;
    const bytes = M.songToMidi(s, { keyPc: state.keyPc, tempo: state.tempo, melody: true, chords: true });
    const name = s.title.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "") + `_Sa-${M.westernName(60 + state.keyPc, state.keyPc).replace("#", "sharp")}_${state.tempo}bpm.mid`;
    try {
      const url = URL.createObjectURL(new Blob([bytes], { type: "audio/midi" }));
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(`Saving ${name} — if nothing downloads, open the app from your computer (downloads are blocked inside the Claude preview).`);
    } catch (e) {
      toast("Downloads are blocked here. Open index.html from your computer to save MIDI files.");
    }
  }

  // ---------- editor ----------
  let editingId = null;
  const TEMPLATE = `Title: My new song
Key: C
Tempo: 90
Time: 4/4

[Sa] Sa Re Ga Ma | [Pa] Pa- Pa-
Here are my first words

[Ma] Dha Dha [Pa] Pa- | [Sa] Ma Ga Re Sa-
and here is line num-ber two
`;
  function openEditor(text, id) {
    editingId = id || null;
    midiData = null;
    $("import-opts").hidden = true;
    $("import-info").hidden = true;
    $("midi-name").textContent = "The app reads the file on your computer — nothing is uploaded anywhere.";
    $("ed-text").value = text || TEMPLATE;
    $("ed-delete").hidden = !editingId;
    $("ed-h").textContent = editingId ? "Edit your song" : "Add a song";
    $("editor").hidden = false;
    updatePreview();
    $("ed-text").focus();
  }
  function closeEditor() { $("editor").hidden = true; }
  function updatePreview() {
    const p = M.parseSongText($("ed-text").value);
    renderChart($("ed-preview"), p, false);
    $("ed-preview").className = "chart mini " + state.notation;
    $("ed-warn").innerHTML = p.warnings.map((w) => `<li>${esc(w)}</li>`).join("");
  }
  function saveEditor() {
    const text = $("ed-text").value;
    const p = M.parseSongText(text);
    if (!p.lines.length) { toast("Add at least one line of notes first."); return; }
    const mine = store.get("cc2.mySongs", []);
    let id = editingId;
    if (id) { const s = mine.find((x) => x.id === id); if (s) { s.text = text; s.updated = Date.now(); } }
    else { id = "my-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); mine.push({ id, text, updated: Date.now() }); }
    store.set("cc2.mySongs", mine);
    if (window.SongSync) window.SongSync.changed();
    loadSongs();
    closeEditor();
    $("search").value = "";
    openSong(id);
    toast(p.warnings.length ? `Saved, with ${p.warnings.length} thing(s) to check.` : "Saved! Your song is in the list.");
  }
  function deleteSong() {
    if (!editingId) return;
    const btn = $("ed-delete");
    if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Tap again to delete"; setTimeout(() => { btn.dataset.confirm = ""; btn.textContent = "Delete song"; }, 3000); return; }
    store.set("cc2.mySongs", store.get("cc2.mySongs", []).filter((s) => s.id !== editingId));
    if (window.SongSync) window.SongSync.deleted(editingId);
    loadSongs(); closeEditor(); openSong(state.songs[0].id); toast("Song deleted.");
  }
  function rewrite(system) {
    const p = M.parseSongText($("ed-text").value);
    $("ed-text").value = M.songToText(p, system);
    updatePreview();
  }


  // ---------- MIDI import ----------
  let midiData = null, midiTitle = "";
  function midiTitleFrom(name) {
    return name.replace(/\.(mid|midi|kar)$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim() || "Imported song";
  }
  async function onMidiFile(file) {
    if (!file) return;
    $("midi-name").textContent = file.name;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      midiData = M.readMidi(buf);
      midiTitle = midiTitleFrom(file.name);
      const guess = M.guessMelodyTrack(midiData);
      if (guess < 0) throw new Error("I couldn't find a tune in this file (it may be drums only).");
      $("midi-track").innerHTML = midiData.tracks.map((t, i) =>
        `<option value="${i}" ${t.drums ? "disabled" : ""}>${esc(t.name)} — ${t.notes.length} notes${t.drums ? " (drums)" : ""}${i === guess ? " ★ best guess" : ""}</option>`).join("");
      $("midi-track").value = String(guess);
      $("import-opts").hidden = false;
      buildFromMidi();
    } catch (e) {
      midiData = null;
      $("import-opts").hidden = true;
      $("import-info").hidden = false;
      $("import-info").textContent = "Couldn't read that file: " + e.message;
    }
  }
  function buildFromMidi() {
    if (!midiData) return;
    try {
      const r = M.midiToSongText(midiData, {
        title: midiTitle,
        melodyTrack: parseInt($("midi-track").value, 10),
        chordEvery: $("midi-chords").value,
        barsPerLine: parseInt($("midi-bars").value, 10),
      });
      $("ed-text").value = r.text;
      const keyName = M.westernName(60 + r.key.pc, r.key.pc);
      $("import-info").hidden = false;
      $("import-info").textContent = `Found ${r.notes} tune notes and ${r.chords} chord changes. Sa = ${keyName} (${r.key.minor ? "minor" : "major"} key), ${r.tempo} BPM.` +
        (r.lyrics ? ` Words found in the file: ${r.lyrics}.` : " No words in the file — you can type them under each line.") +
        " Press Play after saving; if the tune sounds wrong, try another track in “Tune is in”.";
      updatePreview();
    } catch (e) {
      $("import-info").hidden = false;
      $("import-info").textContent = e.message;
    }
  }


  // ---------- backup / restore of the user's own songs ----------
  function saveBackup() {
    const mine = store.get("cc2.mySongs", []);
    if (!mine.length) { toast("You haven't added any songs yet."); return; }
    const data = { app: "chord-charts-v2", version: 1, saved: new Date().toISOString(), songs: mine };
    const d = new Date();
    const name = `my-chord-songs-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.json`;
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(`Saved ${mine.length} song(s) as ${name}. Put this file on your other device (Google Drive, email…) and press “Load songs from a file” there.`);
    } catch (e) {
      toast("Couldn't save a file here. Open the app from https://gpuwar-sys.github.io/Piano-Chord-Charts/ and try again.");
    }
  }
  async function loadBackup(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : data.songs;
      if (!Array.isArray(incoming)) throw new Error("bad file");
      const mine = store.get("cc2.mySongs", []);
      const texts = new Set(mine.map((x) => x.text));
      const ids = new Set(mine.map((x) => x.id));
      let added = 0, skipped = 0;
      incoming.forEach((x) => {
        if (!x || typeof x.text !== "string" || !x.text.trim()) return;
        if (texts.has(x.text)) { skipped++; return; }
        let id = typeof x.id === "string" && x.id ? x.id : "my-" + Math.random().toString(36).slice(2, 9);
        while (ids.has(id)) id = "my-" + Math.random().toString(36).slice(2, 9);
        mine.push({ id, text: x.text, updated: Date.now() });
        ids.add(id); texts.add(x.text); added++;
      });
      store.set("cc2.mySongs", mine);
      if (added && window.SongSync) window.SongSync.changed();
      loadSongs();
      renderCards($("search").value);
      toast(added ? `Loaded ${added} song(s)${skipped ? ` (${skipped} you already had)` : ""}. They're in the song list now.` : "Those songs are already here — nothing new to load.");
    } catch (e) {
      toast("That file isn't a Chord Charts song backup (it should end in .json).");
    }
  }

  let toastTimer = 0;
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4200);
  }

  // ---------- wire up ----------
  function setPressed(btn, on) { btn.setAttribute("aria-pressed", String(on)); }
  function init() {
    loadSongs();
    $("key").innerHTML = M.KEYS.map((k) => `<option value="${k.pc}">${k.label}</option>`).join("");
    document.querySelectorAll("#notation button").forEach((b) => setPressed(b, b.dataset.v === state.notation));
    $("devanagari").checked = state.devanagari;
    setPressed($("t-melody"), state.melody); setPressed($("t-chords"), state.chords);
    setPressed($("t-click"), state.click); setPressed($("t-countin"), state.countIn); setPressed($("t-loop"), state.loop);

    $("search").addEventListener("input", (e) => renderCards(e.target.value));
    $("search").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { const first = $("cards").querySelector(".card"); if (first) first.click(); else $("nf-add").click(); }
    });
    $("cards").addEventListener("click", (e) => {
      const c = e.target.closest(".card"); if (!c) return;
      openSong(c.dataset.id);
      $("player").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("nf-add").addEventListener("click", () => openEditor(TEMPLATE.replace("My new song", $("search").value.trim() || "My new song")));
    $("open-editor").addEventListener("click", () => openEditor());
    $("backup-save").addEventListener("click", saveBackup);
    $("backup-load").addEventListener("change", (e) => { loadBackup(e.target.files[0]); e.target.value = ""; });
    const startImport = () => { openEditor(" "); $("ed-text").value = ""; updatePreview(); $("midi-file").click(); };
    $("open-import").addEventListener("click", startImport);
    $("nf-import").addEventListener("click", startImport);
    $("midi-file").addEventListener("change", (e) => { onMidiFile(e.target.files[0]); e.target.value = ""; });
    ["midi-track", "midi-chords", "midi-bars"].forEach((id) => $(id).addEventListener("change", buildFromMidi));

    $("notation").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      state.notation = b.dataset.v;
      document.querySelectorAll("#notation button").forEach((x) => setPressed(x, x === b));
      savePrefs(); renderAll();
    });
    $("devanagari").addEventListener("change", (e) => { state.devanagari = e.target.checked; savePrefs(); renderAll(); });
    $("key").addEventListener("change", (e) => {
      const was = state.playing; const b = was ? currentBeat() : 0; stop(true);
      state.keyPc = parseInt(e.target.value, 10); renderAll(); if (was) play(Math.max(0, b));
    });
    $("tempo").addEventListener("input", (e) => { state.tempo = parseInt(e.target.value, 10); $("bpm").textContent = `${state.tempo} BPM`; });
    $("tempo").addEventListener("change", () => {
      if (state.playing) { const b = currentBeat(); stop(true); play(Math.max(0, b)); }
    });
    $("tempo-reset").addEventListener("click", () => {
      state.tempo = state.current.parsed.tempo; $("tempo").value = state.tempo; $("bpm").textContent = `${state.tempo} BPM`;
      if (state.playing) { const b = currentBeat(); stop(true); play(Math.max(0, b)); }
    });
    const toggle = (id, key) => $(id).addEventListener("click", () => {
      state[key] = !state[key]; setPressed($(id), state[key]); savePrefs();
      if (state.playing && key !== "countIn" && key !== "loop") { const b = currentBeat(); stop(true); play(Math.max(0, b)); }
    });
    toggle("t-melody", "melody"); toggle("t-chords", "chords"); toggle("t-click", "click"); toggle("t-countin", "countIn"); toggle("t-loop", "loop");

    $("play").addEventListener("click", () => { if (state.playing) stop(); else play(state.startBeat); });
    $("restart").addEventListener("click", () => { stop(true); state.startBeat = 0; play(0); });
    $("chart").addEventListener("click", (e) => {
      const c = e.target.closest(".cell"); if (!c) return;
      const it = state.current.parsed.lines[+c.dataset.line].items[+c.dataset.i];
      state.startBeat = it.start;
      ensureAudio();
      if (state.playing) { stop(true); play(it.start); return; }
      $("chart").querySelectorAll(".cell.active").forEach((n) => n.classList.remove("active"));
      c.classList.add("active");
      if (!it.rest) {
        const m = 60 + it.semi + state.keyPc;
        pianoNote(m, ctx.currentTime + 0.01, Math.min(1.2, it.beats * spb()), 1);
        lightKeys(m, []);
        $("status").textContent = `${M.sargamText(m, state.keyPc)} = ${M.westernName(m, state.keyPc)}${it.lyric ? ` · “${it.lyric}”` : ""}. Press Play to start from here.`;
      }
    });
    $("chord-list").addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      ensureAudio();
      const c = $("chord-list")._chords[+b.dataset.chord];
      const v = chordTones(c);
      const now = ctx.currentTime + 0.01;
      pianoNote(v.bass, now, 1.4, 0.8);
      v.notes.forEach((n, i) => pianoNote(n, now + i * 0.03, 1.4, 0.7));
      lightKeys(null, [v.bass, ...v.notes]);
      document.querySelectorAll(".chip.on").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      const lh = handNotes(v);
      $("status").textContent = `${M.chordWords(c, state.keyPc)} (${chordIndian(c)}) — press ${lh.map((n) => M.westernName(n, state.keyPc)).join(" + ")} with your left hand (${lh.map(swaraLabel).join(" + ")}). Your right hand plays the tune.`;
    });
    $("midi").addEventListener("click", downloadMidi);
    $("edit-copy").addEventListener("click", () => {
      const s = state.current;
      if (s.mine) openEditor(s.text, s.id);
      else openEditor(s.text.replace(/^Title:\s*(.*)$/m, "Title: $1 (my version)"));
    });

    $("ed-text").addEventListener("input", () => { clearTimeout(updatePreview._t); updatePreview._t = setTimeout(updatePreview, 200); });
    $("ed-save").addEventListener("click", saveEditor);
    $("ed-close").addEventListener("click", closeEditor);
    $("ed-delete").addEventListener("click", deleteSong);
    $("ed-to-indian").addEventListener("click", () => rewrite("sargam"));
    $("ed-to-american").addEventListener("click", () => rewrite("western"));
    $("ed-copy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText($("ed-text").value); toast("Copied!"); }
      catch (e) { $("ed-text").select(); toast("Press Ctrl+C (or ⌘C) to copy."); }
    });
    $("editor").addEventListener("click", (e) => { if (e.target === $("editor")) closeEditor(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("editor").hidden) closeEditor();
      if (e.key === " " && document.activeElement === document.body) { e.preventDefault(); $("play").click(); }
    });
    window.addEventListener("resize", () => { clearTimeout(init._r); init._r = setTimeout(buildKeyboard, 200); });

    const last = store.get("cc2.last", null);
    openSong(state.songs.some((s) => s.id === last) ? last : state.songs[0].id);
  }
  window.ChordApp = {
    refresh() {
      const cur = state.current && state.current.id;
      loadSongs();
      renderCards($("search").value);
      if (cur && !state.songs.some((x) => x.id === cur)) openSong(state.songs[0].id);
      else if (cur && !state.playing) {
        const s = state.songs.find((x) => x.id === cur);
        if (s && s.text !== state.current.text) openSong(cur, true);
      }
    },
  };
  init();
})();
