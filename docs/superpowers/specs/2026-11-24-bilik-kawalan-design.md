# Bilik Kawalan (paparan besar Kawalan Majlis) — reka bentuk + pelan

Tarikh: 24 Nov 2026 · Mockup diluluskan Cikgu ("cantik gila"): `docs/mockup-bilik-kawalan.html` · Analisis vMix dari manual rasmi sahaja (installer vMix tidak dibongkar).

## Niat
Cikgu mahu rasa "satu skrin kawal semua" seperti vMix, untuk cikgu sekolah, tetapi kekal sebagai plugin OBS (percuma, Windows + Mac, OBS sebagai enjin siaran). Prototaip 24 Nov membuktikan gambar Preview/Program (640px, 10/s) + 8 input (320px, 2/s) hanya menambah ~0.3% CPU OBS, 0 bingkai tercicir, semasa rakaman x264 1080p30.

## Matlamat
- Bilik Kawalan ialah **paparan besar panel Kawalan Majlis yang sama** (satu keadaan, satu `KM.Pengarah`), bukan dock kedua.
- Bila panel ditarik keluar dan dibesarkan (lebar ≥ 1000 px) atau tetapan "Sentiasa", susun atur bertukar ke mockup: bar atas (jam, bingkai tercicir, CPU, REC, LIVE), PREVIEW (oren) | PERALIHAN | PROGRAM (merah), deretan input, kemudian Panel Pengarah (mod Majlis sedia ada) dan Mixer audio.
- Input = scene OBS (kecuali scene bantu "Kawalan Majlis - Hitam"), ikut susunan panel Scenes OBS. Klik = Preview, klik dua kali = terus ke Program. Kekunci 1–9.
- Peralihan: CUT, FADE (tempoh 0.3/0.5/1/2 s), T-bar, FTB. Guna Studio Mode OBS; jika mati, butang "Hidupkan Studio Mode".
- FTB = Fade ke scene "Kawalan Majlis - Hitam" (dicipta sendiri, warna hitam penuh); tekan lagi = kembali ke scene Program sebelumnya.
- Mixer: setiap sumber OBS yang ada audio (kecuali paparan), meter sebenar (InputVolumeMeters), fader (dB), M = bisu, S = dengar di fon kepala (audio monitoring "monitor and output"; ditekan lagi = jenis asal). Muzik latar tunjuk "DIKECILKAN" semasa ducking. Nama mesra: Video → "Lagu / video", Muzik Latar → "Muzik latar".
- REC mula/henti. LIVE mula; **henti perlu tekan tahan 2 s**. Pemasa dari status OBS. Bingkai tercicir (render + output, sejak panel dibuka) dan CPU OBS setiap 2 s.
- Deretan input boleh disembunyikan (sekolah yang guna switcher hardware).

## Bukan matlamat (kali ini)
- Kiraan masa sesi (perlu masa mula setiap item aturcara) — jam biasa sahaja.
- Video licin dalam panel (had OBS; video penuh dalam OBS / Multiview).
- Aplikasi berasingan (libobs GPL atau enjin sendiri) — keputusan lesen Cikgu kemudian.

## Anti-matlamat
- Klik input membisukan mikrofon (masalah vMix Auto Mix): klik input **tidak pernah** menyentuh audio.
- Bilik Kawalan mengubah perangai Panel Pengarah v2 (58 semakan mesti kekal lulus) atau panel v1.2.
- Berhenti siaran dengan satu klik tersilap.
- Gambar pratonton membebankan OBS bila tidak dilihat: pratonton berhenti bila paparan besar tidak aktif atau tab tersorok.

## Reka bentuk teknikal
- `lib/bilik.js`: `KM.bilik.mount(container, {obs, store, toast, ditunduk: () => bool})` → `{aktif(bool)}`. Bahagian tulen (diuji Node, `ujian/uji-bilik.cjs`): `senaraiInput(scenes)`, `dbKeSlider/sliderKeDb`, `meterPeratus(mul)`, `masa(ms)`.
- `lib/obs.js`: bit langganan `Transitions:16, Outputs:64, InputVolumeMeters:65536`.
- `kawalan-majlis.html`: elemen Bilik Kawalan di sekeliling `#show`; kelas `body.besar` mengawal susun atur (grid). Tetapan dalam Persediaan: "Paparan besar (Bilik Kawalan): Auto / Sentiasa / Tidak" (`majlis.besar`), "Tunjuk deretan input" (`majlis.input`).
- Pratonton: `GetSourceScreenshot` jpg — Preview/Program 640px kualiti 70 pada 10/s; input 320px kualiti 60 pada 2/s setiap satu (round-robin), satu permintaan pada satu masa.

## Pelan pelaksanaan
1. `lib/obs.js` bit langganan + `lib/bilik.js` fungsi tulen + `ujian/uji-bilik.cjs` (TDD).
2. `lib/bilik.js` UI: monitor + input + peralihan + FTB + Studio Mode; `kawalan-majlis.html` susun atur besar + tetapan. Uji hidup `ujian/uji-bilik-hidup.cjs` (OBS): input tersenarai, klik → Preview, CUT/FADE → Program, T-bar, FTB pergi/balik, gambar pratonton keluar.
3. Mixer + REC/LIVE + statistik. Uji hidup: meter bergerak bila muzik dimainkan, M membisukan dalam OBS, fader menukar dB, S menukar jenis monitor dan memulihkan, REC mula/henti, LIVE henti perlu tahan.
4. Regresi: `uji-majlis` (58), `uji-windows` (24), unit + pemasang. PASANG.html: bahagian Bilik Kawalan. Pulihkan OBS Cikgu.
