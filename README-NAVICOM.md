# Navicom v2.10.3 – chạy local dễ

Xem `HUONG-DAN-TUNG-BUOC-NAVICOM-LOCAL-v2.10.3.md`.

# Tích hợp Navicom – BVMSGTV v2.10.2

## Mục tiêu

Navicom là nguồn **GPS + camera chính** của xe. App điều phối không lấy GPS từ điện thoại tài xế nữa.

### Quyền xem Camera/GPS Navicom

- Ban Giám đốc: Có
- Hành chính: Có
- Điều phối: Có
- Quản trị: Có
- Kế toán: Không
- Trưởng khoa/phòng: Không
- Tài xế: Không cần xem, không cần bật GPS điện thoại

## Flow tài xế mới

1. Nhận chuyến
2. Chụp KM đầu
3. Bắt đầu chuyến
4. Lái xe
5. Nếu phát sinh: Gửi chi phí / Báo sự cố
6. Chụp KM cuối
7. Kết thúc chuyến

Không còn:

- Checklist bắt buộc trước chuyến
- GPS điện thoại
- Google Maps trên giao diện tài xế
- Xác nhận vị trí xuất phát
- Chụp tổng quan xe khi kết thúc

## Kiến trúc

```text
Camera/GPS Navicom
        ↓
CMSV6/CMSV7/Navicom Server
        ↓
server/navicom-gateway
        ↓
/api/navicom
        ↓
App Điều phối xe
```

Frontend KHÔNG chứa tài khoản/mật khẩu Navicom.

## Dữ liệu gắn với xe

Trong Hồ sơ xe có thêm:

- `navicom_enabled`
- `navicom_device_id`
- `navicom_channel_count`
- `navicom_notes`

Chạy migration:

`supabase/migrate-v2.10.2-navicom-driver-minimal.sql`

## Test local trước khi map API thật

Copy:

```text
.env.navicom.local.example
```

thành:

```text
.env.navicom.local
```

Đặt:

```env
NAVICOM_MODE=mock
NAVICOM_SKIP_AUTH=true
NAVICOM_MOCK_LAT=10.000000
NAVICOM_MOCK_LNG=106.000000
NAVICOM_MOCK_SPEED=35
NAVICOM_MOCK_ADDRESS=Vị trí mô phỏng
NAVICOM_MOCK_CHANNELS=2
```

Sau đó chạy:

```text
START-LOCAL-NAVICOM.cmd
```

Trong Hồ sơ xe:

- bật `Kích hoạt Navicom`
- nhập `Mã thiết bị / IMEI`
- nhập số kênh camera

## Kết nối Navicom thật

Hiện gateway đã dựng xong lớp bảo mật và contract API. Vì Navicom/CMSV6 có thể dùng endpoint khác nhau theo server/phiên bản, không đoán endpoint trong frontend.

Khi xác định API thật, adapter phải trả JSON canonical:

```json
{
  "device_id": "DEVICE-001",
  "device_name": "Xe 51A-123.45",
  "online": true,
  "gps": {
    "lat": 10.0,
    "lng": 106.0,
    "speed_kph": 42,
    "heading": 120,
    "ignition": true,
    "updated_at": "2026-09-30T13:30:00+07:00",
    "address": "..."
  },
  "channels": [
    {
      "id": "1",
      "label": "Camera trước",
      "online": true,
      "player_url": "https://...",
      "hls_url": null,
      "snapshot_url": null
    }
  ]
}
```

Gateway hỗ trợ `NAVICOM_MODE=canonical-http` để gọi endpoint đã map về cấu trúc trên.

## Bảo mật gateway

Production phải cấu hình:

```env
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_ANON_KEY=...
NAVICOM_SKIP_AUTH=false
```

Gateway xác thực Supabase JWT và chỉ cho phép các role:

```text
director
fleet
dispatcher
admin
```

Không bật `NAVICOM_SKIP_AUTH=true` trên production.


# Kết nối API thật từ v2.10.5

Gateway hỗ trợ trực tiếp `NAVICOM_MODE=cmsv6` cho CMSV6 Standard API.

Luồng:

```text
StandardApiAction_login.action -> jsession
StandardApiAction_queryTrackDetail.action -> GPS mới nhất
/808gps/open/player/video.html -> camera HTML5
```

Cấu hình production nằm ở `/etc/bvmsgtv/navicom-gateway.env`; không đưa tài khoản/mật khẩu Navicom vào frontend.

Xem `HUONG-DAN-KET-NOI-NAVICOM-CMSV6-THAT-v2.10.5.md`.
