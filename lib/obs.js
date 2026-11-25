/* Kawalan Majlis: obs-websocket v5 client (no dependencies).
 * Works from file:// docks and OBS browser sources. SHA-256 is bundled because
 * crypto.subtle is missing in non-secure contexts. */
(function (root) {
  "use strict";

  // ---- SHA-256 (bytes in, bytes out) ----
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  function sha256(msg) {
    const len = msg.length, bitLen = len * 8;
    const total = ((len + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(total);
    buf.set(msg); buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 4, bitLen >>> 0);
    dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000));
    const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    const W = new Uint32Array(64);
    const r = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < total; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = r(W[i-15],7) ^ r(W[i-15],18) ^ (W[i-15] >>> 3);
        const s1 = r(W[i-2],17) ^ r(W[i-2],19) ^ (W[i-2] >>> 10);
        W[i] = (W[i-16] + s0 + W[i-7] + s1) >>> 0;
      }
      let [a,b,c,d,e,f,g,h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (r(e,6) ^ r(e,11) ^ r(e,25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
        const t2 = ((r(a,2) ^ r(a,13) ^ r(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0]+=a; H[1]+=b; H[2]+=c; H[3]+=d; H[4]+=e; H[5]+=f; H[6]+=g; H[7]+=h;
    }
    const out = new Uint8Array(32), odv = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i]);
    return out;
  }
  const utf8 = s => new TextEncoder().encode(s);
  const b64 = bytes => { let s = ""; for (const x of bytes) s += String.fromCharCode(x); return btoa(s); };
  function authString(password, salt, challenge) {
    const secret = b64(sha256(utf8(password + salt)));
    return b64(sha256(utf8(secret + challenge)));
  }

  // ---- Client ----
  // Event subscription bits: General=1 (includes CustomEvent), Scenes=4, Inputs=8, SceneItems=128, MediaInputs=256, Ui=1024.
  const SUB = { General: 1, Scenes: 4, Inputs: 8, Transitions: 16, Outputs: 64, SceneItems: 128, MediaInputs: 256, Ui: 1024, InputVolumeMeters: 65536 };
  class OBSClient {
    constructor({ events = SUB.General } = {}) {
      this.events = events;
      this.ws = null; this.pending = new Map(); this.seq = 0;
      this.listeners = {}; this.state = "idle"; this.retryTimer = null;
      this.opts = null; this.autoRetry = false;
    }
    on(evt, fn) { (this.listeners[evt] ||= []).push(fn); }
    off(evt, fn) { this.listeners[evt] = (this.listeners[evt] || []).filter(f => f !== fn); }
    emit(evt, data) { (this.listeners[evt] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); }
    setState(s, detail) { this.state = s; this.emit("state", { state: s, detail }); }

    connect({ host = "127.0.0.1", port = 4455, password = "", retry = true } = {}) {
      this.opts = { host, port, password }; this.autoRetry = retry;
      clearTimeout(this.retryTimer);
      if (this.ws) { this.ws.onclose = null; try { this.ws.close(); } catch (_) {} }
      this.setState("connecting");
      let ws;
      try { ws = new WebSocket(`ws://${host}:${port}`); }
      catch (e) { this.setState("error", String(e)); return this.scheduleRetry(); }
      this.ws = ws;
      ws.onmessage = ev => this.handle(JSON.parse(ev.data));
      ws.onclose = ev => {
        for (const p of this.pending.values()) p.reject(new Error("Sambungan terputus"));
        this.pending.clear();
        // 4009 = authentication failed: do not retry with the same wrong password.
        if (ev.code === 4009) { this.setState("auth-failed"); return; }
        this.setState("disconnected", ev.code);
        this.scheduleRetry();
      };
      ws.onerror = () => {};
    }
    scheduleRetry() {
      if (!this.autoRetry) return;
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.connect({ ...this.opts, retry: true }), 2000);
    }
    disconnect() { this.autoRetry = false; clearTimeout(this.retryTimer); if (this.ws) { this.ws.onclose = null; this.ws.close(); } this.setState("idle"); }

    handle(msg) {
      const { op, d } = msg;
      if (op === 0) { // Hello
        const ident = { rpcVersion: 1, eventSubscriptions: this.events };
        if (d.authentication) ident.authentication = authString(this.opts.password, d.authentication.salt, d.authentication.challenge);
        this.ws.send(JSON.stringify({ op: 1, d: ident }));
      } else if (op === 2) { this.setState("connected");
      } else if (op === 5) { this.emit("event", d); if (d.eventType === "CustomEvent") this.emit("custom", d.eventData);
      } else if (op === 7) {
        const p = this.pending.get(d.requestId); if (!p) return;
        this.pending.delete(d.requestId);
        if (d.requestStatus.result) p.resolve(d.responseData || {});
        else { const err = new Error(d.requestStatus.comment || ("Kod " + d.requestStatus.code)); err.code = d.requestStatus.code; p.reject(err); }
      }
    }
    call(requestType, requestData = {}) {
      if (this.state !== "connected") return Promise.reject(new Error("OBS belum bersambung"));
      const requestId = "km" + (++this.seq);
      return new Promise((resolve, reject) => {
        this.pending.set(requestId, { resolve, reject });
        this.ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
      });
    }
    broadcast(data) { return this.call("BroadcastCustomEvent", { eventData: { app: "kawalan-majlis", ...data } }); }
  }

  root.KM = root.KM || {};
  root.KM.OBSClient = OBSClient;
  root.KM.SUB = SUB;
  root.KM.authString = authString;
  root.KM.sha256 = sha256;
})(typeof window !== "undefined" ? window : globalThis);
