# How to commit the Music folder to GitHub

Do these steps in **Git Bash** (or Terminal if you use it). If Git isn’t installed, install it from https://git-scm.com/ first.

---

## 1. Go to the Music folder

```bash
cd "C:\Users\gpuwa\OneDrive\Desktop\Music"
```

---

## 2. Turn this folder into a Git repo (first time only)

```bash
git init
```

---

## 3. Add all music files

```bash
git add .
```

---

## 4. Commit

```bash
git commit -m "Add chord charts, Tu Jhoom Indian notation, MIDI script, Play_Chords.html"
```

---

## 5. Create a repo on GitHub

1. Open https://github.com/new  
2. Repository name: e.g. **piano-chord-charts** or **music-scripts**  
3. Leave it **empty** (no README, no .gitignore).  
4. Click **Create repository**.

---

## 6. Connect and push

Replace `YOUR_USERNAME` and `REPO_NAME` with your GitHub username and the repo name you chose (e.g. `piano-chord-charts`):

```bash
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

Example if your username is `jane` and repo is `piano-chord-charts`:

```bash
git remote add origin https://github.com/jane/piano-chord-charts.git
git branch -M main
git push -u origin main
```

GitHub may ask you to sign in (or use a personal access token if you have 2FA).

---

After this, your **music scripts and chord charts** will be on GitHub. You can run `git add .` and `git commit -m "message"` and `git push` whenever you want to update.
