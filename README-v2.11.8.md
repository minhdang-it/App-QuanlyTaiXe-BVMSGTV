# v2.11.8 — Cinematic Fleet Login

## Mục tiêu
Trang đăng nhập mới theo phong cách cinematic/motion: ảnh bệnh viện thật, xe Toyota Hiace + Fortuner, glassmorphism, animation nhẹ và tối ưu mobile-first.

## Cập nhật
Chép đè các thư mục `src/` và `public/` của patch vào full source hiện tại rồi chạy:

```cmd
npm.cmd run verify:source
npm.cmd run check
npm.cmd run build
```

Không cần SQL và không cần cập nhật Navicom Gateway.

## Mobile
- Giao diện rút gọn, giữ xe Hiace nổi bật phía trên form.
- Input 16px để iPhone không tự zoom.
- Không chạy hiệu ứng intro nặng trên mobile.
- Hỗ trợ safe-area iPhone.
