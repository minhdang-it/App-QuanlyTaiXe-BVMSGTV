#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo 'Hãy chạy: sudo bash install-ubuntu.sh'; exit 1; fi
SRC="$(cd "$(dirname "$0")" && pwd)"
SERVICE_DIR=/opt/bvmsgtv-trip-telemetry
ENV_FILE=/etc/bvmsgtv/trip-telemetry.env
mkdir -p "$SERVICE_DIR" /etc/bvmsgtv
install -m 644 "$SRC/collector.mjs" "$SERVICE_DIR/collector.mjs"
if [ ! -f "$ENV_FILE" ]; then
  install -m 600 "$SRC/telemetry.env.example" "$ENV_FILE"
  echo "Đã tạo $ENV_FILE. Hãy sửa KEY/EMAIL/PASSWORD rồi chạy systemctl enable --now bvmsgtv-trip-telemetry"
fi
chmod 600 "$ENV_FILE"
NODE_PATH="$(command -v node || true)"
if [ -z "$NODE_PATH" ]; then echo 'Không thấy Node.js trong PATH của sudo. Cài Node 18+ trước.'; exit 1; fi
cat > /etc/systemd/system/bvmsgtv-trip-telemetry.service <<EOF
[Unit]
Description=BVMSGTV Navicom trip GPS collector
After=network-online.target bvmsgtv-navicom-gateway.service
Wants=network-online.target

[Service]
Type=simple
DynamicUser=yes
WorkingDirectory=$SERVICE_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_PATH $SERVICE_DIR/collector.mjs
Restart=always
RestartSec=10
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadOnlyPaths=$SERVICE_DIR /etc/bvmsgtv

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
# Không auto-enable khi env còn mật khẩu mẫu.
if grep -q 'PASTE_SERVICE_ROLE_SECRET_SERVER_ONLY\|telemetry@example.com' "$ENV_FILE"; then
  echo 'Chưa kích hoạt service vì env vẫn là mẫu. Sửa: sudo nano /etc/bvmsgtv/trip-telemetry.env'
else
  systemctl enable --now bvmsgtv-trip-telemetry
  systemctl --no-pager status bvmsgtv-trip-telemetry || true
fi
