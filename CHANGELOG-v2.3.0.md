# CHANGELOG v2.3.0

## Không gian làm việc riêng theo từng bộ phận
- Điều phối: hiển thị chuyến đang chạy, chuyến trễ và chuyến sắp khởi hành.
- Kế toán: hiển thị chi phí tháng, khoản chờ duyệt, chứng từ và nhóm chi phí lớn.
- Đội xe: hiển thị sức khỏe từng xe, đăng kiểm, bảo hiểm, bảo dưỡng và sự cố mở.
- Ban lãnh đạo: dashboard cô đọng gồm mức sẵn sàng, xe đang chạy, chi phí tháng và cảnh báo nghiêm trọng.
- Quản trị: hiển thị tài khoản hoạt động, tài khoản bị khóa, thiếu thông tin bộ phận và phân bố vai trò.

## Theo dõi vị trí xe đúng nghiệp vụ
- Bổ sung `current_lat`, `current_lng`, `location_updated_at`.
- Không còn ghi đè vị trí xuất phát khi cập nhật GPS.
- Tài xế cập nhật vị trí hiện tại định kỳ khi chuyến đang chạy.
- Các bộ phận được phân quyền xem vị trí hiện tại và thời gian cập nhật gần nhất.
- Bổ sung file `supabase/migrate-v2.3-live-location.sql`.

## Giao diện và bảo mật
- Mỗi bộ phận có màu nhấn, KPI và bố cục nghiệp vụ riêng.
- Icon, tiêu đề và trạng thái được tăng độ rõ.
- Tiếp tục giữ khối bảo mật theo vai trò và trạng thái đồng bộ dữ liệu.
