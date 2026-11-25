// Kawalan Majlis v2: smoke test for lib/dek.js + lib/reka.js in a plain headless Chromium (not OBS).
//   node ujian/uji-dek-reka.cjs [path-to-playwright]
// Playwright is not a dependency of this project: point to any local install (default: ../pajsk-assist).
const path = require("path"), fs = require("fs"), os = require("os");
const { minimalPdf } = require("./cdp.cjs");
const pwPath = process.argv[2] || path.resolve(__dirname, "../../pajsk-assist/node_modules/playwright");
const { chromium } = require(pwPath);

let gagal = 0;
const ok = (c, l, x = "") => { console.log((c ? "LULUS  " : "GAGAL  ") + l + (x ? "  · " + x : "")); if (!c) gagal++; };

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "km-dek-"));
  const pdf = path.join(tmp, "dua halaman.pdf");
  fs.writeFileSync(pdf, minimalPdf(["Satu", "Dua"]));
  const png = path.join(tmp, "b.png"), png2 = path.join(tmp, "a.png");
  const px = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  fs.writeFileSync(png, px); fs.writeFileSync(png2, px);

  const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.goto("file:///" + path.join(__dirname, "dek-reka.html").replace(/\\/g, "/"));

  // Name designer
  await page.evaluate(() => editor.buka());
  const fonts = await page.$$eval("#font option", o => o.length);
  ok(fonts >= 7, "reka: 7 font tersenarai", fonts + " pilihan");
  await page.click('#tpl [data-t]');
  const g = await page.evaluate(() => siaran.filter(d => d.type === "gaya").length);
  ok(g >= 1, "reka: templat dihantar ke paparan (gaya)", g + " siaran");
  ok(await page.evaluate(() => editor.terbuka()), "reka: terbuka()");
  editorTutup: { await page.evaluate(() => editor.tutup()); ok(!(await page.evaluate(() => editor.terbuka())), "reka: tutup()"); }

  // Decks: a 2-page PDF and two pictures
  const pdfItem = await page.evaluate(async () => {
    const el = document.createElement("input"); el.type = "file"; el.id = "f"; document.body.append(el); return true;
  });
  await page.setInputFiles("#f", pdf);
  const r = await page.evaluate(async () => {
    const { item, stored } = await KM.dek.tambahPdf(document.getElementById("f").files[0]);
    const src = await KM.dek.halaman(item, 1);
    return { item, stored, src: src.slice(0, 30), kira: await KM.dek.kira(item) };
  });
  ok(r.item.jenis === "slaid" && r.item.halaman === 2 && r.item.tajuk === "dua halaman.pdf", "dek: PDF jadi item slaid 2 halaman", JSON.stringify(r.item));
  ok(r.src.startsWith("data:image/jpeg"), "dek: halaman 2 dirender (dataURL JPEG)", r.src);
  ok(r.kira === 2 && r.stored, "dek: kira + disimpan dalam IndexedDB");
  await page.evaluate(() => { const el = document.getElementById("f"); el.multiple = true; });
  await page.setInputFiles("#f", [png, png2]);
  const g2 = await page.evaluate(async () => {
    const { item } = await KM.dek.tambahGambar([...document.getElementById("f").files]);
    return { item, src: (await KM.dek.halaman(item, 0)).slice(0, 22) };
  });
  ok(g2.item.jenis === "gambar" && g2.item.halaman === 2 && /a\.png/.test(g2.item.tajuk), "dek: gambar disusun ikut nama fail", JSON.stringify(g2.item));
  ok(g2.src.startsWith("data:image/jpeg"), "dek: gambar dirender");
  // v1.2 items (kind/count) still render from the same IndexedDB keys.
  const lama = await page.evaluate(async id => (await KM.dek.halaman({ id, kind: "pdf", count: 2 }, 0)).slice(0, 15), r.item.id);
  ok(lama.startsWith("data:image"), "dek: item v1.2 (kind pdf) masih boleh dibaca");
  await page.evaluate(id => KM.dek.buang(id), r.item.id);
  const hilang = await page.evaluate(async item => { KM.dek.lupa(item.id); return KM.dek.halaman(item, 0).then(() => "ada", e => e.message); }, r.item);
  ok(/tiada lagi/.test(hilang), "dek: buang() memadam fail", hilang);

  ok(errs.length === 0, "tiada ralat JavaScript", errs.slice(0, 3).join(" | "));
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(gagal ? `\n${gagal} GAGAL` : "\nSemua LULUS");
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
