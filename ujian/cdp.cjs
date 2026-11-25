// Kawalan Majlis: shared raw CDP + obs-websocket helpers for the live OBS tests (Node 22+, no dependencies).
// OBS 32 on Windows refuses Playwright connectOverCDP, so each dock page is driven over its own DevTools WebSocket.
const CDP = process.env.KM_CDP || "http://127.0.0.1:9223";

class Tab {
  constructor(info) { this.info = info; this.id = 0; this.wait = new Map(); this.errs = []; }
  url() { return this.info.url; }
  open() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.info.webSocketDebuggerUrl);
      this.ws.onopen = async () => { await this.send("Runtime.enable"); await this.send("Page.enable"); await this.send("DOM.enable"); res(this); };
      this.ws.onerror = e => rej(new Error("CDP " + (e.message || "error")));
      this.ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        if (m.id && this.wait.has(m.id)) { const w = this.wait.get(m.id); this.wait.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result); }
        else if (m.method === "Runtime.exceptionThrown") this.errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
        else if (m.method === "Page.loadEventFired" && this.onload) this.onload();
      };
    });
  }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => this.wait.set(id, { res, rej })); }
  async evaluate(fn, arg) {
    const r = await this.send("Runtime.evaluate", { expression: `(${fn})(${JSON.stringify(arg)})`, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  click(sel) { return this.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error("tiada " + s); e.click(); }, sel); }
  fill(sel, v) { return this.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }, [sel, v]); }
  async setInputFiles(sel, file) {
    const { root } = await this.send("DOM.getDocument", { depth: 0 });
    const { nodeId } = await this.send("DOM.querySelector", { nodeId: root.nodeId, selector: sel });
    await this.send("DOM.setFileInputFiles", { nodeId, files: [file] });
  }
  reload() { return new Promise(res => { this.onload = () => { this.onload = null; setTimeout(res, 800); }; this.send("Page.reload"); }); }
  close() { try { this.ws.close(); } catch (_) {} }
}
// Minimal valid PDF, one page per string.
function minimalPdf(texts) {
  const objs = []; const kids = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  texts.forEach((t, i) => {
    const pg = 4 + i * 2, ct = pg + 1, stream = `BT /F1 48 Tf 72 400 Td (${t}) Tj ET`;
    kids.push(`${pg} 0 R`);
    objs[pg] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${ct} 0 R >>`;
    objs[ct] = `<< /Length ${stream.length} >>
stream
${stream}
endstream`;
  });
  objs[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${texts.length} >>`;
  let out = "%PDF-1.4\n"; const off = [];
  for (let i = 1; i < objs.length; i++) { off[i] = out.length; out += `${i} 0 obj
${objs[i]}
endobj
`; }
  const x = out.length;
  out += `xref
0 ${objs.length}
0000000000 65535 f 
` + off.slice(1).map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
  out += `trailer
<< /Size ${objs.length} /Root 1 0 R >>
startxref
${x}
%%EOF
`;
  return Buffer.from(out, "latin1");
}
// Direct obs-websocket v5 client for test setup (Studio Mode etc).
function obsSocket(password, port = 4455) {
  const crypto = require("crypto");
  const h = s => crypto.createHash("sha256").update(s).digest("base64");
  return new Promise((res, rej) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`); let id = 0; const wait = new Map();
    const api = { call: (requestType, requestData = {}) => { const requestId = String(++id); ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } })); return new Promise((r, j) => wait.set(requestId, { r, j })); }, close: () => ws.close() };
    ws.onerror = () => rej(new Error("obs-websocket"));
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.op === 0) { const a = m.d.authentication; ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, ...(a ? { authentication: h(h(password + a.salt) + a.challenge) } : {}) } })); }
      else if (m.op === 2) res(api);
      else if (m.op === 7) { const w = wait.get(m.d.requestId); if (!w) return; wait.delete(m.d.requestId); m.d.requestStatus.result ? w.r(m.d.responseData) : w.j(new Error(m.d.requestStatus.comment || m.d.requestStatus.code)); }
    };
  });
}
async function list() { return (await (await fetch(CDP + "/json")).json()).filter(p => p.type === "page"); }
async function tab(re) { const p = (await list()).find(p => re.test(decodeURIComponent(p.url))); return p ? new Tab(p).open() : null; }
let pass = 0, fail = 0;
const ok = (cond, label, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "LULUS" : "GAGAL"}  ${label}${extra ? "  · " + extra : ""}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await fn(); if (v) return v; } catch (_) {} await sleep(250); } return null; }

module.exports = { Tab, minimalPdf, obsSocket, list, tab, ok, sleep, until, hasil: () => ({ pass, fail }) };
