# HƯỚNG DẪN TỪNG BƯỚC – BVMSGTV v2.10.3 + NAVICOM LOCAL

## Mục tiêu
Chạy App Điều phối xe + Navicom Gateway trên máy Windows. Lần đầu dùng MOCK để xác nhận flow và liên kết xe. Sau đó mới map API Navicom thật.

## 1. Chuẩn bị
- Node.js 22 trở lên.
- Source đầy đủ v2.10.3.
- Supabase project đang dùng của hệ thống.
- Đã chạy migration `supabase/migrate-v2.10.2-navicom-driver-minimal.sql`.

## 2. Cài frontend
1. Chạy `SETUP-LOCAL.cmd`.
2. Lần đầu script tạo `.env.local` và mở Notepad.
3. Điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.
4. Lưu, đóng Notepad.
5. Chạy lại `SETUP-LOCAL.cmd` để cài dependencies và kiểm tra source.

## 3. Cài Navicom Gateway local
1. Chạy `SETUP-NAVICOM-LOCAL.cmd`.
2. Script tự tạo `.env.navicom.local` ở `NAVICOM_MODE=mock`.
3. Không cần điền tài khoản Navicom để test mock.

## 4. Khởi động cả App + Gateway
Chạy `START-LOCAL-NAVICOM.cmd`.

Kết quả mong đợi:
- Gateway: `http://127.0.0.1:3020`
- Health: `http://127.0.0.1:3020/health`
- App: `http://localhost:5173`

Có thể chạy `CHECK-NAVICOM-GATEWAY.cmd` để kiểm tra gateway riêng.

## 5. Liên kết một xe với Navicom
Đăng nhập tài khoản Hành chính hoặc Quản trị:
1. Quản lý xe.
2. Chọn xe → Chỉnh sửa.
3. Bật `Kích hoạt Navicom`.
4. Nhập `Mã thiết bị / Device ID / IMEI`. Khi test mock có thể nhập `TEST-64A36687`.
5. Số kênh camera: 2.
6. Lưu.

Sau đó mở Tổng quan / Chi tiết chuyến. Khối Camera & GPS Navicom phải chuyển khỏi trạng thái chưa liên kết.

## 6. Flow tài xế v2.10.3
Tài xế không dùng GPS điện thoại và không dùng Google Maps:
`Nhận chuyến → Chụp KM đầu → Bắt đầu chuyến → Lái xe → Chụp KM cuối → Kết thúc chuyến`.
Không chụp tổng quan xe. Chi phí và sự cố chỉ thao tác khi phát sinh.

## 7. Chuyển sang Navicom thật
Chỉ thực hiện sau khi xác định API của domain Navicom:
- đổi `NAVICOM_MODE=canonical-http` hoặc adapter CMSV6/CMSV7 riêng;
- `NAVICOM_SKIP_AUTH=false`;
- điền Supabase URL/Anon key cho gateway;
- tài khoản/mật khẩu Navicom chỉ nằm trong `.env.navicom.local` hoặc biến môi trường server, không đưa vào React/Vite.

Lưu ý: chỉ điền `NAVICOM_BASE_URL/USERNAME/PASSWORD` chưa đủ nếu chưa map endpoint API thật của CMSV6/CMSV7.
