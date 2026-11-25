/* Kawalan Majlis: the name-card designer ("Reka paparan nama"). Needs lib/gaya.js and lib/idb.js.
 * KM.reka.mount(container, {obs, store, contoh}) → {buka, tutup, terbuka, sendGaya}
 * Keeps the v1.2 keys gaya.layout / gaya.fonts and IndexedDB "aset:<id>", answers "minta-aset". */
(function () {
  "use strict";
  const CSS = `
  .design{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:10px;display:flex;flex-direction:column;gap:9px}
  .design[hidden],.dz-props[hidden],.dz-img[hidden]{display:none}
  .dz-head{display:flex;justify-content:space-between;align-items:center;font-size:13px}
  .dz .seg{display:flex;background:var(--bg);border-radius:6px;padding:3px;gap:2px}
  .dz .seg button{flex:1;min-width:0;background:none;border:0;color:var(--mute);font-weight:600;font-size:11.5px;padding:6px 4px;border-radius:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dz .seg button.on{background:var(--panel2);color:var(--text)}
  .dz .seg button:disabled{opacity:.35}
  .pv{position:relative;width:100%;aspect-ratio:16/9;border-radius:5px;overflow:hidden;border:1px solid var(--line);
    background:repeating-conic-gradient(#2c2e35 0 25%,#222429 0 50%) 0 0/14px 14px}
  .pv-stage{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;pointer-events:none}
  .pv-ui{position:absolute;inset:0;touch-action:none}
  .hb{position:absolute;border:1px dashed rgba(255,255,255,.4);cursor:move}
  .hb.sel{border:1.5px solid var(--accent);background:rgba(61,123,253,.08)}
  .hd{position:absolute;width:11px;height:11px;background:#fff;border:2px solid var(--accent);border-radius:2px}
  .hd[data-h=nw]{left:-7px;top:-7px;cursor:nwse-resize} .hd[data-h=ne]{right:-7px;top:-7px;cursor:nesw-resize}
  .hd[data-h=sw]{left:-7px;bottom:-7px;cursor:nesw-resize} .hd[data-h=se]{right:-7px;bottom:-7px;cursor:nwse-resize}
  .gd{position:absolute;background:#ff4fd8;pointer-events:none} .gd.v{top:0;bottom:0;width:1px;left:50%} .gd.h{left:0;right:0;height:1px;top:50%}
  .dz label{font-size:11px;color:var(--mute);display:flex;flex-direction:column;gap:3px;min-width:0}
  .dz select{background:var(--bg);border:1px solid var(--line);border-radius:5px;padding:6px 7px;color:var(--text);font-size:12.5px;font-family:inherit;width:100%}
  .dz input[type=color]{width:100%;height:31px;padding:2px;background:var(--bg);border:1px solid var(--line);border-radius:5px}
  .dz .r2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .dz .chks{display:flex;flex-wrap:wrap;gap:6px 14px}
  .dz label.chk{flex-direction:row;align-items:center;gap:6px;font-size:12px;color:var(--text);cursor:pointer}
  .dz label.chk input{accent-color:var(--accent);width:14px;height:14px}
  .dz-img{display:flex;align-items:center;gap:8px;font-size:12px}
  .dz-img .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--mute)}
  .dz-foot{display:flex;justify-content:space-between;align-items:center;gap:8px}
  .dz .sub{font-size:11px;color:var(--mute);font-weight:700;letter-spacing:.03em;margin-top:2px}
  .dz .link{background:none;border:0;color:var(--mute);font-size:11px;text-decoration:underline;cursor:pointer}
  .dz .warn{font-size:12px;color:#ffcf7a;background:rgba(217,162,59,.12);border:1px solid rgba(217,162,59,.4);border-radius:6px;padding:7px 9px;display:none}
  .dz .warn.info{color:#8fe0b5;background:rgba(42,157,99,.12);border-color:rgba(42,157,99,.45)}`;

  const HTML = `
<div class="design dz" id="design" hidden>
  <div class="dz-head"><b>Reka paparan nama</b><button class="link" id="designClose" type="button">Tutup</button></div>
  <div class="seg" id="tpl"></div>
  <div class="pv" id="pv"><div class="pv-stage" id="pvStage"></div><div class="pv-ui" id="pvUi"></div></div>
  <div class="hint">Klik teks atau gambar, seret untuk alih, tarik bucu untuk ubah saiz. Tinggi kotak = saiz huruf. Untuk ruang lebih besar, tarik panel ini keluar dari OBS dan besarkan.</div>
  <div class="sub">GAMBAR LATAR / BINGKAI</div>
  <div class="dz-img">
    <span class="nm" id="imgName">Tiada gambar</span>
    <button class="icon-btn" id="imgPick" type="button">Pilih gambar</button>
    <button class="icon-btn" id="imgDel" type="button" hidden>Buang</button>
    <input type="file" id="imgInput" accept="image/png,image/jpeg,image/webp" hidden>
  </div>
  <div class="hint">Tip: reka bingkai di Canva saiz 1920 × 1080, muat turun sebagai PNG dengan latar telus (transparent).</div>
  <div class="r2">
    <label>Latar gelap<select id="shade"><option value="bawah">Bayang di bawah</option><option value="penuh">Seluruh skrin</option><option value="tiada">Tiada</option></select></label>
    <label class="chk" style="align-self:end;padding-bottom:7px"><input type="checkbox" id="shadow"> Bayang pada teks</label>
  </div>
  <div class="sub">TEKS</div>
  <div class="seg" id="pickEl">
    <button data-k="anugerah" type="button">Anugerah</button><button data-k="nama" type="button">Nama</button>
    <button data-k="kelas" type="button">Kelas</button><button data-k="img" type="button">Gambar</button>
  </div>
  <div class="dz-props" id="elProps">
    <div class="r2">
      <label>Font<select id="font"></select></label>
      <label>Warna<input type="color" id="color"></label>
    </div>
    <div class="r2">
      <label>Jajaran<select id="align"><option value="left">Kiri</option><option value="center">Tengah</option><option value="right">Kanan</option></select></label>
      <label style="justify-content:end"><button class="icon-btn" id="fontAdd" type="button" style="padding:6px 8px">+ Font sendiri</button></label>
    </div>
    <input type="file" id="fontInput" accept=".ttf,.otf,.woff,.woff2" hidden>
    <div class="chks">
      <label class="chk"><input type="checkbox" id="elShow"> Papar</label>
      <label class="chk"><input type="checkbox" id="bold"> Tebal</label>
      <label class="chk"><input type="checkbox" id="upper"> HURUF BESAR</label>
    </div>
  </div>
  <div class="hint" id="imgProps" hidden>Gambar sentiasa di belakang teks. Tarik bucu untuk ubah saiz (nisbah gambar dikekalkan).</div>
  <div class="warn" id="dzMsg"></div>
  <div class="dz-foot"><span class="hint">Perubahan terus ke paparan OBS.</span><button class="link" id="designReset" type="button">Tetapkan semula</button></div>
</div>`;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const SAMPLE = { anugerah: "Anugerah Cemerlang", nama: "Nur Aisyah binti Ahmad", kelas: "6 Bestari" };

  function mount(container, { obs, store, contoh, onTutup } = {}) {
    if (!document.getElementById("kmRekaCss")) {
      const st = document.createElement("style"); st.id = "kmRekaCss"; st.textContent = CSS; document.head.appendChild(st);
    }
    container.insertAdjacentHTML("beforeend", HTML);
    const $ = id => document.getElementById(id);
    const G = KM.gaya;
    let layout = G.normalize(store.get("gaya.layout", null));
    let myFonts = store.get("gaya.fonts", []);          // fonts the teacher added: [{id, name}]
    const assets = {};                                   // id -> data URL, loaded from IndexedDB
    let sel = "nama", drag = null, gTimer = null;
    const designOpen = () => !$("design").hidden;
    const dzMsg = (t, info) => { $("dzMsg").textContent = t || ""; $("dzMsg").style.display = t ? "block" : "none"; $("dzMsg").classList.toggle("info", !!info); };

    function sendGaya() { obs.broadcast({ type: "gaya", layout }).catch(() => {}); }
    async function sendAset(id) {
      try {
        const rec = await KM.idb.get("aset:" + id); if (!rec) return;
        await obs.broadcast({ type: "aset", id, kind: rec.kind, data: rec.data });
      } catch (_) {}
    }
    obs.on("custom", d => {
      if (!d || d.app !== "kawalan-majlis") return;
      if (d.type === "minta-aset") sendAset(d.id);
      else if (d.type === "paparan-sedia") sendGaya();
    });
    // Save at once; send to OBS at most every 120 ms while dragging.
    function changed(now) {
      store.set("gaya.layout", layout);
      if (now) { clearTimeout(gTimer); gTimer = null; sendGaya(); }
      else if (!gTimer) gTimer = setTimeout(() => { gTimer = null; sendGaya(); }, 120);
      drawPreview(); props();
    }
    async function loadAsset(id) {
      if (assets[id]) return true;
      try {
        const rec = await KM.idb.get("aset:" + id); if (!rec) return false;
        if (rec.kind === "font") await G.registerFont(id, rec.data);
        assets[id] = rec.data; return true;
      } catch (_) { return false; }
    }
    async function loadAssets() {
      await Promise.all([...G.assetIds(layout), ...myFonts.map(f => f.id)].map(loadAsset));
      // A picture or font that is gone from storage: fall back instead of showing nothing.
      if (layout.img && !assets[layout.img.id]) layout.img = null;
      for (const k of G.KEYS) { const f = layout.el[k].font; if (f.startsWith("u:") && !assets[f.slice(2)]) layout.el[k].font = "montserrat"; }
      myFonts = myFonts.filter(f => assets[f.id]);
      if (designOpen()) { drawPreview(); props(); }
    }

    // ----- preview -----
    const scale = () => $("pv").clientWidth / G.W;
    const boxOf = k => k === "img" ? layout.img : layout.el[k];
    function pvData() {
      const r = (contoh && contoh()) || {};
      return { anugerah: r.anugerah || SAMPLE.anugerah, nama: r.nama || SAMPLE.nama, kelas: r.kelas || SAMPLE.kelas };
    }
    function drawPreview(guides) {
      if (!designOpen()) return;
      const s = scale();
      $("pvStage").style.transform = `scale(${s})`;
      G.render($("pvStage"), layout, pvData(), assets);
      const ui = $("pvUi"); ui.textContent = "";
      const order = (layout.img && assets[layout.img.id] ? ["img"] : []).concat(G.KEYS.filter(k => layout.el[k].show));
      for (const k of order) {
        const b = boxOf(k), hb = document.createElement("div");
        const hh = Math.max(b.h * s, 12);
        hb.className = "hb" + (k === sel ? " sel" : ""); hb.dataset.k = k;
        hb.style.cssText = `left:${b.x * s}px;top:${b.y * s + (b.h * s - hh) / 2}px;width:${b.w * s}px;height:${hh}px`;
        if (k === sel) for (const h of ["nw", "ne", "sw", "se"]) { const d = document.createElement("div"); d.className = "hd"; d.dataset.h = h; hb.appendChild(d); }
        ui.appendChild(hb);
      }
      if (guides && guides.v) ui.insertAdjacentHTML("beforeend", '<div class="gd v"></div>');
      if (guides && guides.h) ui.insertAdjacentHTML("beforeend", '<div class="gd h"></div>');
    }
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    $("pvUi").addEventListener("pointerdown", e => {
      const hb = e.target.closest(".hb"); if (!hb) return;
      const k = hb.dataset.k;
      if (k !== sel) { sel = k; props(); }
      const b = boxOf(k);
      drag = { k, h: e.target.dataset.h || null, x0: e.clientX, y0: e.clientY, o: { ...b }, ratio: b.w / b.h };
      $("pvUi").setPointerCapture(e.pointerId); e.preventDefault();
      drawPreview();
    });
    $("pvUi").addEventListener("pointermove", e => {
      if (!drag) return;
      const s = scale(), dx = (e.clientX - drag.x0) / s, dy = (e.clientY - drag.y0) / s;
      const b = boxOf(drag.k), o = drag.o, img = drag.k === "img", guides = {};
      if (!drag.h) {
        b.x = clamp(o.x + dx, Math.min(0, G.W - o.w), Math.max(0, G.W - o.w));
        b.y = clamp(o.y + dy, Math.min(0, G.H - o.h), Math.max(0, G.H - o.h));
        const snap = 8 / s;   // snap to the centre lines (8 screen pixels)
        if (Math.abs(b.x + b.w / 2 - G.W / 2) < snap) { b.x = G.W / 2 - b.w / 2; guides.v = true; }
        if (Math.abs(b.y + b.h / 2 - G.H / 2) < snap) { b.y = G.H / 2 - b.h / 2; guides.h = true; }
      } else {
        const minW = img ? 40 : 80, minH = img ? 20 : 16;
        let x = o.x, y = o.y, w = o.w, h = o.h;
        if (drag.h.includes("e")) w = o.w + dx;
        if (drag.h.includes("w")) w = o.w - dx;
        if (drag.h.includes("s")) h = o.h + dy;
        if (drag.h.includes("n")) h = o.h - dy;
        w = Math.max(minW, w); h = Math.max(minH, h);
        if (img) h = w / drag.ratio;   // keep the picture's proportions
        if (drag.h.includes("w")) x = o.x + o.w - w;
        if (drag.h.includes("n")) y = o.y + o.h - h;
        Object.assign(b, { x, y, w, h });
      }
      for (const f of ["x", "y", "w", "h"]) b[f] = Math.round(b[f]);
      store.set("gaya.layout", layout);
      if (!gTimer) gTimer = setTimeout(() => { gTimer = null; sendGaya(); }, 120);
      drawPreview(guides);
    });
    const endDrag = () => { if (!drag) return; drag = null; changed(true); };
    $("pvUi").addEventListener("pointerup", endDrag);
    $("pvUi").addEventListener("pointercancel", endDrag);
    // Arrow keys move the selected item (Shift = 10x) while the designer is open; the dock's own keys wait.
    document.addEventListener("keydown", e => {
      if (!designOpen() || ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
      const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      const b = boxOf(sel); if (!m || !b) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const step = e.shiftKey ? 20 : 2;
      b.x = clamp(b.x + m[0] * step, Math.min(0, G.W - b.w), Math.max(0, G.W - b.w));
      b.y = clamp(b.y + m[1] * step, Math.min(0, G.H - b.h), Math.max(0, G.H - b.h));
      changed();
    }, true);
    new ResizeObserver(() => drawPreview()).observe($("pv"));

    // ----- controls -----
    $("tpl").innerHTML = Object.entries(G.TEMPLATES).map(([k, t]) => `<button type="button" data-t="${k}">${esc(t.label)}</button>`).join("");
    $("tpl").onclick = e => { const b = e.target.closest("[data-t]"); if (!b) return; G.applyTemplate(layout, b.dataset.t); changed(true); };
    $("pickEl").onclick = e => { const b = e.target.closest("[data-k]"); if (!b || b.disabled) return; sel = b.dataset.k; drawPreview(); props(); };
    const el = () => layout.el[sel];
    function fontOptions() {
      $("font").innerHTML = G.FONTS.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join("") +
        myFonts.map(f => `<option value="u:${f.id}">${esc(f.name)} (sendiri)</option>`).join("");
    }
    function props() {
      if (!designOpen()) return;
      const hasImg = !!(layout.img && assets[layout.img.id]);
      if (sel === "img" && !hasImg) sel = "nama";
      $("pickEl").querySelectorAll("button").forEach(b => { b.classList.toggle("on", b.dataset.k === sel); if (b.dataset.k === "img") b.disabled = !hasImg; });
      $("imgName").textContent = hasImg ? (layout.img.name || "Gambar") + " · " + layout.img.w + " × " + layout.img.h : "Tiada gambar";
      $("imgPick").textContent = hasImg ? "Tukar" : "Pilih gambar";
      $("imgDel").hidden = !hasImg;
      $("shade").value = layout.shade; $("shadow").checked = !!layout.shadow;
      $("elProps").hidden = sel === "img"; $("imgProps").hidden = sel !== "img";
      if (sel === "img") return;
      const e = el();
      if ($("font").options.length !== G.FONTS.length + myFonts.length) fontOptions();
      $("font").value = e.font; $("color").value = e.color; $("align").value = e.align;
      $("elShow").checked = e.show; $("bold").checked = e.weight >= 700; $("upper").checked = e.upper;
    }
    $("font").onchange = () => {
      const e = el(); e.font = $("font").value;
      // One-weight fonts (script, display) look wrong with fake bold.
      const f = G.FONTS.find(x => x.id === e.font);
      if (f && Object.keys(f.files).length === 1) e.weight = +Object.keys(f.files)[0];
      changed(true);
    };
    $("color").oninput = () => { el().color = $("color").value; changed(); };
    $("color").onchange = () => changed(true);
    $("align").onchange = () => { el().align = $("align").value; changed(true); };
    $("elShow").onchange = () => { el().show = $("elShow").checked; changed(true); };
    $("bold").onchange = () => { el().weight = $("bold").checked ? 800 : 500; changed(true); };
    $("upper").onchange = () => { el().upper = $("upper").checked; changed(true); };
    $("shade").onchange = () => { layout.shade = $("shade").value; changed(true); };
    $("shadow").onchange = () => { layout.shadow = $("shadow").checked; changed(true); };

    // Picture: scaled to at most 1920x1080 and kept as WebP (transparency stays, file stays small).
    $("imgPick").onclick = () => $("imgInput").click();
    $("imgInput").onchange = async e => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      dzMsg("Memproses gambar…", true);
      try {
        const bmp = await createImageBitmap(f);
        const k = Math.min(1, G.W / bmp.width, G.H / bmp.height);
        const c = document.createElement("canvas");
        c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
        c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); bmp.close && bmp.close();
        const data = c.toDataURL("image/webp", 0.9);
        const id = "img" + Date.now();
        await KM.idb.set("aset:" + id, { kind: "img", data, name: f.name });
        const old = layout.img && layout.img.id;
        assets[id] = data;
        // Full-screen frames fill the canvas; smaller pictures sit behind the name.
        let box;
        if (Math.abs(c.width / c.height - 16 / 9) < 0.03) box = { x: 0, y: 0, w: G.W, h: G.H };
        else {
          const n = layout.el.nama, w = c.width, h = c.height;
          box = { x: Math.round((G.W - w) / 2), y: Math.round(clamp(n.y + n.h / 2 - h / 2, 0, G.H - h)), w, h };
        }
        layout.img = { id, name: f.name, ...box };
        sel = "img"; changed(true);
        if (old && old !== id) { KM.idb.del("aset:" + old).catch(() => {}); delete assets[old]; }
        dzMsg("Gambar dipasang. Seret dan ubah saiz dalam pratonton.", true);
        setTimeout(() => dzMsg(""), 5000);
      } catch (err) { dzMsg("Tidak dapat membuka gambar: " + err.message); }
    };
    $("imgDel").onclick = () => {
      if (!layout.img) return;
      KM.idb.del("aset:" + layout.img.id).catch(() => {}); delete assets[layout.img.id];
      layout.img = null; sel = "nama"; changed(true);
    };

    // Teacher's own font file (.ttf/.otf/.woff/.woff2).
    $("fontAdd").onclick = () => $("fontInput").click();
    $("fontInput").onchange = async e => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      if (f.size > 4 * 1024 * 1024) { dzMsg("Fail font terlalu besar (had 4 MB)."); return; }
      try {
        const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
        const id = "fon" + Date.now();
        await G.registerFont(id, data);          // throws if the file is not a font
        await KM.idb.set("aset:" + id, { kind: "font", data, name: f.name });
        assets[id] = data;
        myFonts.push({ id, name: f.name.replace(/\.(ttf|otf|woff2?)$/i, "") }); store.set("gaya.fonts", myFonts);
        fontOptions(); el().font = "u:" + id; changed(true);
        dzMsg("Font ditambah dan dipakai pada " + sel + ".", true); setTimeout(() => dzMsg(""), 5000);
      } catch (err) { dzMsg("Fail ini bukan font yang boleh dibaca."); }
    };

    let resetArm = null;
    $("designReset").onclick = () => {
      const b = $("designReset");
      if (!resetArm) { b.textContent = "Tekan sekali lagi untuk sahkan"; resetArm = setTimeout(() => { resetArm = null; b.textContent = "Tetapkan semula"; }, 3000); return; }
      clearTimeout(resetArm); resetArm = null; b.textContent = "Tetapkan semula";
      if (layout.img) { KM.idb.del("aset:" + layout.img.id).catch(() => {}); delete assets[layout.img.id]; }
      layout = G.defaults(); sel = "nama"; changed(true);
    };
    function buka() { $("design").hidden = false; fontOptions(); props(); drawPreview(); }
    function tutup() { $("design").hidden = true; onTutup && onTutup(); }
    $("designClose").onclick = tutup;

    loadAssets();
    return { buka, tutup, terbuka: designOpen, sendGaya, segar: () => drawPreview() };
  }

  window.KM = window.KM || {};
  window.KM.reka = { mount };
})();
