# CHANGELOG v2.6.2

## Quyền đổi mật khẩu cá nhân
- Mọi tài khoản đang hoạt động đều có quyền tự đổi mật khẩu của chính mình.
- Đổi mật khẩu cá nhân gọi trực tiếp Supabase Auth của phiên đăng nhập, không phụ thuộc quyền quản lý tài khoản của Quản trị viên.
- Người dùng thường không thể đổi mật khẩu của tài khoản khác.
- Quản trị viên vẫn giữ quyền tạo tài khoản, khóa/mở khóa, đổi vai trò và đặt lại mật khẩu cho người khác.
- Áp dụng cho Tài xế, Điều phối, Kế toán, Hành chính đội xe, Ban Giám đốc và Quản trị hệ thống.

## Giao diện
- Hồ sơ cá nhân ghi rõ mọi tài khoản đang hoạt động được tự đổi mật khẩu.
- Tài xế có cùng quyền trong cửa sổ “Tài khoản của tôi”.
