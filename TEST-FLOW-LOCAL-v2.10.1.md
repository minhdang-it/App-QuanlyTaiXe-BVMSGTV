# Checklist test flow local v2.10.1

Sau khi đăng nhập bằng các tài khoản test, kiểm tra theo thứ tự:

## 1. Trưởng khoa
- Tạo đề nghị xe, chọn ngày giờ DD/MM/YYYY HH:mm.
- Đính kèm nhiều ảnh/tệp.
- Trạng thái sau khi gửi: **Chờ Hành chính**.

## 2. Hành chính
- Nhìn thấy đề nghị mới.
- Duyệt đề nghị.
- Đề nghị chuyển sang **Đã duyệt**, Điều phối nhận được để tạo chuyến.

## 3. Điều phối
- Tạo chuyến trực tiếp: trạng thái **Chờ Hành chính**.
- Tạo chuyến từ đề nghị đã được Hành chính duyệt: chuyến được **Đã giao** ngay, không yêu cầu Hành chính duyệt lần hai.

## 4. Hành chính – chuyến trực tiếp
- Duyệt chuyến trực tiếp của Điều phối.
- Sau duyệt: **Đã giao** cho tài xế.
- Không có bước BGĐ duyệt chuyến.

## 5. Tài xế
- Nhận chuyến → checklist → KM đầu → lấy GPS → bắt đầu → chi phí/sự cố nếu có → KM cuối → kết thúc.
- Tạo thử chuyến đột xuất: đi ngay, sau đó báo cáo chờ Hành chính/Điều phối xác nhận.

## 6. GPS
- Điều phối/Hành chính/BGĐ/Quản trị: xem được vị trí xe đang chạy.
- Kế toán: không thấy bản đồ, tọa độ hay nút vị trí realtime.

## 7. Chi phí
- Tài xế gửi → **Chờ BGĐ**.
- BGĐ duyệt → **Chờ Kế toán**.
- Kế toán duyệt → **Chờ chi trả**.
- Kế toán xác nhận → **Đã chi trả**.

## 8. Sự cố / bảo dưỡng
- Tạo yêu cầu → **Chờ BGĐ**.
- BGĐ duyệt → Hành chính tiếp nhận/xử lý.

## 9. Báo cáo
- BGĐ xem tổng hợp, báo cáo tháng và chi phí.
- BGĐ không có nút duyệt chuyến xe.
