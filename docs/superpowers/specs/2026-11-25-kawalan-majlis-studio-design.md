# Kawalan Majlis Studio (fork OBS) — reka bentuk + pelan

Tarikh: 25 Nov 2026 · Keputusan Cikgu: **pilihan B = fork OBS Studio (C++/Qt), lesen GPL disetujui**, "teruskan ikut mockup, buat yang terbaik… memudahkan cikgu, berfungsi dengan baik".
Mockup diluluskan: `docs/mockup-bilik-kawalan.html` · Spike lulus (25 Nov 12.30 pg): video asli licin, klik/CUT/FADE/klik dua kali berfungsi, panel web terbenam — disahkan Cikgu di skrin. CPU OBS 0.9 %, 30 fps, 0 bingkai tercicir.

## Repo dan binaan
- Fork: `C:\km-studio\obs-studio` (NTFS; JANGAN F: exFAT), tag asas OBS **32.0.4**, cabang `kawalan-majlis`. Remote `origin` = obsproject (jangan push ke situ). Repo GitHub sendiri: belum dicipta (perlu onz Cikgu).
- Alat: VS 2022 Community 17.14 (C++), CMake 4.4.4 (`C:\Program Files\CMake\bin\cmake.exe`, belum dalam PATH sesi lama), Windows SDK 10.0.26100.
- Konfigurasi: `CMakeUserPresets.json` preset `windows-x64-km` (SDK 26100). Bina: `cmake --build build_x64 --config RelWithDebInfo --parallel` (sasaran pantas: `--target obs-studio`).
- Jalan untuk ujian: `build_x64\rundir\RelWithDebInfo\bin\64bit\obs64.exe --portable --remote-debugging-port=9223 --disable-shutdown-check --disable-updater` (portable = tetapan dalam `rundir\RelWithDebInfo\config`, OBS Cikgu tidak disentuh). Kata laluan WebSocket ujian: `C:\km-studio\pw.txt`. Env `KM_BILIK=1` buka Bilik Kawalan; `KM_PANEL=<url>` tukar panel web.
- Tangkapan skrin tetingkap OBS dengan PrintWindow keluar HITAM (swapchain DirectX) → semakan visual oleh Cikgu, atau tangkap panel web melalui CDP.

## Matlamat
Satu aplikasi **Kawalan Majlis Studio** yang dibuka terus ke **Bilik Kawalan** ikut mockup, untuk cikgu sekolah yang bukan juruteknik:
1. **Bar atas:** jenama, status sambungan/siaran, jam, bingkai tercicir + CPU, **REC**, **LIVE** (henti = tahan 2 s), suis **✎ Persediaan / ▶ Majlis**.
2. **PREVIEW (oren) | PERALIHAN | PROGRAM (merah)** — video asli. Peralihan: **CUT** (Enter), **FADE** (F), tempoh, **T-bar asli** (campuran separuh sebenar, guna `obs_transition_set_manual_time` seperti OBS), **FTB** (scene hitam, tekan lagi kembali).
3. **Deretan input** = scene, video asli, nombor 1–9, tag PROGRAM/PREVIEW, sempadan merah/oren, klik = Preview, klik dua kali = Program; boleh disembunyikan (pengguna switcher).
4. **Panel Pengarah** (web sedia ada, kod v2 + 58 ujian) dibenam melalui CEF dalam mod terbenam (tanpa bar sambungan, tanpa paparan besar web).
5. **Mixer audio asli** (`VolControl` menegak, meter licin), nama mesra, tanda DIKECILKAN untuk Muzik latar.
6. **Persediaan:** halaman Persediaan web sedia ada + "Tetapan lanjutan" membuka tetingkap OBS penuh (sumber, output, tetapan siaran).
7. **Tanpa Pasang.bat:** aplikasi menghidupkan WebSocket sendiri dengan kata laluan rawak dan menghantarnya ke panel; paparan (browser source) dipasang ke scene sekali klik.

## Bukan matlamat (versi pertama)
Mac (selepas Windows lulus), pemasang bertandatangan (perlu sijil), kiraan masa sesi, kawal telefon, replay.

## Anti-matlamat
- Cikgu tersesat ke antara muka OBS yang rumit untuk kerja biasa majlis.
- Klik input menyentuh audio; berhenti siaran dengan satu klik tersilap.
- Panel Pengarah hilang keselamatan v2 (kunci lagu, SEDIA, giliran, Esc dua kali untuk lagu).
- Aplikasi tergantung semasa live: tiada perubahan scene-item berlonjak (pelajaran hang 24 Nov: jeda + satu demi satu).

## Pendekatan (dipilih Cikgu)
- **B: fork OBS** (dipilih) — enjin + UI dalam satu aplikasi, video asli, T-bar asli. Kos: bina C++/Qt, ikut naik taraf OBS.
- A: Electron + obs-studio-node — ditolak Cikgu (B lebih kukuh, OBS sumber terbuka).
- C: plugin C++ dalam OBS — tetingkap OBS kekal di sekeliling.

## Seni bina
- `frontend/widgets/BilikKawalan.{hpp,cpp}` — tetingkap utama KM (gantikan spike). Komponen: `KMBarAtas`, `KMMonitor` (KMDisplay + tajuk), `KMPeralihan`, `KMDeretanInput`, `KMMixer` (VolControl), `QCefWidget` Panel Pengarah.
- `frontend/data/kawalan-majlis/` — salinan fail web Kawalan Majlis (dibina dari repo `kawalan-majlis`), URL melalui `obs_find_data_file`.
- Gaya: QSS dengan token mockup (`--bg #111216`, `--panel #1b1d23`, `--live #e5484d`, oren `#f08a24`, kuning `#f5a524`, hijau `#3fb27f`), fon sistem (Segoe UI / SF).
- `OBSBasic`: mod KM lalai (`KM_KLASIK=1` untuk tetingkap OBS biasa); tetingkap OBS disembunyikan, dibuka dari menu "Tetapan lanjutan".
- Panel web: `kawalan-majlis.html?tertanam=1&pw=…` → sembunyi `#bar`, `.modes` (suis mod dikawal bar atas asli melalui `window.__km.setMod()`), dan bahagian Bilik Kawalan web.

## Pelan pelaksanaan (setiap tugas: bina, uji, commit dalam fork)
1. **Rangka aplikasi:** buka terus ke BilikKawalan; tajuk/ikon "Kawalan Majlis Studio"; tutup = keluar; "Tetapan lanjutan" tunjuk OBSBasic. Uji: lancar portable, proses responsif, satu tetingkap utama.
2. **Gaya + bar atas asli:** QSS token; jam, bingkai tercicir, CPU (`os_cpu_usage_info`/stats OBS), REC/LIVE (OBSBasic Start/StopRecording, Start/StopStreaming), tahan 2 s. Uji: WebSocket `GetRecordStatus` selepas klik (melalui `QTest`/hook `KM_UJI`), semakan visual Cikgu.
3. **Monitor + peralihan:** tajuk oren/merah ikut mockup, CUT/FADE/tempoh, T-bar asli (panggil logik TBar OBSBasic), FTB. Uji WebSocket: Program/Preview berubah, T-bar separuh mencampur (GetSourceScreenshot Program semasa 50 %).
4. **Deretan input:** jubin bergaya, tag, sempadan, kekunci 1–9/Enter/F, sembunyi. Uji WebSocket.
5. **Mixer asli:** VolControl menegak, tapis sumber, nama mesra, tanda ducking. Uji: bisu/volume melalui WebSocket.
6. **Panel Pengarah terbenam:** mod `tertanam` dalam `kawalan-majlis.html` (+ ujian CDP dalam aplikasi), WebSocket auto + kata laluan rawak, pasang paparan sekali klik, fail web dibundel. Uji: `uji-majlis.cjs` berjalan terhadap aplikasi.
7. **Kekunci + kebolehcapaian:** fokus papan kekunci, saiz sentuh ≥ 32 px, kontras, BM penuh. Semakan `design:accessibility-review` + `design:ux-copy`.
8. **Pembungkusan Windows:** `cmake --install` ke folder, zip/pemasang (NSIS) "Kawalan Majlis Studio", GPL + notis OBS, uji pada PC bersih/laptop sekolah. Repo GitHub (onz Cikgu).

## Disahkan dalam kod OBS 32.0.4
- T-bar asli: `OBSBasic::tBar`, `TBarChanged/TBarReleased` (`widgets/OBSBasic_Transitions.cpp` ~680–760).
- `VolControl(OBSSource, bool showConfig, bool vertical)` (`widgets/VolControl.hpp:54`).
- Render: `OBSQTDisplay` + `obs_display_add_draw_callback`, `startRegion/endRegion` dalam `components/Multiview.hpp`, `GetScaleAndCenterPos` dalam `utility/display-helpers.hpp`.
- CEF: `OBSBasic::InitBrowserPanelSafeBlock()`, `cef->create_widget(parent, url, panel_cookies)` (`docks/BrowserDock.hpp`).
- `os_getenv` TIADA → guna `qEnvironmentVariable`.
