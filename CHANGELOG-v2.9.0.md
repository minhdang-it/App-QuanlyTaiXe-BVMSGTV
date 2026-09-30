# CHANGELOG v2.9.0

## 1. Tài xế tạo chuyến đột xuất (đi ngay, báo cáo sau)
- Nút **TẠO CHUYẾN ĐỘT XUẤT** trên ứng dụng tài xế: chọn xe, loại chuyến, **lý do phát sinh / người yêu cầu** (bắt buộc), điểm đón/đến, giờ đi/về.
- Chuyến tạo ra ở trạng thái **Đã nhận**, tài xế làm tiếp checklist → KM đầu → bắt đầu (GPS) → KM cuối như chuyến thường.
- Tài xế được tự hủy chuyến đột xuất khi chưa ghi KM đầu/xuất phát.
- Hành chính và Điều phối nhận thông báo, có hàng chờ **“Chờ Hành chính/Điều phối xác nhận báo cáo”** ở trang Điều xe: **Xác nhận báo cáo** hoặc **Cần giải trình** (bắt buộc ghi nội dung). Tài xế nhận thông báo kết quả.
- Máy chủ kiểm soát: chỉ tài xế tạo cho chính mình, xe không ở trạng thái sửa chữa/ngừng dùng, giờ đi trong khoảng -2h…+12h, không có chuyến sẵn sàng/đang chạy, không trùng lịch xe/tài xế.

## 2. Quy trình điều xe mới
- **Điều phối tạo chuyến → Hành chính điều phối duyệt → Tài xế.** Hành chính duyệt là xe đi.
- **Ban Giám đốc không còn duyệt chuyến** (bị chặn ở cả giao diện và cơ sở dữ liệu), không nhận thông báo từng chuyến; BGĐ xem **báo cáo tổng hợp cuối tháng** và **duyệt chi phí**.
- Các chuyến cũ đang “Chờ BGĐ” được migration chuyển thẳng sang **Đã giao** (vì Hành chính đã duyệt).
- Trang Báo cáo có mục **Chuyến đột xuất do tài xế tạo** (số chuyến, đã xác nhận, chờ xác nhận, cần giải trình, km, chi phí) và xuất kèm trong CSV/sao chép tóm tắt.

## 3. Trạng thái trực tuyến của tài khoản
- Chấm xanh/xám và “Đang trực tuyến / Hoạt động x phút trước” ở trang Tài khoản (có bộ lọc), chi tiết chuyến, danh sách chọn tài xế khi tạo chuyến.
- Nút **“N trực tuyến”** trên thanh công cụ (máy tính) và bảng **Tài khoản đang trực tuyến** ở trang Tổng quan.
- Kỹ thuật: Supabase Realtime Presence + bảng `user_presence` ghi nhịp mỗi phút qua RPC `touch_presence()`.

## Triển khai
1. Chạy `supabase/migrate-v2.9.0-adhoc-trips-presence.sql` trong Supabase SQL Editor (cài mới: `schema.sql` đã bao gồm).
2. Build và deploy frontend như thường lệ (`npm ci && npm run verify`).

## Chưa thay đổi
- Sự cố và bảo dưỡng vẫn qua BGĐ duyệt như trước (bảo dưỡng gắn với chi phí).
