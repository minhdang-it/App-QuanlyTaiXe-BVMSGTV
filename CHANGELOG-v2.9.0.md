# CHANGELOG v2.9.0

## 1. Hành chính được tạo chuyến
- Quyền **Hành chính đội xe (`fleet`)** được mở rộng để tạo chuyến, sửa chuyến khi còn ở bước `Chờ Hành chính`, hủy chuyến và duyệt ngoại lệ checklist tương tự Điều phối.
- Hành chính có thể tạo chuyến trực tiếp từ đề nghị khoa/phòng đã được duyệt.
- Supabase `can_dispatch()` và workflow trip đã cập nhật tương ứng.

## 2. Lịch nghỉ phép tài xế theo tuần
- Thêm bảng `driver_leaves`.
- Điều phối / Hành chính / Quản trị có bảng tuần để tick ngày nghỉ từng tài xế.
- Tài xế nghỉ ngày nào sẽ bị **khóa lựa chọn** khi tạo chuyến ngày đó.
- Database cũng chặn xếp chuyến vào ngày nghỉ để tránh lách bằng API.
- Không cho đánh dấu nghỉ nếu tài xế đang có chuyến chưa hoàn tất trong ngày đó.

## 3. Quy trình sự cố mới
**Tài xế → Hành chính → Ban Giám đốc → thông báo tài xế → Hành chính sửa/xử lý**
- Tài xế gửi sự cố ở trạng thái `Chờ Hành chính`.
- Hành chính kiểm tra và trình BGĐ.
- BGĐ chọn `Duyệt sửa` hoặc `Không duyệt`.
- Tài xế nhận thông báo rõ ràng: **ĐƯỢC PHÉP SỬA** / **CHƯA ĐƯỢC PHÉP SỬA**.
- Sau khi được duyệt, Hành chính tiếp nhận, sửa/xử lý và đóng sự cố.

## 4. Quy trình chi phí mới
**Tài xế → Hành chính → Kế toán → Ban Giám đốc → Kế toán → Chi trả**
- Hành chính duyệt bước đầu.
- Kế toán kiểm tra chứng từ trước khi trình BGĐ.
- BGĐ duyệt khoản chi.
- Kế toán xác nhận lần cuối.
- Kế toán xác nhận đã chi trả.
- Mỗi bước lưu người duyệt và thời gian duyệt riêng.

## 5. Bàn giao xe cuối chuyến
- Sau khi chụp KM cuối, tài xế phải:
  1. Chụp **hình tổng thể xe**.
  2. Ghi **mức nhiên liệu còn lại 0–100%**.
  3. Bấm `Lưu bàn giao & kết thúc chuyến`.
- Database bắt buộc đủ ảnh KM cuối + ảnh tổng thể xe + nhiên liệu mới cho hoàn tất chuyến.

## 6. Đối chiếu khi nhận xe
- Tài xế có nút **Xem & đối chiếu** trước chuyến.
- Hiển thị chuyến trước của cùng xe:
  - KM cuối.
  - Ảnh KM cuối.
  - Ảnh tổng thể xe lúc bàn giao.
  - Mức nhiên liệu cuối chuyến.
- Sau khi chụp KM đầu chuyến mới, hệ thống hiển thị ảnh KM cuối cũ và ảnh KM đầu mới cạnh nhau để đối chiếu.
- Cảnh báo khi KM đầu lệch đáng kể so với KM cuối chuyến trước.

## 7. Kiểm tra kỹ thuật
- `npm run check`: PASS.
- `npm run build`: PASS.
- Vite chỉ cảnh báo bundle chính > 500 kB; không phải lỗi build.
