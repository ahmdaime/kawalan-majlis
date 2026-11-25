#!/bin/bash
# Kawalan Majlis: pemasang OBS untuk Mac. Klik kanan > Open (kali pertama).
# Tambah panel Kawalan Majlis (Custom Browser Dock) dan hidupkan WebSocket OBS.
# Tidak menyentuh susun atur panel (DockState). Sandaran dibuat sebelum mengubah fail.
cd "$(dirname "$0")" || exit 1
DIR="$(pwd)"
OBSDIR="$HOME/Library/Application Support/obs-studio"

echo ""
echo "  Kawalan Majlis - Pemasang OBS (Mac)"
echo "  oleh Cikgu Aime - percuma untuk sekolah"
echo ""

tamat() { echo ""; [ -z "$KM_UJIAN" ] && read -r -p "Tekan Enter untuk tutup " _; exit "$1"; }

case "$DIR" in
  /private/var/folders/*|*/AppTranslocation/*)
    echo "  Folder ini dibuka dari lokasi sementara macOS."
    echo "  Seret folder kawalan-majlis ke Documents, kemudian buka Pasang.command dari situ."
    tamat 1 ;;
esac
for f in kawalan-majlis.html paparan.html; do
  [ -f "$DIR/$f" ] || { echo "  Fail $f tiada di sebelah Pasang.command."; tamat 1; }
done
if [ ! -d "$OBSDIR" ]; then
  echo "  OBS belum pernah dibuka di komputer ini."
  echo "  Buka OBS sekali, tutup (Cmd+Q), kemudian buka Pasang.command semula."
  tamat 1
fi
while pgrep -f "OBS.app/Contents/MacOS" >/dev/null; do
  echo "  OBS sedang dibuka. Tutup OBS dahulu (Cmd+Q), kemudian tekan Enter."
  [ -n "$KM_UJIAN" ] && exit 3
  read -r _
done

HASIL="$(osascript -l JavaScript "$DIR/lib/pasang-mac.js" "$DIR" "$OBSDIR" 2>&1)"

case "$HASIL" in
  OK*)
    set -- $HASIL
    echo "  Siap!"
    echo ""
    echo "  - WebSocket OBS dihidupkan (port $2)."
    echo "  - Panel Kawalan Majlis ditambah. Kata laluan sudah diisi."
    echo "  - Sandaran tetapan lama: $3"
    echo ""
    echo "  Langkah seterusnya:"
    echo "  1. Buka OBS. Jika panel tidak kelihatan: menu Docks, tandakan Kawalan Majlis."
    echo "  2. Seret panel ke tempat yang selesa. Jangan jadikan panel skrin penuh (butang hijau)."
    echo "  3. Dalam panel Kawalan Majlis: Persediaan > Sambung OBS > Tetapan > tanda scene > Pasang ke scene ditanda."
    echo ""
    echo "  Jangan alihkan folder ini. Jika dialih, buka Pasang.command sekali lagi."
    tamat 0 ;;
  GAGAL*) echo "  ${HASIL#GAGAL }"; tamat 1 ;;
  *) echo "  Ralat tidak dijangka:"; echo "$HASIL"; tamat 1 ;;
esac
