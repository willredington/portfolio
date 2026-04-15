#!/usr/bin/env bash
# Deploy the portfolio to the Raspberry Pi.
#
# Flow:
#   1. rsync the project source to the Pi (excluding node_modules, dist, .astro)
#   2. SSH to the Pi and run `docker compose up -d --build`
#
# One-time setup on the Pi is documented in README.md.

set -euo pipefail

PI_HOST="${PI_HOST:-will@raspberrypi.local}"
PI_PATH="${PI_PATH:-/home/will/portfolio}"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$here"

echo "▸ Syncing source to ${PI_HOST}:${PI_PATH}"
rsync -az --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .astro \
  --exclude .git \
  --exclude .DS_Store \
  --exclude '.env*' \
  ./ "${PI_HOST}:${PI_PATH}/"

echo "▸ Building and starting containers on the Pi"
ssh "${PI_HOST}" "cd '${PI_PATH}' && docker compose up -d --build"

echo "▸ Done. Container status:"
ssh "${PI_HOST}" "cd '${PI_PATH}' && docker compose ps"
