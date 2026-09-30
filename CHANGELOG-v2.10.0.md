# CHANGELOG v2.10.0 — Giao diện doanh nghiệp

Chỉ thay đổi giao diện. Không đổi nghiệp vụ, dữ liệu hay phân quyền, **không cần chạy SQL**.

## Hệ thống thiết kế
- Viết lại toàn bộ CSS: thay `src/styles.css` (≈10.500 dòng, nhiều bản vá chồng nhau) bằng 9 module trong `src/styles/`:
  `base` (màu, chữ, nút, form, bảng, badge, modal), `shell`, `components`, `dashboard`, `dispatch`, `pages`, `reports`, `driver`, `login`.
- Giữ logo và màu xanh ngọc thương hiệu; thêm nền tối (ink) cho sidebar, khối điều hành và header ứng dụng tài xế.
- Chữ: ưu tiên "Be Vietnam Pro" nếu máy đã cài, sau đó Segoe UI / hệ thống. Biển số, KM, giờ dùng font số đơn cách để dễ đối chiếu.
- Bộ biểu tượng nét (`src/components/Icon.tsx`) thay cho emoji trên toàn hệ thống; tệp đính kèm hiển thị nhãn PDF/DOC/XLS.
- Nhãn nút chuyển sang chữ thường có viết hoa đầu câu.

## Khung ứng dụng văn phòng
- Sidebar tối, chia nhóm Điều hành / Đội xe & chi phí / Phân tích / Hệ thống; thu gọn được và nhớ trạng thái.
- Topbar gọn: đường dẫn, tiêu đề trang, tìm kiếm toàn cục (phím tắt **Ctrl K**), số người trực tuyến, làm mới, thông báo.
- Điện thoại: thanh điều hướng dưới 4 mục chính + nút **Thêm** mở bảng chức năng và đăng xuất.

## Trang
- Tổng quan: dải 6 KPI, bố cục 2 cột (việc cần xử lý, không gian theo vai trò, lịch xe, GPS | cảnh báo, kiểm tra dữ liệu, trực tuyến, hoạt động).
- Điều xe: hàng chờ có viền trạng thái, thẻ chuyến có biển số nổi bật, lịch ngày/tuần/tháng mới, chi tiết chuyến có thanh thao tác cố định.
- Chi phí: thanh quy trình 4 bước kiêm thống kê; Sự cố: thẻ có viền theo mức độ; Hồ sơ xe: thẻ ảnh với biển số dạng biển thật.
- Báo cáo: khối Ban Giám đốc nền tối, bảng so sánh kỳ trước có nhãn tăng/giảm.
- Tài khoản: bảng chuyển thành thẻ trên điện thoại.
- Ứng dụng tài xế: header tối có lời chào, thẻ chuyến với tuyến đường dạng timeline, nút hành động lớn, thao tác nhanh 2×2.
- Đăng nhập: bố cục 2 cột (ảnh bệnh viện + năng lực hệ thống | form), điện thoại chỉ hiện form.
