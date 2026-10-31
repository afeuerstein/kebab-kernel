# flsh.me — five flashbangs

Five production-quality, fully self-contained landing-page concepts for the domain
**flsh.me**, each inspired by the Counter-Strike flashbang: all 3D (Three.js,
vendored locally — no CDN at runtime), all with procedurally synthesized sound
(WebAudio — no audio files), and each featuring an interactive flashbang you can
detonate.

## The five concepts

| # | Concept | Path | Vibe |
|---|---------|------|------|
| 01 | **Dust Hangar** | `/sites/dust-hangar/` | Cinematic diorama — orbit a hero flashbang in a sunlit hangar; click to throw it, screen goes white, camera shakes, tinnitus ring fades over ~8 s |
| 02 | **Bombsite Radar** | `/sites/bombsite-radar/` | Top-down tactical map with round timer, kill feed and sweeping radar; thrown flash makes enemy markers blink white |
| 03 | **Corridor 1v1** | `/sites/corridor-1v1/` | First-person — you hold mid corridor with a USP viewmodel; the enemy peeks and throws the flash *at you* |
| 04 | **Studio Flash** | `/sites/studio-flash/` | Luxury product landing — the M67 on a pedestal with studio lighting, swappable finishes, "see it flash" CTA |
| 05 | **1.6 Terminal** | `/sites/cs16-crt/` | 1998 CRT boot sequence over a wireframe phosphor 3D scene; press `T` / `THROW` to detonate, screen whites out |

Open `/` for the gallery index linking to all five.

## Run

```bash
node tools/server.mjs     # serves this folder on http://127.0.0.1:8734
```

Any static file server works — there is no build step. Dependencies (three.js,
fonts) are vendored under `/vendor/`.

## QA harness

```bash
node tools/server.mjs &   # if not already running
node tools/qa.mjs sites/dust-hangar sites/bombsite-radar sites/corridor-1v1 sites/studio-flash sites/cs16-crt
```

Loads every site in headless Chromium, captures console/page errors, screenshots
idle → flash → recover states into `qa/shots/`, and reads `window.__stats`.

## Structure

```
index.html          gallery
sites/<name>/       one self-contained site per concept (index.html + main.js)
shared/             audio.js (procedural CS sounds), flash.js (flash state machine), ui.js (nav/boot/hints)
vendor/             three.module.js + addons + woff2 fonts (all local)
tools/              static server + playwright QA loop
```
