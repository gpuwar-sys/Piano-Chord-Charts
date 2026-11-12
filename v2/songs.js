/*
 * Built-in song library (Chord Charts V2).
 * Every song here is traditional or public domain (melody AND words), so the full
 * tune and lyrics can live in the app. Chords are simple beginner arrangements.
 *
 * Format (same as the "Add a song" box in the app):
 *   Header lines: Title / By / Key / Tempo / Time
 *   Then a NOTES line, followed by a WORDS line. Blank line between phrases.
 *   Notes can be Indian (Sa Re Ga Ma Pa Dha Ni) or American (C D E F G A B).
 *   Sa' or C' = higher octave.  ,Pa / Pa, or G, = lower octave.
 *   Length: Sa = 1 beat, Sa- = 2, Sa-- = 3, Sa_ = half, Sa__ = quarter, Sa. = 1½, Sa*5 = 5 beats.
 *   Chords go in [brackets] just before the note where they start: [C] [Am] [G7] or [Pa] [Dham].
 *   In the words line, hyphens split syllables (Twin-kle). "_" holds the last word over one more note.
 */
(function (root) {
  "use strict";

  const SONGS = [
    {
      id: "twinkle",
      emoji: "⭐",
      level: "Easy",
      text: `Title: Twinkle, Twinkle, Little Star
By: Traditional (French melody, 1761; words Jane Taylor, 1806)
Key: C
Tempo: 96
Time: 4/4

[Sa] Sa Sa Pa Pa | [Ma] Dha Dha [Sa] Pa- | [Ma] Ma Ma [Sa] Ga Ga | [Pa] Re Re [Sa] Sa-
Twin-kle, twin-kle, lit-tle star, how I won-der what you are!

[Sa] Pa Pa [Ma] Ma Ma | [Sa] Ga Ga [Pa] Re- | [Sa] Pa Pa [Ma] Ma Ma | [Sa] Ga Ga [Pa] Re-
Up a-bove the world so high, like a dia-mond in the sky.

[Sa] Sa Sa Pa Pa | [Ma] Dha Dha [Sa] Pa- | [Ma] Ma Ma [Sa] Ga Ga | [Pa] Re Re [Sa] Sa-
Twin-kle, twin-kle, lit-tle star, how I won-der what you are!
`,
    },
    {
      id: "birthday",
      emoji: "🎂",
      level: "Easy",
      text: `Title: Happy Birthday to You
By: Traditional (Hill sisters melody, 1893 — public domain)
Key: C
Tempo: 100
Time: 3/4

G_. G__ | [C] A G C' | [G] B-
Hap-py birth-day to you,

G_. G__ | [G] A G D' | [C] C'-
Hap-py birth-day to you,

G_. G__ | [C] G' E' C' | [F] B A
Hap-py birth-day dear bud-dy,

F'_. F'__ | [C] E' C' [G] D' | [C] C'--
Hap-py birth-day to you!
`,
    },
    {
      id: "mary",
      emoji: "🐑",
      level: "Easy",
      text: `Title: Mary Had a Little Lamb
By: Traditional (words Sarah Josepha Hale, 1830)
Key: C
Tempo: 108
Time: 4/4

[C] E D C D | E E E- | [G] D D D- | [C] E G G-
Ma-ry had a lit-tle lamb, lit-tle lamb, lit-tle lamb,

[C] E D C D | E E E E | [G] D D E D | [C] C---
Ma-ry had a lit-tle lamb, its fleece was white as snow.
`,
    },
    {
      id: "row",
      emoji: "🚣",
      level: "Easy",
      text: `Title: Row, Row, Row Your Boat
By: Traditional (1852)
Key: C
Tempo: 100
Time: 6/8

[C] C. C. | C D_ E.
Row, row, row your boat,

E D_ E F_ | G*3
gent-ly down the stream.

C'_ C'_ C'_ G_ G_ G_ | E_ E_ E_ C_ C_ C_
Mer-ri-ly, mer-ri-ly, mer-ri-ly, mer-ri-ly,

[G] G F_ E D_ | [C] C*3
life is but a dream.
`,
    },
    {
      id: "sleeping",
      emoji: "🔔",
      level: "Easy",
      text: `Title: Are You Sleeping? (Frère Jacques)
By: Traditional (France, 1700s)
Key: C
Tempo: 100
Time: 4/4

[C] C D E C | C D E C
Are you sleep-ing, are you sleep-ing,

E F G- | E F G-
Broth-er John, Broth-er John?

G_ A_ G_ F_ E C | G_ A_ G_ F_ E C
Morn-ing bells are ring-ing, morn-ing bells are ring-ing,

C [G] G, [C] C- | C [G] G, [C] C-
Ding, dang, dong. Ding, dang, dong.
`,
    },
    {
      id: "london",
      emoji: "🌉",
      level: "Easy",
      text: `Title: London Bridge Is Falling Down
By: Traditional (England)
Key: C
Tempo: 108
Time: 4/4

[C] G. A_ G F | E F G- | [G] D E F- | [C] E F G-
Lon-don Bridge is fall-ing down, fall-ing down, fall-ing down,

[C] G. A_ G F | E F G- | [G] D- G- | [C] E C--
Lon-don Bridge is fall-ing down, my fair la-dy.
`,
    },
    {
      id: "jingle",
      emoji: "🛷",
      level: "Medium",
      text: `Title: Jingle Bells (chorus)
By: James Lord Pierpont, 1857
Key: C
Tempo: 116
Time: 4/4

[C] E E E- | E E E- | E G C. D_ | E---
Jin-gle bells, jin-gle bells, jin-gle all the way!

[F] F F F. F_ | [C] F E E E_ E_ | [D7] E D D E | [G7] D- G-
Oh what fun it is to ride in a one-horse o-pen sleigh, hey!

[C] E E E- | E E E- | E G C. D_ | E---
Jin-gle bells, jin-gle bells, jin-gle all the way!

[F] F F F F | [C] F E E E_ E_ | [G7] G G F D | [C] C---
Oh what fun it is to ride in a one-horse o-pen sleigh!
`,
    },
    {
      id: "yankee",
      emoji: "🪶",
      level: "Medium",
      text: `Title: Yankee Doodle
By: Traditional (America, 1700s)
Key: C
Tempo: 116
Time: 4/4

[C] C C D E | C E [G] D G, | [C] C C D E | C- [G] B,-
Yan-kee Doo-dle went to town a-rid-ing on a po-ny,

[C] C C D E | [F] F E D C | [G] B, G, A, B, | [C] C- C-
stuck a feath-er in his cap and called it mac-a-ro-ni.
`,
    },
    {
      id: "ode",
      emoji: "🎻",
      level: "Medium",
      text: `Title: Ode to Joy (Joyful, Joyful)
By: Ludwig van Beethoven, 1824 (words Henry van Dyke, 1907)
Key: C
Tempo: 100
Time: 4/4

[C] E E F G | [G] G F E D | [C] C C D E | [G] E. D_ D-
Joy-ful, joy-ful, we a-dore Thee, God of glo-ry, Lord of love;

[C] E E F G | [G] G F E D | [C] C C D E | [G] D. C_ [C] C-
hearts un-fold like flow'rs be-fore Thee, op'-ning to the sun a-bove.

[G] D D E C | D E_ F_ [C] E C | [G] D E_ F_ E D | [C] C [G] D G,-
Melt the clouds of sin and _ sad-ness; drive the _ dark of doubt a-way;

[C] E E F G | [G] G F E D | [C] C C D E | [G] D. C_ [C] C-
Giv-er of im-mor-tal glad-ness, fill us with the light of day!
`,
    },
    {
      id: "grace",
      emoji: "🕊️",
      level: "Medium",
      text: `Title: Amazing Grace
By: John Newton, 1779 (tune "New Britain", 1835)
Key: C
Tempo: 84
Time: 3/4

G, | [C] C- E_ C_ | E- D | [F] C- A, | [C] G,-
A-maz-ing _ grace, how sweet the sound

G, | [C] C- E_ C_ | E- D | [G] G*5
that saved a _ wretch like me!

E | [C] G- E_ C_ | E- D | [F] C- A, | [C] G,-
I once was _ lost, but now am found,

G, | [C] C- E_ C_ | [G] E- D | [C] C--
was blind, but _ now I see.
`,
    },
  ];

  const api = { SONGS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SongLibrary = api;
})(typeof window !== "undefined" ? window : globalThis);
