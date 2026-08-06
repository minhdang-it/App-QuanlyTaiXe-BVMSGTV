#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  echo "Cách dùng: $0 <domain> <thu-muc-dist> [so-release-giu-lai]"
  echo "Ví dụ:   $0 xe.example.vn ./dist 5"
}

[[ $# -ge 2 ]] || { usage; exit 1; }
DOMAIN="$1"
DIST_DIR="$(realpath "$2")"
KEEP="${3:-5}"
SITE_ROOT="/var/www/${DOMAIN}"
RELEASE_ID="$(date +%Y%m%d-%H%M%S)"
RELEASE_DIR="${SITE_ROOT}/releases/${RELEASE_ID}"
CURRENT_LINK="${SITE_ROOT}/current"

[[ -f "${DIST_DIR}/index.html" ]] || {
  echo "Lỗi: ${DIST_DIR}/index.html không tồn tại. Hãy chạy npm run build trước."
  exit 1
}

mkdir -p "${SITE_ROOT}/releases"
mkdir -p "$RELEASE_DIR"
rsync -a --delete "${DIST_DIR}/" "${RELEASE_DIR}/"
find "$RELEASE_DIR" -type d -exec chmod 0755 {} +
find "$RELEASE_DIR" -type f -exec chmod 0644 {} +

ln -sfn "$RELEASE_DIR" "${CURRENT_LINK}.new"
mv -Tf "${CURRENT_LINK}.new" "$CURRENT_LINK"

mapfile -t OLD_RELEASES < <(find "${SITE_ROOT}/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | awk -v keep="$KEEP" 'NR > keep {print $2}')
for release in "${OLD_RELEASES[@]:-}"; do
  [[ -n "$release" ]] && rm -rf -- "$release"
done

echo "Đã deploy: $RELEASE_DIR"
echo "Current: $(readlink -f "$CURRENT_LINK")"
echo "Tiếp theo: sudo nginx -t && sudo systemctl reload nginx"
