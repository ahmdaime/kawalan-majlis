// Kawalan Majlis v2: unit tests for the Panel Pengarah state machine (no OBS, no browser).
//   node ujian/uji-aturcara.cjs
const assert = require("assert");
const P = require("../lib/aturcara.js");

let gagal = 0;
function ok(cond, label) { console.log((cond ? "LULUS " : "GAGAL ") + label); if (!cond) gagal++; }
function cuba(label, fn) { try { fn(); } catch (e) { ok(false, label + " (" + e.message + ")"); } }
const sama = (a, b) => { try { assert.deepStrictEqual(a, b); return true; } catch (_) { return false; } };

const namaList = (pfx, n) => Array.from({ length: n }, (_, k) => ({ nama: pfx + "-NAMA-" + k, kelas: "6 K" + k }));
const fixture = () => [
  { id: "v1", jenis: "video", tajuk: "Video pembukaan", fail: "buka.mp4", laluan: "C:/m/buka.mp4" },
  { id: "l1", jenis: "lagu", tajuk: "Lagu Negaraku", fail: "negaraku.mp3", laluan: "C:/m/negaraku.mp3" },
  { id: "s1", jenis: "slaid", tajuk: "Ucapan Guru Besar", fail: "ucapan.pdf", halaman: 3 },
  { id: "n1", jenis: "nama", tajuk: "Cemerlang", senarai: namaList("CEMERLANG", 120) },
  { id: "n2", jenis: "nama", tajuk: "Tokoh", senarai: namaList("TOKOH", 6) },
  { id: "v2", jenis: "video", tajuk: "Penutup", fail: "tutup.mp4", laluan: "C:/m/tutup.mp4" },
];
const baru = (extra) => new P(Object.assign({ aturcara: fixture() }, extra));
const jenisT = r => r.tindakan.map(a => a.t + (a.show === undefined ? "" : ":" + a.show));

cuba("kuningMemaparkanNama", () => {
  const p = baru({ sedia: { i: 3, s: 45 } });
  const r = p.kuning();
  const a = r.tindakan.find(x => x.t === "nama");
  ok(r.ok && a && a.show === true && a.nama === "CEMERLANG-NAMA-45" && a.kelas === "6 K45" && a.anugerah === "Cemerlang", "kuningMemaparkanNama: tindakan nama");
  ok(sama(p.udara, { i: 3, s: 45 }), "kuningMemaparkanNama: udara");
  ok(p.dipapar.has("3:45"), "kuningMemaparkanNama: dipapar");
  ok(sama(p.sedia, { i: 3, s: 46 }), "kuningMemaparkanNama: sedia bergerak ke nama berikut");
});

cuba("satuKeUdara", () => {
  const p = baru({ sedia: { i: 2, s: 0 } });
  p.kuning();
  p.sediakan({ i: 3, s: 0 });
  const r = p.kuning();
  ok(sama(jenisT(r), ["media:false", "nama:true"]), "satuKeUdara: slaid disorok dahulu, kemudian nama");
});

cuba("kuningDikunciSemasaMain", () => {
  const p = baru({});
  p.sediakan({ i: 1, s: 0 });
  const r1 = p.kuning();
  ok(sama(r1.tindakan.map(a => a.t), ["duck", "main"]) && r1.tindakan[0].ke === "rendah" && r1.tindakan[1].item.id === "l1", "kuningDikunciSemasaMain: duck rendah + main lagu");
  ok(p.sedangMain === true, "kuningDikunciSemasaMain: sedangMain");
  const r2 = p.kuning();
  ok(r2.ok === false && /HENTI/.test(r2.sebab || "") && r2.tindakan.length === 0, "kuningDikunciSemasaMain: tekan kedua ditolak");
  ok(sama(p.udara, { i: 1, s: 0 }), "kuningDikunciSemasaMain: lagu masih ke udara");
});

cuba("seterusnyaSemasaMainHanyaAlihSedia", () => {
  const p = baru({});
  p.sediakan({ i: 1, s: 0 }); p.kuning();
  const sebelum = JSON.stringify(p.sedia);
  const r = p.seterusnya();
  ok(r.tindakan.length === 0, "seterusnyaSemasaMain: tiada tindakan");
  ok(JSON.stringify(p.sedia) !== sebelum, "seterusnyaSemasaMain: sedia berubah");
  ok(sama(p.udara, { i: 1, s: 0 }), "seterusnyaSemasaMain: udara tidak berubah");
  const r2 = p.sebelum();
  ok(r2.tindakan.length === 0 && sama(p.udara, { i: 1, s: 0 }), "sebelumSemasaMain: tiada tindakan");
});

cuba("mainTamatSorokDanSediakan", () => {
  const p = baru({});
  p.sediakan({ i: 1, s: 0 }); p.kuning();
  const r = p.mainTamat();
  ok(p.udara === null, "mainTamat: udara null");
  ok(r.tindakan.some(a => a.t === "duck" && a.ke === "asal"), "mainTamat: duck asal");
  ok(p.selesai.has(1), "mainTamat: item selesai");
  ok(sama(p.sedia, { i: 2, s: 0 }), "mainTamat: item berikut SEDIA");
  ok(p.kuning().ok, "mainTamat: kunci dilepas");
});

cuba("hentiFade", () => {
  const p = baru({});
  p.sediakan({ i: 0, s: 0 }); p.kuning();
  const r = p.sorok();
  ok(sama(r.tindakan, [{ t: "henti" }, { t: "duck", ke: "asal" }]), "hentiFade: henti + duck asal");
  ok(p.udara === null && !p.sedangMain, "hentiFade: kunci dilepas");
});

cuba("seterusnyaSemasaNamaDipapar", () => {
  const p = baru({ sedia: { i: 3, s: 10 } });
  p.kuning();
  const r = p.seterusnya();
  ok(sama(jenisT(r), ["nama:false"]), "seterusnyaSemasaNama: sorok sahaja");
  ok(sama(p.sedia, { i: 3, s: 11 }) && p.udara === null, "seterusnyaSemasaNama: nama berikut SEDIA, tiada yang keluar");
  p.seterusnya();
  ok(sama(p.sedia, { i: 3, s: 12 }), "seterusnyaTanpaUdara: alih SEDIA");
});

cuba("slaidSeterusnyaTukarHalaman", () => {
  const p = baru({ sedia: { i: 2, s: 0 } });
  const r0 = p.kuning();
  ok(sama(jenisT(r0), ["media:true"]) && r0.tindakan[0].halaman === 0, "slaid: halaman pertama keluar");
  const r1 = p.seterusnya();
  ok(sama(jenisT(r1), ["media:true"]) && r1.tindakan[0].halaman === 1 && r1.tindakan[0].item.id === "s1", "slaid: Seterusnya tukar halaman");
  const rb = p.sebelum();
  ok(rb.tindakan[0] && rb.tindakan[0].halaman === 0, "slaid: Sebelum undur halaman");
  p.seterusnya(); p.seterusnya();
  ok(sama(p.udara, { i: 2, s: 2 }), "slaid: halaman akhir ke udara");
  const r3 = p.seterusnya();
  ok(sama(jenisT(r3), ["media:false"]) && p.udara === null, "slaid: halaman akhir + Seterusnya = sorok");
  ok(sama(p.sedia, { i: 3, s: 0 }), "slaid: item berikut SEDIA");
  ok(p.selesai.has(2), "slaid: selesai");
});

cuba("hujungSeksyen", () => {
  const p = baru({ sedia: { i: 3, s: 119 } });
  p.seterusnya();
  ok(sama(p.sedia, { i: 4, s: 0 }), "hujungSeksyen: ke seksyen berikut");
  ok(p.langkah({ i: 5, s: 0 }, 1) === null, "hujungSeksyen: langkah melepasi akhir = null");
  p.sediakan({ i: 5, s: 0 });
  p.seterusnya();
  ok(sama(p.sedia, { i: 5, s: 0 }), "hujungSeksyen: item terakhir kekal");
  ok(sama(p.langkah({ i: 4, s: 0 }, -1), { i: 3, s: 119 }), "langkah undur ke nama terakhir seksyen sebelum");
  ok(sama(p.langkah({ i: 2, s: 1 }, 1), { i: 3, s: 0 }), "langkah dari slaid ke item berikut");
});

cuba("klikTidakPapar", () => {
  const p = baru({ sedia: { i: 3, s: 0 } });
  const r = p.sediakan({ i: 4, s: 3 });
  ok(r.ok && r.tindakan.length === 0 && p.udara === null && sama(p.sedia, { i: 4, s: 3 }), "klikTidakPapar");
  ok(p.sediakan({ i: 4, s: 99 }).ok === false, "sediakan kedudukan tidak sah ditolak");
});

cuba("cari", () => {
  const p = baru({ sedia: { i: 3, s: 5 } });
  ok(sama(p.cari("tokoh-nama-2"), { i: 4, s: 2 }), "cariNama: merentas seksyen");
  ok(sama(p.cari("46"), { i: 3, s: 45 }), "cariNombor: dalam seksyen SEDIA");
  ok(p.cari("999") === null, "cariNombor: luar julat = null");
  ok(p.cari("tiada-sesiapa") === null, "cariNama: tiada = null");
  ok(sama(p.sedia, { i: 3, s: 5 }) && p.udara === null, "cari tidak mengubah keadaan");
});

cuba("pulihMain", () => {
  const p = baru({ udara: { i: 1, s: 0 } });
  ok(p.sedangMain, "pulihMain: lagu dari simpanan dianggap main");
  const r = p.pulihMain(false);
  ok(p.udara === null && !p.sedangMain && r.tindakan.some(a => a.t === "duck" && a.ke === "asal"), "pulihMain(false): kunci dilepas");
  const q = baru({});
  q.pulihMain(true, 1);
  ok(q.sedangMain && sama(q.udara, { i: 1, s: 0 }), "pulihMain(true): dikunci");
  ok(q.kuning().ok === false, "pulihMain(true): butang kuning dikunci");
});

cuba("bolehPersediaan", () => {
  const p = baru({ sedia: { i: 3, s: 0 } });
  ok(p.bolehPersediaan, "bolehPersediaan: kosong = ya");
  p.kuning();
  ok(!p.bolehPersediaan, "bolehPersediaan: nama ke udara = tidak");
  p.sorok();
  ok(p.bolehPersediaan, "bolehPersediaan: selepas sorok = ya");
});

cuba("huraikan", () => {
  const p = baru({});
  const h = p.huraikan({ i: 3, s: 45 });
  ok(h.utama === "CEMERLANG-NAMA-45" && h.giliran.no === 46 && h.giliran.daripada === 120 && h.butang === "PAPAR", "huraikan nama");
  ok(p.huraikan({ i: 1, s: 0 }).butang === "MAIN LAGU" && p.huraikan({ i: 0, s: 0 }).butang === "MAIN VIDEO", "huraikan lagu/video");
  ok(/2 \/ 3/.test(p.huraikan({ i: 2, s: 1 }).kecil), "huraikan slaid");
  ok(p.saiz(fixture()[3]) === 120 && p.saiz(fixture()[2]) === 3 && p.saiz(fixture()[0]) === 1, "saiz");
});

cuba("toJSONBulatBalik", () => {
  const p = baru({ sedia: { i: 3, s: 7 } });
  p.kuning(); p.seterusnya(); p.kuning();
  const j = p.toJSON();
  const q = new P(JSON.parse(JSON.stringify(j)));
  ok(sama(q.toJSON(), j), "toJSONBulatBalik");
  ok(Array.isArray(j.dipapar) && j.dipapar.includes("3:7"), "toJSON: Set jadi array");
});

// ---------- Task 2: Excel parser + v1.2 migration ----------
const S = require("../lib/senarai.js");
const row = (nama, anugerah, kelas = "6 A") => ({ nama, kelas, anugerah });

cuba("dariJadual", () => {
  const r = S.dariJadual([["SENARAI PENERIMA ANUGERAH AKADEMIK 2026"], ["Bil", "Nama Murid", "Kelas"], ["1", "ALI", "6 A"], ["2", "  ABU  BAKAR ", "6 B"], ["", "Nama Murid", "Kelas"]]);
  ok(r.rows.length === 2 && r.rows[1].nama === "ABU BAKAR" && r.rows[1].kelas === "6 B", "dariJadual: tajuk di baris 2, ruang dikemas, tajuk berulang dibuang");
  ok(r.noAward === true && r.suggest === "ANUGERAH AKADEMIK", "dariJadual: cadangan anugerah dari baris tajuk");
});

cuba("seksyenIkutAnugerah", () => {
  const secs = P.seksyenDariRows([row("A1", "A"), row("A2", "A"), row("B1", "B"), row("A3", "A"), row("X", "")], "");
  ok(secs.map(s => s.tajuk + ":" + s.senarai.length).join(",") === "A:3,B:1,Anugerah:1", "seksyenIkutAnugerah: turutan kemunculan");
  ok(secs.every(s => s.jenis === "nama" && s.id), "seksyenIkutAnugerah: item nama ada id");
  ok(P.seksyenDariRows([row("X", "")], "Akademik")[0].tajuk === "Akademik", "seksyenIkutAnugerah: anugerah lalai");
});

cuba("naikTarafV12", () => {
  const mediaItems = [{ id: "m1", kind: "pdf", label: "ucapan.pdf", count: 4 }, { id: "m2", kind: "vid", label: "buka.mp4", path: "C:\\m\\buka.mp4", count: 1 }];
  const rows = [row("R0", "A"), row("R1", "A"), row("R2", "A"), row("R3", "A")];
  const st = P.naikTaraf({ mediaItems, rows, defAward: "", cur: 2, done: [0, 1] });
  ok(st.aturcara.length === 3 && st.aturcara[0].jenis === "slaid" && st.aturcara[0].halaman === 4 && st.aturcara[0].id === "m1", "naikTarafV12: PDF jadi slaid");
  ok(st.aturcara[1].jenis === "video" && st.aturcara[1].laluan === "C:\\m\\buka.mp4" && st.aturcara[1].fail === "buka.mp4", "naikTarafV12: video kekal laluan");
  ok(st.dipapar.includes("2:0") && st.dipapar.includes("2:1") && st.dipapar.length === 2, "naikTarafV12: tanda dipapar");
  ok(sama(st.sedia, { i: 2, s: 2 }), "naikTarafV12: kedudukan SEDIA");
  const p = new P(st);
  ok(p.huraikan(p.sedia).utama === "R2", "naikTarafV12: boleh dimuat Pengarah");
  ok(P.naikTaraf({ mediaItems: [], rows: [], cur: 0, done: [] }).aturcara.length === 0, "naikTarafV12: kosong");
  const img = P.naikTaraf({ mediaItems: [{ id: "g", kind: "img", label: "3 gambar", count: 3 }], rows: [] });
  ok(img.aturcara[0].jenis === "gambar" && img.aturcara[0].halaman === 3, "naikTarafV12: gambar");
});

cuba("muatSemulaKekalTanda", () => {
  const p = baru({ sedia: { i: 4, s: 1 } });
  p.sediakan({ i: 3, s: 0 }); p.kuning(); p.sorok();
  p.sediakan({ i: 4, s: 2 }); p.kuning(); p.sorok();
  p.sediakan({ i: 0, s: 0 }); p.kuning(); p.sorok();   // a video: its mark must survive too
  p.sediakan({ i: 4, s: 3 });
  // Corrected Excel: one CEMERLANG name fixed, order of awards the same.
  const rowsBaru = [];
  fixture()[3].senarai.forEach((r, k) => rowsBaru.push(row(k === 5 ? "CEMERLANG-NAMA-5 (BETUL)" : r.nama, "Cemerlang")));
  fixture()[4].senarai.forEach(r => rowsBaru.push(row(r.nama, "Tokoh")));
  const st = P.gabungSenarai(p.toJSON(), rowsBaru, "");
  ok(st.aturcara.length === 6 && st.aturcara[3].tajuk === "Cemerlang" && st.aturcara[5].jenis === "video", "muatSemula: susunan aturcara kekal");
  ok(st.aturcara[3].senarai[5].nama === "CEMERLANG-NAMA-5 (BETUL)", "muatSemula: nama dibetulkan");
  ok(st.dipapar.includes("3:0") && st.dipapar.includes("4:2") && st.dipapar.includes("0:0"), "muatSemulaKekalTanda: tanda kekal");
  ok(sama(st.sedia, { i: 4, s: 3 }), "muatSemula: SEDIA kekal ikut nama");
  ok(st.aturcara[3].id === "n1", "muatSemula: id seksyen kekal");
  // A new award appears; Tokoh dropped.
  const st2 = P.gabungSenarai(p.toJSON(), [row("BARU-1", "Sukan"), row("CEMERLANG-NAMA-0", "Cemerlang")], "");
  ok(st2.aturcara.filter(x => x.jenis === "nama").map(x => x.tajuk).join(",") === "Cemerlang,Sukan", "muatSemula: seksyen sedia ada kekal di tempatnya, anugerah baharu selepasnya");
  ok(st2.dipapar.includes(st2.aturcara.findIndex(x => x.tajuk === "Cemerlang") + ":0"), "muatSemula: tanda ikut nama dalam seksyen baharu");
  ok(new P(st2).sah(st2.sedia), "muatSemula: SEDIA sah walaupun seksyennya hilang");
});

// ---------- Final review fixes ----------
cuba("namaBerulangTidakMelompat", () => {
  const senarai = Array.from({ length: 60 }, (_, k) => ({ nama: k === 11 || k === 51 ? "MUHAMMAD ADAM" : "MURID " + k, kelas: k === 11 ? "6 A" : "6 B" }));
  const st = { aturcara: [{ id: "s", jenis: "nama", tajuk: "A", senarai }], sedia: { i: 0, s: 51 }, dipapar: Array.from({ length: 51 }, (_, k) => "0:" + k) };
  const r = P.petaSemula(st, st.aturcara.slice());
  ok(sama(r.sedia, { i: 0, s: 51 }), "nama berulang: SEDIA kekal di #52, tidak lompat ke #12", JSON.stringify(r.sedia));
  ok(r.dipapar.length === 51, "nama berulang: tanda dipapar tidak hilang", String(r.dipapar.length));
  // Same name and class twice (listed twice): the second occurrence stays the second.
  const dua = [{ nama: "ALI", kelas: "6 A" }, { nama: "ABU", kelas: "6 A" }, { nama: "ALI", kelas: "6 A" }];
  const st2 = { aturcara: [{ id: "s", jenis: "nama", tajuk: "A", senarai: dua }], sedia: { i: 0, s: 2 }, dipapar: ["0:0", "0:1"] };
  const baruDua = [{ id: "s", jenis: "nama", tajuk: "A", senarai: [{ nama: "ALI", kelas: "6 A" }, { nama: "ABU BAKAR", kelas: "6 A" }, { nama: "ALI", kelas: "6 A" }] }];
  const r2 = P.petaSemula(st2, baruDua);
  ok(sama(r2.sedia, { i: 0, s: 2 }) && !r2.dipapar.includes("0:2"), "nama sama + kelas sama dua kali: kedudukan ke-2 kekal ke-2", JSON.stringify(r2));
});

cuba("muatSemulaKekalSusunan", () => {
  const st = new P({ aturcara: [
    { id: "l1", jenis: "lagu", tajuk: "Negaraku", fail: "n.mp3", laluan: "n.mp3" },
    { id: "a", jenis: "nama", tajuk: "Akademik", anugerah: "Akademik", senarai: [{ nama: "X1", kelas: "" }, { nama: "MURID 3", kelas: "6 A" }] },
    { id: "l2", jenis: "lagu", tajuk: "Persembahan", fail: "p.mp3", laluan: "p.mp3" },
    { id: "b", jenis: "nama", tajuk: "Anugerah Sukan (Lelaki)", anugerah: "Sukan", senarai: [{ nama: "MURID 3", kelas: "6 A" }, { nama: "Y2", kelas: "" }] },
  ], dipapar: ["1:1"] }).toJSON();
  const rows = [row("X1", "Akademik"), row("Y2", "Sukan"), row("MURID 3", "Sukan", "6 A"), row("BARU", "Kokurikulum")];
  const r = P.gabungSenarai(st, rows, "");
  ok(r.aturcara.map(x => x.id).slice(0, 4).join(",") === "l1,a,l2,b" && r.aturcara[4].tajuk === "Kokurikulum", "muat semula: lagu antara seksyen kekal di tempatnya; seksyen baharu di hujung", r.aturcara.map(x => x.tajuk).join(" > "));
  ok(r.aturcara[3].tajuk === "Anugerah Sukan (Lelaki)", "muat semula: tajuk yang dinamakan semula dikekalkan");
  ok(!r.dipapar.length, "tanda tidak berpindah ke anugerah lain (MURID 3 dalam Sukan belum dipapar)", JSON.stringify(r.dipapar));
});

console.log(gagal ? `\n${gagal} GAGAL` : "\nSemua LULUS");
process.exit(gagal ? 1 : 0);
