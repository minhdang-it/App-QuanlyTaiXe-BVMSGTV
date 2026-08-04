# Kiểm thử v1.4.1

## Đã thực hiện

- `npm run check`: thành công.
- `npm run build`: thành công với Vite production build.
- 111 module frontend được transform thành công.
- Kiểm tra cú pháp TypeScript của Edge Function bằng TypeScript compiler: thành công.
- Kiểm tra source không chứa Supabase Secret Key hoặc service-role key thật.
- Service Worker cache đã tăng lên `shell-v8`.

## Cần thực hiện trên Supabase của người dùng

- Deploy `manage-user` bằng `--no-verify-jwt`.
- Chạy health check sau deploy.
- Đăng xuất/đăng nhập lại admin để lấy access token mới.
- Thử tạo một tài khoản tài xế.
