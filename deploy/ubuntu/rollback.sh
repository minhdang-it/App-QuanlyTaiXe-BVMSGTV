#!/usr/bin/env bash
set -Eeuo pipefail

[[ $# -eq 2 ]] || {
  echo "Cách dùng: $0 <domain> <release-id>"
  echo "Ví dụ: $0 xe.example.vn 20260805-143000"
  exit 1
}

DOMAIN="$1"
RELEASE_ID="$2"
SITE_ROOT="/var/www/${DOMAIN}"
TARGET="${SITE_ROOT}/releases/${RELEASE_ID}"

[[ -f "${TARGET}/index.html" ]] || { echo "Không tìm thấy release hợp lệ: $TARGET"; exit 1; }
ln -sfn "$TARGET" "${SITE_ROOT}/current.new"
mv -Tf "${SITE_ROOT}/current.new" "${SITE_ROOT}/current"
echo "Đã rollback về: $TARGET"
echo "Chạy: sudo nginx -t && sudo systemctl reload nginx"
