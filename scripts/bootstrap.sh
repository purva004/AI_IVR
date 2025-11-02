#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/.."
PROJECT_NAME="AI-IVR-SYSTEM-NEXT"

log() {
  printf '\033[1;34m[%s]\033[0m %s\n' "${PROJECT_NAME}" "$1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '\033[1;31mError:\033[0m Required command "%s" is not installed.\n' "$1"
    printf 'Install Node.js 18+ and npm, then re-run this script.\n'
    exit 1
  fi
}

log "Verifying prerequisites"
require_command node
require_command npm

cd "${ROOT_DIR}"

NODE_VERSION="$(node --version | sed 's/^v//')"
REQUIRED_MAJOR=18
CURRENT_MAJOR="${NODE_VERSION%%.*}"
if [ "${CURRENT_MAJOR}" -lt "${REQUIRED_MAJOR}" ]; then
  printf '\033[1;31mError:\033[0m Node.js version %s detected. Please install Node.js %d or newer.\n' "${NODE_VERSION}" "${REQUIRED_MAJOR}"
  exit 1
fi

ENV_FILE="${ROOT_DIR}/.env.local"
if [ ! -f "${ENV_FILE}" ]; then
  log "Creating .env.local with default development secrets"
  cat <<'EOF' >"${ENV_FILE}"
MONGO_URI="mongodb://localhost:27017/AI-IVR"
JWT_SECRET="c9b1f7d6a3e2b4c8d9f0a1b2c3d4e5f60718293a4b5c6d7e"
VAPI_API_KEY="9a05e800-6a2e-456b-a8c3-270f0495a201"
VAPI_PRIVATE_KEY="31aa2da3-24ea-4a50-8d67-febb5d38dc8e"
EOF
else
  log ".env.local already exists – keeping current values"
fi

if [ ! -d "${ROOT_DIR}/node_modules" ]; then
  log "Installing npm dependencies"
  npm install
else
  log "Dependencies already installed – running npm install to make sure everything is current"
  npm install
fi

log "Starting the Next.js development server"
npm run dev
