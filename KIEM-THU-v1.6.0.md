# Kiểm thử v1.6.0

- TypeScript strict check: PASS.
- Vite production build: PASS.
- Source verification: PASS, 33 tệp TypeScript.
- Edge Function TypeScript syntax transpile: PASS.
- Không đóng gói `.env` hoặc `node_modules`.
- Đã kiểm tra luồng tạo tài khoản, sửa hồ sơ, đổi số điện thoại, khóa/mở tài khoản và đặt lại mật khẩu ở mức mã nguồn.

## Cần kiểm thử trên Supabase thật

1. Chạy migration v1.6.
2. Deploy `manage-user` v1.6.0.
3. Tải avatar và xác nhận ảnh hiển thị ở tài khoản đích.
4. Đổi số điện thoại và đăng nhập lại bằng số mới.
5. Đặt lại mật khẩu và đăng nhập bằng mật khẩu mới.
