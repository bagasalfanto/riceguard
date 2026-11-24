# Postgres lokal untuk tes API, tanpa Docker dan tanpa Supabase.
#
#   .\scripts\db-local.ps1 start    # nyalakan, migrasi, seed, tulis apps/api/.env
#   .\scripts\db-local.ps1 stop
#   .\scripts\db-local.ps1 status
#   .\scripts\db-local.ps1 reset    # hapus cluster lalu start ulang
#
# Binary diambil dari paket npm @embedded-postgres/windows-x64 ke .cache/pg
# (di luar git). Set $env:PG_BIN kalau sudah punya Postgres sendiri.
# Paket itu tidak menyertakan psql, jadi DDL dan seed dijalankan lewat psycopg
# dari virtualenv API. Data ada di .cache/pgdata dan tidak pernah di-commit.
param(
  [Parameter(Position = 0)]
  [ValidateSet("start", "stop", "status", "reset")]
  [string]$Aksi = "start",

  [int]$Port = 54322,
  [string]$Database = "riceguard"
)

$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
$Cache = Join-Path $Repo ".cache"
$Data = Join-Path $Cache "pgdata"
$Log = Join-Path $Cache "pg.log"
$EnvFile = Join-Path $Repo "apps/api/.env"

function Get-PgBin {
  if ($env:PG_BIN) { return $env:PG_BIN }

  $bin = Join-Path $Cache "pg/node_modules/@embedded-postgres/windows-x64/native/bin"
  if (-not (Test-Path (Join-Path $bin "postgres.exe"))) {
    New-Item -ItemType Directory -Path (Join-Path $Cache "pg") -Force | Out-Null
    Write-Host "Mengunduh Postgres ke .cache/pg (sekali saja)..."
    npm install --prefix (Join-Path $Cache "pg") --no-save "@embedded-postgres/windows-x64@16.16.0-beta.19" | Out-Null
  }
  return $bin
}

function Get-Python {
  foreach ($kandidat in @((Join-Path $Repo ".venv/Scripts/python.exe"), "python")) {
    if ($kandidat -eq "python" -or (Test-Path $kandidat)) {
      & $kandidat -c "import psycopg" 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { return $kandidat }
    }
  }
  throw "Tidak ada Python dengan psycopg. Jalankan: python -m venv .venv; .venv\Scripts\pip install -e apps/api"
}

# Jalankan perintah native tanpa membiarkan stderr-nya jadi terminating error.
function Invoke-Native {
  param([string]$Exe, [string[]]$Argumen)
  $lama = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $Exe @Argumen 2>$null } finally { $ErrorActionPreference = $lama }
}

function Test-Siap {
  $py = Get-Python
  $kode = @"
import psycopg
try:
    psycopg.connect('host=127.0.0.1 port=$Port user=postgres dbname=postgres', connect_timeout=2).close()
    print('READY')
except Exception:
    print('NO')
"@
  $hasil = Invoke-Native $py @("-c", $kode)
  return ("$hasil".Trim() -eq "READY")
}

function Start-Db {
  $bin = Get-PgBin
  New-Item -ItemType Directory -Path $Cache -Force | Out-Null

  if (-not (Test-Path (Join-Path $Data "PG_VERSION"))) {
    Write-Host "Menyiapkan cluster di .cache/pgdata..."
    Invoke-Native (Join-Path $bin "initdb.exe") @("-D", $Data, "-U", "postgres", "--encoding=UTF8", "--locale=C") | Out-Null
  }

  if (-not (Test-Siap)) {
    Write-Host "Menjalankan Postgres di port $Port..."
    Start-Process -FilePath (Join-Path $bin "postgres.exe") `
      -ArgumentList "-D", $Data, "-p", $Port, "-k", $Cache `
      -RedirectStandardOutput (Join-Path $Cache "pg.out.log") -RedirectStandardError $Log -WindowStyle Hidden

    $siap = $false
    for ($i = 0; $i -lt 40; $i++) {
      Start-Sleep -Milliseconds 500
      if (Test-Siap) { $siap = $true; break }
    }
    if (-not $siap) { throw "Postgres tidak siap. Lihat $Log" }
  }

  $sql = @()
  $sql += "create schema if not exists auth;"
  $sql += "create table if not exists auth.users (id uuid primary key);"
  foreach ($file in @("supabase/migrations/0001_init.sql", "supabase/seed/0001_static.sql")) {
    $path = Join-Path $Repo $file
    if (-not (Test-Path $path)) { throw "File tidak ditemukan: $file" }
    $sql += [IO.File]::ReadAllText($path)
  }
  $sementara = Join-Path $Cache "bootstrap.sql"
  [IO.File]::WriteAllText($sementara, ($sql -join "`n"), (New-Object System.Text.UTF8Encoding($false)))

  $py = Get-Python
  Invoke-Native $py @((Join-Path $Repo "scripts/db_local_bootstrap.py"), "$Port", $Database, $sementara) | ForEach-Object { Write-Host $_ }
  if ($LASTEXITCODE -ne 0) { throw "Gagal menerapkan skema dan seed" }
  $url = "postgresql+psycopg://postgres@127.0.0.1:$Port/$Database"
  $isi = @(
    "DATABASE_URL=$url",
    "SUPABASE_URL=https://dxgqjmcxraqammhzoufw.supabase.co",
    "CORS_ORIGINS=http://localhost:5173,http://localhost:4173",
    "MAX_UPLOAD_MB=2"
  ) -join "`n"
  [IO.File]::WriteAllText($EnvFile, $isi, (New-Object System.Text.UTF8Encoding($false)))

  Write-Host ""
  Write-Host "Postgres lokal siap: port $Port, database $Database."
  Write-Host "apps/api/.env sudah ditulis. Langkah berikut:"
  Write-Host "  .\.venv\Scripts\python.exe -m app.seed    (dari apps/api)"
  Write-Host "  npm run test:api"
}

function Stop-Db {
  $bin = Get-PgBin
  if (-not (Test-Path (Join-Path $Data "PG_VERSION"))) {
    Write-Host "Belum ada cluster lokal."
    return
  }
  Invoke-Native (Join-Path $bin "pg_ctl.exe") @("-D", $Data, "stop", "-m", "fast") | Out-Null
  Write-Host "Postgres lokal dihentikan."
}

switch ($Aksi) {
  "start" { Start-Db }
  "stop" { Stop-Db }
  "status" {
    if (Test-Siap) { Write-Host "Postgres lokal hidup di port $Port." }
    else { Write-Host "Postgres lokal tidak berjalan." }
  }
  "reset" {
    Stop-Db
    if (Test-Path $Data) { Remove-Item -Recurse -Force $Data }
    Write-Host "Cluster dihapus."
    Start-Db
  }
}
