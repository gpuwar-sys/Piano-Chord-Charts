# Chord Charts V3

Everything in V2 (song list, Sa Re Ga + C D E charts, piano playback, MIDI import, backup files) **plus sync**:
sign in with Google and the songs you add or import appear on every device — phone, tablet and computer.

## Turn on sync (one time)
1. Create a free Firebase project (Spark plan) with **Google sign-in** turned on and a **Firestore** database.
2. In Authentication → Settings → Authorized domains, add `gpuwar-sys.github.io`.
3. In Firestore → Rules, publish:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/songs/{songId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
   Each person can only read and change their own songs.
4. Paste the web app's config into `firebase-config.js`.

Until step 4 is done the app runs exactly like V2 (songs stay on each device).

## How sync works
- Songs live at `users/{uid}/songs/{songId}` in Firestore and in each browser's local storage.
- The newest change wins. Deleting a song deletes it everywhere.
- Built-in songs are not synced (every device already has them).

## Files
- `sync.js` – Google sign-in + Firestore sync (merge logic is plain JS and unit-tested)
- `firebase-config.js` – your Firebase project settings
- `music.js`, `songs.js`, `app.js`, `index.html`, `styles.css` – the app (same as V2)

## Public site
`.github/workflows/pages.yml` publishes the `v3/` folder on every push to the `v3` branch:
https://gpuwar-sys.github.io/Piano-Chord-Charts/
