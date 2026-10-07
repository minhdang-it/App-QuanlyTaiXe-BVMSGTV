# BVMSGTV v2.11.7 — MOBILE + OFFLINE CAMERA FIX

Dùng trên source đã áp dụng v2.11.6.

## Sửa lỗi chính

### 1. Xe offline không còn bật popup Navicom
Popup `The Device Isn't Online!` không phải notification của app mà là `alert()` phát ra từ trang camera Navicom được nhúng bằng iframe (`camnd10.navicom.vn`). Vì iframe khác domain, frontend không thể chặn alert sau khi iframe đã load.

v2.11.7 xử lý đúng từ gốc: **không mount iframe/player camera khi xe offline hoặc kênh camera offline**. Thay vào đó chỉ hiện thẻ trạng thái `Offline`.

Áp dụng ở cả:
- Theo dõi xe realtime.
- Hồ sơ xe / Navicom Monitor.

### 2. UI mobile rõ hơn
- Font và khoảng cách ở màn Theo dõi xe được tăng vừa phải.
- Filter, search, camera switch, nút thao tác có touch target lớn hơn.
- Danh sách xe dạng horizontal snap trên mobile; bản đồ nằm ngay bên dưới.
- Camera xếp 1 cột trên mobile.
- Form input/select/textarea dùng 16px trên mobile để tránh Safari tự zoom khi nhập.
- Bottom navigation tăng vùng bấm nhưng không làm chữ quá lớn.

### 3. Trạng thái dễ hiểu
- `Mất tín hiệu` đổi thành `Offline` ở màn Theo dõi xe.
- KPI dùng `Xe offline`.
- Topbar số tài khoản đổi từ `x trực tuyến` thành `x tài khoản`, tránh nhầm với số xe online.

## Cách cập nhật

1. Giải nén patch.
2. Copy `APPLY-v2.11.7.mjs` vào thư mục full source hiện tại.
3. Mở CMD tại source và chạy:

```cmd
node APPLY-v2.11.7.mjs
npm.cmd run verify:source
npm.cmd run check
npm.cmd run build
```

Script tự backup file trước khi sửa vào `_backup-v2.11.7-...`.

Không cần SQL.
Không cần cập nhật Navicom Gateway.
