// Kawalan Majlis: live check inside real OBS (Windows or Mac) through raw CDP.
// OBS 32 on Windows refuses Playwright connectOverCDP (Browser.setDownloadBehavior), so this
// talks to each dock page over its own DevTools WebSocket. No dependencies (Node 22+).
// Launch OBS with --remote-debugging-port=9223 and WebSocket on, then:
//   node ujian/uji-windows.cjs <websocket-password>
// Never change a dock's viewport size: it sticks inside the OBS dock.
const path = require("path");
const PW = process.argv[2];
const ROOT = path.resolve(__dirname, "..");

const { Tab, minimalPdf, obsSocket, tab, ok, sleep, until, hasil } = require("./cdp.cjs");

(async () => {
  const anug = await until(() => tab(/kawalan-anugerah\.html/));
  const media = await until(() => tab(/kawalan-media\.html/));
  ok(!!anug, "dock Kawalan Anugerah dimuat (laluan ada ruang)");
  ok(!!media, "dock Kawalan Media dimuat");
  if (!anug || !media) process.exit(1);

  // 1. connect with the WebSocket password; the other dock should pick it up from localStorage.
  await anug.evaluate(() => localStorage.clear());
  await anug.reload(); await media.reload();
  await anug.evaluate(() => document.getElementById("kmSetup").classList.add("open"));
  await anug.fill("#kmPw", PW);
  await anug.click("#kmConnect");
  const installReady = await until(() => anug.evaluate(() => !document.getElementById("kmInstall").disabled));
  ok(!!installReady, "Anugerah bersambung ke OBS WebSocket");
  const mediaConn = await until(() => media.evaluate(() => !document.getElementById("kmInstall").disabled), 6000);
  ok(!!mediaConn, "Media bersambung sendiri (kata laluan dikongsi)");

  // 2. scene list + install overlay into scene "Ujian" only.
  await anug.evaluate(() => { document.getElementById("kmSetup").classList.add("open"); document.getElementById("kmSetupBtn").click(); document.getElementById("kmSetupBtn").click(); });
  const names = await until(() => anug.evaluate(() => { const a = [...document.querySelectorAll("#kmScenes input")].map(i => i.value); return a.length ? a : null; }));
  ok(names && names.includes("Ujian") && names.includes("Ujian 2"), "senarai scene OBS dipapar", JSON.stringify(names));
  await anug.evaluate(() => document.querySelectorAll("#kmScenes input").forEach(i => { i.checked = i.value === "Ujian"; }));
  await anug.click("#kmInstall");
  const res = await until(() => anug.evaluate(() => { const t = document.getElementById("kmSetup").innerText; return /Siap\.|Gagal/.test(t) ? t : null; }), 10000);
  ok(res && /Siap\. Paparan ada dalam 1 scene/.test(res), "pasang paparan ke scene Ujian", (res || "").split("\n").find(l => /Siap|Gagal/.test(l)));
  const pap = await until(() => tab(/paparan\.html/), 10000);
  ok(!!pap, "browser source paparan.html hidup dalam OBS");
  const status = await until(() => anug.evaluate(() => { const t = document.body.innerText; return /Paparan sedia|paparan sedia|Bersambung/i.test(t) && !/menyemak paparan/i.test(t) ? t.slice(0, 400) : null; }), 8000);
  ok(!!status, "dock mengesan paparan (jawapan paparan-ada)");
  const route = await anug.evaluate(() => { const r = document.getElementById("kmRoute"); return r && !r.hidden ? r.textContent : ""; });
  ok(/Program|Preview/i.test(route), "penunjuk PREVIEW/PROGRAM", route);

  // 3. load Excel, show first name, check overlay text.
  await anug.setInputFiles("#fileInput", path.join(ROOT, "contoh-senarai.xlsx"));
  const count = await until(() => anug.evaluate(() => document.querySelectorAll("#list > *").length || null));
  ok(count > 0, "Excel contoh dibaca", `${count} baris`);
  const first = await anug.evaluate(() => document.getElementById("nowName").textContent.trim());
  await anug.click("#toggle");
  const shown = pap && await until(() => pap.evaluate(n => document.getElementById("nameWrap").classList.contains("show") && document.body.innerText.includes(n) ? 1 : null, first), 5000);
  ok(!!shown, "nama dipapar di paparan OBS", first);
  await anug.click("#toggle");
  const hidden = pap && await until(() => pap.evaluate(() => document.getElementById("nameWrap").classList.contains("show") ? null : 1), 5000);
  ok(!!hidden, "SOROK menyembunyikan nama");
  await anug.click("#next");
  const second = await anug.evaluate(() => document.getElementById("nowName").textContent.trim());
  ok(second && second !== first, "Seterusnya ke nama kedua", second);

  // 4. design editor opens + a non-default font survives into the overlay.
  await anug.click("#designBtn");
  const designOpen = await until(() => anug.evaluate(() => { const d = document.getElementById("design"); return d && (d.open || d.classList.contains("open") || getComputedStyle(d).display !== "none"); }));
  ok(!!designOpen, "editor Reka paparan nama dibuka");
  const fonts = await anug.evaluate(() => [...document.querySelectorAll("#font option")].map(o => o.value));
  ok(fonts.length >= 7, "7 font terbina tersenarai", fonts.length + " pilihan");
  await anug.click("#designClose").catch(() => {});

  // 5. media playlist: image + PDF render to dataURL and reach the overlay.
  const fs = require("fs"), os = require("os");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "km-"));
  const png = path.join(tmp, "ujian.png");
  fs.writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  await media.setInputFiles("#imgInput", png);
  const pl = await until(() => media.evaluate(() => document.querySelectorAll("#pl > *").length || null));
  ok(pl >= 1, "gambar masuk susunan media", `${pl} item`);
  await media.click("#toggle");
  const imgOn = pap && await until(() => pap.evaluate(() => document.getElementById("media").classList.contains("show") && [...document.querySelectorAll("#media img.on")].some(i => i.src.startsWith("data:image")) ? 1 : null), 6000);
  ok(!!imgOn, "gambar dipapar di paparan OBS");
  await media.click("#toggle");

  // 5b. a 2-page PDF renders page by page.
  const pdf = path.join(tmp, "ujian.pdf");
  fs.writeFileSync(pdf, minimalPdf(["Slaid Satu", "Slaid Dua"]));
  await media.setInputFiles("#pdfInput", pdf);
  const pl2 = await until(() => media.evaluate(n => document.querySelectorAll("#pl > *").length > n ? document.querySelectorAll("#pl > *").length : null, pl), 15000);
  ok(pl2 > pl, "PDF 2 muka surat masuk susunan media", `${pl2} item`);
  const pdfTxt = await media.evaluate(() => document.getElementById("pl").innerText.replace(/\s+/g, " ").slice(0, 160));
  ok(/ujian\.pdf/i.test(pdfTxt) && /2/.test(pdfTxt), "PDF dikenal pasti 2 muka surat", pdfTxt);

  // 5c. Studio Mode: the route badge must say PREVIEW / warn, not PROGRAM.
  const ows = await obsSocket(PW);
  // Overlay lives only in "Ujian". OBS refuses Preview = Program, so a third scene is needed.
  await ows.call("CreateScene", { sceneName: "Ujian 3" }).catch(() => {});
  await ows.call("SetStudioModeEnabled", { studioModeEnabled: true });
  const routeIs = re => until(() => anug.evaluate(r => { const t = document.getElementById("kmRoute").textContent; return new RegExp(r).test(t) ? t : null; }, re), 5000);
  await ows.call("SetCurrentProgramScene", { sceneName: "Ujian 2" });
  await ows.call("SetCurrentPreviewScene", { sceneName: "Ujian 3" });
  const r1 = await routeIs("tiada di Preview atau Program");
  ok(!!r1, "Studio Mode: amaran bila paparan tiada di Preview/Program", r1);
  await ows.call("SetCurrentPreviewScene", { sceneName: "Ujian" });
  const r2 = await routeIs("^PREVIEW:");
  ok(!!r2, "Studio Mode: PREVIEW bila scene paparan di Preview", r2);
  await ows.call("SetCurrentProgramScene", { sceneName: "Ujian" });
  await ows.call("SetCurrentPreviewScene", { sceneName: "Ujian 3" });
  const r3 = await routeIs("^PROGRAM:");
  ok(!!r3, "Studio Mode: PROGRAM bila scene paparan di Program", r3);
  await ows.call("SetStudioModeEnabled", { studioModeEnabled: false });
  await ows.call("RemoveScene", { sceneName: "Ujian 3" }).catch(() => {});
  ows.close();

  // 6. survives a dock reload (IndexedDB + localStorage).
  await media.reload();
  const plAfter = await until(() => media.evaluate(() => document.querySelectorAll("#pl > *").length || null));
  ok(plAfter >= 1, "susunan media kekal selepas muat semula dock");

  const errs = [anug, media, pap].filter(Boolean).flatMap(t => t.errs);
  ok(errs.length === 0, "tiada ralat JavaScript", errs.slice(0, 3).join(" | "));
  const { pass, fail } = hasil();
  console.log(`\n${pass} lulus, ${fail} gagal`);
  fs.rmSync(tmp, { recursive: true, force: true });
  [anug, media, pap].forEach(t => t && t.close());
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
