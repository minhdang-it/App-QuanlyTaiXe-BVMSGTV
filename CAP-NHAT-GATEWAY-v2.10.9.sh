#!/usr/bin/env bash
set -euo pipefail
SRC_DIR="$(cd "$(dirname "$0")" && pwd)/server/navicom-gateway"
DST_DIR="/var/www/navicom-gateway"
sudo install -d -m 755 "$DST_DIR"
sudo cp "$SRC_DIR/cmsv6.mjs" "$DST_DIR/cmsv6.mjs"
sudo chown root:root "$DST_DIR/cmsv6.mjs"
sudo chmod 644 "$DST_DIR/cmsv6.mjs"
sudo systemctl restart bvmsgtv-navicom-gateway
sleep 2
sudo systemctl status bvmsgtv-navicom-gateway --no-pager || true
printf '\nHealth:\n'
curl -sS http://127.0.0.1:3020/health || true
printf '\n'
