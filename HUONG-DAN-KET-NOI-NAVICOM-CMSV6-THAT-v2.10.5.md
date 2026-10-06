# Hướng dẫn kết nối Navicom CMSV6 thật – v2.10.5

## 1. Cấu hình gateway Ubuntu

Mở `/etc/bvmsgtv/navicom-gateway.env` và đặt:

```env
NAVICOM_MODE=cmsv6
NAVICOM_BASE_URL=https://DOMAIN-NAVICOM
NAVICOM_USERNAME=TAI_KHOAN
NAVICOM_PASSWORD=MAT_KHAU
NAVICOM_CMSV6_PASSWORD_MODE=auto
NAVICOM_CMSV6_PLAYER_PATH=/808gps/open/player/video.html
NAVICOM_CMSV6_SPEED_DIVISOR=10
NAVICOM_SKIP_AUTH=false
TZ=Asia/Ho_Chi_Minh
```

Không đưa mật khẩu vào `.env.local` của Vite.

## 2. Copy gateway mới

Copy `server/navicom-gateway/server.mjs`, `cmsv6.mjs`, `test-cmsv6.mjs` vào `/var/www/navicom-gateway/`.

## 3. Test API Navicom trực tiếp từ Ubuntu

```bash
sudo /DUONG_DAN_NODE/node --env-file=/etc/bvmsgtv/navicom-gateway.env /var/www/navicom-gateway/test-cmsv6.mjs DEVICE_ID
```

Kết quả tốt phải có `session_obtained: true`. Nếu thiết bị có dữ liệu GPS, `gps_found: true`.

## 4. Restart service

```bash
sudo systemctl restart bvmsgtv-navicom-gateway
sudo systemctl status bvmsgtv-navicom-gateway --no-pager
curl http://127.0.0.1:3020/health
```

Health phải hiện `mode: cmsv6`.

## 5. Frontend

Build và deploy frontend v2.10.5. App tự truyền `navicom_channel_count` sang gateway.

## 6. Lưu ý video

CMSV6 live video phụ thuộc Media Streaming Server và các cổng media của nhà cung cấp. Nếu GPS chạy nhưng iframe video không chạy, bấm `Mở camera Navicom trong cửa sổ mới`. Nếu vẫn không có hình, kiểm tra server Navicom có cho phép HTML5 player/stream từ mạng ngoài hay không.
