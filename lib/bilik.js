/* Kawalan Majlis: Bilik Kawalan — the large layout (vMix-style) of the same panel.
 * Preview | transitions | Program, an input bar (OBS scenes), audio mixer, REC/LIVE, stats.
 * Pure helpers are exported for Node tests; mount() needs a browser + obs-websocket client. */
(function (root, factory) {
  const B = factory();
  if (typeof module === "object" && module.exports) module.exports = B;
  else { root.KM = root.KM || {}; root.KM.bilik = B; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const HITAM = "Kawalan Majlis - Hitam";
  const PAPARAN = "Kawalan Majlis - Paparan";

  // ---------- pure helpers ----------
  /** Scenes as the operator sees them in OBS's Scenes panel (top first), minus our helper scene. */
  function senaraiInput(scenes) {
    return (scenes || []).slice().sort((a, b) => b.sceneIndex - a.sceneIndex).map(s => s.sceneName).filter(n => n !== HITAM);
  }
  // Fader: 0..100 ↔ -60..0 dB (0 = silent).
  const sliderKeDb = v => (v <= 0 ? -100 : Math.round((v / 100) * 60 - 60) || 0);
  const dbKeSlider = db => (db <= -60 ? 0 : Math.max(0, Math.min(100, Math.round(((db + 60) / 60) * 100))));
  /** Meter height from a linear peak (0..1): -60 dBFS = 0 %, 0 dBFS = 100 %. */
  function meterPeratus(mul) {
    if (!(mul > 0)) return 0;
    const db = 20 * Math.log10(mul);
    return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
  }
  const masa = ms => { const s = Math.max(0, Math.floor((ms || 0) / 1000)); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(x => String(x).padStart(2, "0")).join(":"); };
  const NAMA = { "Kawalan Majlis - Video": "Lagu / video", "Kawalan Majlis - Muzik Latar": "Muzik latar" };
  const namaMesra = n => NAMA[n] || n;
  const audioDipapar = n => n !== PAPARAN;

  const CSS = `
  .bk-atas{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:7px 10px}
  .bk-atas .sp{flex:1}
  .bk-jam{font-variant-numeric:tabular-nums;font-weight:800;font-size:15px}
  .bk-stat{font-size:12px;color:var(--mute);font-variant-numeric:tabular-nums}
  .bk-stat b{color:var(--ok)} .bk-stat b.buruk{color:var(--live)}
  .bk-out{border:1px solid var(--line);background:var(--panel2);border-radius:7px;padding:6px 12px;font-weight:800;display:flex;gap:7px;align-items:center;position:relative;overflow:hidden}
  .bk-out i{width:9px;height:9px;border-radius:50%;background:var(--dim)}
  .bk-out.on{background:var(--live);border-color:var(--live)} .bk-out.on i{background:#fff;animation:p 1.2s infinite}
  .bk-out small{font-weight:600;font-variant-numeric:tabular-nums}
  .bk-out .tahan{position:absolute;left:0;bottom:0;height:3px;width:0;background:#fff}
  .bk-mon{display:grid;grid-template-columns:1fr 140px 1fr;gap:10px}
  .bk-scr{background:var(--panel);border-radius:10px;overflow:hidden;border:2px solid var(--line);min-width:0}
  .bk-scr .bar{display:flex;justify-content:space-between;gap:8px;padding:5px 10px;font-weight:800;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase}
  .bk-scr .bar span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:none;letter-spacing:0}
  .bk-pv{border-color:#f08a24} .bk-pv .bar{background:#f08a24;color:#2a1300}
  .bk-pg{border-color:var(--live)} .bk-pg .bar{background:var(--live);color:#fff}
  .bk-scr img{display:block;width:100%;aspect-ratio:16/9;background:#000;object-fit:contain}
  .bk-mati{display:flex;align-items:center;justify-content:center;aspect-ratio:16/9;background:#000;color:var(--mute);flex-direction:column;gap:8px;font-size:12.5px;padding:10px;text-align:center}
  .bk-tr{display:flex;flex-direction:column;gap:7px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:9px;min-width:0}
  .bk-tr .h{font-size:10.5px;color:var(--mute);font-weight:800;letter-spacing:.08em;text-align:center}
  .bk-tb{border-radius:8px;padding:9px 6px;font-weight:900;font-size:15px;background:var(--panel2);border:1px solid var(--line)}
  .bk-tb.cut{background:#e9ecf1;color:#111;border-color:#e9ecf1} .bk-tb.fade{background:#3b5bdb;border-color:#3b5bdb}
  .bk-tb.ftb.on{background:var(--live);border-color:var(--live)}
  .bk-tbar{flex:1 1 0;display:flex;justify-content:center;min-height:50px}
  .bk-tbar input{writing-mode:vertical-lr;direction:rtl;width:30px;height:100%;accent-color:#3b5bdb}
  .bk-dur{display:flex;gap:4px;align-items:center;justify-content:center;font-size:11px;color:var(--mute)}
  .bk-dur select{background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:5px;padding:2px}
  .bk-in{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 10px}
  .bk-ih{display:flex;justify-content:space-between;gap:8px;color:var(--mute);font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-bottom:7px}
  .bk-ih span:last-child{text-transform:none;letter-spacing:0;font-weight:500}
  .bk-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
  .bk-tile{background:var(--panel2);border:2px solid var(--line);border-radius:8px;overflow:hidden;cursor:pointer;user-select:none;min-width:0}
  .bk-tile.is-pv{border-color:#f08a24} .bk-tile.is-pg{border-color:var(--live)}
  .bk-tile .th{position:relative;aspect-ratio:16/9;background:#000}
  .bk-tile .th img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
  .bk-tile .no{position:absolute;left:5px;top:4px;font-size:11px;font-weight:800;background:#000a;border-radius:3px;padding:0 5px}
  .bk-tile .st{position:absolute;right:5px;top:4px;font-size:9.5px;font-weight:800;border-radius:3px;padding:1px 5px}
  .bk-tile.is-pv .st{background:#f08a24;color:#2a1300} .bk-tile.is-pg .st{background:var(--live)}
  .bk-tile .nm{padding:4px 7px;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .bk-mix{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:9px 10px;display:flex;flex-direction:column;gap:8px;min-width:0}
  .bk-mix .ch{display:flex;justify-content:space-between;color:var(--mute);font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
  .bk-chs{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:8px}
  .bk-c{display:flex;flex-direction:column;align-items:center;gap:6px;background:var(--panel2);border-radius:8px;padding:8px 4px;min-width:0}
  .bk-c .n{font-size:11px;font-weight:700;text-align:center;line-height:1.2;min-height:27px;word-break:break-word}
  .bk-fad{display:flex;gap:5px;align-items:stretch;height:120px}
  .bk-meter{width:7px;background:#0007;border-radius:3px;position:relative;overflow:hidden}
  .bk-meter i{position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(0deg,var(--ok) 0 65%,#e7c94b 65% 85%,var(--live) 85%)}
  .bk-fad input{writing-mode:vertical-lr;direction:rtl;width:22px;accent-color:var(--text)}
  .bk-db{font-size:10.5px;color:var(--mute);font-variant-numeric:tabular-nums}
  .bk-mb{display:flex;gap:3px}
  .bk-mb button{border:1px solid var(--line);background:var(--panel);border-radius:4px;font-size:10.5px;font-weight:800;padding:2px 6px}
  .bk-mb button.m.on{background:var(--live);border-color:var(--live)}
  .bk-mb button.s.on{background:#e7c94b;color:#222;border-color:#e7c94b}
  .bk-duck{font-size:9.5px;font-weight:800;border-radius:3px;padding:1px 5px;background:#2b3a6b;color:#bcd0ff;visibility:hidden}
  .bk-duck.on{visibility:visible}
  @media (max-width:760px){ .bk-mon{grid-template-columns:1fr 1fr} .bk-tr{grid-column:1/-1;flex-direction:row;flex-wrap:wrap;align-items:center} .bk-tr .bk-tb{flex:1} .bk-tr .h{display:none} .bk-tbar{min-height:0;flex:2} .bk-tbar input{writing-mode:horizontal-tb;direction:ltr;width:100%;height:auto} }
  @media (max-width:460px){ .bk-mon{grid-template-columns:1fr} }`;

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /** mount({atas, mon, input, audio}, {obs, store, toast, ditunduk}) → {aktif(bool), segar()} */
  function mount(el, { obs, store, toast, ditunduk }) {
    if (!document.getElementById("kmBilikCss")) {
      const st = document.createElement("style"); st.id = "kmBilikCss"; st.textContent = CSS; document.head.appendChild(st);
    }
    el.atas.innerHTML = `<div class="bk-atas"><span class="bk-jam" id="bkJam">--:--:--</span>
      <span class="bk-stat">Bingkai tercicir: <b id="bkDrop">0</b> · CPU OBS <span id="bkCpu">–</span></span><span class="sp"></span>
      <button class="bk-out" id="bkRec" type="button" title="Mula / henti rakaman"><i></i>REC <small id="bkRecT"></small></button>
      <button class="bk-out" id="bkLive" type="button" title="Mula siaran. Untuk henti: tekan dan tahan 2 saat"><i></i>LIVE <small id="bkLiveT"></small><span class="tahan" id="bkTahan"></span></button></div>`;
    el.mon.innerHTML = `<div class="bk-mon">
      <div class="bk-scr bk-pv"><div class="bar"><span>Preview · belum keluar</span><span id="bkPvN"></span></div><div id="bkPvBox"><img id="bkPv" alt=""></div></div>
      <div class="bk-tr"><div class="h">PERALIHAN</div>
        <button class="bk-tb cut" id="bkCut" type="button" title="Enter">CUT</button>
        <button class="bk-tb fade" id="bkFade" type="button" title="F">FADE</button>
        <div class="bk-tbar"><input type="range" id="bkTbar" min="0" max="100" value="0" title="Tarik melepasi separuh dan lepaskan = FADE"></div>
        <div class="bk-dur">Tempoh <select id="bkDur"><option value="300">0.3 s</option><option value="500">0.5 s</option><option value="1000">1 s</option><option value="2000">2 s</option></select></div>
        <button class="bk-tb ftb" id="bkFtb" type="button" title="Skrin hitam ke penonton. Tekan lagi untuk kembali.">FTB</button></div>
      <div class="bk-scr bk-pg"><div class="bar"><span>Program · ke udara</span><span id="bkPgN"></span></div><img id="bkPg" alt=""></div></div>`;
    el.input.innerHTML = `<div class="bk-in"><div class="bk-ih"><span>Input (scene OBS)</span><span>Klik = Preview · klik dua kali = terus ke Program · <kbd>1</kbd>–<kbd>9</kbd> · <kbd>Enter</kbd> CUT · <kbd>F</kbd> FADE</span></div><div class="bk-row" id="bkRow"></div></div>`;
    el.audio.innerHTML = `<div class="bk-mix"><div class="ch"><span>Audio</span><span style="text-transform:none;letter-spacing:0;font-weight:500">Klik input tidak menyentuh audio</span></div><div class="bk-chs" id="bkChs"></div></div>`;
    const $ = id => document.getElementById(id);

    let aktif = false, scenes = [], pv = null, pg = null, studio = false, sebelumFtb = null, pvSebelumFtb = null;
    let peralihan = { cut: null, fade: null };

    // ---------- scenes, studio mode, transitions ----------
    async function segar() {
      if (obs.state !== "connected") return;
      try {
        const [sl, sm, tl] = await Promise.all([obs.call("GetSceneList"), obs.call("GetStudioModeEnabled"), obs.call("GetSceneTransitionList")]);
        scenes = senaraiInput(sl.scenes); pg = sl.currentProgramSceneName; pv = sl.currentPreviewSceneName; studio = sm.studioModeEnabled;
        peralihan.cut = (tl.transitions.find(t => t.transitionKind === "cut_transition") || {}).transitionName || null;
        peralihan.fade = (tl.transitions.find(t => t.transitionKind === "fade_transition") || {}).transitionName || null;
        renderInput(); renderMon();
      } catch (_) {}
    }
    function renderMon() {
      $("bkPvN").textContent = studio ? (pv || "") : "";
      $("bkPgN").textContent = pg === HITAM ? "SKRIN HITAM" : (pg || "");
      $("bkFtb").classList.toggle("on", pg === HITAM);
      if (!studio) {
        if (!$("bkPvMati")) $("bkPvBox").innerHTML = `<div class="bk-mati" id="bkPvMati">Studio Mode OBS belum dihidupkan.<button class="bk-tb" id="bkStudio" type="button" style="font-size:13px">Hidupkan Studio Mode</button></div>`;
        $("bkStudio").onclick = () => obs.call("SetStudioModeEnabled", { studioModeEnabled: true }).catch(e => toast("Gagal: " + e.message, true));
      } else if ($("bkPvMati")) $("bkPvBox").innerHTML = `<img id="bkPv" alt="">`;
    }
    function renderInput() {
      const row = $("bkRow");
      const ada = [...row.children].map(c => c.dataset.n).join("\n");
      if (ada !== scenes.join("\n")) {
        row.innerHTML = scenes.map((n, k) => `<div class="bk-tile" data-n="${esc(n)}"><div class="th"><img alt=""><span class="no">${k + 1}</span><span class="st"></span></div><div class="nm">${esc(n)}</div></div>`).join("") ||
          `<div class="bk-mati" style="aspect-ratio:auto">Tiada scene dalam OBS.</div>`;
      }
      for (const t of row.querySelectorAll(".bk-tile")) {
        const n = t.dataset.n, isPg = n === pg, isPv = studio && n === pv && !isPg;
        t.classList.toggle("is-pg", isPg); t.classList.toggle("is-pv", isPv);
        t.querySelector(".st").textContent = isPg ? "PROGRAM" : isPv ? "PREVIEW" : "";
        t.querySelector(".st").style.display = isPg || isPv ? "" : "none";
      }
    }
    async function keProgram(nama, kind) {
      const tn = kind === "cut" ? peralihan.cut : peralihan.fade;
      if (tn) await obs.call("SetCurrentSceneTransition", { transitionName: tn });
      if (kind !== "cut") await obs.call("SetCurrentSceneTransitionDuration", { transitionDuration: +$("bkDur").value });
      if (studio) {
        if (nama && nama !== pv) {
          await obs.call("SetCurrentPreviewScene", { sceneName: nama });
          // OBS applies the new Preview on its UI thread: wait for it, or the old Preview would go out.
          for (let k = 0; k < 20; k++) { if ((await obs.call("GetCurrentPreviewScene")).currentPreviewSceneName === nama) break; await sleep(50); }
        }
        await obs.call("TriggerStudioModeTransition");
      } else if (nama) await obs.call("SetCurrentProgramScene", { sceneName: nama });
    }
    const salah = e => toast("Gagal: " + e.message, true);
    function pilih(nama) {
      if (!nama) return;
      if (!studio) return toast("Hidupkan Studio Mode dahulu (butang dalam kotak Preview).", true);
      obs.call("SetCurrentPreviewScene", { sceneName: nama }).catch(salah);
    }
    $("bkRow").onclick = e => { const t = e.target.closest("[data-n]"); if (t) pilih(t.dataset.n); };
    $("bkRow").ondblclick = e => { const t = e.target.closest("[data-n]"); if (t) keProgram(t.dataset.n, "cut").catch(salah); };
    $("bkCut").onclick = () => keProgram(null, "cut").catch(salah);
    $("bkFade").onclick = () => keProgram(null, "fade").catch(salah);
    $("bkDur").value = String(store.get("majlis.bilik.dur", 500));
    $("bkDur").onchange = () => store.set("majlis.bilik.dur", +$("bkDur").value);

    // T-bar: OBS 32 ignores SetTBarPosition from obs-websocket (checked 24 Nov), so a partial mix is not possible
    // from a panel. Dragging past the middle and letting go runs a FADE; letting go before the middle cancels.
    $("bkTbar").addEventListener("change", () => {
      const v = +$("bkTbar").value; $("bkTbar").value = 0;
      if (v > 50) keProgram(null, "fade").catch(salah);
    });

    // FTB = fade to our black scene, and back to where we were.
    async function pastikanHitam() {
      const { scenes: s } = await obs.call("GetSceneList");
      if (s.some(x => x.sceneName === HITAM)) return;
      const { baseWidth, baseHeight } = await obs.call("GetVideoSettings");
      await obs.call("CreateScene", { sceneName: HITAM });
      await obs.call("CreateInput", { sceneName: HITAM, inputName: HITAM + " (warna)", inputKind: "color_source_v3", inputSettings: { color: 0xff000000, width: baseWidth, height: baseHeight }, sceneItemEnabled: true });
    }
    $("bkFtb").onclick = async () => {
      try {
        if (pg !== HITAM) {
          await pastikanHitam();
          sebelumFtb = pg; pvSebelumFtb = studio ? pv : null;
          await keProgram(HITAM, "fade");
          if (pvSebelumFtb) { await sleep(+$("bkDur").value + 150); await obs.call("SetCurrentPreviewScene", { sceneName: pvSebelumFtb }).catch(() => {}); }
        } else {
          const balik = sebelumFtb && scenes.includes(sebelumFtb) ? sebelumFtb : scenes[0];
          const simpanPv = studio ? pv : null;
          await keProgram(balik, "fade");
          if (simpanPv && simpanPv !== HITAM) { await sleep(+$("bkDur").value + 150); await obs.call("SetCurrentPreviewScene", { sceneName: simpanPv }).catch(() => {}); }
        }
      } catch (e) { salah(e); }
    };

    obs.on("event", ev => {
      const d = ev.eventData || {}, t = ev.eventType;
      if (t === "CurrentProgramSceneChanged") { pg = d.sceneName; renderInput(); renderMon(); }
      else if (t === "CurrentPreviewSceneChanged") { pv = d.sceneName; renderInput(); renderMon(); }
      else if (t === "StudioModeStateChanged") { studio = d.studioModeEnabled; segar(); }
      else if (/^Scene(Created|Removed|NameChanged|ListChanged)$/.test(t)) segar();
      else if (t === "InputVolumeMeters") meter(d.inputs || []);
      else if (t === "InputMuteStateChanged" || t === "InputVolumeChanged" || t === "InputAudioMonitorTypeChanged") kemasSaluran(d.inputName);
      else if (/^Input(Created|Removed|NameChanged)$/.test(t)) muatMixer();
      else if (t === "RecordStateChanged" || t === "StreamStateChanged") statusOutput();
    });

    // ---------- pictures (only while the large layout is visible) ----------
    let gilir = 0, larian = 0;
    async function gambar(nama, w, q) {
      const r = await obs.call("GetSourceScreenshot", { sourceName: nama, imageFormat: "jpg", imageWidth: w, imageHeight: Math.round(w * 9 / 16), imageCompressionQuality: q });
      return r.imageData;
    }
    async function loopMonitor(id) {
      while (aktif && larian === id) {
        const t = performance.now();
        if (!document.hidden && obs.state === "connected") {
          try {
            if (studio && pv && $("bkPv")) $("bkPv").src = await gambar(pv, 640, 70);
            if (pg) $("bkPg").src = await gambar(pg, 640, 70);
          } catch (_) {}
        }
        await sleep(Math.max(20, 100 - (performance.now() - t)));
      }
    }
    async function loopInput(id) {
      while (aktif && larian === id) {
        const tiles = [...$("bkRow").querySelectorAll(".bk-tile")], t = performance.now();
        const papar = $("bkRow").offsetParent !== null;
        if (tiles.length && papar && !document.hidden && obs.state === "connected") {
          const tile = tiles[gilir++ % tiles.length];
          try { tile.querySelector("img").src = await gambar(tile.dataset.n, 320, 60); } catch (_) {}
        }
        await sleep(Math.max(20, 1000 / (2 * Math.max(1, tiles.length)) - (performance.now() - t)));
      }
    }

    // ---------- audio mixer ----------
    let saluran = [];   // [{nama, monitorAsal}]
    async function muatMixer() {
      if (obs.state !== "connected") return;
      try {
        const { inputs } = await obs.call("GetInputList");
        const ada = [];
        for (const i of inputs) {
          if (!audioDipapar(i.inputName)) continue;
          try { const v = await obs.call("GetInputVolume", { inputName: i.inputName }); ada.push({ nama: i.inputName, db: v.inputVolumeDb }); } catch (_) { /* no audio */ }
        }
        const lama = new Map(saluran.map(s => [s.nama, s]));
        saluran = ada.map(a => Object.assign({ monitorAsal: null }, lama.get(a.nama) || {}, { nama: a.nama }));
        $("bkChs").innerHTML = saluran.map((s, k) => `<div class="bk-c" data-k="${k}"><div class="n">${esc(namaMesra(s.nama))}</div>
          <span class="bk-duck">DIKECILKAN</span>
          <div class="bk-fad"><div class="bk-meter"><i></i></div><input type="range" min="0" max="100" title="Kuat perlahan"><div class="bk-meter"><i></i></div></div>
          <div class="bk-db"></div><div class="bk-mb"><button class="m" type="button" title="Bisu">M</button><button class="s" type="button" title="Dengar di fon kepala (audio monitoring OBS)">S</button></div></div>`).join("") ||
          `<div class="bk-mati" style="aspect-ratio:auto">Tiada sumber bunyi dalam OBS.</div>`;
        for (const s of saluran) kemasSaluran(s.nama);
      } catch (_) {}
    }
    const elSaluran = nama => { const k = saluran.findIndex(s => s.nama === nama); return k < 0 ? null : $("bkChs").querySelector(`[data-k="${k}"]`); };
    async function kemasSaluran(nama) {
      const c = elSaluran(nama); if (!c) return;
      try {
        const [v, m, mon] = await Promise.all([obs.call("GetInputVolume", { inputName: nama }), obs.call("GetInputMute", { inputName: nama }), obs.call("GetInputAudioMonitorType", { inputName: nama })]);
        const sl = c.querySelector("input");
        if (document.activeElement !== sl) sl.value = dbKeSlider(v.inputVolumeDb);
        c.querySelector(".bk-db").textContent = v.inputVolumeDb <= -60 ? "-∞ dB" : v.inputVolumeDb.toFixed(1) + " dB";
        c.querySelector(".m").classList.toggle("on", m.inputMuted);
        c.querySelector(".s").classList.toggle("on", mon.monitorType !== "OBS_MONITORING_TYPE_NONE");
      } catch (_) {}
    }
    let faderT = null;
    $("bkChs").addEventListener("input", e => {
      const c = e.target.closest("[data-k]"); if (!c || e.target.type !== "range") return;
      const s = saluran[+c.dataset.k], db = sliderKeDb(+e.target.value);
      c.querySelector(".bk-db").textContent = db <= -60 ? "-∞ dB" : db.toFixed(1) + " dB";
      clearTimeout(faderT); faderT = setTimeout(() => obs.call("SetInputVolume", { inputName: s.nama, inputVolumeDb: db }).catch(() => {}), 40);
    });
    $("bkChs").addEventListener("click", async e => {
      const b = e.target.closest("button"), c = e.target.closest("[data-k]"); if (!b || !c) return;
      const s = saluran[+c.dataset.k];
      try {
        if (b.classList.contains("m")) await obs.call("ToggleInputMute", { inputName: s.nama });
        else {
          const { monitorType } = await obs.call("GetInputAudioMonitorType", { inputName: s.nama });
          if (monitorType === "OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT" && s.monitorAsal) await obs.call("SetInputAudioMonitorType", { inputName: s.nama, monitorType: s.monitorAsal });
          else if (monitorType !== "OBS_MONITORING_TYPE_NONE") await obs.call("SetInputAudioMonitorType", { inputName: s.nama, monitorType: "OBS_MONITORING_TYPE_NONE" });
          else { s.monitorAsal = monitorType; await obs.call("SetInputAudioMonitorType", { inputName: s.nama, monitorType: "OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT" }); }
        }
      } catch (err) { salah(err); }
      kemasSaluran(s.nama);
    });
    function meter(list) {
      if (!aktif) return;
      for (const i of list) {
        const c = elSaluran(i.inputName); if (!c) continue;
        const bars = c.querySelectorAll(".bk-meter i"), lv = i.inputLevelsMul || [];
        bars[0].style.height = meterPeratus(lv[0] && lv[0][1]) + "%";
        bars[1].style.height = meterPeratus((lv[1] || lv[0] || [])[1]) + "%";
      }
      const mz = elSaluran("Kawalan Majlis - Muzik Latar");
      if (mz) mz.querySelector(".bk-duck").classList.toggle("on", !!(ditunduk && ditunduk()));
    }

    // ---------- REC / LIVE / stats / clock ----------
    let rec = false, live = false, asas = null;
    async function statusOutput() {
      if (obs.state !== "connected") return;
      try {
        const [r, s] = await Promise.all([obs.call("GetRecordStatus"), obs.call("GetStreamStatus")]);
        rec = r.outputActive; live = s.outputActive;
        $("bkRec").classList.toggle("on", rec); $("bkRecT").textContent = rec ? masa(r.outputDuration) : "";
        $("bkLive").classList.toggle("on", live); $("bkLiveT").textContent = live ? masa(s.outputDuration) : "";
      } catch (_) {}
    }
    $("bkRec").onclick = () => obs.call(rec ? "StopRecord" : "StartRecord").then(() => setTimeout(statusOutput, 300)).catch(salah);
    let tahanT = null;
    $("bkLive").addEventListener("pointerdown", () => {
      if (!live) return;
      $("bkTahan").style.transition = "width 2s linear"; $("bkTahan").style.width = "100%";
      tahanT = setTimeout(() => { tahanT = null; obs.call("StopStream").then(() => setTimeout(statusOutput, 300)).catch(salah); }, 2000);
    });
    const lepas = () => { if (tahanT) { clearTimeout(tahanT); tahanT = null; toast("Untuk henti siaran: tekan dan tahan butang LIVE selama 2 saat."); } $("bkTahan").style.transition = "none"; $("bkTahan").style.width = "0"; };
    $("bkLive").addEventListener("pointerup", lepas);
    $("bkLive").addEventListener("pointerleave", lepas);
    $("bkLive").addEventListener("click", () => {
      if (live) return;
      obs.call("StartStream").then(() => setTimeout(statusOutput, 1500)).catch(e => toast("Siaran tidak dapat dimulakan: " + e.message + ". Semak OBS → Settings → Stream.", true));
    });
    async function statistik() {
      try {
        const s = await obs.call("GetStats");
        const n = s.renderSkippedFrames + s.outputSkippedFrames;
        if (asas === null) asas = n;
        $("bkDrop").textContent = n - asas; $("bkDrop").classList.toggle("buruk", n - asas > 0);
        $("bkCpu").textContent = s.cpuUsage.toFixed(1) + "%";
      } catch (_) {}
    }
    setInterval(() => {
      $("bkJam").textContent = new Date().toTimeString().slice(0, 8);
      if (aktif && (rec || live)) statusOutput();
    }, 1000);
    setInterval(() => { if (aktif) statistik(); }, 2000);

    // Keys (only while the large layout is visible; the dock ignores keys while typing).
    document.addEventListener("keydown", e => {
      if (!aktif || ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName) || e.repeat) return;
      if (/^[1-9]$/.test(e.key)) { const n = scenes[+e.key - 1]; if (n) { e.preventDefault(); pilih(n); } }
      else if (e.key === "Enter") { e.preventDefault(); keProgram(null, "cut").catch(salah); }
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); keProgram(null, "fade").catch(salah); }
    });

    obs.on("state", ({ state }) => { if (state === "connected") { asas = null; segar(); muatMixer(); statusOutput(); } });
    if (obs.state === "connected") { segar(); muatMixer(); statusOutput(); }

    return {
      aktif(on) {
        if (on === aktif) return;
        aktif = on;
        if (on) { larian++; segar(); muatMixer(); statusOutput(); statistik(); loopMonitor(larian); loopInput(larian); }
      },
      segar,
    };
  }

  return { senaraiInput, sliderKeDb, dbKeSlider, meterPeratus, masa, namaMesra, audioDipapar, mount, HITAM };
});
