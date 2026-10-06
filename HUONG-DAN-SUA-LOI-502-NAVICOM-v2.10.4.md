# Sửa lỗi Navicom HTTP 502 / ECONNREFUSED 127.0.0.1:3020

## Ý nghĩa lỗi

Nếu Vite hiện:

`http proxy error: /vehicle/<deviceId>`

`connect ECONNREFUSED 127.0.0.1:3020`

thì frontend đang chạy nhưng Navicom Gateway chưa chạy hoặc đã tự thoát.

## Cách chạy đúng

1. Chạy `SETUP-LOCAL.cmd` nếu chưa thiết lập `.env.local`.
2. Chạy `SETUP-NAVICOM-LOCAL.cmd` nếu chưa có `.env.navicom.local`.
3. Chạy `START-LOCAL-NAVICOM.cmd`.
4. Script v2.10.4 sẽ mở cửa sổ `BVMSGTV Navicom Gateway` trước.
5. Script chờ tối đa khoảng 15 giây đến khi `http://127.0.0.1:3020/health` trả OK.
6. Chỉ khi Gateway OK, Vite mới được chạy.

## Kiểm tra riêng Gateway

Chạy `START-NAVICOM-GATEWAY.cmd` và giữ cửa sổ này mở.

Sau đó mở trình duyệt:

`http://127.0.0.1:3020/health`

Ở chế độ mock phải thấy JSON có `ok: true` và `mode: "mock"`.

## Nếu port 3020 đã bị ứng dụng khác dùng

Chạy:

`netstat -ano | findstr :3020`

Nếu có PID lạ chiếm port, đóng tiến trình đó hoặc đổi `NAVICOM_GATEWAY_PORT` và đồng bộ proxy Vite.
