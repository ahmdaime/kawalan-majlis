# Panel Pengarah (Kawalan Majlis v2) — reka bentuk

Tarikh: 24 Nov 2026 · Mockup diluluskan Cikgu: `docs/mockup-panel-pengarah.html`

## Niat dan sebab
Cikgu Aime tidak puas hati dengan v1.2: dua dock (Anugerah, Media) jadi dua tab OBS, UI bercampur persediaan dengan kawalan majlis, warna tidak bercerita. Ketakutan utama operator semasa majlis (siaran langsung):
1. **Tersilap main lagu** (atau memotong lagu yang sedang dimainkan).
2. **Tersilap papar nama murid**: beratus penerima.

Matlamat produk kekal: mudahkan cikgu sekolah buat siaran langsung program. Percuma untuk sekolah (LESEN.txt).

## Matlamat
- Satu dock **Kawalan Majlis** menggantikan dua dock. Tiada tab.
- Majlis = satu **Aturcara** berturutan: video, lagu, slaid PDF, gambar, dan seksyen anugerah (senarai nama).
- Dua mod: **✎ Persediaan** (sambung, aturcara, Excel, fail, reka paparan) dan **▶ Majlis** (hanya kawalan).
- Warna ikut keadaan: MERAH = ke udara, KUNING = SEDIA, kelabu = selesai.
- Satu benda ke udara pada satu masa.

## Bukan matlamat
- Tukar kamera. Cikgu tukar kamera di switcher hardware; output switcher masuk OBS sebagai satu sumber (capture card). Dua orang: Cikgu di switcher, seorang cikgu lain di OBS (Panel Pengarah).
- Kawal dari telefon, templat jenama, jana sijil (Pro, kemudian).
- Plugin C++ (dock auto-lekat).
- Menukar `paparan.html` secara besar (protokol BroadcastCustomEvent kekal).

## Anti-matlamat (gagal walaupun "berfungsi")
- Klik pada senarai/carian terus keluar ke skrin.
- Space/clicker boleh memotong lagu/video yang sedang dimainkan.
- Operator perlu membuka Persediaan semasa majlis untuk kerja biasa.
- Kehilangan data v1.2 (senarai nama, kedudukan, reka bentuk, susunan media) semasa naik taraf.

## Kekangan
- OBS 28+ Custom Browser Dock, Windows + Mac, tanpa internet. `file://`, tiada pelayan.
- obs-websocket v5 (`lib/obs.js`), `paparan.html` sebagai browser source.
- Video/lagu dimainkan oleh sumber OBS `ffmpeg_source` "Kawalan Majlis - Video"; laluan fail dipilih melalui `OpenInputPropertiesDialog` (halaman web tidak dapat laluan fail). Bunyi masuk Audio Mixer OBS, maka ke dewan DAN ke siaran.
- MASEP 28 Nov 2026: v1.2 mesti kekal boleh digunakan sehingga v2 lulus ujian.

## Pendekatan
- **A (dipilih, keputusan Rex):** bina `kawalan-majlis.html` baharu bersebelahan dock lama; guna semula `lib/` (obs, dock, gaya, idb) dan `paparan.html`. Dock lama kekal dalam repo sehingga v2 lulus; pemasang tukar kepada dock baharu bila sedia. Risiko MASEP rendah.
- B: ubah dua dock sedia ada menjadi satu secara beransur. Ditolak: separuh jalan akan merosakkan v1.2 sebelum MASEP.
- C: tulis semula dari kosong termasuk paparan. Ditolak: membuang bahagian yang dah lulus 24 ujian (paparan, editor reka, pemasang).

## Reka bentuk
### Model data (localStorage `km.*` + IndexedDB untuk fail)
`aturcara: [{ id, jenis: "nama"|"lagu"|"video"|"slaid"|"gambar", tajuk, ... }]`
- `nama`: `{ anugerah, senarai: [{nama, kelas}] }` dibina dari Excel (lajur Nama/Kelas/Anugerah; sel bergabung, tajuk berulang, anugerah lalai — parser v1.2 dipindah). Satu seksyen per anugerah, ikut turutan kemunculan dalam Excel.
- `lagu`/`video`: `{ fail, tempoh }` — laluan fail disimpan dalam tetapan sumber OBS per item (seperti v1.2 video).
- `slaid`: PDF dirender ke dataURL 1920×1080 per halaman (kod v1.2).
- `gambar`: satu atau beberapa gambar (kod v1.2).
- Keadaan: `sedia {i, s}`, `udara {i, s} | null`, `dipapar: Set("i:s")`, `selesai: Set(i)`.

### Mod Majlis (ikut mockup)
- **Kotak MERAH "Ke udara sekarang"** (atas): item + nombor giliran; butang SOROK (nama/slaid/gambar) atau HENTI (lagu/video) di tempat tetap, Esc. Lagu/video: bar masa + masa berbaki. Skrin bersih = kotak putus-putus kelabu.
- **Kotak KUNING "SEDIA · belum keluar"**: jenis item; untuk nama: nombor giliran besar `46 daripada 120`, nama besar, kelas; untuk lagu/video: tajuk aturcara besar + fail + tempoh; untuk slaid: halaman `3 / 12`. Butang kuning besar: PAPAR / ♪ MAIN LAGU / ▶ MAIN VIDEO. ◀ Sebelum / Seterusnya ▶.
- **Selepas ini / Kemudian**: 2 baris kecil.
- **Carian**: nama atau nombor giliran; Enter = jadikan SEDIA sahaja (toast "Disediakan sahaja").
- **Aturcara**: senarai item; seksyen nama ada bar kemajuan `45 / 120`; item selesai dicoret; klik = jadikan SEDIA sahaja.
- **Penunjuk PREVIEW/PROGRAM** (v1.2, `refreshRoute`) dikekalkan dalam bar atas, kerana siaran langsung sering guna Studio Mode.

### Peraturan keselamatan
1. Tiada apa keluar tanpa butang kuning (atau Space/clicker yang dipetakan kepadanya).
2. Semasa lagu/video dimainkan, butang kuning **dikunci** dan Space/clicker diabaikan (toast). Berhenti hanya bila tamat atau HENTI.
3. Menekan butang kuning untuk item baharu menyorok item semasa dahulu (satu ke udara).
4. Seterusnya semasa nama dipapar = sorok nama, jadikan nama berikut SEDIA (tingkah laku v1.2 kekal).
5. Slaid: semasa slaid ke udara, Seterusnya menukar halaman terus (seperti v1.2); di halaman akhir, Seterusnya menyorok dan menyediakan item berikut.
6. Pemetaan kekunci: Space = butang kuning; → / PageDown = Seterusnya; ← / PageUp = Sebelum; Esc = SOROK/HENTI.

### Muzik Latar (keputusan Cikgu: B)
- Baris kecil sentiasa di bawah bar atas dalam mod Majlis: tajuk muzik, ▶/■, gelangsar kuat-perlahan. Bebas dari aturcara dan dari peraturan "satu ke udara": nama/slaid boleh dipapar semasa muzik latar berbunyi.
- Sumber OBS berasingan `ffmpeg_source` "Kawalan Majlis - Muzik Latar" (audio sahaja, ulang/loop), dipasang bersama paparan. Fail dipilih dalam Persediaan melalui dialog OBS (seperti video).
- Bila lagu/video aturcara dimainkan, muzik latar dikecilkan (fade) automatik dan dikembalikan selepas tamat/HENTI.
- Tiada kekunci pintas untuk Muzik Latar (elak tersilap); klik sahaja.

### Keputusan tingkah laku (dari semakan pembina)
- Nombor giliran dikira dalam setiap seksyen anugerah. Carian nama merangkumi semua seksyen; carian nombor dalam seksyen SEDIA semasa.
- Semasa lagu/video aturcara: hanya butang kuning + Space dikunci. Seterusnya/→/PageDown masih mengalih SEDIA (menyediakan tidak mengeluarkan apa-apa).
- Lagu/video tamat: disorok sendiri, item berikut jadi SEDIA (seperti v1.2). Akhir seksyen nama: Seterusnya ke item aturcara berikut. Item terakhir: berhenti.
- HENTI: fade ~0.8 s (SetInputVolume berperingkat), kemudian STOP, pulihkan kelantangan.
- Tempoh lagu/video: dibaca selepas fail dipilih dengan memuat sumber dalam keadaan tersembunyi dan senyap (GetMediaInputStatus.mediaDuration); jika gagal, papar "—" hingga main pertama.
- Muat semula dock / sambung semula OBS semasa lagu: tanya GetMediaInputStatus sumber Video; jika PLAYING, pulihkan kotak merah + kunci. Kunci juga dilepas jika status bukan PLAYING (semakan berkala 2 s semasa terkunci). HENTI sentiasa aktif.
- Persediaan tidak boleh dibuka semasa ada item ke udara (muzik latar dikecualikan).
- Naik taraf: `anugerah.rows` dipecah satu seksyen per anugerah (turutan kemunculan); `done` (indeks baris) dipetakan ke `dipapar`; `cur` menentukan SEDIA awal.
- Paparan dipasang ke scene ditanda (seperti v1.2). Kerana kamera ditukar di switcher, biasanya satu scene.

### Mod Persediaan
Langkah bertanda ✓ (ikut mockup): 1 Sambung OBS (tetapan v1.2 + pilih scene + Pasang), 2 Aturcara (tambah item: Lagu/Video/Slaid/Gambar; susun ↑↓; nama semula; buang), 3 Senarai penerima (Excel → seksyen nama dimasukkan ke aturcara), 4 Lagu dan video (semak fail + tempoh), 5 Reka paparan nama (editor v1.2 sedia ada). Butang **Mula Majlis ▶**.

### Naik taraf dari v1.2
Bila `km.aturcara` tiada: bina dari `anugerah.rows` (+ kedudukan `anugerah.cur`/`done`) dan `media.items`. Media dahulu, kemudian seksyen nama (operator susun semula). Data lama tidak dipadam.

### Pemasang
`Pasang.ps1` / `lib/pasang-mac.js`: tambah satu dock "Kawalan Majlis" (`kawalan-majlis.html?pw=&port=`); regex buang dock lama diperluas kepada `kawalan-(anugerah|media|majlis)\.html`.

### Ujian
`ujian/uji-windows.cjs` dikemas kini untuk dock baharu: semua semakan v1.2 yang berkaitan + peraturan keselamatan 1–6 (khususnya: klik senarai tidak papar; Space tidak memotong lagu; satu ke udara). Semakan mesti dibuktikan boleh merah.

## Diserahkan kepada pembina
Struktur fail dalaman, gaya CSS tepat (ikut mockup), teks bantuan, ikon.

## Keputusan Rex (boleh ditolak Cikgu)
- Pendekatan A; dock lama kekal sehingga v2 lulus.
- Butang "Dengar" (semak lagu di fon kepala) **ditangguh**: bunyi dock keluar ke peranti audio lalai, yang mungkin sistem PA dewan, jadi tidak selamat tanpa tetapan monitor OBS. Ganti dengan paparan nama fail + tempoh.
- Lagu guna sumber OBS yang sama dengan video (fail .mp3/.m4a/.wav diterima).
