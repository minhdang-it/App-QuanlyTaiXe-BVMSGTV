# Điều phối xe BVMSGTV v2.7.1

## Thay đổi nghiệp vụ

### 1. Thêm vai trò Trưởng khoa khi tạo thành viên
- Vai trò `department_head` hiển thị rõ là **Trưởng khoa** trong màn hình Tài khoản.
- Trưởng khoa có trang **Đề nghị xe** để gửi đề nghị kèm văn bản/kế hoạch cho Hành chính đội xe.

### 2. Quy trình duyệt chuyến được chốt lại

**Không có kế hoạch/văn bản:**

`Điều phối yêu cầu → Hành chính trình BGĐ → BGĐ duyệt → Tài xế nhận chuyến`

**Có kèm kế hoạch/văn bản:**

`Điều phối yêu cầu → Hành chính duyệt trực tiếp → Tài xế nhận chuyến`

Không còn giới hạn việc bỏ qua BGĐ chỉ cho loại chuyến công tác hoặc đón bệnh nhân. Chỉ cần chuyến có tệp kế hoạch/văn bản đi kèm thì hệ thống tự chọn luồng `fleet_only`.

### 3. Giao diện tạo chuyến
- Bỏ checkbox xác nhận riêng “văn bản đã phê duyệt”.
- Khi chọn đề nghị của Trưởng khoa đã có kế hoạch hoặc tải trực tiếp một văn bản/kế hoạch, giao diện tự hiển thị luồng duyệt rút gọn.
- Hành chính thấy nút **Hành chính duyệt & giao tài xế** đối với chuyến có kế hoạch.

## Database
Nếu đã chạy migration v2.7.0, chạy tiếp:

`supabase/migrate-v2.7.1-trip-plan-bypass.sql`

Nếu cài mới từ source v2.7.1, file `migrate-v2.7.0-workflows.sql` trong gói cũng đã được đồng bộ điều kiện mới; vẫn nên chạy v2.7.1 sau đó để chuẩn hóa dữ liệu đang chờ nếu có.
