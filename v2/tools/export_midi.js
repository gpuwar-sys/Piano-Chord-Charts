// Writes one .mid file per built-in song into v2/midi/ (Sa on the song's own key, song's tempo).
// Run from the repo root:  node v2/tools/export_midi.js
const fs = require("fs");
const path = require("path");
const M = require("../music.js");
const { SONGS } = require("../songs.js");
const out = path.join(__dirname, "..", "midi");
fs.mkdirSync(out, { recursive: true });
for (const s of SONGS) {
  const p = M.parseSongText(s.text);
  const file = path.join(out, `${String(SONGS.indexOf(s) + 1).padStart(2, "0")}_${s.id}.mid`);
  fs.writeFileSync(file, Buffer.from(M.songToMidi(p)));
  console.log("wrote", path.relative(process.cwd(), file), `(${p.totalBeats} beats @ ${p.tempo} bpm)`);
}
