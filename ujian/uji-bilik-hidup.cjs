// Kawalan Majlis: live checks for the Bilik Kawalan (large layout) inside real OBS (raw CDP, see cdp.cjs).
// OBS with --remote-debugging-port=9223, WebSocket on, Kawalan Majlis dock installed, scenes "Ujian" + "Ujian 2". Then:
//   node ujian/uji-bilik-hidup.cjs <websocket-password>
// The large layout is forced with the "Sentiasa" setting: never resize a dock's viewport in tests.
const path = require("path"), fs = require("fs"), os = require("os");
const { obsSocket, tab, ok, sleep, until, hasil } = require("./cdp.cjs");
const PW = process.argv[2];
const MUZIK = "Kawalan Majlis - Muzik Latar", HITAM = "Kawalan Majlis - Hitam";

function wav(file, seconds, freq = 330) {
  const rate = 22050, n = Math.round(rate * seconds), buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freq * i / rate) * 12000), 44 + i * 2);
  fs.writeFileSync(file, buf); return file;
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "km-bk-"));
  const o = await obsSocket(PW);
  const m = await until(() => tab(/kawalan-majlis\.html/));
  ok(!!m, "dock Kawalan Majlis dimuat");
  if (!m) process.exit(1);
  const prog = async () => (await o.call("GetCurrentProgramScene")).currentProgramSceneName;
  const prev = async () => (await o.call("GetCurrentPreviewScene")).currentPreviewSceneName;
  const tunggu = (f, ms = 4000) => until(f, ms);

  // Test scenes; start with Studio Mode off.
  for (const sceneName of ["Ujian 3"]) await o.call("CreateScene", { sceneName }).catch(() => {});
  await o.call("CreateInput", { sceneName: "Ujian 3", inputName: "Warna Ujian 3", inputKind: "color_source_v3", inputSettings: { color: 0xff2e7d32, width: 1920, height: 1080 }, sceneItemEnabled: true }).catch(() => {});
  await o.call("SetStudioModeEnabled", { studioModeEnabled: false });
  await o.call("SetCurrentProgramScene", { sceneName: "Ujian" });

  await m.evaluate(() => { localStorage.setItem("km.majlis.besar", '"sentiasa"'); localStorage.setItem("km.majlis.input", "true"); });
  await m.reload();
  await tunggu(() => m.evaluate(() => document.getElementById("kmConn").classList.contains("ok") ? 1 : null), 10000);
  ok(await m.evaluate(() => document.body.classList.contains("besar")), "paparan besar aktif (tetapan Sentiasa)");
  // Overlay + Video + Muzik Latar sources (as Persediaan → Pasang would), after the docks settle.
  await sleep(2000);
  const pasang = await m.evaluate(async pw => {
    const t = new KM.OBSClient({ events: KM.SUB.General }); t.connect({ port: 4455, password: pw, retry: false });
    for (let i = 0; i < 40 && t.state !== "connected"; i++) await new Promise(r => setTimeout(r, 100));
    try { await KM.dock.installOverlay(t, 4455, pw, ["Ujian", "Ujian 2", "Ujian 3"]); return "ok"; } catch (e) { return e.message; } finally { t.disconnect(); }
  }, PW);
  ok(pasang === "ok", "paparan dipasang ke scene ujian", pasang);

  // Input bar = OBS scenes, without our helper scene.
  const tiles = await tunggu(() => m.evaluate(() => { const a = [...document.querySelectorAll("#bkRow [data-n]")].map(t => t.dataset.n); return a.length >= 3 ? a : null; }));
  ok(tiles && ["Ujian", "Ujian 2", "Ujian 3"].every(n => tiles.includes(n)) && !tiles.includes(HITAM), "deretan input = scene OBS", JSON.stringify(tiles));

  // Studio Mode off: a clear button turns it on.
  ok(await tunggu(() => m.evaluate(() => document.getElementById("bkStudio") ? 1 : null)), "Studio Mode mati: butang Hidupkan Studio Mode dipapar");
  await m.click("#bkStudio");
  ok(await tunggu(async () => (await o.call("GetStudioModeEnabled")).studioModeEnabled ? 1 : null), "butang menghidupkan Studio Mode");
  await sleep(500);

  // Click = Preview, nothing goes out.
  const clickTile = (n, dbl) => m.evaluate(([n, dbl]) => { const t = [...document.querySelectorAll("#bkRow [data-n]")].find(x => x.dataset.n === n); t.dispatchEvent(new MouseEvent(dbl ? "dblclick" : "click", { bubbles: true })); }, [n, dbl]);
  await clickTile("Ujian 2");
  await tunggu(async () => (await prev()) === "Ujian 2" ? 1 : null); await sleep(700);
  ok((await prev()) === "Ujian 2" && (await prog()) === "Ujian", "klik input = ke Preview sahaja (Program tidak berubah)");
  ok(await tunggu(() => m.evaluate(() => document.querySelector('#bkRow [data-n="Ujian 2"]').classList.contains("is-pv") ? 1 : null)), "input Preview bersempadan oren");

  await m.click("#bkCut");
  ok(await tunggu(async () => (await prog()) === "Ujian 2" ? 1 : null), "CUT: Preview ke Program");
  ok(await tunggu(() => m.evaluate(() => document.querySelector('#bkRow [data-n="Ujian 2"]').classList.contains("is-pg") ? 1 : null)), "input Program bersempadan merah");

  await clickTile("Ujian"); await tunggu(async () => (await prev()) === "Ujian" ? 1 : null);
  await m.evaluate(() => { const s = document.getElementById("bkDur"); s.value = "300"; s.dispatchEvent(new Event("change")); });
  await m.click("#bkFade");
  ok(await tunggu(async () => (await prog()) === "Ujian" ? 1 : null), "FADE: Preview ke Program");
  const dur = (await o.call("GetCurrentSceneTransition")).transitionDuration;
  ok(dur === 300, "tempoh peralihan dipakai", String(dur));

  await clickTile("Ujian 3", true);
  ok(await tunggu(async () => (await prog()) === "Ujian 3" ? 1 : null), "klik dua kali: terus ke Program");

  // T-bar released past the middle completes the transition.
  await clickTile("Ujian"); await tunggu(async () => (await prev()) === "Ujian" ? 1 : null);
  await m.evaluate(async () => { const t = document.getElementById("bkTbar"); for (const v of [20, 50, 80]) { t.value = v; t.dispatchEvent(new Event("input")); await new Promise(r => setTimeout(r, 120)); } t.dispatchEvent(new Event("change")); });
  ok(await tunggu(async () => (await prog()) === "Ujian" ? 1 : null, 5000), "T-bar: tarik melepasi separuh = peralihan selesai");
  await clickTile("Ujian 3"); await tunggu(async () => (await prev()) === "Ujian 3" ? 1 : null);
  await m.evaluate(() => { const t = document.getElementById("bkTbar"); t.value = 30; t.dispatchEvent(new Event("change")); });
  await sleep(800);
  ok((await prog()) === "Ujian", "T-bar dilepas sebelum separuh = batal");

  // FTB: to black and back; the Preview choice is kept.
  await clickTile("Ujian 2"); await tunggu(async () => (await prev()) === "Ujian 2" ? 1 : null);
  const sebelumFtb = await prog();
  await m.click("#bkFtb");
  ok(await tunggu(async () => (await prog()) === HITAM ? 1 : null), "FTB: Program jadi skrin hitam");
  ok(await tunggu(async () => (await prev()) === "Ujian 2" ? 1 : null), "FTB: pilihan Preview dikekalkan");
  ok(await m.evaluate(() => document.getElementById("bkFtb").classList.contains("on")), "butang FTB menyala");
  await m.click("#bkFtb");
  ok(await tunggu(async () => (await prog()) === sebelumFtb ? 1 : null), "FTB lagi: kembali ke scene sebelum", sebelumFtb);

  // Pictures from OBS.
  ok(await tunggu(() => m.evaluate(() => (document.getElementById("bkPg").src || "").startsWith("data:image") && (document.getElementById("bkPv").src || "").startsWith("data:image") ? 1 : null), 5000), "gambar Preview + Program dari OBS");
  ok(await tunggu(() => m.evaluate(() => [...document.querySelectorAll("#bkRow img")].filter(i => (i.src || "").startsWith("data:image")).length >= 3 ? 1 : null), 6000), "gambar kecil deretan input");

  // Mixer.
  const lagu = wav(path.join(tmp, "latar bk.wav"), 20);
  await o.call("SetInputSettings", { inputName: MUZIK, inputSettings: { local_file: lagu } });
  await o.call("SetInputVolume", { inputName: MUZIK, inputVolumeMul: 1 });
  await o.call("SetInputMute", { inputName: MUZIK, inputMuted: false });
  await o.call("TriggerMediaInputAction", { inputName: MUZIK, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART" });
  const ch = await tunggu(() => m.evaluate(() => { const a = [...document.querySelectorAll("#bkChs .bk-c .n")].map(n => n.textContent); return a.includes("Muzik latar") ? a : null; }), 6000);
  ok(ch && ch.includes("Lagu / video") && !ch.some(n => /Paparan/.test(n)), "mixer: sumber bunyi OBS dengan nama mesra, tanpa paparan", JSON.stringify(ch));
  const kMz = ch ? ch.indexOf("Muzik latar") : 0;
  ok(await tunggu(() => m.evaluate(k => parseFloat(document.querySelectorAll("#bkChs .bk-c")[k].querySelector(".bk-meter i").style.height) > 5 ? 1 : null, kMz), 5000), "meter Muzik latar bergerak bila muzik dimainkan");
  const btn = (k, cls) => m.evaluate(([k, cls]) => document.querySelectorAll("#bkChs .bk-c")[k].querySelector("." + cls).click(), [k, cls]);
  await btn(kMz, "m");
  ok(await tunggu(async () => (await o.call("GetInputMute", { inputName: MUZIK })).inputMuted ? 1 : null), "M: bisu dalam OBS");
  await btn(kMz, "m");
  ok(await tunggu(async () => !(await o.call("GetInputMute", { inputName: MUZIK })).inputMuted ? 1 : null), "M lagi: bunyi kembali");
  await m.evaluate(k => { const s = document.querySelectorAll("#bkChs .bk-c")[k].querySelector("input"); s.value = 50; s.dispatchEvent(new Event("input", { bubbles: true })); }, kMz);
  ok(await tunggu(async () => Math.abs((await o.call("GetInputVolume", { inputName: MUZIK })).inputVolumeDb + 30) < 0.6 ? 1 : null), "fader: 50 = -30 dB dalam OBS");
  const monAsal = (await o.call("GetInputAudioMonitorType", { inputName: MUZIK })).monitorType;
  await btn(kMz, "s");
  ok(await tunggu(async () => (await o.call("GetInputAudioMonitorType", { inputName: MUZIK })).monitorType === "OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT" ? 1 : null), "S: dengar di fon kepala (monitor and output)");
  await btn(kMz, "s");
  ok(await tunggu(async () => (await o.call("GetInputAudioMonitorType", { inputName: MUZIK })).monitorType === monAsal ? 1 : null), "S lagi: jenis monitor asal dipulihkan", monAsal);
  // Clicking an input never touches audio.
  const muteSebelum = (await o.call("GetInputMute", { inputName: MUZIK })).inputMuted, volSebelum = (await o.call("GetInputVolume", { inputName: MUZIK })).inputVolumeDb;
  await clickTile("Ujian 3"); await sleep(400); await m.click("#bkCut"); await sleep(600);
  ok((await o.call("GetInputMute", { inputName: MUZIK })).inputMuted === muteSebelum && (await o.call("GetInputVolume", { inputName: MUZIK })).inputVolumeDb === volSebelum, "tukar input tidak menyentuh audio");

  // REC into a temporary folder (never the teacher's own Videos folder).
  const { recordDirectory: dirAsal } = await o.call("GetRecordDirectory");
  await o.call("SetRecordDirectory", { recordDirectory: tmp.split(path.sep).join("/") });
  await m.click("#bkRec");
  ok(await tunggu(async () => (await o.call("GetRecordStatus")).outputActive ? 1 : null, 5000), "REC: rakaman bermula");
  ok(await tunggu(() => m.evaluate(() => document.getElementById("bkRec").classList.contains("on") && /\d\d:\d\d:\d\d/.test(document.getElementById("bkRecT").textContent) ? 1 : null), 4000), "REC menyala dengan pemasa");
  await sleep(1500);
  await m.click("#bkRec");
  ok(await tunggu(async () => !(await o.call("GetRecordStatus")).outputActive ? 1 : null, 5000), "REC lagi: rakaman berhenti");
  await o.call("SetRecordDirectory", { recordDirectory: dirAsal });

  // Stats + clock.
  ok(await tunggu(() => m.evaluate(() => /%/.test(document.getElementById("bkCpu").textContent) && /\d\d:\d\d:\d\d/.test(document.getElementById("bkJam").textContent) ? 1 : null), 5000), "jam + CPU OBS dipapar");

  // Hiding the input bar (switcher users).
  await m.evaluate(() => { localStorage.setItem("km.majlis.input", "false"); });
  await m.reload();
  await tunggu(() => m.evaluate(() => document.getElementById("kmConn").classList.contains("ok") ? 1 : null), 10000);
  ok(await m.evaluate(() => getComputedStyle(document.getElementById("bkInput")).display === "none" && document.body.classList.contains("besar")), "deretan input boleh disembunyikan");

  // Panel Pengarah still works inside the large layout.
  const iNama = await m.evaluate(() => __majlis.p().aturcara.findIndex(x => x.jenis === "nama"));
  if (iNama >= 0) {
    await m.evaluate(i => __majlis.sedia({ i, s: 0 }), iNama);
    await sleep(700);
    await m.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true })));
    ok(await tunggu(() => m.evaluate(() => __majlis.p().udara ? 1 : null), 3000), "Panel Pengarah dalam paparan besar: Space memapar nama");
    await sleep(700);
    await m.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  }

  ok(m.errs.length === 0, "tiada ralat JavaScript", m.errs.slice(0, 3).join(" | "));

  // Clean up: music off, layout back to auto, Studio Mode off, Program back to "Ujian".
  await o.call("TriggerMediaInputAction", { inputName: MUZIK, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP" }).catch(() => {});
  await o.call("SetInputSettings", { inputName: MUZIK, inputSettings: { local_file: "" } }).catch(() => {});
  await o.call("SetInputVolume", { inputName: MUZIK, inputVolumeMul: 1 }).catch(() => {});
  await m.evaluate(() => { localStorage.setItem("km.majlis.besar", '"auto"'); localStorage.setItem("km.majlis.input", "true"); });
  await o.call("SetStudioModeEnabled", { studioModeEnabled: false }).catch(() => {});
  await o.call("SetCurrentProgramScene", { sceneName: "Ujian" }).catch(() => {});
  const { pass, fail } = hasil();
  console.log(`\n${pass} lulus, ${fail} gagal`);
  o.close(); m.close();
  await sleep(1500);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { console.log("(folder sementara tidak dapat dipadam: " + tmp + ")"); }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
