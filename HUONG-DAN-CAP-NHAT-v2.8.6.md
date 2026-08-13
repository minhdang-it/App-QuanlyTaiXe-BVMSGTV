# Cập nhật v2.8.6 — Giao diện Quy trình / Trạng thái

## Nội dung chỉnh sửa
- Thu gọn khối **Quy trình sự cố** và **Quy trình bảo dưỡng**.
- Giảm cỡ chữ tiêu đề quy trình, giảm padding và bóng đổ.
- Cân lại 5 nút trạng thái sự cố: **Đang mở / Chờ BGĐ / Đang xử lý / Đã xử lý / Tất cả**.
- Trên điện thoại: 3 nút ở hàng đầu, 2 nút ở hàng dưới; không còn nút bị cắt khỏi màn hình.
- Không thay đổi dữ liệu, nghiệp vụ hoặc phân quyền.

## Cập nhật bằng patch
Giải nén patch và chép đè vào thư mục project hiện tại.

Sau đó chạy:

```bash
npm install
npm run build
```

Nếu đang deploy bằng bản build cũ, cần build lại để CSS/React mới có hiệu lực.
