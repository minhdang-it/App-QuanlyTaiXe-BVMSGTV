# Cập nhật v2.7.5 – Mobile-first và badge thông báo theo tính năng

## Nội dung
- Menu đáy mobile rút gọn “Đề nghị từ khoa/phòng” thành “Đề nghị”.
- Chữ menu mobile không còn tràn/chồng nhau.
- Trung tâm thông báo là overlay độc lập, nền trắng đặc, cuộn riêng; không còn dính bộ lọc trang phía sau.
- Mỗi module có badge số thông báo chưa đọc: Đề nghị, Điều xe, Chi phí, Sự cố, Bảo dưỡng.
- Khi mở module, badge của module được đánh dấu đã xem.
- Thông báo “Đề nghị đã được Hành chính duyệt” của Điều phối trỏ thẳng đến Điều xe.

## Cập nhật
Không cần SQL migration và không cần deploy Edge Function.

Chép patch vào thư mục gốc source rồi chạy:

```powershell
npm run verify:source
npm run check
npm run build
```

Sau đó upload thư mục `dist` lên Ubuntu như quy trình hiện tại.
