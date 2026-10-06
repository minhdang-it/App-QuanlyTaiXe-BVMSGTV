# Hướng dẫn cập nhật v2.11.0

## Điều kiện
Frontend hiện tại nên ở v2.10.9 hoặc đã có đầy đủ các sửa lỗi Navicom v2.10.8.1 + Gateway v2.10.9.

## Cập nhật bằng patch
1. Giải nén patch v2.11.0.
2. Chép đè toàn bộ file/thư mục trong patch vào source hiện tại.
3. Chạy:

```cmd
npm.cmd run verify:source
npm.cmd run check
npm.cmd run build
```

4. Upload thư mục `dist` lên Ubuntu.
5. Deploy bằng script đang dùng cho domain `dieuphoixe.matsaigontravinh.vn`.

## Kiểm tra sau deploy
- Đăng nhập bằng BGĐ / Hành chính / Điều phối / Quản trị.
- Mở menu **Theo dõi xe realtime**.
- Kiểm tra KPI, danh sách xe, map, 2 camera đồng thời.
- Để một thiết bị chuyển online/offline hoặc thay đổi tốc độ để kiểm tra thông báo.

## Không cần
- Không chạy SQL mới.
- Không mở thêm port.
- Không dùng GPS điện thoại tài xế.
