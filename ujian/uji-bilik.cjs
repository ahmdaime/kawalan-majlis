// Kawalan Majlis: unit tests for the pure parts of the Bilik Kawalan (no OBS, no browser).
//   node ujian/uji-bilik.cjs
const B = require("../lib/bilik.js");
let gagal = 0;
const ok = (c, l, x = "") => { console.log((c ? "LULUS " : "GAGAL ") + l + (x !== "" ? "  · " + x : "")); if (!c) gagal++; };

// OBS lists scenes bottom-up (sceneIndex 0 = bottom of the Scenes panel).
const scenes = [
  { sceneName: "Kamera Dewan", sceneIndex: 0 }, { sceneName: "Kawalan Majlis - Hitam", sceneIndex: 1 },
  { sceneName: "Slaid", sceneIndex: 2 }, { sceneName: "Kamera Pentas", sceneIndex: 3 },
];
ok(B.senaraiInput(scenes).join("|") === "Kamera Pentas|Slaid|Kamera Dewan", "senaraiInput: ikut susunan panel Scenes, tanpa scene bantu Hitam", B.senaraiInput(scenes).join("|"));
ok(B.senaraiInput([]).length === 0, "senaraiInput: kosong");

ok(B.sliderKeDb(100) === 0 && B.sliderKeDb(0) === -100 && B.sliderKeDb(50) === -30, "sliderKeDb: 100 = 0 dB, 50 = -30 dB, 0 = senyap", [B.sliderKeDb(100), B.sliderKeDb(50), B.sliderKeDb(0)].join(", "));
ok(B.dbKeSlider(0) === 100 && B.dbKeSlider(-30) === 50 && B.dbKeSlider(-100) === 0 && B.dbKeSlider(6) === 100, "dbKeSlider: songsang + had", [B.dbKeSlider(0), B.dbKeSlider(-30), B.dbKeSlider(-100), B.dbKeSlider(6)].join(", "));
ok(B.dbKeSlider(B.sliderKeDb(73)) === 73, "slider ↔ dB pergi balik");

ok(B.meterPeratus(1) === 100 && B.meterPeratus(0) === 0 && Math.abs(B.meterPeratus(Math.pow(10, -30 / 20)) - 50) < 0.01, "meterPeratus: 0 dBFS = 100%, -30 dB = 50%, senyap = 0", B.meterPeratus(Math.pow(10, -30 / 20)));
ok(B.meterPeratus(-1) === 0 && B.meterPeratus(NaN) === 0 && B.meterPeratus(3) === 100, "meterPeratus: nilai pelik dihadkan");

ok(B.masa(0) === "00:00:00" && B.masa(4350000) === "01:12:30" && B.masa(null) === "00:00:00", "masa: jam:minit:saat", B.masa(4350000));

ok(B.namaMesra("Kawalan Majlis - Video") === "Lagu / video" && B.namaMesra("Kawalan Majlis - Muzik Latar") === "Muzik latar" && B.namaMesra("Mic/Aux") === "Mic/Aux", "namaMesra");
ok(B.audioDipapar("Kawalan Majlis - Paparan") === false && B.audioDipapar("Mic/Aux") === true, "mixer: sumber paparan tidak disenaraikan");

console.log(gagal ? `\n${gagal} GAGAL` : "\nSemua LULUS");
process.exit(gagal ? 1 : 0);
