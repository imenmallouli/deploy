#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "./scripts/docker-up.ps1"
