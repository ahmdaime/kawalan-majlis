/* Kawalan Majlis: shared dock code (connection bar, setup panel, overlay + video install). */
(function () {
  "use strict";
  const SOURCE_NAME = "Kawalan Majlis - Paparan";
  const VIDEO_NAME = "Kawalan Majlis - Video";
  const MUZIK_NAME = "Kawalan Majlis - Muzik Latar";
  const store = {
    get(k, d) { try { const v = localStorage.getItem("km." + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem("km." + k, JSON.stringify(v)); } catch (_) {} },
  };

  function overlayUrl(port, pw) {
    const base = location.href.split(/[?#]/)[0].replace(/[^/]*$/, "");
    return base + "paparan.html?port=" + encodeURIComponent(port) + "&pw=" + encodeURIComponent(pw);
  }

  const BAR_HTML = `
    <div class="conn" id="kmConn"><span class="dot"></span><span class="msg" id="kmConnMsg">Belum bersambung ke OBS</span>
      <button class="icon-btn" id="kmSetupBtn" type="button">Tetapan</button></div>
    <div class="route" id="kmRoute" hidden></div>
    <div class="setup" id="kmSetup">
      <p>Dalam OBS: menu <b>Tools → WebSocket Server Settings</b>. Tandakan <b>Enable WebSocket server</b>, tekan <b>Show Connect Info</b>, salin kata laluan ke sini.</p>
      <div class="row">
        <label>Kata laluan WebSocket<input id="kmPw" type="password" autocomplete="off" spellcheck="false"></label>
        <label style="flex:0 0 80px">Port<input id="kmPort" inputmode="numeric" value="4455"></label>
      </div>
      <button class="b show" id="kmConnect" type="button">Sambung</button>
      <div class="scn" id="kmScenesBox" hidden>
        <p><b>Scene yang ada paparan</b> (nama dan media keluar dalam scene ini sahaja):</p>
        <div class="scn-list" id="kmScenes"></div>
        <button class="b" id="kmInstall" type="button" disabled>Pasang ke scene ditanda</button>
        <p>Studio Mode: letak scene ini di Preview, tekan Papar, semak, kemudian Transition. Tekan butang ini sekali lagi jika ada scene baharu atau kata laluan WebSocket ditukar.</p>
      </div>
      <div class="result" id="kmResult"></div>
      <p style="font-size:11px;opacity:.7">Kawalan Majlis v2.0 oleh Cikgu Aime · perisian bebas GPL (LESEN.txt)</p>
    </div>`;

  /** mount(container, {onConnected, events}) → OBSClient */
  function mount(container, opts = {}) {
    container.insertAdjacentHTML("afterbegin", BAR_HTML);
    const $ = id => document.getElementById(id);
    const S = KM.SUB;
    const obs = new KM.OBSClient({ events: (opts.events || S.General) | S.Scenes | S.SceneItems | S.Ui });
    // Pasang.bat / Pasang.command put the WebSocket password in the dock URL. Adopt it only when it
    // changed since last time (installer ran again), so a password typed by hand later still wins.
    const q = new URLSearchParams(location.search);
    if (q.has("pw") && q.get("pw") !== store.get("urlpw", null)) {
      store.set("urlpw", q.get("pw")); store.set("pw", q.get("pw"));
      if (q.has("port")) store.set("port", +q.get("port") || 4455);
    }
    $("kmPw").value = store.get("pw", "");
    $("kmPort").value = store.get("port", 4455);

    let overlaySeen = false, checkTimer = null;
    const setMsg = (cls, msg) => { $("kmConn").className = "conn " + cls; $("kmConnMsg").textContent = msg; };
    const result = (cls, msg) => { $("kmResult").className = "result " + cls; $("kmResult").textContent = msg; };
    const showConnected = () => overlaySeen
      ? setMsg("ok", "Bersambung · paparan OBS sedia")
      : setMsg("wait", "Bersambung, tetapi paparan belum dikesan. Buka Tetapan → Pasang paparan.");
    $("kmSetupBtn").onclick = () => { $("kmSetup").classList.toggle("open"); if ($("kmSetup").classList.contains("open")) loadScenes(); };

    // ---- scene checklist ----
    async function loadScenes() {
      if (obs.state !== "connected") { $("kmScenesBox").hidden = true; return; }
      try {
        const names = (await sceneNames(obs)).reverse();   // OBS lists bottom-up; show as in the Scenes panel
        const has = await Promise.all(names.map(n => itemId(obs, n, SOURCE_NAME)));
        // Keep the operator's unsaved ticks while the list refreshes.
        const ticked = new Map([...$("kmScenes").querySelectorAll("input")].map(i => [i.value, i.checked]));
        $("kmScenes").replaceChildren(...names.map((n, i) => {
          const l = document.createElement("label"), c = document.createElement("input");
          c.type = "checkbox"; c.value = n; c.checked = ticked.has(n) ? ticked.get(n) : !!has[i];
          l.append(c, document.createTextNode(" " + n)); return l;
        }));
        $("kmScenesBox").hidden = false;
      } catch (e) { result("bad", "Gagal baca senarai scene: " + e.message); }
    }

    // ---- where does Papar go right now? ----
    let routeTimer = null;
    const refreshRoute = () => { clearTimeout(routeTimer); routeTimer = setTimeout(showRoute, 150); };
    async function showRoute() {
      const el = $("kmRoute");
      if (obs.state !== "connected") { el.hidden = true; return; }
      try {
        const r = await routeInfo(obs);
        const list = r.scenes.length ? r.scenes.map(n => "«" + n + "»").join(", ") : "";
        let cls, msg;
        if (!r.scenes.length) { cls = "warn"; msg = "Paparan belum dipasang. Buka Tetapan, tanda scene, tekan Pasang."; }
        else if (r.inProgram) { cls = "live"; msg = "PROGRAM: tekan Papar terus keluar ke penonton (scene «" + r.program + "»)."; }
        else if (r.studio && r.inPreview) { cls = "prev"; msg = "PREVIEW: tekan Papar, semak, kemudian Transition (scene «" + r.preview + "»)."; }
        else if (r.studio) { cls = "warn"; msg = "Paparan tiada di Preview atau Program. Pilih " + list + " di Preview."; }
        else { cls = "warn"; msg = "Penonton tidak nampak paparan. Tukar ke " + list + "."; }
        el.className = "route " + cls; el.textContent = msg; el.hidden = false;
      } catch (e) { el.hidden = true; }
    }
    const ROUTE_EVENTS = ["CurrentProgramSceneChanged", "CurrentPreviewSceneChanged", "StudioModeStateChanged",
      "SceneItemCreated", "SceneItemRemoved", "SceneItemEnableStateChanged", "SceneCreated", "SceneRemoved", "SceneNameChanged", "SceneListChanged"];
    obs.on("event", ev => {
      if (!ROUTE_EVENTS.includes(ev.eventType)) return;
      refreshRoute();
      if (/^Scene(Created|Removed|NameChanged|ListChanged)$/.test(ev.eventType) && $("kmSetup").classList.contains("open")) loadScenes();
    });

    function connect() {
      const pw = $("kmPw").value.trim(), port = +$("kmPort").value || 4455;
      store.set("pw", pw); store.set("port", port);
      obs.connect({ port, password: pw, retry: true });
    }
    $("kmConnect").onclick = () => { result("", ""); connect(); };
    $("kmPw").addEventListener("keydown", e => { if (e.key === "Enter") $("kmConnect").click(); });

    // The other dock saved a password: pick it up without asking again.
    // pw and port arrive as two events: wait a moment and connect once.
    let storageTimer = null;
    window.addEventListener("storage", e => {
      if (e.key !== "km.pw" && e.key !== "km.port") return;
      clearTimeout(storageTimer);
      storageTimer = setTimeout(() => {
        $("kmPw").value = store.get("pw", ""); $("kmPort").value = store.get("port", 4455);
        if (obs.state !== "connected") connect();
      }, 300);
    });

    // Ask the overlay to answer; it replies with "paparan-ada" (or "paparan-sedia" when it (re)loads).
    function checkOverlay() {
      clearTimeout(checkTimer);
      obs.broadcast({ type: "semak-paparan" }).catch(() => {});
      checkTimer = setTimeout(() => { if (obs.state === "connected" && !overlaySeen) showConnected(); }, 2500);
    }
    obs.on("custom", d => {
      if (!d || d.app !== "kawalan-majlis") return;
      if (d.type === "paparan-ada" || d.type === "paparan-sedia") { overlaySeen = true; if (obs.state === "connected") showConnected(); }
    });

    obs.on("state", ({ state }) => {
      $("kmInstall").disabled = state !== "connected";
      if (state === "connected") {
        overlaySeen = false; setMsg("wait", "Bersambung · menyemak paparan…");
        $("kmSetup").classList.remove("open"); checkOverlay(); refreshRoute(); loadScenes();
        opts.onConnected && opts.onConnected();
      }
      else $("kmRoute").hidden = true;
      if (state === "connecting") setMsg("wait", "Menyambung ke OBS…");
      else if (state === "auth-failed") { setMsg("bad", "Kata laluan WebSocket salah"); $("kmSetup").classList.add("open"); result("bad", "Kata laluan salah. Salin semula dari Show Connect Info."); }
      else if (state === "disconnected") setMsg("bad", "OBS tidak dijumpai. Mencuba semula… (WebSocket dihidupkan?)");
    });

    $("kmInstall").onclick = async () => {
      const chosen = [...$("kmScenes").querySelectorAll("input:checked")].map(i => i.value);
      if (!chosen.length) { result("bad", "Tanda sekurang-kurangnya satu scene."); return; }
      result("", "Memasang…");
      try {
        const n = await installOverlay(obs, +$("kmPort").value || 4455, $("kmPw").value.trim(), chosen);
        result("ok", `Siap. Paparan ada dalam ${n} scene.`); loadScenes(); refreshRoute();
        overlaySeen = false; setTimeout(checkOverlay, 2500);
      } catch (e) { result("bad", "Gagal: " + e.message); }
    };

    if (store.get("pw", null) !== null) connect(); else $("kmSetup").classList.add("open");
    return obs;
  }

  async function sceneNames(obs) {
    const { scenes } = await obs.call("GetSceneList");
    return scenes.map(s => s.sceneName);
  }
  async function itemId(obs, sceneName, sourceName) {
    try { return (await obs.call("GetSceneItemId", { sceneName, sourceName })).sceneItemId; } catch (_) { return null; }
  }
  async function placeOnTop(obs, sceneName, id, { canvas, fit }) {
    if (fit) await obs.call("SetSceneItemTransform", { sceneName, sceneItemId: id, sceneItemTransform: {
      positionX: 0, positionY: 0, alignment: 5, boundsType: fit, boundsWidth: canvas.baseWidth, boundsHeight: canvas.baseHeight, boundsAlignment: 0 } });
    const { sceneItems } = await obs.call("GetSceneItemList", { sceneName });
    await obs.call("SetSceneItemIndex", { sceneName, sceneItemId: id, sceneItemIndex: sceneItems.length - 1 });
  }
  // OBS's UI thread hung twice in tests right after bursts of scene-item changes (24 Nov). Until the cause is known:
  // one install at a time across all docks, and a short pause after every change so OBS's UI can catch up.
  const jeda = () => new Promise(r => setTimeout(r, 250));
  const satuSatu = fn => (navigator.locks ? navigator.locks.request("km-pasang", fn) : fn());
  /** Put `name` in exactly `scenes` (creating the input once); remove it from every other scene. */
  async function ensureIn(obs, scenes, name, kind, settings, { enabled, fit, canvas, bawah }) {
    const { inputs } = await obs.call("GetInputList");
    let created = inputs.some(i => i.inputName === name);
    const all = await sceneNames(obs);
    scenes = scenes.filter(n => all.includes(n));
    if (!scenes.length) throw new Error("Scene yang ditanda tiada lagi dalam OBS");
    // Add first, remove after: the input must never be left in zero scenes (OBS would delete it).
    for (const sceneName of scenes) {
      let id = await itemId(obs, sceneName, name);
      if (!id) {
        if (!created) { ({ sceneItemId: id } = await obs.call("CreateInput", { sceneName, inputName: name, inputKind: kind, inputSettings: settings, sceneItemEnabled: enabled })); created = true; }
        else ({ sceneItemId: id } = await obs.call("CreateSceneItem", { sceneName, sourceName: name, sceneItemEnabled: enabled }));
        await jeda();
      }
      if (bawah) await obs.call("SetSceneItemIndex", { sceneName, sceneItemId: id, sceneItemIndex: 0 });
      else await placeOnTop(obs, sceneName, id, { canvas, fit });
      if (enabled) await obs.call("SetSceneItemEnabled", { sceneName, sceneItemId: id, sceneItemEnabled: true });
    }
    for (const sceneName of all) {
      if (scenes.includes(sceneName)) continue;
      const id = await itemId(obs, sceneName, name);
      if (id) { await obs.call("RemoveSceneItem", { sceneName, sceneItemId: id }); await jeda(); }
    }
    return scenes.length;
  }
  /** Scenes that directly hold the overlay source. */
  async function overlayScenes(obs) {
    const names = await sceneNames(obs);
    const has = await Promise.all(names.map(n => itemId(obs, n, SOURCE_NAME)));
    return names.filter((_, i) => has[i]);
  }
  /** Is the overlay visible in this scene, also through nested scenes and groups? */
  async function shows(obs, sceneName, group, seen = new Set()) {
    if (seen.has(sceneName)) return false;
    seen.add(sceneName);
    const { sceneItems } = group
      ? await obs.call("GetGroupSceneItemList", { sceneName })
      : await obs.call("GetSceneItemList", { sceneName });
    for (const it of sceneItems) {
      if (!it.sceneItemEnabled) continue;
      if (it.sourceName === SOURCE_NAME) return true;
      if (it.isGroup && await shows(obs, it.sourceName, true, seen)) return true;
      if (!it.isGroup && it.sourceType === "OBS_SOURCE_TYPE_SCENE" && await shows(obs, it.sourceName, false, seen)) return true;
    }
    return false;
  }
  async function routeInfo(obs) {
    const [{ studioModeEnabled: studio }, { currentProgramSceneName: program }, scenes] = await Promise.all([
      obs.call("GetStudioModeEnabled"), obs.call("GetCurrentProgramScene"), overlayScenes(obs)]);
    let preview = null;
    if (studio) preview = (await obs.call("GetCurrentPreviewScene")).currentPreviewSceneName;
    const inProgram = await shows(obs, program, false);
    const inPreview = studio && preview ? await shows(obs, preview, false) : false;
    return { studio, program, preview, inProgram, inPreview, scenes };
  }

  const installOverlay = (...a) => satuSatu(() => pasangOverlay(...a));
  async function pasangOverlay(obs, port, pw, scenes) {
    const canvas = await obs.call("GetVideoSettings");
    // Background music at the bottom (audio only), video, then the overlay on top (names stay above the video).
    await ensureIn(obs, scenes, MUZIK_NAME, "ffmpeg_source", MUZIK_SETTINGS, { enabled: true, canvas, bawah: true });
    await letakItem(obs, MUZIK_NAME, false, scenes);
    await ensureIn(obs, scenes, VIDEO_NAME, "ffmpeg_source", VIDEO_SETTINGS, VIDEO_OPTS(canvas));
    const settings = { url: overlayUrl(port, pw), is_local_file: false, width: 1920, height: 1080, shutdown: false, restart_when_active: false, reroute_audio: false, fps_custom: false };
    const { inputs } = await obs.call("GetInputList");
    if (inputs.some(i => i.inputName === SOURCE_NAME)) await obs.call("SetInputSettings", { inputName: SOURCE_NAME, inputSettings: settings });
    return ensureIn(obs, scenes, SOURCE_NAME, "browser_source", settings, { enabled: true, fit: "OBS_BOUNDS_STRETCH", canvas });
  }

  const VIDEO_SETTINGS = { is_local_file: true, looping: false, restart_on_activate: true, close_when_inactive: true, clear_on_media_end: true };
  const VIDEO_OPTS = canvas => ({ enabled: false, fit: "OBS_BOUNDS_SCALE_INNER", canvas });
  /** Make sure the video source exists, in the same scenes as the overlay. */
  const ensureVideo = obs => satuSatu(() => pastikanVideo(obs));
  let muzikDiluar = false;
  async function pastikanVideo(obs) {
    const scenes = await overlayScenes(obs);
    if (!scenes.length) throw new Error("Pasang paparan dahulu (Tetapan → tanda scene → Pasang)");
    const { inputs } = await obs.call("GetInputList");
    const tiada = async n => !inputs.some(i => i.inputName === n)
      || (await Promise.all(scenes.map(s => itemId(obs, s, n)))).some(id => !id);
    const canvas = await obs.call("GetVideoSettings");
    if (await tiada(MUZIK_NAME)) await ensureIn(obs, scenes, MUZIK_NAME, "ffmpeg_source", MUZIK_SETTINGS, { enabled: true, canvas, bawah: true });
    if (!muzikDiluar) { await letakItem(obs, MUZIK_NAME, false); muzikDiluar = true; }   // also older installs
    if (!(await tiada(VIDEO_NAME))) return scenes.length;
    // Add the video below the overlay in each overlay scene (overlay is re-placed on top).
    await ensureIn(obs, scenes, VIDEO_NAME, "ffmpeg_source", VIDEO_SETTINGS, VIDEO_OPTS(canvas));
    for (const sceneName of scenes) await placeOnTop(obs, sceneName, await itemId(obs, sceneName, SOURCE_NAME), { canvas });
    return scenes.length;
  }
  /** Show/hide the video source in every scene that has it. */
  async function setVideoVisible(obs, visible) {
    for (const sceneName of await sceneNames(obs)) {
      const id = await itemId(obs, sceneName, VIDEO_NAME);
      if (id) await obs.call("SetSceneItemEnabled", { sceneName, sceneItemId: id, sceneItemEnabled: visible });
    }
  }

  // MP3 files often carry album art, which OBS shows as a picture. Audio must be heard but never seen:
  // a hidden item would also be silent, so the item stays on but sits outside the canvas.
  const BUNYI = /\.(mp3|wav|m4a|aac|flac|ogg|oga|opus|wma)$/i;
  async function letakItem(obs, name, nampak, scenes) {
    const canvas = await obs.call("GetVideoSettings");
    for (const sceneName of scenes || await sceneNames(obs)) {
      const id = await itemId(obs, sceneName, name);
      if (!id) continue;
      await obs.call("SetSceneItemTransform", { sceneName, sceneItemId: id, sceneItemTransform: nampak
        ? { positionX: 0, positionY: 0, alignment: 5, boundsType: "OBS_BOUNDS_SCALE_INNER", boundsWidth: canvas.baseWidth, boundsHeight: canvas.baseHeight, boundsAlignment: 0 }
        : { positionX: -4 * canvas.baseWidth, positionY: 0, alignment: 5, boundsType: "OBS_BOUNDS_SCALE_INNER", boundsWidth: 16, boundsHeight: 16, boundsAlignment: 0 } });
    }
  }

  // Background music: loops, keeps playing when the scene changes, never restarts by itself.
  const MUZIK_SETTINGS = { is_local_file: true, looping: true, restart_on_activate: false, close_when_inactive: false, clear_on_media_end: false };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const namaFail = p => String(p || "").split(/[\\/]/).pop();

  /** Play a song/video file in the video source. A missing file never errors in OBS: it sits at
   *  "playing" with no duration, so no duration within 2 s means the file is gone. */
  async function mainFail(obs, laluan) {
    batalPilih();   // a file dialog left open must not take this file as its answer
    await ensureVideo(obs);
    await obs.call("SetInputSettings", { inputName: VIDEO_NAME, inputSettings: { local_file: laluan } });
    await letakItem(obs, VIDEO_NAME, !BUNYI.test(laluan));
    await setVideoVisible(obs, true);
    await obs.call("TriggerMediaInputAction", { inputName: VIDEO_NAME, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART" });
    for (let t = 150; t <= 2400; t += 150) {
      await sleep(150);
      const s = await obs.call("GetMediaInputStatus", { inputName: VIDEO_NAME });
      if (s.mediaState === "OBS_MEDIA_STATE_ERROR") break;
      if (s.mediaDuration > 0) return s.mediaDuration;
      // After a failed file OBS can sit at "ended" without starting the new one: ask once more.
      if (t === 750) await obs.call("TriggerMediaInputAction", { inputName: VIDEO_NAME, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART" });
    }
    await obs.call("TriggerMediaInputAction", { inputName: VIDEO_NAME, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP" }).catch(() => {});
    await setVideoVisible(obs, false).catch(() => {});
    throw new Error("Fail tidak dijumpai: " + namaFail(laluan) + ". Fail mungkin sudah dialih atau ditukar nama.");
  }

  /** Is the song/video really playing? (A missing file reports "playing" with no duration.) */
  async function statusMain(obs) {
    const [s, { inputSettings }] = await Promise.all([
      obs.call("GetMediaInputStatus", { inputName: VIDEO_NAME }),
      obs.call("GetInputSettings", { inputName: VIDEO_NAME })]);
    return { playing: s.mediaState === "OBS_MEDIA_STATE_PLAYING" && s.mediaDuration > 0, laluan: inputSettings.local_file || "",
      kursor: s.mediaCursor || 0, tempoh: s.mediaDuration || 0, paused: s.mediaState === "OBS_MEDIA_STATE_PAUSED" };
  }

  /** Change an input's volume smoothly (multiplier 0..1) over `ms`. */
  async function pudar(obs, inputName, keMul, ms = 800) {
    const { inputVolumeMul: dari } = await obs.call("GetInputVolume", { inputName });
    const langkah = Math.max(1, Math.round(ms / 50));
    for (let k = 1; k <= langkah; k++) {
      await obs.call("SetInputVolume", { inputName, inputVolumeMul: dari + (keMul - dari) * k / langkah });
      if (k < langkah) await sleep(50);
    }
  }

  /** Let the teacher pick a file in OBS's own Properties window (a web page cannot read file paths).
   *  Resolves with the chosen path, or null on Cancel / after 5 minutes. */
  let batalPilih = () => {};
  async function pilihFail(obs, inputName) {
    batalPilih();
    await ensureVideo(obs);
    const { inputSettings: asal } = await obs.call("GetInputSettings", { inputName });
    await obs.call("SetInputSettings", { inputName, inputSettings: { local_file: "" } });
    await obs.call("OpenInputPropertiesDialog", { inputName });
    const laluan = await new Promise(res => {
      const done = v => { clearTimeout(t); obs.off("event", on); batalPilih = () => {}; res(v); };
      const on = ev => {
        const d = ev.eventData || {};
        if (ev.eventType !== "InputSettingsChanged" || d.inputName !== inputName) return;
        done((d.inputSettings && d.inputSettings.local_file) || null);
      };
      const t = setTimeout(() => done(null), 5 * 60 * 1000);
      batalPilih = () => done(null);
      obs.on("event", on);
    });
    // Cancel: put the previous file back (e.g. the background music the teacher already chose).
    if (!laluan && asal && asal.local_file) await obs.call("SetInputSettings", { inputName, inputSettings: { local_file: asal.local_file } }).catch(() => {});
    return laluan;
  }

  // ---------- Slaid Canva (live, animated) + projector screen capture ----------
  const CANVA_NAME = "Kawalan Majlis - Canva", CANVA_SCENE = "Slaid Canva";
  const SKRIN_NAME = "Kawalan Majlis - Skrin Projektor", SKRIN_SCENE = "Skrin Projektor";
  // Canva's viewer draws its controls in a <footer>: hidden, the audience sees only the slide.
  const CANVA_CSS = "footer{display:none!important} html,body{background:#000!important;overflow:hidden}";
  /** Any canva.com/design link (edit, view, present) -> the clean embed viewer. */
  function canvaEmbed(url) {
    const u = String(url || "").trim();
    if (/canva\.link\//i.test(u)) return { ralat: "Ini pautan pendek (canva.link). Buka pautan itu dalam Chrome, kemudian salin alamat penuh yang bermula dengan https://www.canva.com/design/ dan tampal di sini." };
    const m = /canva\.com\/design\/([A-Za-z0-9_-]+)(?:\/([A-Za-z0-9_-]+))?/i.exec(u);
    if (!m) return { ralat: "Pautan Canva tidak dikenali. Dalam Canva: Kongsi → Salin pautan, kemudian tampal di sini." };
    const token = m[2] && !/^(edit|view|watch|present)$/i.test(m[2]) ? m[2] + "/" : "";
    return { url: `https://www.canva.com/design/${m[1]}/${token}view?embed` };
  }
  async function pastikanScene(obs, sceneName) {
    if (!(await sceneNames(obs)).includes(sceneName)) { await obs.call("CreateScene", { sceneName }); await jeda(); }
  }
  async function adaInput(obs, name) {
    const { inputs } = await obs.call("GetInputList");
    return inputs.some(i => i.inputName === name);
  }
  /** Put the Canva slides in their own scene (an input the director cuts to like a camera). */
  async function pasangCanva(obs, url) {
    url = String(url || "").trim();
    // A short share link: the Studio follows it to the full address (plain OBS cannot).
    if (/canva\.link\//i.test(url)) {
      try { const r = await obs.call("CallVendorRequest", { vendorName: "kawalan-majlis", requestType: "pautan", requestData: { url } }); url = (r.responseData && r.responseData.url) || url; } catch (_) {}
    }
    const e = canvaEmbed(url);
    if (e.ralat) return Promise.reject(new Error(e.ralat));
    return satuSatu(async () => {
      const canvas = await obs.call("GetVideoSettings");
      const settings = { url: e.url, width: 1920, height: 1080, fps: 30, css: CANVA_CSS, reroute_audio: true, shutdown: false, restart_when_active: false };
      await pastikanScene(obs, CANVA_SCENE);
      if (await adaInput(obs, CANVA_NAME)) await obs.call("SetInputSettings", { inputName: CANVA_NAME, inputSettings: settings });
      await ensureIn(obs, [CANVA_SCENE], CANVA_NAME, "browser_source", settings, { enabled: true, fit: "OBS_BOUNDS_SCALE_INNER", canvas, bawah: false });
      return e.url;
    });
  }
  async function canvaUrl(obs) {
    try { return (await obs.call("GetInputSettings", { inputName: CANVA_NAME })).inputSettings.url || ""; } catch (_) { return ""; }
  }
  /** One step forward (1) or back (-1) in the Canva viewer: the Studio sends the arrow key. */
  async function canvaLangkah(obs, arah) {
    try {
      const r = await obs.call("CallVendorRequest", { vendorName: "kawalan-majlis", requestType: "canva", requestData: { arah } });
      return !!(r.responseData && r.responseData.ok);
    } catch (_) { return false; }
  }
  /** The projector screen (Canva Present in Chrome on the second display), captured as an input. */
  function pasangSkrin(obs, monitorId) {
    return satuSatu(async () => {
      const canvas = await obs.call("GetVideoSettings");
      const settings = { capture_cursor: false };
      if (monitorId) settings.monitor_id = monitorId;
      await pastikanScene(obs, SKRIN_SCENE);
      if (await adaInput(obs, SKRIN_NAME)) await obs.call("SetInputSettings", { inputName: SKRIN_NAME, inputSettings: settings });
      await ensureIn(obs, [SKRIN_SCENE], SKRIN_NAME, "monitor_capture", settings, { enabled: true, fit: "OBS_BOUNDS_SCALE_INNER", canvas, bawah: false });
    });
  }
  /** The screens OBS can capture, and the one in use. */
  async function senaraiSkrin(obs) {
    if (!(await adaInput(obs, SKRIN_NAME))) return null;
    const [{ propertyItems }, { inputSettings }] = await Promise.all([
      obs.call("GetInputPropertiesListPropertyItems", { inputName: SKRIN_NAME, propertyName: "monitor_id" }),
      obs.call("GetInputSettings", { inputName: SKRIN_NAME })]);
    return { pilihan: propertyItems.filter(x => x.itemEnabled !== false).map(x => ({ nama: x.itemName, id: x.itemValue })), semasa: inputSettings.monitor_id || "" };
  }

  window.KM = window.KM || {};
  window.KM.dock = { mount, store, installOverlay, ensureVideo, setVideoVisible, mainFail, statusMain, pudar, pilihFail, namaFail,
    canvaEmbed, pasangCanva, canvaUrl, canvaLangkah, pasangSkrin, senaraiSkrin,
    SOURCE_NAME, VIDEO_NAME, MUZIK_NAME, CANVA_NAME, CANVA_SCENE, SKRIN_NAME, SKRIN_SCENE };
})();
