const M = require("../music.js");
const { SONGS } = require("../songs.js");
for (const s of SONGS) {
  const p = M.parseSongText(s.text);
  const bars = p.totalBeats / p.beatsPerBar;
  console.log(`\n== ${p.title} | key ${p.key} tempo ${p.tempo} beats ${p.totalBeats} bars ${bars} warnings: ${p.warnings.join("; ")||"none"}`);
  p.lines.forEach((ln) => {
    const sy = ln.items.filter(i=>!i.rest).map(i => `${M.westernWithOctave(60+i.semi)}/${M.sargamText(60+i.semi,0)}:${i.lyric||"·"}`).join(" ");
    const lineBeats = ln.items.reduce((a,i)=>a+i.beats,0);
    console.log(`  [${lineBeats}] ${sy}`);
  });
  console.log("  chords:", p.chords.map(c=>`${M.chordWestern(c.chord,0)}@${c.start}`).join(" "));
}
