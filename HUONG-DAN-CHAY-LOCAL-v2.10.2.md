# Hướng dẫn chạy local v2.10.2 – Navicom Ready

## 1. Chuẩn bị frontend

Copy `.env.local.example` thành `.env.local`, điền:

```env
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_NAVICOM_GATEWAY_URL=/api/navicom
```

Sau đó:

```cmd
npm.cmd ci
npm.cmd run verify:source
npm.cmd run check
```

## 2. Chạy migration v2.10.2

Supabase → SQL Editor → chạy:

`supabase/migrate-v2.10.2-navicom-driver-minimal.sql`

Migration này:

- thêm mã thiết bị Navicom vào xe;
- bỏ checklist khỏi điều kiện bắt đầu chuyến;
- vẫn bắt buộc KM đầu + ảnh KM đầu khi bắt đầu;
- vẫn bắt buộc KM cuối + ảnh KM cuối khi kết thúc.

## 3. Test giao diện Navicom local bằng mock

Chạy:

```text
SETUP-NAVICOM-LOCAL.cmd
```

Trong `.env.navicom.local` đặt:

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

Vite sẽ proxy `/api/navicom` sang gateway local ở `127.0.0.1:3020`.

## 4. Gắn mã thiết bị vào xe

Đăng nhập Quản trị/Hành chính/Điều phối → Hồ sơ xe → Chỉnh sửa:

- Kích hoạt Navicom
- Mã thiết bị / IMEI
- Số kênh camera
- Ghi chú Navicom

## 5. Test quyền

Các tài khoản được xem Camera/GPS Navicom:

- BGĐ
- Hành chính
- Điều phối
- Quản trị

Kế toán, Trưởng khoa, Tài xế không được xem.

## 6. Flow tài xế cần test

1. Nhận chuyến
2. Chụp KM đầu
3. Bắt đầu chuyến
4. Không yêu cầu GPS điện thoại
5. Không mở Google Maps
6. Không checklist bắt buộc
7. Nếu có phát sinh: gửi chi phí / báo sự cố
8. Chụp KM cuối
9. Kết thúc

## 7. Kết nối Navicom thật

Không để username/password Navicom trong `.env.local` của Vite.

Thông tin Navicom chỉ nằm ở:

`/etc/bvmsgtv/navicom-gateway.env` trên Ubuntu.

Gateway đã có lớp xác thực Supabase role. Production phải:

```env
NAVICOM_SKIP_AUTH=false
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_ANON_KEY=...
```

Để map API Navicom thật cần xác định đúng domain CMSV6/CMSV7, Device ID và response API. Khi có thông tin đó chỉ sửa adapter gateway, không phải sửa giao diện app.
