# CHANGELOG v2.7.12

## Tệp đính kèm đề nghị và điều xe
- “Xem văn bản kế hoạch” mở trực tiếp trong modal của hệ thống, không mở tab mới.
- PDF và hình ảnh xem trực tiếp trong ứng dụng; Word/Excel/PowerPoint/TXT hiển thị thông tin và nút tải xuống ngay trong modal.
- Đề nghị xe cho phép chọn tối đa 10 tệp cùng lúc.
- Điều xe cho phép chọn nhiều tệp/hình ảnh; chuyến tạo từ đề nghị đã duyệt tự kế thừa toàn bộ tệp của đề nghị.
- Giới hạn 10 MB/tệp và 50 MB cho một lần chọn.
- Bổ sung migration `supabase/migrate-v2.7.12-multiple-plan-attachments.sql`.
