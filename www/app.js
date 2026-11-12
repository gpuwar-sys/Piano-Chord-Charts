/* Chord voicings match play_chords_midi.py (bass + right-hand triad). */
const CHORDS = {
  Am: { bass: 57, notes: [60, 64, 67] },
  F: { bass: 53, notes: [65, 69, 72] },
  C: { bass: 48, notes: [60, 64, 67] },
  G: { bass: 55, notes: [67, 71, 74] },
  Dm: { bass: 50, notes: [62, 65, 69] },
  Bb: { bass: 58, notes: [70, 74, 77] },
};

const SONGS = [
  {
    id: "frozen",
    title: "Frozen",
    detail: "Am · F · C · G",
    progression: ["Am", "F", "C", "G"],
    bpm: 72,
  },
  {
    id: "tujhoom",
    title: "Tu Jhoom",
    detail: "Am shape · 65 BPM",
    progression: ["Am", "F", "C", "G"],
    bpm: 65,
  },
  {
    id: "tujhoom-dm",
    title: "Tu Jhoom in Dm",
    detail: "Closer to the recording",
    progression: ["Dm", "Bb", "F", "C"],
    bpm: 65,
  },
  {
    id: "takeabow",
    title: "Take a Bow",
    detail: "Dm · Bb · F · C",
    progression: ["Dm", "Bb", "F", "C"],
    bpm: 70,
  },
  {
    id: "snowman",
    title: "Build a Snowman",
    detail: "C · G · Am · F",
    progression: ["C", "G", "Am", "F"],
    bpm: 100,
  },
];

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const SARGAM = {
  0: "Sa",
  1: "re",
  2: "Re",
  3: "ga",
  4: "Ga",
  5: "Ma",
  6: "ma",
  7: "Pa",
  8: "dha",
  9: "Dha",
  10: "ni",
  11: "Ni",
};
const WHITE = new Set([0, 2, 4, 5, 7, 9, 11]);

const libraryEl = document.getElementById("library");
const progressionEl = document.getElementById("progression");
const pianoEl = document.getElementById("piano");
const symbolEl = document.getElementById("symbol");
const qualityEl = document.getElementById("quality");
const bassEl = document.getElementById("bass");
const rightEl = document.getElementById("right");
const sargamEl = document.getElementById("sargam");
const beatsEl = document.getElementById("beats");
const introEl = document.getElementById("intro");
const stateLabel = document.getElementById("state-label");
const liveEl = document.getElementById("live");
const playBtn = document.getElementById("play");
const iconPlay = document.getElementById("icon-play");
const iconPause = document.getElementById("icon-pause");
const loopBtn = document.getElementById("loop");
const tempoInput = document.getElementById("tempo");
const bpmLabel = document.getElementById("bpm-label");

const state = {
  songId: SONGS[0].id,
  preview: 0,
  chordIndex: 0,
  playing: false,
  loop: true,
  bpm: SONGS[0].bpm,
};

let audio = null;
let master = null;
let timer = null;
let raf = 0;
let nextTime = 0;
let stopAt = null;
let queue = [];
let tempoTimer = 0;
let lastSpoken = "";

function song() {
  return SONGS.find((item) => item.id === state.songId);
}

function spell(midi) {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

function sargam(midi) {
  return SARGAM[((midi % 12) + 12) % 12];
}

function qualityText(name) {
  const minor = name.endsWith("m");
  const root = minor ? name.slice(0, -1) : name;
  return root + (minor ? " minor" : " major");
}

function freq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function chordBeats() {
  return 60 / state.bpm;
}

function chordDuration() {
  return chordBeats() * 4;
}

function ensureAudio() {
  if (!audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audio = new Ctx();
    master = audio.createGain();
    master.gain.value = 0.9;
    master.connect(audio.destination);
  }
  return audio.resume();
}

function cutSound() {
  if (!audio || !master) return;
  const now = audio.currentTime;
  const old = master;
  old.gain.cancelScheduledValues(now);
  old.gain.setValueAtTime(Math.max(old.gain.value, 0.0001), now);
  old.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
  master = audio.createGain();
  master.gain.value = 0.9;
  master.connect(audio.destination);
  setTimeout(() => old.disconnect(), 120);
}

function tone(midi, when, duration, peak) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq(midi), when);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1600, when);
  filter.frequency.exponentialRampToValueAtTime(700, when + duration);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.018);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak * 0.4, 0.0001), when + Math.min(0.22, duration * 0.35));
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

function soundChord(name, when, duration) {
  const chord = CHORDS[name];
  if (!chord) return;
  tone(chord.bass, when, duration, 0.16);
  chord.notes.forEach((midi) => tone(midi, when, duration, 0.075));
}

function audibleIndex() {
  if (!audio || !queue.length) return state.preview;
  const t = audio.currentTime + 0.02;
  let found = null;
  for (let i = 0; i < queue.length; i += 1) {
    const event = queue[i];
    if (t >= event.time && t < event.time + event.dur) found = event.index;
  }
  return found === null ? state.preview : found;
}

function scheduler() {
  if (!state.playing || !audio) return;
  const horizon = audio.currentTime + 0.28;
  while (nextTime < horizon) {
    if (stopAt !== null && nextTime >= stopAt - 0.001) break;
    const current = song();
    const index = state.chordIndex;
    const name = current.progression[index];
    const dur = chordDuration();
    soundChord(name, nextTime, dur * 0.94);
    queue.push({ time: nextTime, index, name, dur });
    nextTime += dur;
    if (index === current.progression.length - 1 && !state.loop) {
      stopAt = nextTime;
      state.chordIndex = 0;
      break;
    }
    state.chordIndex = (index + 1) % current.progression.length;
  }
  if (queue.length > 16) queue = queue.slice(-12);
  if (stopAt !== null && audio.currentTime >= stopAt - 0.03) {
    finish();
    return;
  }
  timer = setTimeout(scheduler, 40);
}

function shownIndex() {
  return state.playing ? audibleIndex() : state.preview;
}

function renderPiano(active) {
  const start = 60;
  const end = 77;
  const whites = [];
  const blacks = [];
  for (let midi = start; midi <= end; midi += 1) {
    if (WHITE.has(midi % 12)) whites.push(midi);
    else blacks.push(midi);
  }
  pianoEl.replaceChildren();
  const row = document.createElement("div");
  row.className = "whites";
  whites.forEach((midi) => {
    const key = document.createElement("div");
    key.className = "white-key" + (active.has(midi) ? " is-on" : "");
    row.appendChild(key);
  });
  pianoEl.appendChild(row);
  const whiteWidth = 100 / whites.length;
  blacks.forEach((midi) => {
    const before = whites.filter((note) => note < midi).length;
    const key = document.createElement("div");
    key.className = "black-key" + (active.has(midi) ? " is-on" : "");
    key.style.width = whiteWidth * 0.58 + "%";
    key.style.left = "calc(" + before * whiteWidth + "% - " + whiteWidth * 0.29 + "%)";
    pianoEl.appendChild(key);
  });
}

function renderProgression(index) {
  const names = song().progression;
  progressionEl.replaceChildren();
  names.forEach((name, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = name;
    button.className = i === index ? "is-on" : "";
    button.setAttribute("aria-pressed", i === index ? "true" : "false");
    button.addEventListener("click", () => jumpTo(i));
    progressionEl.appendChild(button);
  });
}

function renderSongs() {
  libraryEl.querySelectorAll(".song").forEach((button) => {
    const on = button.dataset.id === state.songId;
    button.classList.toggle("is-current", on);
    button.setAttribute("aria-current", on ? "true" : "false");
  });
}

let lastDomKey = "";

function render() {
  const current = song();
  const index = shownIndex();
  const name = current.progression[index];
  const chord = CHORDS[name];
  let beat = -1;
  if (state.playing && audio) {
    const event = queue.find((item) => {
      const t = audio.currentTime;
      return t >= item.time && t < item.time + item.dur && item.index === index;
    });
    if (event) beat = Math.min(3, Math.floor((audio.currentTime - event.time) / chordBeats()));
  }
  const domKey = [current.id, index, beat, state.playing, state.loop, state.bpm].join("|");
  if (domKey === lastDomKey) return;
  const chordChanged = !lastDomKey.startsWith(current.id + "|" + index + "|");
  lastDomKey = domKey;

  symbolEl.textContent = name;
  qualityEl.textContent = qualityText(name);
  bassEl.textContent = spell(chord.bass);
  rightEl.textContent = chord.notes.map(spell).join(" · ");
  sargamEl.textContent = chord.notes.map(sargam).join(" · ");
  introEl.textContent = current.title + " — " + current.detail;
  stateLabel.textContent = state.playing ? "Playing" : "Ready";
  bpmLabel.textContent = state.bpm + " BPM";
  if (document.activeElement !== tempoInput) tempoInput.value = String(state.bpm);
  playBtn.setAttribute("aria-label", state.playing ? "Pause" : "Play");
  playBtn.setAttribute("aria-pressed", state.playing ? "true" : "false");
  iconPlay.hidden = state.playing;
  iconPause.hidden = !state.playing;
  loopBtn.classList.toggle("is-on", state.loop);
  loopBtn.setAttribute("aria-pressed", state.loop ? "true" : "false");

  beatsEl.querySelectorAll(".beat").forEach((dot, i) => {
    dot.classList.toggle("is-on", i <= beat);
  });
  renderPiano(new Set(chord.notes));
  if (chordChanged || progressionEl.childElementCount !== current.progression.length) {
    renderProgression(index);
  } else {
    progressionEl.querySelectorAll("button").forEach((button, i) => {
      button.classList.toggle("is-on", i === index);
      button.setAttribute("aria-pressed", i === index ? "true" : "false");
    });
  }
  renderSongs();

  const spoken = name + ", " + qualityText(name) + ". Left hand " + spell(chord.bass) + ". Right hand " + chord.notes.map(spell).join(" ");
  if (spoken !== lastSpoken) {
    lastSpoken = spoken;
    liveEl.textContent = spoken;
  }
}

function frame() {
  render();
  if (state.playing) raf = requestAnimationFrame(frame);
}

function jumpTo(index) {
  const count = song().progression.length;
  const next = (index + count) % count;
  state.preview = next;
  state.chordIndex = next;
  if (state.playing) {
    cutSound();
    queue = [];
    nextTime = audio.currentTime + 0.05;
    stopAt = null;
  }
  lastDomKey = "";
  render();
}

async function play() {
  await ensureAudio();
  state.playing = true;
  state.chordIndex = state.preview;
  queue = [];
  nextTime = audio.currentTime + 0.05;
  stopAt = null;
  lastDomKey = "";
  clearTimeout(timer);
  cancelAnimationFrame(raf);
  scheduler();
  frame();
}

function pause() {
  state.preview = audibleIndex();
  state.chordIndex = state.preview;
  state.playing = false;
  clearTimeout(timer);
  cancelAnimationFrame(raf);
  cutSound();
  queue = [];
  lastDomKey = "";
  render();
}

function finish() {
  state.playing = false;
  state.preview = 0;
  state.chordIndex = 0;
  clearTimeout(timer);
  cancelAnimationFrame(raf);
  queue = [];
  lastDomKey = "";
  render();
}

function selectSong(id) {
  const next = SONGS.find((item) => item.id === id);
  state.songId = next.id;
  state.bpm = next.bpm;
  state.preview = 0;
  state.chordIndex = 0;
  if (state.playing) {
    cutSound();
    queue = [];
    nextTime = audio.currentTime + 0.05;
    stopAt = null;
  }
  lastDomKey = "";
  render();
  const current = libraryEl.querySelector('[data-id="' + id + '"]');
  if (current) current.scrollIntoView({ inline: "nearest", block: "nearest" });
}

function buildLibrary() {
  SONGS.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "song";
    button.dataset.id = item.id;
    button.innerHTML = "<strong></strong><small></small>";
    button.querySelector("strong").textContent = item.title;
    button.querySelector("small").textContent = item.detail;
    button.addEventListener("click", () => selectSong(item.id));
    libraryEl.appendChild(button);
  });
}

playBtn.addEventListener("click", () => {
  if (state.playing) pause();
  else play();
});

document.getElementById("prev").addEventListener("click", () => jumpTo(shownIndex() - 1));
document.getElementById("next").addEventListener("click", () => jumpTo(shownIndex() + 1));

loopBtn.addEventListener("click", () => {
  state.loop = !state.loop;
  if (state.loop) stopAt = null;
  lastDomKey = "";
  render();
});

tempoInput.addEventListener("input", () => {
  state.bpm = Number(tempoInput.value);
  bpmLabel.textContent = state.bpm + " BPM";
  clearTimeout(tempoTimer);
  tempoTimer = setTimeout(() => {
    if (!state.playing) return;
    const index = audibleIndex();
    state.preview = index;
    state.chordIndex = index;
    cutSound();
    queue = [];
    nextTime = audio.currentTime + 0.05;
    stopAt = null;
  }, 140);
});

document.addEventListener("keydown", (event) => {
  if (event.target.closest("button, input, a, textarea")) return;
  if (event.code === "Space") {
    event.preventDefault();
    if (state.playing) pause();
    else play();
  } else if (event.code === "ArrowRight") {
    event.preventDefault();
    jumpTo(shownIndex() + 1);
  } else if (event.code === "ArrowLeft") {
    event.preventDefault();
    jumpTo(shownIndex() - 1);
  }
});

buildLibrary();
render();
