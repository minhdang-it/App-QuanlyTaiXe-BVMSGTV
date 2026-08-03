# Điều phối xe BVMSGTV v1.2.1 — Sửa lỗi build TypeScript

## Đã sửa

- Khắc phục lỗi `TS18047: 'supabase' is possibly 'null'` tại `src/lib/backend.ts`.
- Sao chép Supabase client sang biến cục bộ `client` trước khi đăng ký realtime channel.
- Hàm cleanup dùng `client.removeChannel(channel)`, nên TypeScript giữ được kết luận client không null.
- Tăng cache Service Worker lên `dieu-phoi-xe-bvmsgtv-shell-v4`.
- Loại bỏ tệp `*.tsbuildinfo` sinh ra từ máy đóng gói và thêm chúng vào `.gitignore`.

## Cập nhật

Không cần chạy lại SQL hoặc thay đổi Supabase. Chép đè source rồi chạy:

```bash
npm run build
```
