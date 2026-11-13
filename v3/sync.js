/*
 * Chord Charts V3 — sync "my songs" across devices with Firebase (Google sign-in + Firestore).
 * Data layout: users/{uid}/songs/{songId} = { text, updated } or { deleted: true, updated }.
 * Every device keeps its own copy in localStorage; sync merges by "newest change wins".
 */
(function (root) {
  "use strict";
  const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  const LS_SONGS = "cc2.mySongs";
  const LS_TOMB = "cc3.deleted";

  // ---------- pure merge (tested in Node) ----------
  // local: [{id,text,updated}], remote: [{id,text,updated,deleted}], tomb: {id: time deleted locally}
  function merge(local, remote, tomb) {
    const out = local.map((s) => Object.assign({}, s));
    const byId = new Map(out.map((s) => [s.id, s]));
    const rById = new Map(remote.map((r) => [r.id, r]));
    const toPush = [];
    const toDelete = [];
    let changed = false;
    remote.forEach((r) => {
      const l = byId.get(r.id);
      const t = tomb[r.id];
      if (r.deleted) {
        if (l && (l.updated || 0) <= (r.updated || 0)) { out.splice(out.indexOf(l), 1); byId.delete(r.id); changed = true; }
        return;
      }
      if (t && t >= (r.updated || 0)) { toDelete.push(r.id); return; } // deleted here after its last change
      if (!l) { const s = { id: r.id, text: r.text, updated: r.updated || 0 }; out.push(s); byId.set(r.id, s); changed = true; }
      else if ((r.updated || 0) > (l.updated || 0)) { l.text = r.text; l.updated = r.updated; changed = true; }
    });
    out.forEach((l) => {
      const r = rById.get(l.id);
      if (!r || (!r.deleted && (l.updated || 0) > (r.updated || 0)) || (r.deleted && (l.updated || 0) > (r.updated || 0))) toPush.push(l);
    });
    Object.keys(tomb).forEach((id) => { const r = rById.get(id); if (!r || (!r.deleted && !toDelete.includes(id) && tomb[id] >= (r.updated || 0))) { if (r) toDelete.push(id); } });
    return { local: out, toPush, toDelete: [...new Set(toDelete)], changed };
  }

  if (typeof module !== "undefined" && module.exports) { module.exports = { merge }; return; }

  // ---------- browser ----------
  const $ = (id) => document.getElementById(id);
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
  let auth = null, db = null, col = null, unsub = null, user = null, busy = false, pending = false;

  function ui(state, msg) {
    const st = $("sync-status"), btn = $("sync-btn");
    if (!st || !btn) return;
    st.textContent = msg;
    btn.hidden = state === "off" || state === "loading";
    btn.textContent = state === "in" ? "Sign out" : "☁️ Sign in with Google";
    btn.dataset.state = state;
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("Couldn't load " + src));
      document.head.appendChild(s);
    });
  }

  async function syncWith(remote) {
    if (busy) { pending = true; return; }
    busy = true;
    try {
      const tomb = get(LS_TOMB, {});
      const r = merge(get(LS_SONGS, []), remote, tomb);
      if (r.changed) { set(LS_SONGS, r.local); root.ChordApp && root.ChordApp.refresh(); }
      const batch = db.batch();
      r.toPush.forEach((s) => batch.set(col.doc(s.id), { text: s.text, updated: s.updated || Date.now() }));
      r.toDelete.forEach((id) => batch.set(col.doc(id), { deleted: true, updated: Math.max(tomb[id] || 0, Date.now()) }));
      if (r.toPush.length || r.toDelete.length) await batch.commit();
      // tombstones are now on the server
      if (Object.keys(tomb).length) set(LS_TOMB, {});
      ui("in", `Synced ✓ — signed in as ${user.displayName || user.email}. Songs you add appear on all your devices.`);
    } catch (e) {
      ui("in", "Sync problem: " + (e.code || e.message) + ". Your songs are still saved on this device.");
    } finally {
      busy = false;
      if (pending) { pending = false; pushNow(); }
    }
  }

  async function pullAll() {
    const snap = await col.get();
    return snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  }
  async function pushNow() { if (col) syncWith(await pullAll()); }

  async function start(cfg) {
    ui("loading", "Connecting sync…");
    await loadScript(SDK + "firebase-app-compat.js");
    await Promise.all([loadScript(SDK + "firebase-auth-compat.js"), loadScript(SDK + "firebase-firestore-compat.js")]);
    root.firebase.initializeApp(cfg);
    auth = root.firebase.auth();
    db = root.firebase.firestore();
    auth.getRedirectResult().catch(() => { /* ignore */ });
    auth.onAuthStateChanged((u) => {
      if (unsub) { unsub(); unsub = null; }
      user = u; col = null;
      if (!u) { ui("out", "Sign in to keep your added songs on all your devices (phone, tablet, computer)."); return; }
      col = db.collection("users").doc(u.uid).collection("songs");
      ui("in", "Syncing…");
      unsub = col.onSnapshot((snap) => syncWith(snap.docs.map((d) => Object.assign({ id: d.id }, d.data()))),
        (e) => ui("in", "Sync problem: " + (e.code || e.message)));
    });
    $("sync-btn").addEventListener("click", async () => {
      if (user) { await auth.signOut(); return; }
      const provider = new root.firebase.auth.GoogleAuthProvider();
      try { await auth.signInWithPopup(provider); }
      catch (e) {
        if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") auth.signInWithRedirect(provider);
        else if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") ui("out", "Sign-in didn't work: " + (e.code || e.message));
      }
    });
  }

  root.SongSync = {
    // called by the app after a song is added, edited or loaded from a backup
    changed() { if (col) pushNow(); },
    // called by the app when a song is deleted
    deleted(id) {
      const t = get(LS_TOMB, {}); t[id] = Date.now(); set(LS_TOMB, t);
      if (col) pushNow();
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    const cfg = root.FIREBASE_CONFIG;
    if (!cfg) { ui("off", ""); const box = $("sync"); if (box) box.hidden = true; return; }
    start(cfg).catch((e) => ui("off", "Sync isn't available right now (" + e.message + "). Your songs are still saved on this device."));
  });
})(typeof window !== "undefined" ? window : globalThis);
