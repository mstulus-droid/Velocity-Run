# Velocity Run

Endless racer synthwave dalam 3D sungguhan (Three.js): selap-selip trafik, kombo near-miss, nitro. Bagian dari Rhadzor Arcade. README.md berisi kontrol dan peta berkas yang lebih rinci.

## Stack
- `index.html` (HUD, overlay, CSS, import map) + modul ES di `src/` + Three.js 0.170 yang divendor di `vendor/`.
- Dua cara jalan dengan kode yang sama: statis (import map memetakan `three` ke `vendor/three.module.js`) atau Vite (`npm run dev`, `npm run build` ke `dist/`).
- Font Google: Outfit + JetBrains Mono (HUD, kartu akhir), Orbitron (judul, dasbor, tombol), Exo 2 miring (kalimat layar judul).
- Bahasa di `src/i18n.js` (`I18N`, `data-key`), pilihan di localStorage `rhadzor-lang`. Simpanan: `vr_best` (jarak), `vr_bestscore`, `vr_muted`, `vr_quality`.

## Cara jalan & deploy
- Lokal: **wajib lewat server** (modul ES tidak jalan dari `file://`): `python -m http.server 8950` atau `npm run serve`, buka `http://localhost:8950/`.
- Deploy: repo `mstulus-droid/Velocity-Run`, Cloudflare Pages git-connected ke velocity-run.rhadzor.id. **Cloudflare menyajikan folder repo apa adanya, bukan `dist/`** (commit 65ea183), jadi `index.html`, `src/`, `vendor/`, dan `og.jpg` di akar harus tetap utuh dan konsisten.
- Uji: `npm run test:e2e` (butuh Chrome, server di 8950) memakai hook `window.__vr` (`G`, `ST`, `newGame`, `world`, `renderer`, `track`).

## Struktur
- `src/main.js` boot, loop, pemilihan kualitas (turun otomatis kalau < ~38 fps).
- `src/game.js` aturan dan mesin keadaan `ST = MENU 0, COUNT 1, PLAY 2, CRASH 3, OVER 4, PAUSE 5`; `newGame`, `toMenu`, `endGame`, `crash`.
- `src/input.js` keyboard (panah/WASD, Shift/↑ nitro, ↓ rem, Space/Enter mulai, P jeda, M bisu) dan sentuh (seret kanvas `#fx` untuk belok, `#btnNitro` ditahan).
- `src/render/*` dunia 3D; `src/fx.js` kanvas 2D di atasnya untuk percikan, pop, dan hitung mundur.

## Jebakan
- Potret headless butuh WebGL: pakai `periksa-tampilan ... --gpu`. Tanpa GPU, SwiftShader lambat dan hitung mundur 3 detik berjalan dalam waktu game yang melar; uji memendekkannya lewat `window.__vr.G.countT = 0.01`.
- Saat menu, loop tetap menggerakkan dunia (attract mode), jadi potret menu selalu "berubah" antar frame.
- Kualitas grafis tersimpan di `vr_quality`; uji yang mengubahnya harus menghapusnya lagi.
- Layar judul (`#menu`) tersusun `.vr-top` (kredit, judul krom miring, kalimat) dan `.console` di bawah (jarum `.dial`, lampu start `.lights`, `#btnPlay` miring, legenda tombol). Kaca buram menu sengaja tipis supaya jalan 3D terlihat.
- Judul memakai `transform: skewX(-11deg)` pada `h1.title`; `#btnPlay` juga miring dan teksnya diluruskan lewat `.un`. `.badge` masih dipakai overlay jeda.
- `.overlay:not(.on) *` wajib `pointer-events:none`: tombol overlay yang transparan dulu menangkap ketukan.
- `.gauge .odo#menuBest` diisi `game.js` dengan teks "N pts · N m"; jangan mengganti id-nya.
