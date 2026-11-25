/* Kawalan Majlis: name-card layout (fonts, templates, renderer).
 * Shared by paparan.html (OBS browser source) and the design preview in kawalan-anugerah.html,
 * so what the operator sees while designing is exactly what goes on screen. */
(function () {
  "use strict";
  const W = 1920, H = 1080;
  const KEYS = ["anugerah", "nama", "kelas"];

  // Bundled fonts (SIL Open Font License, see fonts/LESEN-FON.txt). Offline: schools often have no internet.
  const FONTS = [
    { id: "montserrat", name: "Montserrat", files: { 600: "montserrat-600", 700: "montserrat-700", 800: "montserrat-800" } },
    { id: "poppins", name: "Poppins", files: { 500: "poppins-500", 700: "poppins-700" } },
    { id: "cinzel", name: "Cinzel (rasmi)", files: { 600: "cinzel-600", 800: "cinzel-800" } },
    { id: "playfair", name: "Playfair Display (klasik)", files: { 600: "playfair-display-600", 800: "playfair-display-800" } },
    { id: "greatvibes", name: "Great Vibes (tulisan tangan)", files: { 400: "great-vibes-400" } },
    { id: "oswald", name: "Oswald (padat)", files: { 500: "oswald-500", 700: "oswald-700" } },
    { id: "bebas", name: "Bebas Neue (tajuk)", files: { 400: "bebas-neue-400" } },
  ];
  const FALLBACK = ", Montserrat, Arial, sans-serif";
  const family = id => (id && id.startsWith("u:") ? "KMU-" + id.slice(2) : "KMF-" + (FONTS.some(f => f.id === id) ? id : "montserrat"));

  let fontsInjected = false;
  function ensureFonts() {
    if (fontsInjected) return;
    fontsInjected = true;
    const css = FONTS.flatMap(f => Object.entries(f.files).map(([w, file]) =>
      `@font-face{font-family:"KMF-${f.id}";font-weight:${w};font-display:block;src:url(fonts/${file}.woff2) format("woff2")}`)).join("\n");
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  }
  const customFonts = new Set();
  /** Register a font the teacher added (data: URL). */
  async function registerFont(id, dataUrl) {
    if (customFonts.has(id)) return;
    const ff = new FontFace("KMU-" + id, "url(" + dataUrl + ")");
    await ff.load();
    document.fonts.add(ff); customFonts.add(id);
  }

  // Default = v1.0 style C: centred minimal text over a dark fade at the bottom.
  function defaults() {
    return {
      v: 1, shade: "bawah", shadow: true, img: null, kad: null,
      el: {
        anugerah: { x: 110, y: 800, w: 1700, h: 41, font: "montserrat", weight: 700, color: "#f6e3ad", align: "center", upper: true, show: true },
        nama: { x: 110, y: 851, w: 1700, h: 91, font: "montserrat", weight: 800, color: "#ffffff", align: "center", upper: false, show: true },
        kelas: { x: 110, y: 950, w: 1700, h: 46, font: "montserrat", weight: 600, color: "#ffffff", align: "center", upper: false, show: true },
      },
    };
  }
  // Templates move the text; fonts, colours and the picture stay as chosen.
  const TEMPLATES = {
    tengah: { label: "Tengah bawah", shade: "bawah", align: "center", el: { anugerah: [110, 800, 1700, 41], nama: [110, 851, 1700, 91], kelas: [110, 950, 1700, 46] } },
    kiri: { label: "Kiri bawah", shade: "bawah", align: "left", el: { anugerah: [120, 812, 1150, 41], nama: [120, 860, 1150, 91], kelas: [120, 958, 1150, 46] } },
    skrin: { label: "Tengah skrin", shade: "penuh", align: "center", el: { anugerah: [160, 372, 1600, 58], nama: [160, 452, 1600, 150], kelas: [160, 626, 1600, 66] } },
    // A ceremonial card: deep green band with gold lines, the award on a gold ribbon. Sets its own fonts and colours.
    emas: { label: "Kad hijau emas", shade: "bawah", align: "center", kad: "emas", el: { anugerah: [460, 786, 1000, 44], nama: [200, 846, 1520, 96], kelas: [200, 946, 1520, 46] },
      gaya: { anugerah: { font: "montserrat", weight: 800, color: "#0b3d27", upper: true }, nama: { font: "playfair", weight: 800, color: "#ffffff", upper: false }, kelas: { font: "montserrat", weight: 600, color: "#f3d27a", upper: false } } },
  };
  function applyTemplate(L, t) {
    const T = TEMPLATES[t]; if (!T) return L;
    const dariKad = !!L.kad;
    L.shade = T.shade; L.kad = T.kad || null;
    for (const k of KEYS) { const [x, y, w, h] = T.el[k]; Object.assign(L.el[k], { x, y, w, h, align: T.align }); }
    if (T.gaya) for (const k of KEYS) Object.assign(L.el[k], T.gaya[k]);
    else if (dariKad) { const D = defaults(); for (const k of KEYS) Object.assign(L.el[k], { font: D.el[k].font, weight: D.el[k].weight, color: D.el[k].color, upper: D.el[k].upper }); }
    return L;
  }
  /** Fill gaps from older saves so a missing field never breaks the screen. */
  function normalize(L) {
    const D = defaults();
    if (!L || typeof L !== "object") return D;
    const out = { ...D, ...L, el: {} };
    for (const k of KEYS) out.el[k] = { ...D.el[k], ...((L.el || {})[k] || {}) };
    if (!["bawah", "penuh", "tiada"].includes(out.shade)) out.shade = D.shade;
    if (out.kad !== "emas") out.kad = null;
    return out;
  }
  /** Asset ids a layout needs (picture + teacher fonts). */
  function assetIds(L) {
    const ids = [];
    if (L.img && L.img.id) ids.push(L.img.id);
    for (const k of KEYS) { const f = L.el[k].font; if (f && f.startsWith("u:")) ids.push(f.slice(2)); }
    return [...new Set(ids)];
  }

  const px = n => Math.round(n) + "px";
  /** Draw the card into `stage` (a 1920x1080 box). data = {anugerah, nama, kelas}; assets = {id: dataUrl}. */
  function render(stage, L, data, assets) {
    ensureFonts();
    stage.textContent = "";
    if (L.shade === "bawah" || L.shade === "penuh") {
      const s = document.createElement("div");
      s.style.cssText = L.shade === "bawah"
        ? "position:absolute;left:0;right:0;bottom:0;height:420px;background:linear-gradient(to top,rgba(0,0,0,.55),rgba(0,0,0,.25) 45%,rgba(0,0,0,0))"
        : "position:absolute;inset:0;background:rgba(0,0,0,.45)";
      stage.appendChild(s);
    }
    if (L.kad === "emas") kadEmas(stage, L, data);
    if (L.img && assets[L.img.id]) {
      const im = document.createElement("img");
      im.src = assets[L.img.id]; im.alt = "";
      im.style.cssText = `position:absolute;left:${px(L.img.x)};top:${px(L.img.y)};width:${px(L.img.w)};height:${px(L.img.h)};object-fit:fill`;
      stage.appendChild(im);
    }
    for (const k of KEYS) {
      const e = L.el[k], text = (data && data[k]) || "";
      if (!e.show || !text) continue;
      const box = document.createElement("div");
      box.className = "km-t"; box.dataset.k = k;
      const base = e.h / 1.2;
      box.dataset.base = base;
      box.style.cssText = `position:absolute;left:${px(e.x)};top:${px(e.y)};width:${px(e.w)};height:${px(e.h)};display:flex;align-items:center;` +
        `justify-content:${e.align === "left" ? "flex-start" : e.align === "right" ? "flex-end" : "center"};text-align:${e.align}`;
      const sp = document.createElement("span");
      sp.textContent = text.replace(/-/g, "-" + String.fromCharCode(0x2060));   // never break a name after a hyphen (AL-HAFIZAH)
      const reben = L.kad === "emas" && k === "anugerah";
      sp.style.cssText = `display:inline-block;white-space:nowrap;line-height:1.2;font-size:${base}px;font-family:"${family(e.font)}"${FALLBACK};` +
        `font-weight:${e.weight};font-synthesis:none;color:${e.color};text-transform:${e.upper ? "uppercase" : "none"};letter-spacing:${e.upper ? ".12em" : "0"};` +
        (reben ? "padding:.12em 1.1em;border-radius:999px;background:linear-gradient(180deg,#fff1c4 0%,#f0c95e 45%,#c8952f 100%);" +
          "box-shadow:0 0 0 2px rgba(255,236,170,.55),0 6px 18px rgba(0,0,0,.45);box-sizing:border-box;max-width:100%;"
          : L.shadow ? "text-shadow:0 3px 18px rgba(0,0,0,.85),0 1px 3px rgba(0,0,0,.9);" : "");
      box.appendChild(sp); stage.appendChild(box);
    }
    fit(stage);
    // Measure again once the real fonts are in (the fallback has different widths).
    const want = KEYS.map(k => L.el[k]).filter(e => e.show).map(e => `${e.weight} 40px "${family(e.font)}"`);
    Promise.all(want.map(f => document.fonts.load(f).catch(() => {}))).then(() => fit(stage));
  }
  /** The green-and-gold card behind the name and class lines (follows their boxes when moved in the designer). */
  function kadEmas(stage, L, data) {
    const n = L.el.nama, k = L.el.kelas, adaKelas = k.show && data && data.kelas;
    const kiri = Math.min(n.x, adaKelas ? k.x : n.x), kanan = Math.max(n.x + n.w, adaKelas ? k.x + k.w : 0);
    const atas = n.y - 30, bawah = (adaKelas ? k.y + k.h : n.y + n.h) + 22;
    const lebar = kanan - kiri + 240, x = kiri - 120;
    const kad = document.createElement("div");
    kad.style.cssText = `position:absolute;left:${px(x)};top:${px(atas)};width:${px(lebar)};height:${px(bawah - atas)};` +
      "background:linear-gradient(90deg,rgba(6,52,34,0) 0%,rgba(8,66,43,.94) 10%,rgba(11,88,57,.97) 50%,rgba(8,66,43,.94) 90%,rgba(6,52,34,0) 100%);";
    const garis = y => { const g = document.createElement("div"); g.style.cssText = `position:absolute;left:0;right:0;top:${y};height:3px;` +
      "background:linear-gradient(90deg,rgba(200,149,47,0) 0%,#c8952f 14%,#ffe7a0 50%,#c8952f 86%,rgba(200,149,47,0) 100%)"; kad.appendChild(g); };
    garis("0"); garis("calc(100% - 3px)");
    const permata = document.createElement("div");
    permata.style.cssText = "position:absolute;left:50%;bottom:-9px;width:16px;height:16px;margin-left:-8px;transform:rotate(45deg);" +
      "background:linear-gradient(135deg,#fff1c4,#c8952f);box-shadow:0 2px 6px rgba(0,0,0,.4)";
    kad.appendChild(permata);
    stage.appendChild(kad);
  }
  /** Long names: shrink to fit the box width (down to 55%), then wrap to two lines. */
  function fit(stage) {
    stage.querySelectorAll(".km-t").forEach(box => {
      const sp = box.firstChild, max = box.clientWidth;
      let s = +box.dataset.base;
      sp.style.whiteSpace = "nowrap"; sp.style.maxWidth = "none"; sp.style.fontSize = s + "px";
      const min = s * 0.55;
      while (sp.offsetWidth > max && s > min) { s = Math.max(min, s - Math.max(1, s * 0.03)); sp.style.fontSize = s + "px"; }
      if (sp.offsetWidth > max) {
        // Two lines: shrink until both lines fit the box height too, so they never run into the next line.
        sp.style.whiteSpace = "normal"; sp.style.maxWidth = "100%"; sp.style.lineHeight = "1.08";
        const tinggi = box.clientHeight * 1.12, paling = +box.dataset.base * 0.4;
        while (sp.offsetHeight > tinggi && s > paling) { s = Math.max(paling, s - Math.max(1, s * 0.03)); sp.style.fontSize = s + "px"; }
      } else sp.style.lineHeight = "1.2";
    });
  }

  window.KM = window.KM || {};
  window.KM.gaya = { W, H, KEYS, FONTS, family, ensureFonts, registerFont, defaults, TEMPLATES, applyTemplate, normalize, assetIds, render, fit };
})();
