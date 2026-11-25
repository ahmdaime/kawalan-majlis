# Panel Pengarah (Kawalan Majlis v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One OBS dock `kawalan-majlis.html` that runs a whole ceremony as one Aturcara (names, songs, videos, slides, pictures) with RED = on air, YELLOW = SEDIA, a locked yellow button while a song plays, and a separate Muzik Latar channel.

**Architecture:** All rules live in a pure, DOM-free state machine `lib/aturcara.js` (`KM.Pengarah`) that returns a list of *actions*; the dock executes actions against OBS. This keeps every safety rule unit-testable in Node. Excel parsing, PDF/picture decks and the name-design editor are extracted from the v1.2 docks into `lib/` and reused. `paparan.html` and its BroadcastCustomEvent protocol (`nama`, `media`, `gaya`, `aset`, `semak-paparan`, `paparan-sedia`) are unchanged.

**Tech Stack:** Plain HTML/CSS/JS (no build), obs-websocket v5 via `lib/obs.js`, SheetJS `lib/xlsx.full.min.js`, pdf.js `lib/pdf.min.js`, IndexedDB `lib/idb.js`, Node 22+ for tests (no dependencies).

**Spec:** `docs/superpowers/specs/2026-11-24-panel-pengarah-design.md` · mockup `docs/mockup-panel-pengarah.html` (approved look; copy its CSS tokens and layout).

## Global Constraints
- OBS 28+ Custom Browser Dock, Windows + Mac, `file://`, no internet, no server, no npm dependencies at runtime.
- v1.2 docks (`kawalan-anugerah.html`, `kawalan-media.html`) stay working and untouched until v2 passes Task 8 (MASEP 28 Nov 2026 fallback).
- All UI copy in Bahasa Melayu; "browser" not "pelayar"; avoid stacked hyphens.
- Never call `setViewportSize` / change a dock viewport in tests.
- Source names: overlay `Kawalan Majlis - Paparan`, video/song `Kawalan Majlis - Video`, background music `Kawalan Majlis - Muzik Latar`.
- localStorage keys prefixed `km.` via `KM.dock.store`; new keys under `majlis.*`. Never delete v1.2 keys (`anugerah.*`, `media.*`, `gaya.*`).
- Version string: `v2.0`.

## Review Focus
1. **Space/clicker during a song**: a second press must never restart, cut or switch the song (clicker sends PageDown/→ too, which must only move SEDIA). → Task 1 tests `kuningDikunciSemasaMain`, `seterusnyaSemasaMainHanyaAlihSedia`.
2. **Huge lists**: 300+ names across sections; search by name must find names in any section, numbers only in the SEDIA section, and Enter must not go on air. → Task 1 `cariNama`, `cariNombor`; Task 5 render check with 320 rows stays responsive (list virtualised or capped to section).
3. **Dock reload mid-song**: state must recover from `GetMediaInputStatus`; a missed `MediaInputPlaybackEnded` must not leave the yellow button locked forever. → Task 1 `pulihMain`; Task 6 live test.
4. **Corrected Excel reloaded mid-ceremony**: shown marks and SEDIA position kept by name match (v1.2 behaviour). → Task 2 test `muatSemulaKekalTanda`.
5. **Video/song file moved or renamed after adding**: playing must show a clear error in the red box, not silent black/silence. → Task 6 live test with a missing path.

---

### Task 1: Pure state machine `KM.Pengarah`

**Files:**
- Create: `lib/aturcara.js`
- Test: `ujian/uji-aturcara.cjs`

**Interfaces:**
- Produces (UMD: `window.KM.Pengarah` in browser, `module.exports` in Node):
  - Item shapes: `{id, jenis:"nama", tajuk, senarai:[{nama,kelas}]}` · `{id, jenis:"lagu"|"video", tajuk, fail, laluan, tempoh?}` · `{id, jenis:"slaid"|"gambar", tajuk, fail, halaman}` (`halaman` = page/picture count).
  - `new Pengarah({aturcara, sedia?, udara?, dipapar?, selesai?})`; `toJSON()` → plain object for `store.set("majlis.state")`.
  - Positions are `{i, s}` (item index, sub index: name or page).
  - `saiz(item) -> number` (names / pages / 1).
  - `langkah(pos, dir:1|-1) -> pos|null` crossing item boundaries; null past ends.
  - `huraikan(pos) -> {utama, kecil, giliran?:{no, daripada}, butang:"PAPAR"|"MAIN LAGU"|"MAIN VIDEO"}`.
  - Commands return `{ok:boolean, sebab?:string, tindakan:Action[]}` where `Action` is one of `{t:"nama", show, nama, kelas, anugerah}`, `{t:"media", show, item, halaman}`, `{t:"main", item}`, `{t:"henti"}`, `{t:"duck", ke:"rendah"|"asal"}`:
    `kuning()`, `seterusnya()`, `sebelum()`, `sorok()`, `sediakan(pos)`, `cari(teks) -> pos|null` (does NOT change state), `mainTamat()`, `pulihMain(playing:boolean, item?)`.
  - Getters: `sedangMain` (song/video on air), `bolehPersediaan` (nothing on air).

- [ ] **Step 1: Write failing tests** (`ujian/uji-aturcara.cjs`, same `ok(cond, label)` style as `uji-windows.cjs`, exit 1 on failure). Fixture: `[video "Video pembukaan", lagu "Lagu Negaraku", slaid 3 halaman, nama "Cemerlang" 120 names, nama "Tokoh" 6 names, video "Penutup"]`. Assertions:
  - `kuningMemaparkanNama`: sedia `{i:3,s:45}` → `kuning()` returns action `{t:"nama", show:true, nama: senarai[45].nama, anugerah:"Cemerlang"}`, `udara` = `{i:3,s:45}`, `dipapar` has `"3:45"`, sedia moves to `{i:3,s:46}`.
  - `satuKeUdara`: slide on air, then `sediakan` a name + `kuning()` → actions contain `{t:"media", show:false}` before `{t:"nama", show:true}`.
  - `kuningDikunciSemasaMain`: `sediakan({i:1,s:0})`, `kuning()` → `{t:"duck",ke:"rendah"}` + `{t:"main"}`; second `kuning()` → `ok:false`, `sebab` contains "HENTI", `tindakan` empty.
  - `seterusnyaSemasaMainHanyaAlihSedia`: during song, `seterusnya()` changes `sedia` only, `tindakan` empty, `udara` unchanged.
  - `mainTamatSorokDanSediakan`: `mainTamat()` → `udara` null, `{t:"duck",ke:"asal"}`, item in `selesai`.
  - `hentiFade`: during song `sorok()` → `[{t:"henti"},{t:"duck",ke:"asal"}]`.
  - `seterusnyaSemasaNamaDipapar`: name on air → `seterusnya()` gives `{t:"nama",show:false}` and sedia = next name, nothing new shown.
  - `slaidSeterusnyaTukarHalaman`: slide page 1 on air → `seterusnya()` gives `{t:"media",show:true,halaman:2}`; on last page → `{t:"media",show:false}` and sedia = next item.
  - `hujungSeksyen`: sedia last name of "Cemerlang" → `seterusnya()` sedia = `{i:4,s:0}`; at last item `langkah` returns null and `seterusnya()` keeps sedia.
  - `klikTidakPapar`: `sediakan(any)` returns `tindakan: []`.
  - `cariNama`: `cari("TOKOH-NAMA-2")` finds `{i:4,s:2}` while sedia is in section 3; `cariNombor`: sedia in section 3, `cari("46")` → `{i:3,s:45}`; `cari("999")` → null.
  - `pulihMain`: fresh Pengarah with `udara` a song and `pulihMain(false)` → udara null, not locked; `pulihMain(true, songIndex)` → locked.
  - `bolehPersediaan`: false while anything on air.
  - `toJSONBulatBalik`: `new Pengarah(p.toJSON())` deep-equals state (Sets serialised as arrays).

- [ ] **Step 2: Run** `node ujian/uji-aturcara.cjs` → fails (module missing).
- [ ] **Step 3: Implement `lib/aturcara.js`.** Pure; no DOM, no OBS. `nama` items use `item.tajuk` as `anugerah`.
- [ ] **Step 4: Run** `node ujian/uji-aturcara.cjs` → all LULUS. Break one rule on purpose (comment out the lock) and see `kuningDikunciSemasaMain` turn GAGAL, then restore.
- [ ] **Step 5: Commit** `git add lib/aturcara.js ujian/uji-aturcara.cjs && git commit -m "Panel Pengarah: mesin keadaan aturcara + ujian"`

### Task 2: Extract Excel parser + v1.2 migration

**Files:**
- Create: `lib/senarai.js`
- Modify: `lib/aturcara.js` (add migration)
- Test: `ujian/uji-aturcara.cjs` (append)

**Interfaces:**
- Produces `KM.senarai.dariJadual(table:string[][]) -> {rows:[{nama,kelas,anugerah}], note, noAward, suggest}` (body copied from `toRows` in `kawalan-anugerah.html:192-222`), `KM.senarai.bacaFail(file:File) -> Promise<same>` (XLSX read + `fillMerges` from `kawalan-anugerah.html:224-231`).
- Produces `Pengarah.seksyenDariRows(rows, defAward) -> nama-items[]`: one item per award in first-appearance order; empty award → `defAward` or `"Anugerah"`.
- Produces `Pengarah.naikTaraf({mediaItems, rows, defAward, cur, done}) -> {aturcara, dipapar, sedia}`: media items mapped (`pdf→slaid`, `img→gambar`, `vid→video`, keep `id`, `label→tajuk`, `count→halaman`, `path→laluan`), then name sections; `done` row indexes → `"i:s"`; `cur` row → sedia.
- Produces `Pengarah.gabungSenarai(aturcara, dipapar, rowsBaru, defAward) -> {aturcara, dipapar}`: replaces name sections, keeps shown marks by lower-cased name.

- [ ] **Step 1: Tests** `seksyenIkutAnugerah` (rows A,A,B,A → sections A(3) then B(1)), `naikTarafV12` (2 media + rows with `done=[0,1]`, `cur=2` → 2 media items first, `dipapar` has `"2:0","2:1"`, sedia `{i:2,s:2}`), `muatSemulaKekalTanda` (shown name stays shown after reload with one name corrected elsewhere). Node tests call `dariJadual` with plain arrays.
- [ ] **Step 2: Run** → fail. **Step 3: Implement.** **Step 4: Run** → pass.
- [ ] **Step 5: Commit** "Panel Pengarah: parser Excel dikongsi + naik taraf data v1.2".

### Task 3: OBS helpers for Muzik Latar, song paths and fades

**Files:**
- Modify: `lib/dock.js` (installOverlay ~line 231, exports line 266)

**Interfaces:**
- Produces `KM.dock.MUZIK_NAME = "Kawalan Majlis - Muzik Latar"`; `installOverlay` also ensures the music input (`ffmpeg_source`, settings `{is_local_file:true, looping:true, restart_on_activate:false, close_when_inactive:false}`, enabled, no transform fit).
- `KM.dock.mainFail(obs, laluan) -> Promise<void>`: `SetInputSettings` VIDEO `local_file=laluan`, `setVideoVisible(true)`, RESTART. Rejects with `Error("Fail tidak dijumpai: <nama>")` if `GetMediaInputStatus.mediaState` is `OBS_MEDIA_STATE_ERROR` within 1.5 s.
- `KM.dock.pudar(obs, inputName, keMul:number /*0..1*/, ms=800) -> Promise<void>`: steps `SetInputVolume {inputVolumeMul}` every 50 ms.
- `KM.dock.pilihFail(obs, inputName) -> Promise<string|null>`: clears `local_file`, `OpenInputPropertiesDialog`, resolves with the path from the next `InputSettingsChanged` for that input (null after 5 min).
- `KM.dock.statusMain(obs) -> Promise<{playing:boolean, laluan:string}>`.

- [ ] **Step 1:** Add live checks to `ujian/uji-windows.cjs` (new section "v2 helpers") that call these through the dock page: after Pasang, inputs list contains all three source names; `pudar` to 0 then `GetInputVolume.inputVolumeMul` < 0.01; `mainFail` with `C:\\tiada\\x.mp3` rejects with "Fail tidak dijumpai".
- [ ] **Step 2: Run** against OBS (README "Uji dalam OBS sebenar") → new checks GAGAL. **Step 3: Implement.** **Step 4: Run** → LULUS, old 24 still LULUS.
- [ ] **Step 5: Commit** "dock.js: Muzik Latar, mainFail, pudar, pilihFail".

### Task 4: Extract decks and the name designer

**Files:**
- Create: `lib/dek.js` (from `kawalan-media.html` lines ~140-210: `fitCanvas`, `fileOf`, `deckOf`, `cached`, `keep`, page → 1920×1080 JPEG dataURL)
- Create: `lib/reka.js` (from `kawalan-anugerah.html` lines ~368-600: design editor markup + logic)

**Interfaces:**
- `KM.dek.simpan(id, files:File[]) -> Promise<{stored:boolean}>`, `KM.dek.halaman(item, n) -> Promise<string dataURL>`, `KM.dek.kira(item) -> Promise<number>`, `KM.dek.buang(id)`. IndexedDB keys stay `media:<id>` so v1.2 items migrate without copying.
- `KM.reka.mount(container:HTMLElement, {obs, store}) -> {buka(), tutup()}`; keeps v1.2 keys `gaya.layout`, `gaya.fonts`, answers `minta-aset`, broadcasts `gaya`.

- [ ] **Step 1:** Smoke page `ujian/dek-reka.html` (not shipped) that mounts `KM.reka` and renders page 2 of a generated 2-page PDF via `KM.dek`; load it headless with Playwright from `pajsk-assist/node_modules` (plain browser, not OBS) and assert: editor has 7 font options, dataURL starts `data:image/jpeg`, no page errors.
- [ ] **Step 2: Run** → fail. **Step 3: Extract** (copy; v1.2 docks keep their own copies until Task 9). **Step 4: Run** → pass.
- [ ] **Step 5: Commit** "lib/dek.js + lib/reka.js diekstrak untuk Panel Pengarah".

### Task 5: The dock `kawalan-majlis.html` (Majlis mode)

**Files:**
- Create: `kawalan-majlis.html`

**Interfaces:**
- Consumes `KM.Pengarah`, `KM.dek`, `KM.dock.*`, `KM.senarai`, `KM.reka`.
- Renders the mockup layout: top bar (connection + route badge from `KM.dock.mount` + `✎ Persediaan` / `▶ Majlis`), Muzik Latar row (title, ▶/■, volume slider 0–100 → `SetInputVolume`), RED box, YELLOW box, Selepas ini/Kemudian, search, Aturcara list with section progress.
- `laksana(tindakan:Action[])`: `nama`→broadcast `{type:"nama",...}`; `media`→`KM.dek.halaman` then broadcast `{type:"media", show, src, key}`; `main`→`KM.dock.mainFail` (on error: RED box shows the message, Pengarah `mainTamat()`); `henti`→`pudar(VIDEO,0)` + STOP + restore volume; `duck`→`pudar(MUZIK, rendah?0.15:simpanan)`.
- Persists `pengarah.toJSON()` to `majlis.state` after every command; on load uses it, else `Pengarah.naikTaraf(...)` from v1.2 keys.
- Keys: Space = `kuning()`; →/PageDown = `seterusnya()`; ←/PageUp = `sebelum()`; Esc = `sorok()`; ignored while typing in an input. `MediaInputPlaybackEnded` (VIDEO) → `mainTamat()`. While locked, poll `statusMain` every 2 s and call `pulihMain`. On connect: `pulihMain` from `statusMain`; on `paparan-sedia`: resend current on-air action.
- Search list shows only the SEDIA section (max 400 rows) to stay fast with 300+ names.

- [ ] **Step 1:** Create `ujian/uji-majlis.cjs` (raw CDP, reuse the `Tab`/`obsSocket`/`minimalPdf` helpers by moving them to `ujian/cdp.cjs` and requiring them from both test files). Checks: dock loads; Excel → sections in Aturcara; clicking a list row → overlay `#nameWrap` NOT `.show` (klik tidak papar); Space → name shown with giliran text `"1 daripada 3"` in yellow box before press; adding a song by setting `local_file` via websocket to a short WAV the test generates; Space → playing; Space again → still playing same file and toast contains "HENTI"; PageDown during song → sedia changed, overlay unchanged; Esc → stopped within 2 s; reload dock mid-song → RED box restored and yellow button disabled.
- [ ] **Step 2: Run** → fail. **Step 3: Implement.** **Step 4: Run** → pass; prove two checks can turn red (disable lock, make click call `kuning`) then restore.
- [ ] **Step 5: Commit** "kawalan-majlis.html: mod Majlis".

### Task 6: Persediaan mode

**Files:**
- Modify: `kawalan-majlis.html`

**Interfaces:** steps per mockup with ✓ state: 1 Sambung OBS (existing setup panel from `KM.dock.mount`), 2 Aturcara (+ Lagu, + Video, + Slaid PDF, + Gambar via `pilihFail`/`KM.dek.simpan`; ↑ ↓ rename ✕ twice to delete), 3 Senarai penerima (`KM.senarai.bacaFail` → `Pengarah.gabungSenarai`, default award row from `suggest`), 4 Muzik Latar file (`pilihFail(MUZIK_NAME)`), 5 Reka paparan nama (`KM.reka.buka()`). `Mula Majlis ▶`. The Persediaan button is disabled with a tooltip while `!bolehPersediaan`. Tempoh shown as "—" until first play, then saved on the item from `GetMediaInputStatus.mediaDuration` (spec deviation: no hidden probe, because `close_when_inactive` sources do not load while hidden).

- [ ] **Step 1:** Extend `uji-majlis.cjs`: Persediaan disabled while a name is on air; add PDF (2 pages) → item appears with "2 halaman"; reorder ↑ changes Aturcara order; Muzik Latar ▶ makes `GetMediaInputStatus(MUZIK)` PLAYING and a song start drops its volume below 0.2, HENTI restores it.
- [ ] **Step 2: Run** → fail. **Step 3: Implement.** **Step 4: Run** → pass.
- [ ] **Step 5: Commit** "kawalan-majlis.html: mod Persediaan + Muzik Latar".

### Task 7: Installer, guide, version

**Files:**
- Modify: `Pasang.ps1`, `lib/pasang-mac.js`, `ujian/uji-pasang-mac.cjs`, `PASANG.html`, `README.md`, `lib/dock.js` (version text)

- [ ] **Step 1:** Update `uji-pasang-mac.cjs` expectations: one dock "Kawalan Majlis" with `kawalan-majlis.html?pw=…`, old `kawalan-anugerah`/`kawalan-media` docks removed, operator docks kept. Run → fail.
- [ ] **Step 2:** Installers add only `{title:"Kawalan Majlis", url: kawalan-majlis.html?...}`; regex `kawalan-(anugerah|media|majlis)\.html`. Run Mac test → pass; rerun the four fake-APPDATA PowerShell cases from the v1.2 session (dua dock / satu dock / kosong / rosak) → expected titles.
- [ ] **Step 3:** `PASANG.html` rewritten around the single panel: Persediaan steps, Majlis rules (kuning = keluar, merah = ke udara, lagu dikunci), Muzik Latar, livestream notes (nama murid jadi awam; lagu berhak cipta boleh dibisukan platform). README updated. Version `v2.0`.
- [ ] **Step 4: Commit** "v2.0: pemasang satu panel + panduan".

### Task 8: Full live verification on Windows OBS

- [ ] Restore-safe setup (backup `user.ini` + websocket config, test scene collection, `--remote-debugging-port=9223`), run `Pasang.bat` (KM_UJIAN=1), then `node ujian/uji-aturcara.cjs`, `node ujian/uji-majlis.cjs <pw>`, `node ujian/uji-windows.cjs <pw>` (v1.2 docks still pass), `node ujian/uji-pasang-mac.cjs`. All LULUS.
- [ ] Screenshot overlay with a name and the dock via CDP `Page.captureScreenshot` on the overlay only; compare dock look with the mockup by eye (via OBS window capture with PrintWindow, never CopyFromScreen).
- [ ] Restore OBS config to the user's original, delete test files and `.sentinel/run_*` from forced kills.
- [ ] Commit, push. Report to Cikgu with the manual checks left: real video/song file through the OBS dialog, a real clicker, Mac `Pasang.command`.

### Task 9 (after MASEP, only with Cikgu's onz): remove v1.2 docks
- [ ] Delete `kawalan-anugerah.html`, `kawalan-media.html`, their checks in `uji-windows.cjs`; the extracted `lib/` modules become the single source.
