# CHANGELOG v2.7.13

## Tệp đính kèm
- Sửa nguyên nhân app chạy nhầm `backend.js` và `DispatchPage.jsx` cũ, khiến chức năng nhiều tệp không hoạt động đúng.
- Đề nghị từ khoa/phòng và Điều xe có thể chọn nhiều tệp một lần hoặc bấm chọn thêm nhiều lần.
- Tự loại tệp trùng; tối đa 10 tệp, 10 MB/tệp, tổng 50 MB.
- Ảnh JPG/PNG/WebP/HEIC... xem trực tiếp trong ứng dụng.
- PDF, Word, Excel, PowerPoint và tệp văn phòng mở ở tab mới.
- Danh sách nhiều tệp hiển thị rõ loại tệp; ảnh được xem nội bộ, văn bản có ký hiệu mở tab mới.

## Kiểm tra source
- `verify:source` cảnh báo nếu xuất hiện `.js/.jsx` legacy cùng tên với `.ts/.tsx`, ngăn lỗi quay lại.
