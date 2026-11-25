# Kawalan Majlis

Panel untuk menyiarkan dan merakam **majlis sekolah** dengan OBS: nama penerima anugerah, lagu, video,
slaid (PDF dan Canva), muzik latar, kamera. Dibina oleh seorang guru untuk guru, berbahasa Melayu,
berfungsi tanpa internet (kecuali slaid Canva).

**Dua cara menggunakannya:**

1. **Kawalan Majlis Studio** (disyorkan, Windows): aplikasi lengkap yang dibina atas OBS Studio, dengan
   Bilik Kawalan gaya studio TV (Preview/Program, CUT/FADE/T-bar, input kamera, audio) dan panel ini di sebelah.
   Muat turun di [kawalan-majlis-studio → Releases](https://github.com/ahmdaime/kawalan-majlis-studio/releases).
2. **Panel untuk OBS Studio biasa** (Windows dan Mac): muat turun repo ini (Code → Download ZIP), kemudian ikut
   `PASANG.html`.

**Ciri utama:** senarai penerima dari Excel (Nama, Kelas, Anugerah) · butang kuning PAPAR satu-satunya cara ke udara ·
aturcara berturutan (nama, lagu, video, slaid PDF, gambar) · slaid Canva dengan animasi (butang ◀ ▶ dan clicker) ·
muzik latar yang mengecil sendiri bila lagu dimainkan · pereka paparan nama (termasuk templat "Kad hijau emas") ·
lagu MP3 hanya berbunyi (gambar kulit album tidak dipapar).

**Mahu membantu?** Uji di sekolah anda dan laporkan masalah atau cadangan di tab **Issues**
(sertakan gambar skrin). Pembaikan kod: hantar **Pull Request**. Semua sumbangan kekal di bawah lesen GPL.

---

## Untuk pembangun

Panel (Custom Browser Dock) OBS Studio 28+ untuk majlis sekolah, Windows dan Mac, tanpa internet. Versi 2.0.

- `kawalan-majlis.html` (Panel Pengarah, v2): satu panel, satu **Aturcara** berturutan (seksyen nama anugerah, lagu, video, slaid PDF, gambar) + saluran **Muzik Latar**. Mod **✎ Persediaan** (sambung, senarai penerima, aturcara, muzik latar, reka paparan) dan **▶ Majlis** (kotak MERAH = ke udara, KUNING = SEDIA; butang kuning satu-satunya cara keluar; dikunci semasa lagu). Data v1.2 dibawa masuk sendiri (`Pengarah.naikTaraf`).
- **Bilik Kawalan** (`lib/bilik.js`): paparan besar panel yang sama (lebar ≥ 1000 px atau tetapan Sentiasa): Preview/Program dari `GetSourceScreenshot` (10/s), deretan input = scene OBS (2/s), CUT/FADE/T-bar (FADE bila dilepas melepasi separuh: OBS 32 abaikan `SetTBarPosition`), FTB (scene `Kawalan Majlis - Hitam`), mixer (InputVolumeMeters), REC/LIVE (henti LIVE = tahan 2 s), bingkai tercicir. Mockup `docs/mockup-bilik-kawalan.html`, reka bentuk `docs/superpowers/specs/2026-11-24-bilik-kawalan-design.md`.
- `lib/aturcara.js`: mesin keadaan tulen `KM.Pengarah` (tiada DOM/OBS). Setiap arahan pulangkan `{ok, sebab, tindakan}`; semua peraturan keselamatan diuji di Node.
- `lib/senarai.js`: pembaca Excel/CSV (Nama, Kelas, Anugerah; sel bergabung, tajuk berulang, anugerah lalai).
- `lib/dek.js`: slaid PDF dan gambar (IndexedDB `media:<id>`), dirender 1920 × 1080. `lib/reka.js`: editor "Reka paparan nama" (`lib/gaya.js`, dikongsi dengan paparan).
- `lib/dock.js`: bar sambungan, pasang paparan + sumber Video + Muzik Latar ke scene ditanda, `mainFail` (fail hilang dikesan: OBS lapor PLAYING tanpa tempoh), `pudar`, `pilihFail` (dialog OBS), `statusMain`.
- `paparan.html`: browser source yang dipasang ke scene ditanda. Panel menunjukkan sama ada paparan keluar ke Preview atau Program.
- `kawalan-anugerah.html`, `kawalan-media.html`: panel v1.2, dikekalkan sebagai sandaran sehingga v2 lulus majlis sebenar (MASEP). Pemasang v2 tidak lagi menambahnya.
- `Pasang.bat` (+ `Pasang.ps1`) / `Pasang.command` (+ `lib/pasang-mac.js`): pemasang. Hidupkan WebSocket, tambah dock **Kawalan Majlis** dengan kata laluan dalam URL (`?pw=&port=`), buang dock Kawalan Majlis lama (v1.2/v2), sandar tetapan (`-asal` + bertarikh), kekalkan dock lain, tidak sentuh `DockState`. OBS mesti ditutup.
- `PASANG.html`: panduan pemasangan dan penggunaan untuk guru (termasuk nota siaran langsung).

Panel dan paparan berhubung melalui obs-websocket (`BroadcastCustomEvent`).

## Ujian
Tanpa OBS:

    node ujian/uji-aturcara.cjs          # mesin keadaan + parser + naik taraf
    node ujian/uji-bilik.cjs             # fungsi tulen Bilik Kawalan
    node ujian/uji-pasang-mac.cjs        # logik pemasang Mac (jambatan ObjC palsu)
    node ujian/uji-dek-reka.cjs [laluan-playwright]   # dek + editor dalam Chromium headless

Dalam OBS sebenar: lancar OBS dengan `--remote-debugging-port=9223` dan WebSocket hidup, dock Kawalan Majlis (dan dock v1.2 untuk `uji-windows`) dipasang, kemudian:

    node ujian/uji-majlis.cjs <kata-laluan-websocket>    # Panel Pengarah (v2)
    node ujian/uji-windows.cjs <kata-laluan-websocket>   # panel v1.2
    node ujian/uji-bilik-hidup.cjs <kata-laluan-websocket>  # Bilik Kawalan

Skrip bercakap CDP mentah dengan setiap page (`ujian/cdp.cjs`), tanpa kebergantungan. OBS 32 Windows menolak Playwright `connectOverCDP`. Jangan ubah saiz viewport dock: saiz itu melekat dalam OBS. Dialog fail OBS (+ Lagu, + Video, Muzik Latar) dan clicker perlu diuji tangan. Uji `Pasang.command` sebenar di Mac sebelum diedar.

## Lesen
Perisian bebas di bawah GNU GPL versi 2 atau kemudian (GPL-2.0-or-later). Lihat `LESEN.txt` dan `COPYING`.
