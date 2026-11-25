// Runs lib/pasang-mac.js (JXA) under Node with a fake ObjC bridge backed by fs,
// so the Mac installer logic can be checked on any machine. Real Mac test still needed.
const fs = require("fs"), path = require("path"), os = require("os"), url = require("url"), crypto = require("crypto");
const SRC = fs.readFileSync(path.join(__dirname, "..", "lib", "pasang-mac.js"), "utf8");
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "LULUS" : "GAGAL"}  ${l}${x ? "  · " + x : ""}`); };

function jalan(dir, obsDir) {
  const $ = s => ({ writeToFileAtomicallyEncodingError: p => { fs.writeFileSync(p, s, "utf8"); return true; } });
  Object.assign($, {
    NSUTF8StringEncoding: 4,
    NSString: { stringWithContentsOfFileEncodingError: p => ({ js: fs.readFileSync(p, "utf8") }) },
    NSFileManager: { defaultManager: {
      fileExistsAtPath: p => fs.existsSync(p),
      removeItemAtPathError: p => fs.rmSync(p),
      copyItemAtPathToPathError: (a, b) => fs.copyFileSync(a, b),
      createDirectoryAtPathWithIntermediateDirectoriesAttributesError: p => fs.mkdirSync(p, { recursive: true }),
    } },
    NSURL: { fileURLWithPath: p => ({ absoluteString: { js: url.pathToFileURL(p).href } }) },
    NSUUID: { get UUID() { return { UUIDString: { js: crypto.randomUUID().toUpperCase() } }; } },
  });
  const run = new Function("ObjC", "$", SRC + "\nreturn run;")({ import() {} }, $);
  return run([dir, obsDir]);
}

function kes(label, ini, { bom = false, eol = "\n", ws = null } = {}) {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), "km-mac-"));
  const obs = path.join(t, "obs-studio"), dir = path.join(t, "Koleksi Coding", "kawalan-majlis");
  fs.mkdirSync(obs, { recursive: true }); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(obs, "user.ini");
  fs.writeFileSync(f, (bom ? "﻿" : "") + ini.join(eol) + eol);
  if (ws) { fs.mkdirSync(path.join(obs, "plugin_config", "obs-websocket"), { recursive: true }); fs.writeFileSync(path.join(obs, "plugin_config", "obs-websocket", "config.json"), JSON.stringify(ws)); }
  const r1 = jalan(dir, obs), r2 = jalan(dir, obs);
  const out = fs.readFileSync(f, "utf8");
  const docksLine = out.split(/\r?\n/).find(l => l.startsWith("ExtraBrowserDocks="));
  let docks = null; try { docks = JSON.parse(docksLine.slice(18)); } catch (_) {}
  const wsOut = JSON.parse(fs.readFileSync(path.join(obs, "plugin_config", "obs-websocket", "config.json"), "utf8"));
  const res = { r1, r2, out, docks, wsOut, files: fs.readdirSync(obs) };
  fs.rmSync(t, { recursive: true, force: true });
  console.log(`-- ${label}`);
  return res;
}

const asas = d => ["[General]", "FirstRun=true", "", "[BasicWindow]", "DockState=AAAA", "ExtraBrowserDocks=" + d, "", "[Basic]", "Profile=Untitled"];
let r = kes("dock operator + dua dock v1.2 + dock v2 lama", asas('[{"title":"Chat YouTube","url":"https://youtube.com/chat","uuid":"x1"},{"title":"Kawalan Media","url":"file:///lama/kawalan-media.html","uuid":"x2"},{"title":"Kawalan Anugerah","url":"file:///lama/kawalan-anugerah.html?pw=a","uuid":"x3"},{"title":"Kawalan Majlis","url":"file:///lama/kawalan-majlis.html","uuid":"x4"}]'));
ok(/^OK 4455 /.test(r.r1) && /^OK/.test(r.r2), "dua jalan berjaya", r.r1);
ok(r.docks && r.docks.map(d => d.title).join("|") === "Chat YouTube|Kawalan Majlis", "satu panel Kawalan Majlis; dock v1.2 dibuang; dock operator kekal", r.docks && r.docks.map(d => d.title).join(", "));
ok(r.docks && /Koleksi%20Coding\/kawalan-majlis\/kawalan-majlis\.html\?pw=[A-Za-z0-9]{16}&port=4455$/.test(r.docks[1].url), "URL dikod (%20) + pw + port", r.docks && r.docks[1].url.replace(/pw=\w+/, "pw=***"));
ok(r.out.includes("DockState=AAAA"), "DockState tidak disentuh");
ok(r.wsOut.server_enabled === true && r.wsOut.server_password.length === 16, "WebSocket dihidupkan + kata laluan dijana");
ok(r.files.includes("user.ini.sandaran-kawalan-majlis-asal"), "sandaran -asal ada");
ok(!r.out.startsWith("﻿") && !r.out.includes("\r\n"), "tiada BOM/CRLF ditambah (format Mac kekal)");

r = kes("kata laluan sedia ada + BOM + CRLF", asas("[]"), { bom: true, eol: "\r\n", ws: { server_enabled: false, auth_required: true, server_password: "lamaLAMA123", server_port: 4460 } });
ok(r.wsOut.server_password === "lamaLAMA123" && r.wsOut.server_port === 4460 && r.wsOut.server_enabled, "kata laluan + port lama dikekalkan");
ok(r.docks && r.docks.length === 1 && r.docks[0].url.endsWith("?pw=lamaLAMA123&port=4460"), "dock guna kata laluan lama");
ok(r.out.startsWith("﻿") && r.out.includes("\r\n"), "BOM + CRLF dikekalkan");

r = kes("tiada baris ExtraBrowserDocks", ["[General]", "FirstRun=true", "", "[BasicWindow]", "DockState=AAAA", "", "[Basic]", "Profile=Untitled"]);
const lines = r.out.split("\n");
ok(lines.indexOf("[BasicWindow]") + 1 === lines.findIndex(l => l.startsWith("ExtraBrowserDocks=")) && r.docks.length === 1, "baris dimasukkan dalam [BasicWindow]");

r = kes("JSON rosak", asas('[{"title":'));
ok(/^GAGAL/.test(r.r1) && r.out.includes('ExtraBrowserDocks=[{"title":'), "JSON rosak: berhenti, baris asal tidak diubah");

console.log(`\n${pass} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
