// Kawalan Majlis v2: live checks for the Panel Pengarah inside real OBS (raw CDP, see cdp.cjs).
// Launch OBS with --remote-debugging-port=9223 and WebSocket on, then:
//   node ujian/uji-majlis.cjs <websocket-password>
// Never change a dock's viewport size: it sticks inside the OBS dock.
const path = require("path"), fs = require("fs"), os = require("os");
const { minimalPdf, obsSocket, tab, ok, sleep, until, hasil } = require("./cdp.cjs");
const PW = process.argv[2];
const ROOT = path.resolve(__dirname, "..");
const VIDEO = "Kawalan Majlis - Video", MUZIK = "Kawalan Majlis - Muzik Latar", PAPARAN = "Kawalan Majlis - Paparan";

// A short WAV tone (mono 16-bit), so a "song" can play without any real music file.
function wav(file, seconds, freq = 440) {
  const rate = 22050, n = Math.round(rate * seconds), buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freq * i / rate) * 8000), 44 + i * 2);
  fs.writeFileSync(file, buf);
  return file;
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "km2-"));
  const ows = await obsSocket(PW);

  // ---------- v2 helpers in lib/dock.js (Task 3) ----------
  const dok = await until(() => tab(/kawalan-majlis\.html/), 4000) || await until(() => tab(/kawalan-anugerah\.html/));
  ok(!!dok, "dock dengan lib/dock.js dimuat");
  if (!dok) process.exit(1);
  await dok.reload();   // pick up the current lib/*.js
  await sleep(2000);   // let the docks settle before changing scene items (see dock.js "jeda")
  // A separate client inside the dock page, so the checks do not depend on the dock's own UI.
  const sedia = await dok.evaluate(async pw => {
    window.__t = new KM.OBSClient({ events: KM.SUB.General | KM.SUB.Inputs | KM.SUB.MediaInputs });
    __t.connect({ port: 4455, password: pw, retry: false });
    for (let i = 0; i < 40 && __t.state !== "connected"; i++) await new Promise(r => setTimeout(r, 100));
    if (__t.state !== "connected") return "tidak bersambung";
    await KM.dock.installOverlay(__t, 4455, pw, ["Ujian"]);
    return "ok";
  }, PW);
  ok(sedia === "ok", "installOverlay dari halaman dock", sedia);
  const { inputs } = await ows.call("GetInputList");
  const nama = inputs.map(i => i.inputName);
  ok([PAPARAN, VIDEO, MUZIK].every(n => nama.includes(n)), "tiga sumber dipasang (Paparan, Video, Muzik Latar)", nama.join(", "));
  const mz = MUZIK in Object.fromEntries(nama.map(n => [n, 1])) && (await ows.call("GetInputSettings", { inputName: MUZIK })).inputSettings;
  ok(mz && mz.looping === true && mz.close_when_inactive === false, "Muzik Latar diulang (loop) dan tidak ditutup", JSON.stringify(mz));

  await ows.call("SetInputVolume", { inputName: MUZIK, inputVolumeMul: 1 });
  const t0 = Date.now();
  await dok.evaluate(n => KM.dock.pudar(__t, n, 0, 800), MUZIK);
  const ms = Date.now() - t0;
  const vol = (await ows.call("GetInputVolume", { inputName: MUZIK })).inputVolumeMul;
  ok(vol < 0.01 && ms >= 600, "pudar ke 0 secara berperingkat", `vol=${vol} dalam ${ms} ms`);
  await dok.evaluate(n => KM.dock.pudar(__t, n, 1, 100), MUZIK);

  const silap = await dok.evaluate(() => KM.dock.mainFail(__t, "C:\\tiada\\x.mp3").then(() => "tiada ralat", e => e.message));
  ok(/Fail tidak dijumpai: x\.mp3/.test(silap), "mainFail: fail hilang beri ralat jelas", silap);
  await dok.evaluate(() => KM.dock.setVideoVisible(__t, false));

  const lagu = wav(path.join(tmp, "lagu ujian.wav"), 3);
  const main = await dok.evaluate(p => KM.dock.mainFail(__t, p).then(() => "ok", e => e.message), lagu);
  const st = await dok.evaluate(() => KM.dock.statusMain(__t));
  ok(main === "ok" && st.playing && /lagu ujian\.wav$/.test(st.laluan), "mainFail + statusMain: lagu dimainkan", main + " " + JSON.stringify(st));
  await until(async () => !(await dok.evaluate(() => KM.dock.statusMain(__t))).playing, 6000);
  const st2 = await dok.evaluate(() => KM.dock.statusMain(__t));
  ok(!st2.playing, "statusMain: tamat selepas lagu habis", JSON.stringify(st2));
  await dok.evaluate(() => KM.dock.setVideoVisible(__t, false));

  if (process.argv.includes("--helpers")) return selesai();

  // ---------- Majlis mode (Task 5) ----------
  const m = await until(() => tab(/kawalan-majlis\.html/));
  ok(!!m, "dock Kawalan Majlis dimuat");
  if (!m) return selesai();
  const pap = await until(() => tab(/paparan\.html/), 10000);
  ok(!!pap, "paparan.html hidup");
  // Fresh start: the dock adopts the password from its URL (as after Pasang.bat).
  await m.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("km.")) localStorage.removeItem(k); });
  await m.reload();
  const sambung = await until(() => m.evaluate(() => document.getElementById("kmConn").classList.contains("ok") ? 1 : null), 10000);
  ok(!!sambung, "Kawalan Majlis bersambung sendiri (kata laluan dari URL)");
  const P = () => m.evaluate(() => __majlis.p().toJSON());
  const key = k => m.evaluate(k => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, code: k === " " ? "Space" : k, bubbles: true, cancelable: true })), k);
  const namaDiPaparan = () => pap.evaluate(() => document.getElementById("nameWrap").classList.contains("show") ? document.getElementById("nameWrap").innerText.replace(/\s+/g, " ").trim() : "");
  const toast = () => m.evaluate(() => document.getElementById("toast").textContent);

  // Excel → name sections in the Aturcara (Persediaan step 3).
  await m.click("#mSetup");
  await m.setInputFiles("#failSenarai", path.join(ROOT, "contoh-senarai.xlsx"));
  const contoh = await until(async () => { const s = await P(); const n = s.aturcara.filter(x => x.jenis === "nama"); return n.length ? n : null; });
  ok(contoh && contoh.length >= 1, "Excel contoh → seksyen nama dalam aturcara", contoh && contoh.map(x => x.tajuk + ":" + x.senarai.length).join(" | "));
  // A bigger list of our own: two awards, 5 + 3 names.
  const csv = path.join(tmp, "senarai ujian.csv");
  fs.writeFileSync(csv, "Nama,Kelas,Anugerah\n" + [1, 2, 3, 4, 5].map(k => `MURID A${k},6 A,Anugerah Ujian A`).join("\n") + "\n" + [1, 2, 3].map(k => `MURID B${k},5 B,Anugerah Ujian B`).join("\n") + "\n");
  await m.setInputFiles("#failSenarai", csv);
  const sek = await until(async () => { const s = await P(); const n = s.aturcara.filter(x => x.jenis === "nama"); return n.length === 2 && n[0].senarai.length === 5 ? n : null; });
  ok(!!sek, "CSV → 2 seksyen (5 + 3 nama), seksyen lama diganti", sek && sek.map(x => x.tajuk + ":" + x.senarai.length).join(" | "));
  if (!sek) return selesai();
  await m.click("#mShow");

  // Click a section row → SEDIA only, nothing on screen.
  const iSek = (await P()).aturcara.findIndex(x => x.jenis === "nama");
  await m.evaluate(i => document.querySelector(`#run [data-i="${i}"]`).click(), iSek);
  await sleep(300);
  ok(/Disediakan sahaja|sudah SEDIA/.test(await toast()), "toast: SEDIA sahaja", await toast());
  // Move away, then click name 1 in the names box: it must become SEDIA without going on air.
  await key("ArrowRight");
  const dipilih = await m.evaluate(() => { const el = document.querySelector("#run .nm:not(.cued)"); if (!el) return null; el.click(); return { i: +el.dataset.i, s: +el.dataset.s }; });
  await sleep(500);
  const st0 = await P();
  ok(dipilih && (await namaDiPaparan()) === "" && st0.sedia.i === dipilih.i && st0.sedia.s === dipilih.s && !st0.udara, "klik nama dalam senarai TIDAK memapar (SEDIA sahaja)", JSON.stringify(dipilih));
  // Back to name 1 of the first section (name row if visible, else the section row).
  await m.evaluate(i => (document.querySelector(`#run .nm[data-i="${i}"][data-s="0"]`) || document.querySelector(`#run .item[data-i="${i}"]`)).click(), iSek);
  await sleep(300);
  const giliran = await m.evaluate(() => document.getElementById("cueBody").innerText.replace(/\s+/g, " "));
  ok(new RegExp("1 daripada " + sek[0].senarai.length).test(giliran), "kotak kuning: nombor giliran", giliran.slice(0, 80));
  const nama1 = sek[0].senarai[0].nama;
  ok(giliran.includes(nama1), "kotak kuning: nama SEDIA ditunjuk besar", nama1);

  // Space → the SEDIA name goes on air.
  await key(" ");
  const keluar = await until(async () => { const t = await namaDiPaparan(); return t.includes(nama1) ? t : null; }, 5000);
  ok(!!keluar, "Space memapar nama SEDIA", keluar);
  const merah = await m.evaluate(() => document.getElementById("air").className + " | " + document.getElementById("air").innerText.replace(/\s+/g, " "));
  ok(!/clean/.test(merah) && merah.includes(nama1), "kotak merah: nama ke udara", merah.slice(0, 90));

  // A song in the Aturcara (the OBS file dialog is replaced by a test hook).
  const lagu2 = wav(path.join(tmp, "lagu majlis.wav"), 6);
  const iLagu = await m.evaluate(p => __majlis.tambah({ jenis: "lagu", tajuk: "Lagu Ujian", laluan: p, fail: "lagu majlis.wav" }, 0), lagu2);
  await m.evaluate(i => document.querySelector(`#run [data-i="${i}"]`).click(), iLagu);
  ok(/Disediakan sahaja/.test(await toast()), "toast: disediakan sahaja (klik lagu)", await toast());
  const butang = await m.evaluate(() => document.getElementById("go").innerText);
  ok(/MAIN LAGU/.test(butang), "butang kuning bertukar: MAIN LAGU", butang);
  await key(" ");
  const main1 = await until(async () => { const s = await ows.call("GetMediaInputStatus", { inputName: VIDEO }); return s.mediaState === "OBS_MEDIA_STATE_PLAYING" && s.mediaDuration > 0 ? s : null; }, 6000);
  ok(!!main1, "Space memainkan lagu");
  ok(await until(async () => (await namaDiPaparan()) === "" ? 1 : null, 3000), "satu ke udara: nama disorok bila lagu bermula");
  const kursor1 = main1 && main1.mediaCursor;
  await sleep(1200);
  await key(" ");
  await sleep(600);
  const s2 = await ows.call("GetMediaInputStatus", { inputName: VIDEO });
  const f2 = (await ows.call("GetInputSettings", { inputName: VIDEO })).inputSettings.local_file;
  ok(s2.mediaState === "OBS_MEDIA_STATE_PLAYING" && s2.mediaCursor > kursor1 + 800 && /lagu majlis\.wav$/.test(f2), "Space kedua TIDAK memotong/mengulang lagu", `kursor ${kursor1} → ${s2.mediaCursor}`);
  ok(/HENTI/.test(await toast()), "toast: tekan HENTI dahulu", await toast());
  ok(await m.evaluate(() => document.getElementById("go").disabled), "butang kuning dikunci semasa lagu");

  const sediaSebelum = JSON.stringify((await P()).sedia);
  await key("PageDown");
  await sleep(300);
  const sediaSelepas = JSON.stringify((await P()).sedia);
  const s3 = await ows.call("GetMediaInputStatus", { inputName: VIDEO });
  ok(sediaSelepas !== sediaSebelum && s3.mediaState === "OBS_MEDIA_STATE_PLAYING" && (await namaDiPaparan()) === "", "PageDown semasa lagu: SEDIA beralih, skrin tidak berubah", sediaSebelum + " → " + sediaSelepas);

  // Dock reload mid-song: red box + lock come back from OBS.
  await m.reload();
  const pulih = await until(() => m.evaluate(() => {
    const a = document.getElementById("air"); return !a.classList.contains("clean") && /Lagu Ujian/.test(a.innerText) && document.getElementById("go").disabled ? a.innerText.replace(/\s+/g, " ") : null;
  }), 8000);
  ok(!!pulih, "muat semula dock semasa lagu: kotak merah + kunci dipulihkan", pulih);

  // Esc = HENTI with a fade.
  await key("Escape"); await key("Escape");   // a song needs Esc twice
  const henti = await until(async () => { const s = await ows.call("GetMediaInputStatus", { inputName: VIDEO }); return s.mediaState !== "OBS_MEDIA_STATE_PLAYING" ? s.mediaState : null; }, 2500);
  ok(!!henti, "Esc = HENTI dalam 2 s", henti);
  ok(await until(() => m.evaluate(() => !document.getElementById("go").disabled && document.getElementById("air").classList.contains("clean") ? 1 : null), 3000), "selepas HENTI: kunci dilepas, skrin bersih");
  const volV = (await ows.call("GetInputVolume", { inputName: VIDEO })).inputVolumeMul;
  ok(volV > 0.95, "kelantangan video dipulihkan selepas fade", String(volV));

  // A file moved after it was added: a clear error, not silence.
  const iHilang = await m.evaluate(() => __majlis.tambah({ jenis: "lagu", tajuk: "Lagu Hilang", laluan: "C:\\tiada\\hilang.mp3", fail: "hilang.mp3" }, 0));
  await m.evaluate(i => document.querySelector(`#run [data-i="${i}"]`).click(), iHilang);
  await key(" ");
  const ralat = await until(() => m.evaluate(() => { const t = document.getElementById("air").innerText; return /Fail tidak dijumpai/.test(t) ? t.replace(/\s+/g, " ") : null; }), 6000);
  ok(!!ralat, "fail hilang: ralat jelas dalam kotak merah", ralat);
  ok(await m.evaluate(() => !document.getElementById("go").disabled), "fail hilang: butang kuning tidak terkunci");

  // A song that ends by itself: hidden, next item SEDIA.
  const pendek = wav(path.join(tmp, "pendek.wav"), 2);
  const iPendek = await m.evaluate(p => __majlis.tambah({ jenis: "lagu", tajuk: "Lagu Pendek", laluan: p, fail: "pendek.wav" }, 0), pendek);
  await m.evaluate(i => document.querySelector(`#run [data-i="${i}"]`).click(), iPendek);
  await key(" ");
  const tamat = await until(() => m.evaluate(() => document.getElementById("air").classList.contains("clean") && !document.getElementById("go").disabled ? 1 : null), 8000);
  const st5 = await P();
  ok(!!tamat && st5.selesai.includes(iPendek) && st5.sedia.i === iPendek + 1, "lagu tamat sendiri: disorok, item berikut SEDIA", JSON.stringify(st5.sedia));

  // 320 names stay responsive.
  const t320 = await m.evaluate(() => {
    const senarai = Array.from({ length: 320 }, (_, k) => ({ nama: "MURID UJIAN " + k, kelas: "6 A" }));
    const i = __majlis.tambah({ jenis: "nama", tajuk: "Besar", senarai }, 0);
    const t = performance.now(); document.querySelector(`#run [data-i="${i}"]`).click(); return performance.now() - t;
  });
  ok(t320 < 150, "320 nama: render pantas", Math.round(t320) + " ms");
  await m.fill("#q", "murid ujian 300");
  const hasil1 = await m.evaluate(() => document.getElementById("hasil").innerText);
  ok(/MURID UJIAN 300/.test(hasil1), "carian nama merentas seksyen", hasil1.slice(0, 60));
  await m.evaluate(() => document.getElementById("q").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  await sleep(300);
  ok((await namaDiPaparan()) === "" && (await m.evaluate(() => __majlis.p().huraikan(__majlis.p().sedia).utama)) === "MURID UJIAN 300", "Enter dalam carian = SEDIA sahaja");

  // ---------- Persediaan + Muzik Latar (Task 6) ----------
  // Persediaan is blocked while something is on air.
  await m.evaluate(i => document.querySelector(`#run .item[data-i="${i}"]`).click(), (await P()).aturcara.findIndex(x => x.tajuk === "Anugerah Ujian B"));
  await key(" ");
  await until(async () => (await namaDiPaparan()) ? 1 : null, 4000);
  ok(await m.evaluate(() => document.getElementById("mSetup").disabled), "Persediaan dikunci semasa nama ke udara");
  await key("Escape");
  await until(async () => (await namaDiPaparan()) === "" ? 1 : null, 4000);
  ok(await m.evaluate(() => !document.getElementById("mSetup").disabled), "Persediaan dibuka semula selepas SOROK");
  await m.click("#mSetup");

  // Add a 2-page PDF.
  const pdf2 = path.join(tmp, "slaid ujian.pdf");
  fs.writeFileSync(pdf2, minimalPdf(["Halaman Satu", "Halaman Dua"]));
  const n0 = (await P()).aturcara.length;
  await m.setInputFiles("#failPdf", pdf2);
  const slaid = await until(async () => { const s = await P(); return s.aturcara.length > n0 ? s.aturcara[s.aturcara.length - 1] : null; }, 10000);
  ok(slaid && slaid.jenis === "slaid" && slaid.halaman === 2, "Persediaan: + Slaid PDF (2 halaman)", JSON.stringify(slaid));
  const baris = await m.evaluate(() => document.getElementById("susun").innerText);
  ok(/slaid ujian\.pdf/.test(baris) && /2 halaman/.test(baris), "Persediaan: slaid tersenarai dengan bilangan halaman");

  // Reorder: ↑ on the last item.
  const sebelumNaik = (await P()).aturcara.map(x => x.id);
  await m.evaluate(() => { const r = [...document.querySelectorAll("#susun [data-a=up]")].pop(); r.click(); });
  const selepasNaik = (await P()).aturcara.map(x => x.id);
  ok(selepasNaik[selepasNaik.length - 2] === sebelumNaik[sebelumNaik.length - 1], "Persediaan: ↑ menyusun semula aturcara");

  // Rename an item inline.
  await m.evaluate(id => { document.querySelector(`#susun [data-id="${id}"] [data-a=ren]`).click(); }, slaid.id);
  await m.evaluate(id => { const inp = document.querySelector(`#susun [data-id="${id}"] input`); inp.value = "Slaid Ucapan Guru Besar"; inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); }, slaid.id);
  ok((await P()).aturcara.find(x => x.id === slaid.id).tajuk === "Slaid Ucapan Guru Besar", "Persediaan: nama semula item");

  // Delete needs two presses.
  await m.evaluate(id => document.querySelector(`#susun [data-id="${id}"] [data-a=del]`).click(), slaid.id);
  ok((await P()).aturcara.some(x => x.id === slaid.id), "Persediaan: ✕ sekali tidak membuang");
  await m.evaluate(id => document.querySelector(`#susun [data-id="${id}"] [data-a=del]`).click(), slaid.id);
  ok(!(await P()).aturcara.some(x => x.id === slaid.id), "Persediaan: ✕ dua kali membuang");

  // Muzik Latar: the OBS file dialog is stood in for by setting the source file directly.
  const latar = wav(path.join(tmp, "muzik latar.wav"), 30, 330);
  await ows.call("SetInputSettings", { inputName: MUZIK, inputSettings: { local_file: latar } });
  const muzikNama = await until(() => m.evaluate(() => /muzik latar\.wav/.test(document.getElementById("stMuzik").innerText) ? 1 : null), 4000);
  ok(!!muzikNama, "Persediaan: fail Muzik Latar dikesan");
  await m.click("#mShow");
  await m.click("#muzikMain");
  const mz1 = await until(async () => { const s = await ows.call("GetMediaInputStatus", { inputName: MUZIK }); return s.mediaState === "OBS_MEDIA_STATE_PLAYING" ? s : null; }, 4000);
  ok(!!mz1, "Muzik Latar ▶ dimainkan");
  const volAsal = (await ows.call("GetInputVolume", { inputName: MUZIK })).inputVolumeMul;
  const lagu3 = wav(path.join(tmp, "lagu duck.wav"), 8);
  const iL3 = await m.evaluate(p => __majlis.tambah({ jenis: "lagu", tajuk: "Lagu Duck", laluan: p, fail: "lagu duck.wav" }, 0), lagu3);
  await m.evaluate(i => document.querySelector(`#run .item[data-i="${i}"]`).click(), iL3);
  await key(" ");
  const rendah = await until(async () => { const v = (await ows.call("GetInputVolume", { inputName: MUZIK })).inputVolumeMul; return v < 0.2 ? v : null; }, 4000);
  ok(rendah !== null && volAsal > 0.4, "lagu bermula: Muzik Latar dikecilkan", `${volAsal} → ${rendah}`);
  const mula = await until(async () => { const s = await ows.call("GetMediaInputStatus", { inputName: VIDEO }); return s.mediaDuration > 0 && s.mediaState === "OBS_MEDIA_STATE_PLAYING" ? s : null; }, 4000);
  ok(!!mula && mula.mediaCursor < 2500, "lagu bermula tanpa menunggu fade muzik latar", mula && String(mula.mediaCursor));
  await key("Escape"); await key("Escape");
  const pulihVol = await until(async () => { const v = (await ows.call("GetInputVolume", { inputName: MUZIK })).inputVolumeMul; return v > volAsal - 0.05 ? v : null; }, 5000);
  ok(pulihVol !== null, "HENTI: Muzik Latar dikembalikan", String(pulihVol));
  await m.click("#muzikMain");
  const mzHenti = await until(async () => { const s = await ows.call("GetMediaInputStatus", { inputName: MUZIK }); return s.mediaState !== "OBS_MEDIA_STATE_PLAYING" ? s.mediaState : null; }, 4000);
  ok(!!mzHenti, "Muzik Latar ■ dihentikan", mzHenti);
  await ows.call("SetInputVolume", { inputName: MUZIK, inputVolumeMul: 1 });

  // ---------- Final review fixes ----------
  const iA = (await P()).aturcara.findIndex(x => x.tajuk === "Anugerah Ujian A");
  await m.evaluate(i => __majlis.sedia({ i, s: 0 }), iA);
  // A double press (or a held Space) must show one name, not skip one.
  await m.evaluate(() => { for (const r of [false, false, true, true]) document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", repeat: r, bubbles: true, cancelable: true })); });
  await sleep(500);
  const dbl = await P();
  ok(dbl.udara && dbl.udara.s === 0 && !dbl.dipapar.includes(iA + ":1"), "tekan Space dua kali / ditahan: satu nama sahaja keluar", JSON.stringify(dbl.udara));
  await sleep(700); await key("Escape"); await sleep(300);

  // "Betulkan nama" writes to the name that was open, even if SEDIA moves meanwhile.
  await m.evaluate(i => __majlis.sedia({ i, s: 2 }), iA);
  await m.click("#editBtn");
  await m.click("#next");
  await m.evaluate(() => { document.getElementById("eNama").value = "MURID A3 BETUL"; document.getElementById("editForm").requestSubmit(); });
  await sleep(200);
  const bt = (await P()).aturcara[iA].senarai;
  ok(bt[2].nama === "MURID A3 BETUL" && bt[3].nama === "MURID A4", "Betulkan nama: nama yang dibuka dibetulkan, bukan SEDIA baharu", bt.map(x => x.nama).join(", "));

  // Esc on a song needs a second press (a clicker can send Esc by itself); the HENTI button stays one click.
  const lagu4 = wav(path.join(tmp, "lagu esc.wav"), 8);
  const iL4 = await m.evaluate(p => __majlis.tambah({ jenis: "lagu", tajuk: "Lagu Esc", laluan: p, fail: "lagu esc.wav" }, 0), lagu4);
  await m.evaluate(i => __majlis.sedia({ i, s: 0 }), iL4);
  await key(" ");
  await until(async () => (await ows.call("GetMediaInputStatus", { inputName: VIDEO })).mediaDuration > 0 ? 1 : null, 5000);
  await sleep(700);
  await key("Escape");
  await sleep(1200);
  const esc1 = await ows.call("GetMediaInputStatus", { inputName: VIDEO });
  ok(esc1.mediaState === "OBS_MEDIA_STATE_PLAYING" && /Esc sekali lagi/.test(await toast()), "Esc sekali semasa lagu: lagu tidak dipotong, minta tekan lagi", await toast());
  await key("Escape");
  ok(await until(async () => (await ows.call("GetMediaInputStatus", { inputName: VIDEO })).mediaState !== "OBS_MEDIA_STATE_PLAYING" ? 1 : null, 3000), "Esc dua kali: HENTI");
  await sleep(500);

  // Deleting an item migrated from v1.2 keeps the v1.2 Media dock's file.
  await m.evaluate(async () => {
    const items = KM.dock.store.get("media.items", []); items.push({ id: "mig1", kind: "img", label: "lama.png", count: 1 });
    KM.dock.store.set("media.items", items); await KM.idb.set("media:mig1", [{ name: "lama.png", blob: new Blob(["x"]) }]);
    __majlis.tambah({ id: "mig1", jenis: "gambar", tajuk: "Gambar lama", fail: "lama.png", halaman: 1 });
  });
  await m.click("#mSetup");
  await m.evaluate(() => { const b = document.querySelector('#susun [data-id="mig1"] [data-a=del]'); b.click(); document.querySelector('#susun [data-id="mig1"] [data-a=del]').click(); });
  const migr = await m.evaluate(async () => ({ ada: !!(await KM.idb.get("media:mig1")), dalam: __majlis.p().aturcara.some(x => x.id === "mig1") }));
  ok(!migr.dalam && migr.ada, "buang item dari v1.2: fail panel v1.2 tidak dipadam", JSON.stringify(migr));
  await m.evaluate(async () => { await KM.idb.del("media:mig1"); KM.dock.store.set("media.items", KM.dock.store.get("media.items", []).filter(x => x.id !== "mig1")); });
  await m.click("#mShow");

  ok(m.errs.length === 0, "tiada ralat JavaScript (Kawalan Majlis)", m.errs.slice(0, 3).join(" | "));
  return selesai();

  async function selesai() {
    const errs = [dok].flatMap(t => t.errs);
    ok(errs.length === 0, "tiada ralat JavaScript", errs.slice(0, 3).join(" | "));
    await dok.evaluate(() => __t.disconnect()).catch(() => {});
    // Leave no test file in the sources (the v1.2 Media dock would import it as a video).
    for (const inputName of [VIDEO, MUZIK]) await ows.call("SetInputSettings", { inputName, inputSettings: { local_file: "" } }).catch(() => {});
    const { pass, fail } = hasil();
    console.log(`\n${pass} lulus, ${fail} gagal`);
    ows.close(); dok.close();
    await sleep(1500);   // OBS lets go of the test files
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { console.log("(folder ujian sementara tidak dapat dipadam: " + tmp + ")"); }
    process.exit(fail ? 1 : 0);
  }
  return selesai();
})().catch(e => { console.error(e); process.exit(2); });
