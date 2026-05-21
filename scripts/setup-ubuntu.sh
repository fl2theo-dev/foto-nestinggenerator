#!/usr/bin/env bash
set -euo pipefail

echo "[setup] Ubuntu-Check fuer foto-nestinggenerator"

auto_install=false
if [[ "${1:-}" == "--install" ]]; then
  auto_install=true
fi

need_cmd() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "[ok] $cmd gefunden: $(command -v "$cmd")"
    return 0
  fi
  echo "[missing] $cmd fehlt"
  return 1
}

missing=0
need_cmd node || missing=1
need_cmd npm || missing=1
need_cmd gs || missing=1

if [[ "$missing" -eq 1 ]]; then
  echo "[info] Fehlende Pakete erkannt."
  if [[ "$auto_install" == true ]]; then
    echo "[setup] Installiere nodejs npm ghostscript ..."
    sudo apt update
    sudo apt install -y nodejs npm ghostscript
  else
    echo "[hint] Fuer automatische Installation: ./scripts/setup-ubuntu.sh --install"
  fi
fi

echo "[setup] npm install im Projekt ..."
npm install

echo "[done] Setup abgeschlossen."
echo "[next] App starten: app/index.html im Browser oeffnen"
