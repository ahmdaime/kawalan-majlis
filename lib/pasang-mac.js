// Kawalan Majlis: logik pemasang Mac (JXA), dipanggil oleh Pasang.command.
ObjC.import("Foundation");
function run(argv) {
  const [dir, obsDir] = argv;
  const fm = $.NSFileManager.defaultManager;
  const ada = p => fm.fileExistsAtPath(p);
  const baca = p => $.NSString.stringWithContentsOfFileEncodingError(p, $.NSUTF8StringEncoding, null).js;
  const tulis = (p, s) => $(s).writeToFileAtomicallyEncodingError(p, true, $.NSUTF8StringEncoding, null);
  const salin = (a, b) => { if (ada(b)) fm.removeItemAtPathError(b, null); fm.copyItemAtPathToPathError(a, b, null); };
  const d = new Date(), z = n => String(n).padStart(2, "0");
  const cap = `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
  const sandar = p => { if (!ada(p + ".sandaran-kawalan-majlis-asal")) salin(p, p + ".sandaran-kawalan-majlis-asal"); salin(p, p + ".sandaran-kawalan-majlis-" + cap); };

  let ini = obsDir + "/user.ini";
  if (!ada(ini)) ini = obsDir + "/global.ini";
  if (!ada(ini)) return "GAGAL Fail tetapan OBS tidak dijumpai. Buka dan tutup OBS sekali, kemudian cuba semula.";
  sandar(ini);

  // 1. WebSocket
  const wsDir = obsDir + "/plugin_config/obs-websocket", wsFile = wsDir + "/config.json";
  let ws = { alerts_enabled: false, auth_required: true, first_load: false, server_enabled: true, server_password: "", server_port: 4455 };
  if (ada(wsFile)) { sandar(wsFile); try { ws = Object.assign(ws, JSON.parse(baca(wsFile))); } catch (e) {} }
  else fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(wsDir, true, $(), null);
  ws.server_enabled = true; ws.first_load = false;
  if (!ws.server_port) ws.server_port = 4455;
  if (ws.auth_required && !ws.server_password) {
    const abjad = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    ws.server_password = Array.from({ length: 16 }, () => abjad[Math.floor(Math.random() * abjad.length)]).join("");
  }
  tulis(wsFile, JSON.stringify(ws, null, 4));
  const pw = ws.auth_required ? String(ws.server_password) : "", port = Number(ws.server_port);

  // 2. Satu panel (v2). Panel v1.2 (Anugerah, Media) dibuang dari senarai; failnya kekal dalam folder.
  const url = f => $.NSURL.fileURLWithPath(dir + "/" + f).absoluteString.js + "?pw=" + encodeURIComponent(pw) + "&port=" + port;
  const uuid = () => $.NSUUID.UUID.UUIDString.js.toLowerCase();
  const baru = [{ title: "Kawalan Majlis", url: url("kawalan-majlis.html"), uuid: uuid() }];
  let teks = baca(ini);
  const bom = teks.charCodeAt(0) === 0xfeff; if (bom) teks = teks.slice(1);
  const eol = teks.includes("\r\n") ? "\r\n" : "\n";
  const baris = teks.split(/\r?\n/);
  while (baris.length && baris[baris.length - 1] === "") baris.pop();
  let mula = baris.indexOf("[BasicWindow]");
  if (mula < 0) { baris.push("", "[BasicWindow]"); mula = baris.length - 1; }
  let akhir = baris.length;
  for (let i = mula + 1; i < baris.length; i++) if (/^\[/.test(baris[i])) { akhir = i; break; }
  let pos = -1;
  for (let i = mula + 1; i < akhir; i++) if (baris[i].startsWith("ExtraBrowserDocks=")) { pos = i; break; }
  let kekal = [];
  if (pos >= 0) {
    const json = baris[pos].slice("ExtraBrowserDocks=".length).trim();
    if (json) {
      try { kekal = JSON.parse(json).filter(x => !/kawalan-(anugerah|media|majlis)\.html/.test(String(x.url))); }
      catch (e) { return "GAGAL Senarai panel sedia ada dalam OBS tidak dapat dibaca. Panel TIDAK ditambah (WebSocket sudah dihidupkan). Tambah panel secara manual ikut PASANG.html."; }
    }
  }
  const line = "ExtraBrowserDocks=" + JSON.stringify(kekal.concat(baru));
  if (pos >= 0) baris[pos] = line; else baris.splice(mula + 1, 0, line);
  tulis(ini, (bom ? "﻿" : "") + baris.join(eol) + eol);
  return "OK " + port + " " + ini.split("/").pop() + ".sandaran-kawalan-majlis-" + cap;
}
