# Điều phối xe BVMSGTV v2.7.0

## Tính năng mới

### 1. Quản trị hệ thống xóa tài khoản
- Quản trị viên có nút **Xóa** trong trang Tài khoản.
- Không cho phép tự xóa tài khoản đang đăng nhập.
- Không cho phép xóa quản trị viên hoạt động cuối cùng.
- Xóa theo hướng **xóa mềm**: khóa quyền đăng nhập và ẩn tài khoản khỏi danh sách, nhưng giữ hồ sơ để lịch sử chuyến/chi phí/sự cố vẫn đối chiếu được.
- Số điện thoại của tài khoản đã xóa được giải phóng để có thể tạo lại người dùng mới.

### 2. Vai trò Trưởng khoa / Trưởng đơn vị
- Thêm vai trò `department_head`.
- Có trang **Đề nghị xe** riêng tại `/de-nghi-xe`.
- Trưởng khoa/đơn vị gửi đề nghị điều hành xe và bắt buộc đính kèm văn bản/kế hoạch.
- Hành chính đội xe duyệt hoặc từ chối đề nghị.
- Điều phối có thể chọn đề nghị đã duyệt khi tạo chuyến; một đề nghị chỉ được chuyển thành một chuyến.

### 3. Quy trình duyệt điều xe
Luồng mặc định:

`Điều phối tạo yêu cầu → Hành chính đội xe trình BGĐ → BGĐ duyệt → Tài xế nhận chuyến`

Trường hợp được bỏ qua BGĐ:
- Mục đích là **Đi công tác** hoặc **Đón bệnh nhân**.
- Có văn bản/kế hoạch đính kèm.
- Văn bản đã được cấp có thẩm quyền phê duyệt.
- Hành chính đội xe kiểm tra và duyệt.

Khi đủ điều kiện, luồng là:

`Điều phối → Hành chính đội xe → Tài xế`

### 4. Sự cố qua Ban Giám đốc duyệt
- Tài xế báo sự cố → trạng thái **Chờ Ban Giám đốc**.
- BGĐ duyệt → Hành chính đội xe tiếp nhận xử lý.
- BGĐ có thể từ chối và phải nhập lý do.
- Hành chính cập nhật **Đang xử lý** và **Đã xử lý**.

### 5. Bảo dưỡng/sửa chữa qua Ban Giám đốc duyệt
- Hành chính đội xe tạo đề nghị bảo dưỡng/sửa chữa.
- BGĐ duyệt trước khi thực hiện.
- Sau duyệt: Hành chính bắt đầu → hoàn thành.
- Nếu từ chối phải có lý do.

### 6. Chi phí có nút Chi tiết
- Mỗi khoản chi phí có nút **Chi tiết**.
- Xem loại chi phí, số tiền, xe, tài xế, ngày chi, ngày gửi, nội dung.
- Xem ảnh hóa đơn trực tiếp và phóng to.
- Xem lịch sử duyệt BGĐ → Kế toán → Chi trả.

### 7. Thông báo workflow
- Hành chính nhận thông báo khi có đề nghị xe mới.
- Điều phối nhận thông báo khi đề nghị đã được Hành chính duyệt.
- Trưởng khoa/đơn vị nhận thông báo khi đề nghị thay đổi trạng thái.
- Hành chính/BGĐ nhận thay đổi trạng thái chuyến, sự cố và bảo dưỡng theo phân quyền.

## Cập nhật cơ sở dữ liệu bắt buộc
Chạy:

`supabase/migrate-v2.7.0-workflows.sql`

trước khi deploy frontend v2.7.0.

## Edge Function bắt buộc
Deploy lại:

`supabase/functions/manage-user`

để kích hoạt chức năng xóa tài khoản và vai trò Trưởng khoa / Trưởng đơn vị.
