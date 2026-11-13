const fs = require("fs"); const M = require("../music.js");
for (const f of process.argv.slice(2)) {
  const mid = M.readMidi(fs.readFileSync(f));
  console.log("\n#####", f, "tracks:", mid.tracks.map(t => `${t.name}(${t.notes.length},avg${t.avgPitch.toFixed(0)},poly${t.poly.toFixed(2)})`).join(" | "));
  const r = M.midiToSongText(mid, { title: f.split("/").pop() });
  console.log(r.text.split("\n").slice(0, 14).join("\n"));
  const p = M.parseSongText(r.text);
  console.log("warnings:", p.warnings.length ? p.warnings.slice(0,3) : "none", "| beats", p.totalBeats, "| key", r.key);
}
