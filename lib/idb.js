/* Kawalan Majlis: tiny IndexedDB store for files (pictures, fonts, PDF) that are too big for localStorage. */
(function () {
  "use strict";
  const DB = "kawalan-majlis", ST = "fail";
  let opening = null;
  function db() {
    return opening || (opening = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(ST);
      r.onsuccess = () => res(r.result);
      r.onerror = () => { opening = null; rej(r.error); };
    }));
  }
  async function run(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(ST, mode), req = fn(t.objectStore(ST));
      t.oncomplete = () => res(req && req.result);
      t.onerror = t.onabort = () => rej(t.error || new Error("Storan gagal"));
    });
  }
  window.KM = window.KM || {};
  window.KM.idb = {
    get: k => run("readonly", s => s.get(k)),
    set: (k, v) => run("readwrite", s => s.put(v, k)),
    del: k => run("readwrite", s => s.delete(k)),
  };
})();
