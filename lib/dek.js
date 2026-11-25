/* Kawalan Majlis: slides (PDF) and pictures, stored in IndexedDB ("media:<id>") and rendered
 * page by page to 1920x1080 JPEG data URLs for the overlay. Needs lib/idb.js and lib/pdf.min.js.
 * Item: {id, jenis:"slaid"|"gambar", tajuk, fail, halaman}. v1.2 items {id, kind:"pdf"|"img", count} also work. */
(function () {
  "use strict";
  const W = 1920, H = 1080;
  // Main-thread worker: real Web Workers are unreliable from file:// pages.
  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";

  const memFiles = new Map();                      // files too big for storage: kept for this session only
  const decks = new Map(), full = new Map(), thumb = new Map();
  const isPdf = it => it.jenis === "slaid" || it.kind === "pdf";
  const newId = () => "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function fitCanvas(srcW, srcH, maxW, maxH) {
    const s = Math.min(maxW / srcW, maxH / srcH);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(srcW * s)); c.height = Math.max(1, Math.round(srcH * s));
    return { c, s };
  }
  async function fileOf(it) {
    if (memFiles.has(it.id)) return memFiles.get(it.id);
    const f = await KM.idb.get("media:" + it.id);
    if (!f) throw new Error("Fail tiada lagi dalam simpanan. Buang item ini dan tambah semula.");
    return f;
  }
  function deckOf(it) {
    if (!decks.has(it.id)) decks.set(it.id, (async () => {
      const f = await fileOf(it);
      if (isPdf(it)) {
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
        return { count: doc.numPages, async render(i, maxW, maxH) {
          const p = await doc.getPage(i + 1), v1 = p.getViewport({ scale: 1 });
          const { c, s } = fitCanvas(v1.width, v1.height, maxW, maxH);
          const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
          await p.render({ canvasContext: ctx, viewport: p.getViewport({ scale: s }) }).promise;
          return c.toDataURL("image/jpeg", 0.92);
        } };
      }
      const list = f;   // [{name, blob}]
      return { count: list.length, async render(i, maxW, maxH) {
        const bmp = await createImageBitmap(list[i].blob, { imageOrientation: "from-image" });
        const { c } = fitCanvas(bmp.width, bmp.height, maxW, maxH);
        const ctx = c.getContext("2d"); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(bmp, 0, 0, c.width, c.height); bmp.close && bmp.close();
        return c.toDataURL("image/jpeg", 0.92);
      } };
    })().catch(e => { decks.delete(it.id); throw e; }));
    return decks.get(it.id);
  }
  function cached(map, it, i, w, h, limit) {
    const k = it.id + ":" + i;
    if (!map.has(k)) {
      map.set(k, deckOf(it).then(d => d.render(i, w, h)).catch(e => { map.delete(k); throw e; }));
      if (map.size > limit) map.delete(map.keys().next().value);
    }
    return map.get(k);
  }
  async function keep(id, data) {
    try { await KM.idb.set("media:" + id, data); return true; }
    catch (_) { memFiles.set(id, data); return false; }
  }

  /** A PDF file → {item, stored}. stored=false: too big for storage, gone when OBS closes. */
  async function tambahPdf(file) {
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const n = doc.numPages; doc.destroy && doc.destroy();
    const id = newId();
    const stored = await keep(id, file);
    return { item: { id, jenis: "slaid", tajuk: file.name, fail: file.name, halaman: n }, stored };
  }
  /** Pictures picked together = one item, ordered by file name. */
  async function tambahGambar(files) {
    files = [...files].filter(f => /^image\//.test(f.type)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!files.length) throw new Error("Tiada gambar dipilih.");
    const id = newId();
    const stored = await keep(id, files.map(f => ({ name: f.name, blob: f })));
    const tajuk = files.length === 1 ? files[0].name : files.length + " gambar (" + files[0].name + " …)";
    return { item: { id, jenis: "gambar", tajuk, fail: files[0].name, halaman: files.length }, stored };
  }
  /** Page/picture n (0-based) as a full-size data URL for the overlay. Warms up the next one. */
  function halaman(it, n) {
    const p = cached(full, it, n, W, H, 12);
    p.then(() => { const c = it.halaman || it.count || 1; if (n + 1 < c) cached(full, it, n + 1, W, H, 12).catch(() => {}); }).catch(() => {});
    return p;
  }
  const lakaran = (it, n) => cached(thumb, it, n, 360, 203, 400);
  const kira = async it => (await deckOf(it)).count;
  /** Forget cached renders (the file stays). */
  function lupa(id) {
    decks.delete(id);
    for (const m of [full, thumb]) for (const k of [...m.keys()]) if (k.startsWith(id + ":")) m.delete(k);
  }
  /** Delete the stored file. */
  function buang(id) { lupa(id); memFiles.delete(id); return KM.idb.del("media:" + id).catch(() => {}); }
  const tidakDisimpan = id => memFiles.has(id);

  window.KM = window.KM || {};
  window.KM.dek = { tambahPdf, tambahGambar, halaman, lakaran, kira, lupa, buang, tidakDisimpan };
})();
