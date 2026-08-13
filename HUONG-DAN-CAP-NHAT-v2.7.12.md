# Cập nhật v2.7.12 – xem tệp trong trang và nhiều tệp đính kèm

## 1. Chép patch
Chép toàn bộ nội dung patch đè vào thư mục gốc project v2.7.11.

## 2. Bắt buộc chạy SQL migration
Supabase → SQL Editor → New query → mở file:
`supabase/migrate-v2.7.12-multiple-plan-attachments.sql`
Copy toàn bộ và Run.

Migration thêm trường `plan_attachments` cho đề nghị/chuyến và cập nhật Storage MIME types.

## 3. Kiểm tra và build
```powershell
npm run verify:source
npm run check
npm run build
```

## 4. Deploy
Upload thư mục `dist` lên Ubuntu và deploy theo quy trình hiện tại.

## Tính năng
- Xem PDF/hình ảnh trực tiếp trong modal của app, không mở tab mới.
- Word/Excel/PowerPoint/TXT hiển thị trong modal và tải xuống tại chỗ.
- Đề nghị xe và Điều xe chọn nhiều tệp/hình ảnh cùng lúc.
- Tối đa 10 tệp, 10 MB/tệp, tổng 50 MB/lần chọn.
- Chuyến tạo từ đề nghị đã duyệt tự kế thừa toàn bộ tệp từ đề nghị.
