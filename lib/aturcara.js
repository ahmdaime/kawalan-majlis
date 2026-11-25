/* Kawalan Majlis v2: Panel Pengarah state machine. Pure: no DOM, no OBS.
 * Every command returns {ok, sebab?, tindakan:[...]}; the dock carries the actions out.
 * Positions are {i, s}: item index in the Aturcara, sub index (name or page, 0-based).
 * Actions: {t:"nama", show, nama, kelas, anugerah} · {t:"media", show, item, halaman}
 *          {t:"main", item} · {t:"henti"} · {t:"duck", ke:"rendah"|"asal"} */
(function (root, factory) {
  const P = factory();
  if (typeof module === "object" && module.exports) module.exports = P;
  else { root.KM = root.KM || {}; root.KM.Pengarah = P; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const MAIN = new Set(["lagu", "video"]);
  const DEK = new Set(["slaid", "gambar"]);
  const kunci = p => p.i + ":" + p.s;
  const salin = p => (p ? { i: p.i, s: p.s } : null);
  const ditolak = sebab => ({ ok: false, sebab, tindakan: [] });
  const jadi = tindakan => ({ ok: true, tindakan: tindakan || [] });

  class Pengarah {
    constructor({ aturcara = [], sedia = null, udara = null, dipapar = [], selesai = [] } = {}) {
      this.aturcara = aturcara;
      this.dipapar = new Set(dipapar);
      this.selesai = new Set(selesai);
      this.udara = this.sah(udara) ? salin(udara) : null;
      this.sedia = this.sah(sedia) ? salin(sedia) : this.pertama();
    }

    // ---------- positions ----------
    saiz(item) {
      if (!item) return 0;
      if (item.jenis === "nama") return (item.senarai || []).length;
      if (DEK.has(item.jenis)) return Math.max(1, item.halaman || 1);
      return 1;
    }
    sah(p) {
      if (!p || !Number.isInteger(p.i) || !Number.isInteger(p.s)) return false;
      const it = this.aturcara[p.i];
      return !!it && p.s >= 0 && p.s < this.saiz(it);
    }
    pertama() {
      for (let i = 0; i < this.aturcara.length; i++) if (this.saiz(this.aturcara[i])) return { i, s: 0 };
      return null;
    }
    /** Next/previous position. Names step one by one; any other item is one step. */
    langkah(pos, dir) {
      if (!pos) return null;
      const it = this.aturcara[pos.i];
      if (it && it.jenis === "nama") {
        const s = pos.s + dir;
        if (s >= 0 && s < this.saiz(it)) return { i: pos.i, s };
      }
      for (let i = pos.i + dir; i >= 0 && i < this.aturcara.length; i += dir) {
        const n = this.saiz(this.aturcara[i]);
        if (!n) continue;
        return { i, s: dir < 0 && this.aturcara[i].jenis === "nama" ? n - 1 : 0 };
      }
      return null;
    }
    item(pos) { return pos ? this.aturcara[pos.i] : null; }

    get sedangMain() { const it = this.item(this.udara); return !!it && MAIN.has(it.jenis); }
    get bolehPersediaan() { return this.udara === null; }

    huraikan(pos) {
      const it = this.item(pos);
      if (!it) return null;
      if (it.jenis === "nama") {
        const r = it.senarai[pos.s] || {};
        return { jenis: "nama", utama: r.nama || "", kecil: r.kelas || "", anugerah: it.tajuk, giliran: { no: pos.s + 1, daripada: it.senarai.length }, butang: "PAPAR" };
      }
      if (MAIN.has(it.jenis)) {
        return { jenis: it.jenis, utama: it.tajuk, kecil: it.fail || "", butang: it.jenis === "lagu" ? "MAIN LAGU" : "MAIN VIDEO" };
      }
      return { jenis: it.jenis, utama: it.tajuk, kecil: (it.jenis === "slaid" ? "Halaman " : "Gambar ") + (pos.s + 1) + " / " + this.saiz(it), butang: "PAPAR" };
    }

    // ---------- actions for what is on air ----------
    keluar(pos) {
      const it = this.item(pos);
      if (it.jenis === "nama") {
        const r = it.senarai[pos.s];
        return [{ t: "nama", show: true, nama: r.nama, kelas: r.kelas || "", anugerah: it.tajuk }];
      }
      if (MAIN.has(it.jenis)) return [{ t: "duck", ke: "rendah" }, { t: "main", item: it }];
      return [{ t: "media", show: true, item: it, halaman: pos.s }];
    }
    /** Take down what is on air (not a song: that is sorok/HENTI). */
    turun() {
      const it = this.item(this.udara);
      this.udara = null;
      if (!it) return [];
      return [it.jenis === "nama" ? { t: "nama", show: false } : { t: "media", show: false }];
    }
    tandaNama(pos) {
      this.dipapar.add(kunci(pos));
      const it = this.item(pos);
      if ([...Array(this.saiz(it)).keys()].every(s => this.dipapar.has(pos.i + ":" + s))) this.selesai.add(pos.i);
    }

    // ---------- commands ----------
    /** The yellow button (and Space). The only way anything goes on air. */
    kuning() {
      if (this.sedangMain) return ditolak("Lagu atau video sedang dimainkan. Tekan HENTI dahulu.");
      if (!this.sah(this.sedia)) return ditolak("Tiada item SEDIA.");
      const pos = salin(this.sedia), it = this.item(pos);
      const tindakan = this.turun().concat(this.keluar(pos));
      this.udara = pos;
      if (it.jenis === "nama") {
        this.tandaNama(pos);
        this.sedia = this.langkah(pos, 1) || pos;
      } else {
        this.dipapar.add(kunci(pos));
        this.sedia = this.langkah({ i: pos.i, s: this.saiz(it) - 1 }, 1) || pos;
      }
      return jadi(tindakan);
    }

    seterusnya() {
      const it = this.item(this.udara);
      if (it && DEK.has(it.jenis)) {
        if (this.udara.s + 1 < this.saiz(it)) {
          this.udara.s++;
          this.dipapar.add(kunci(this.udara));
          return jadi([{ t: "media", show: true, item: it, halaman: this.udara.s }]);
        }
        const i = this.udara.i;
        const t = this.turun();
        this.selesai.add(i);
        return jadi(t);
      }
      if (it && it.jenis === "nama") return jadi(this.turun());   // the next name is already SEDIA
      // A song playing, or nothing on air: only SEDIA moves. Nothing goes out.
      const n = this.langkah(this.sedia, 1);
      if (n) this.sedia = n;
      return jadi([]);
    }

    sebelum() {
      const it = this.item(this.udara);
      if (it && DEK.has(it.jenis) && this.udara.s > 0) {
        this.udara.s--;
        return jadi([{ t: "media", show: true, item: it, halaman: this.udara.s }]);
      }
      const t = this.sedangMain ? [] : this.turun();
      const n = this.langkah(this.sedia, -1);
      if (n) this.sedia = n;
      return jadi(t);
    }

    /** SOROK for names/slides, HENTI for a song or video. */
    sorok() {
      if (this.sedangMain) {
        this.selesai.add(this.udara.i);
        this.udara = null;
        return jadi([{ t: "henti" }, { t: "duck", ke: "asal" }]);
      }
      const it = this.item(this.udara);
      if (it && DEK.has(it.jenis) && this.udara.s < this.saiz(it) - 1) this.sedia = salin(this.udara);   // resume here
      return jadi(this.turun());
    }

    /** Clicking the list or searching: SEDIA only, never on air. */
    sediakan(pos) {
      if (!this.sah(pos)) return ditolak("Kedudukan tidak sah.");
      this.sedia = salin(pos);
      return jadi([]);
    }

    /** Find a name in any section, or a giliran number in the SEDIA section. Does not change state. */
    cari(teks) {
      const q = String(teks || "").trim().toLowerCase();
      if (!q) return null;
      if (/^\d+$/.test(q)) {
        const it = this.item(this.sedia);
        const s = +q - 1;
        return it && it.jenis === "nama" && s >= 0 && s < this.saiz(it) ? { i: this.sedia.i, s } : null;
      }
      for (let i = 0; i < this.aturcara.length; i++) {
        const it = this.aturcara[i];
        if (it.jenis !== "nama") continue;
        const s = it.senarai.findIndex(r => (r.nama || "").toLowerCase().includes(q));
        if (s >= 0) return { i, s };
      }
      return null;
    }

    /** OBS says the song/video ended. */
    mainTamat() {
      if (!this.sedangMain) return jadi([]);
      this.selesai.add(this.udara.i);
      this.udara = null;
      return jadi([{ t: "duck", ke: "asal" }]);
    }

    /** After a dock reload: trust OBS about whether the song is still playing. */
    pulihMain(playing, i) {
      if (playing) {
        const it = this.aturcara[i];
        if (it && MAIN.has(it.jenis)) this.udara = { i, s: 0 };
        return jadi([]);
      }
      return this.mainTamat();
    }

    toJSON() {
      return { aturcara: this.aturcara, sedia: salin(this.sedia), udara: salin(this.udara), dipapar: [...this.dipapar], selesai: [...this.selesai] };
    }
  }

  // ---------- building and changing the Aturcara (static, pure) ----------
  let seq = 0;
  const idBaru = pfx => pfx + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);
  const kecil = s => String(s || "").trim().toLowerCase();

  /** One name section per award, in first-appearance order. */
  Pengarah.seksyenDariRows = function (rows, defAward) {
    const secs = new Map();
    for (const r of rows || []) {
      const a = (r.anugerah || "").trim() || (defAward || "").trim() || "Anugerah";
      if (!secs.has(a)) secs.set(a, { id: idBaru("n"), jenis: "nama", tajuk: a, anugerah: a, senarai: [] });
      secs.get(a).senarai.push({ nama: r.nama, kelas: r.kelas || "" });
    }
    return [...secs.values()];
  };

  /** Map a position in the old Aturcara to the new one: by item id, and for names by the name.
   *  The same name can appear more than once (two pupils, or one listed twice), so a name keeps
   *  its place when the section is unchanged, else it takes the same occurrence (1st, 2nd…)
   *  of the same name + class. `semuaSeksyen`: may also look in other awards (SEDIA / on air
   *  only; never for "sudah dipapar" marks, which must not move to a pupil never called). */
  const anugerahOf = x => x.anugerah || x.tajuk;
  function petaKedudukan(lama, baru, pos, semuaSeksyen) {
    const it = lama[pos.i];
    if (!it) return null;
    if (it.jenis === "nama") {
      const r = it.senarai[pos.s];
      if (!r) return null;
      const kunciNK = x => kecil(x.nama) + "|" + kecil(x.kelas), kunciN = x => kecil(x.nama);
      const ke = (f) => it.senarai.slice(0, pos.s).filter(x => f(x) === f(r)).length;   // occurrence rank
      const cariDalam = j => {
        const b = baru[j];
        if (!b || b.jenis !== "nama") return -1;
        if (b.id === it.id && b.senarai[pos.s] && kunciNK(b.senarai[pos.s]) === kunciNK(r)) return pos.s;
        for (const f of [kunciNK, kunciN]) {
          const hits = b.senarai.reduce((a, x, k) => (f(x) === f(r) ? a.concat(k) : a), []);
          if (hits.length) return hits[Math.min(ke(f), hits.length - 1)];
        }
        return -1;
      };
      const calon = [baru.findIndex(x => x.id === it.id), ...baru.map((x, j) => x.jenis === "nama" && anugerahOf(x) === anugerahOf(it) ? j : -1)];
      if (semuaSeksyen) calon.push(...baru.map((_, j) => j));
      for (const j of calon) { if (j < 0) continue; const s = cariDalam(j); if (s >= 0) return { i: j, s }; }
      return null;
    }
    const j = baru.findIndex(x => x.id === it.id);
    if (j < 0) return null;
    const n = new Pengarah({ aturcara: baru }).saiz(baru[j]);
    return { i: j, s: Math.min(pos.s, n - 1) };
  }

  /** Carry marks, SEDIA and what is on air over to a changed Aturcara (reorder, delete, new Excel). */
  Pengarah.petaSemula = function (keadaan, aturcaraBaru) {
    const lama = keadaan.aturcara || [];
    const pos = (p, semua) => (p ? petaKedudukan(lama, aturcaraBaru, p, semua) : null);
    const dipapar = new Set();
    for (const k of keadaan.dipapar || []) {
      const [i, s] = k.split(":").map(Number);
      const p = pos({ i, s });
      if (p) dipapar.add(p.i + ":" + p.s);
    }
    const selesai = new Set();
    for (const i of keadaan.selesai || []) {
      const it = lama[i]; if (!it || it.jenis === "nama") continue;
      const j = aturcaraBaru.findIndex(x => x.id === it.id);
      if (j >= 0) selesai.add(j);
    }
    const p = new Pengarah({ aturcara: aturcaraBaru });
    aturcaraBaru.forEach((it, j) => {
      if (it.jenis === "nama" && it.senarai.length && it.senarai.every((_, s) => dipapar.has(j + ":" + s))) selesai.add(j);
    });
    let sedia = pos(keadaan.sedia, true);
    if (!p.sah(sedia)) sedia = p.pertama();
    const udara = pos(keadaan.udara, true);
    return { aturcara: aturcaraBaru, sedia, udara, dipapar: [...dipapar], selesai: [...selesai] };
  };

  const JENIS_V12 = { pdf: "slaid", img: "gambar", vid: "video" };
  /** v1.2 data (media.items + anugerah.rows) → an Aturcara state. Media first, then name sections. */
  Pengarah.naikTaraf = function ({ mediaItems = [], rows = [], defAward = "", cur = 0, done = [] } = {}) {
    const media = mediaItems.filter(m => JENIS_V12[m.kind]).map(m => {
      const jenis = JENIS_V12[m.kind];
      const it = { id: m.id, jenis, tajuk: m.label || "" };
      if (jenis === "video") Object.assign(it, { laluan: m.path || "", fail: String(m.path || m.label || "").split(/[\\/]/).pop() });
      else Object.assign(it, { fail: m.label || "", halaman: m.count || 1 });
      return it;
    });
    const secs = Pengarah.seksyenDariRows(rows, defAward);
    const aturcara = media.concat(secs);
    // Row index → position (rows are grouped by award, in first-appearance order).
    const posRow = [], dikira = new Map();
    rows.forEach((r, k) => {
      const a = (r.anugerah || "").trim() || (defAward || "").trim() || "Anugerah";
      const i = media.length + secs.findIndex(x => x.tajuk === a);
      const s = dikira.get(i) || 0; dikira.set(i, s + 1);
      posRow[k] = { i, s };
    });
    const dipapar = done.filter(k => posRow[k]).map(k => posRow[k].i + ":" + posRow[k].s);
    const p = new Pengarah({ aturcara, sedia: posRow[cur] || null, dipapar });
    return p.toJSON();
  };

  /** A new or corrected Excel. Each award section is replaced where it stands (songs placed between
   *  awards stay put, a renamed title is kept); awards new in the file go after the last award;
   *  awards gone from the file are removed. Marks and SEDIA follow the names. */
  Pengarah.gabungSenarai = function (keadaan, rowsBaru, defAward) {
    const lama = keadaan.aturcara || [];
    const secs = Pengarah.seksyenDariRows(rowsBaru, defAward);
    const dipakai = new Set(), baru = [];
    for (const x of lama) {
      if (x.jenis !== "nama") { baru.push(x); continue; }
      const s = secs.find(y => !dipakai.has(y) && y.anugerah === anugerahOf(x));
      if (!s) continue;                                   // award no longer in the file
      dipakai.add(s);
      baru.push(Object.assign({}, x, { senarai: s.senarai, anugerah: s.anugerah }));
    }
    const lebih = secs.filter(y => !dipakai.has(y));
    let at = -1; baru.forEach((x, j) => { if (x.jenis === "nama") at = j; });
    baru.splice(at < 0 ? baru.length : at + 1, 0, ...lebih);
    return Pengarah.petaSemula(keadaan, baru);
  };

  return Pengarah;
});
