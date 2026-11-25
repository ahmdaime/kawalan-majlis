/* Kawalan Majlis: reads the recipients list (Excel/CSV) into rows {nama, kelas, anugerah}.
 * dariJadual is pure (tested in Node); bacaFail needs SheetJS (lib/xlsx.full.min.js). */
(function (root, factory) {
  const S = factory();
  if (typeof module === "object" && module.exports) module.exports = S;
  else { root.KM = root.KM || {}; root.KM.senarai = S; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const norm = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

  function dariJadual(table) {
    table = table.map(r => (r || []).map(norm)).filter(r => r.some(Boolean));
    if (!table.length) return { rows: [], note: "Fail kosong.", noAward: true, suggest: "" };
    // The header may sit below a title row ("SENARAI PENERIMA 2026"): look in the first 10 rows.
    const isNameHead = h => /^(nama|name)\b/i.test(h) || /\bnama\b/i.test(h);
    const hr = table.slice(0, 10).findIndex(r => r.some(isNameHead) && r.filter(Boolean).length >= 2);
    let iN = -1, iK = -1, iA = -1, body = table, note = "";
    if (hr >= 0) {
      const head = table[hr].map(h => h.toLowerCase());
      const find = keys => head.findIndex(h => keys.some(k => h.includes(k)));
      iN = head.findIndex(isNameHead);
      iK = find(["kelas", "class", "tahun", "tingkatan", "sekolah"]);
      iA = find(["anugerah", "award", "kategori", "hadiah", "pencapaian"]);
      body = table.slice(hr + 1);
    } else { iN = 0; iK = 1; iA = 2; note = "Tiada tajuk lajur dikenal pasti. Lajur 1 = Nama, 2 = Kelas, 3 = Anugerah."; }
    const rows = body.map(r => ({ nama: r[iN] || "", kelas: iK >= 0 ? r[iK] || "" : "", anugerah: iA >= 0 ? r[iA] || "" : "" }))
                     .filter(r => r.nama && !isNameHead(r.nama));   // header repeated per page/year
    if (iK < 0) note = "Lajur Kelas tidak dijumpai. Semak tajuk lajur.";
    // No award column: suggest one from a title row such as "SENARAI PENERIMA ANUGERAH AKADEMIK 2026".
    let suggest = "";
    if (iA < 0) {
      for (const r of table.slice(0, Math.max(hr, 0) + 1)) {
        const m = r.join(" ").match(/\b(ANUGERAH(?:\s+(?!MASEP|\d)[A-Z][A-Z&]+){1,3})/i);
        if (m) { suggest = m[1].replace(/\s+/g, " ").trim(); break; }
      }
    }
    return { rows, note, noAward: iA < 0, suggest };
  }

  // A value merged down over several rows belongs to every row in the merge.
  function fillMerges(ws, XLSX) {
    for (const m of ws["!merges"] || []) {
      if (m.e.r === m.s.r) continue;
      const top = ws[XLSX.utils.encode_cell(m.s)]; if (!top) continue;
      for (let r = m.s.r + 1; r <= m.e.r; r++)
        for (let c = m.s.c; c <= m.e.c; c++) ws[XLSX.utils.encode_cell({ r, c })] = { ...top };
    }
  }

  async function bacaFail(file) {
    const XLSX = (typeof self !== "undefined" ? self : globalThis).XLSX;
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", codepage: 65001 });
    const ws = wb.Sheets[wb.SheetNames[0]];
    fillMerges(ws, XLSX);
    return dariJadual(XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }));
  }

  return { dariJadual, bacaFail, norm };
});
