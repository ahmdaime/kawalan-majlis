# Kawalan Majlis: pemasang OBS untuk Windows (dijalankan oleh Pasang.bat).
# Tambah panel Kawalan Majlis (Custom Browser Dock) dan hidupkan WebSocket OBS.
# Tidak menyentuh susun atur panel (DockState). Sandaran dibuat sebelum mengubah fail.
$ErrorActionPreference = 'Stop'
$utf8Bom = New-Object System.Text.UTF8Encoding $true
$utf8 = New-Object System.Text.UTF8Encoding $false

function Tulis($teks, $warna = 'Gray') { Write-Host $teks -ForegroundColor $warna }
function Tamat($kod) { Write-Host ''; if (-not $env:KM_UJIAN) { Read-Host 'Tekan Enter untuk tutup' | Out-Null }; exit $kod }

Tulis ''
Tulis '  Kawalan Majlis - Pemasang OBS (Windows)' 'Cyan'
Tulis '  oleh Cikgu Aime - percuma untuk sekolah' 'DarkGray'
Tulis ''

$folder = $PSScriptRoot
if ($folder -match '^[A-Za-z]:\\Users\\[^\\]+\\AppData\\Local\\Temp' -or $folder -match '\\Temp\\.*\.zip') {
  Tulis '  Folder ini masih di dalam fail ZIP.' 'Yellow'
  Tulis '  Klik kanan fail ZIP > Extract All, salin folder ke Documents, kemudian jalankan Pasang.bat dari situ.'
  Tamat 1
}
foreach ($f in 'kawalan-majlis.html', 'paparan.html') {
  if (-not (Test-Path (Join-Path $folder $f))) { Tulis "  Fail $f tiada di sebelah Pasang.bat." 'Red'; Tamat 1 }
}

$obsDir = Join-Path $env:APPDATA 'obs-studio'
if (-not (Test-Path $obsDir)) {
  Tulis '  OBS belum pernah dibuka di komputer ini.' 'Yellow'
  Tulis '  Buka OBS sekali (lengkapkan Auto-Configuration Wizard jika keluar), tutup, kemudian jalankan Pasang.bat semula.'
  Tamat 1
}

while (Get-Process -Name obs64, obs32, obs -ErrorAction SilentlyContinue) {
  Tulis '  OBS sedang dibuka. Tutup OBS dahulu (File > Exit), kemudian tekan Enter.' 'Yellow'
  if ($env:KM_UJIAN) { exit 3 }
  Read-Host | Out-Null
}

# OBS 31 ke atas simpan panel dalam user.ini; versi lebih lama dalam global.ini.
$ini = Join-Path $obsDir 'user.ini'
if (-not (Test-Path $ini)) { $ini = Join-Path $obsDir 'global.ini' }
if (-not (Test-Path $ini)) { Tulis '  Fail tetapan OBS tidak dijumpai. Buka dan tutup OBS sekali, kemudian cuba semula.' 'Red'; Tamat 1 }

$cap = Get-Date -Format 'yyyyMMdd-HHmmss'
# '-asal' = tetapan sebelum pemasangan pertama; tidak ditimpa bila Pasang dijalankan semula.
function Sandar($f) { if (-not (Test-Path "$f.sandaran-kawalan-majlis-asal")) { Copy-Item $f "$f.sandaran-kawalan-majlis-asal" }; Copy-Item $f "$f.sandaran-kawalan-majlis-$cap" -Force }
Sandar $ini

# ---- 1. WebSocket ----
$wsDir = Join-Path $obsDir 'plugin_config\obs-websocket'
$wsFile = Join-Path $wsDir 'config.json'
if (Test-Path $wsFile) {
  Sandar $wsFile
  $ws = [IO.File]::ReadAllText($wsFile) | ConvertFrom-Json
} else {
  New-Item -ItemType Directory -Force $wsDir | Out-Null
  $ws = [pscustomobject]@{ alerts_enabled = $false; auth_required = $true; first_load = $false; server_enabled = $true; server_password = ''; server_port = 4455 }
}
foreach ($k in 'server_enabled', 'auth_required', 'server_password', 'server_port', 'first_load') {
  if (-not ($ws.PSObject.Properties.Name -contains $k)) { $ws | Add-Member -NotePropertyName $k -NotePropertyValue $null }
}
$ws.server_enabled = $true
$ws.first_load = $false
if (-not $ws.server_port) { $ws.server_port = 4455 }
if ($ws.auth_required -eq $null) { $ws.auth_required = $true }
if ($ws.auth_required -and -not $ws.server_password) {
  $abjad = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'.ToCharArray()
  $ws.server_password = -join (1..16 | ForEach-Object { $abjad | Get-Random })
}
[IO.File]::WriteAllText($wsFile, ($ws | ConvertTo-Json), $utf8)
$pw = if ($ws.auth_required) { [string]$ws.server_password } else { '' }
$port = [int]$ws.server_port

# ---- 2. Satu panel (v2). Panel v1.2 dibuang dari senarai OBS; failnya kekal dalam folder. ----
function UrlPanel($fail) {
  $u = ([Uri](Join-Path $folder $fail)).AbsoluteUri
  return $u + '?pw=' + [Uri]::EscapeDataString($pw) + '&port=' + $port
}
$baru = @(
  [pscustomobject]@{ title = 'Kawalan Majlis'; url = (UrlPanel 'kawalan-majlis.html'); uuid = [guid]::NewGuid().ToString() }
)

$baris = [Collections.Generic.List[string]]([IO.File]::ReadAllText($ini) -split "`r?`n")
while ($baris.Count -and $baris[$baris.Count - 1] -eq '') { $baris.RemoveAt($baris.Count - 1) }
$mula = $baris.IndexOf('[BasicWindow]')
if ($mula -lt 0) { $baris.Add(''); $baris.Add('[BasicWindow]'); $mula = $baris.Count - 1 }
$akhir = $baris.Count
for ($i = $mula + 1; $i -lt $baris.Count; $i++) { if ($baris[$i] -match '^\[') { $akhir = $i; break } }
$pos = -1
for ($i = $mula + 1; $i -lt $akhir; $i++) { if ($baris[$i] -like 'ExtraBrowserDocks=*') { $pos = $i; break } }

# Buang panel Kawalan Majlis lama (contohnya folder dialih), kekalkan panel lain milik operator.
# PowerShell 5.1 pulangkan senarai JSON sebagai SATU objek: mesti dibuka dengan foreach.
$kekal = @()
if ($pos -ge 0) {
  $json = $baris[$pos].Substring('ExtraBrowserDocks='.Length)
  if ($json.Trim()) {
    try { $hurai = ConvertFrom-Json $json } catch {
      Tulis '  Senarai panel sedia ada dalam OBS tidak dapat dibaca. Panel TIDAK ditambah (WebSocket sudah dihidupkan).' 'Red'
      Tulis '  Tambah panel secara manual ikut PASANG.html.'
      Tamat 1
    }
    foreach ($d in $hurai) { if ([string]$d.url -notmatch 'kawalan-(anugerah|media|majlis)\.html') { $kekal += $d } }
  }
}
$semua = @($kekal) + $baru
$teks = 'ExtraBrowserDocks=' + (ConvertTo-Json -InputObject $semua -Compress -Depth 4)
if ($pos -ge 0) { $baris[$pos] = $teks } else { $baris.Insert($mula + 1, $teks) }
[IO.File]::WriteAllText($ini, (($baris -join "`r`n") + "`r`n"), $utf8Bom)

Tulis '  Siap!' 'Green'
Tulis ''
Tulis "  - WebSocket OBS dihidupkan (port $port)."
Tulis '  - Panel Kawalan Majlis ditambah. Kata laluan sudah diisi.'
Tulis "  - Sandaran tetapan lama: $(Split-Path $ini -Leaf).sandaran-kawalan-majlis-$cap"
Tulis ''
Tulis '  Langkah seterusnya:' 'Cyan'
Tulis '  1. Buka OBS. Jika panel tidak kelihatan: menu Docks, tandakan Kawalan Majlis.'
Tulis '  2. Seret panel ke tempat yang selesa.'
Tulis '  3. Dalam panel Kawalan Majlis: Persediaan > Sambung OBS > Tetapan > tanda scene > Pasang ke scene ditanda.'
Tulis ''
Tulis '  Jangan alihkan folder ini. Jika dialih, jalankan Pasang.bat sekali lagi.' 'Yellow'
Tamat 0
