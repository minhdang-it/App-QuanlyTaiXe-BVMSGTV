# HƯỚNG DẪN CẬP NHẬT v2.6.2 – ĐỔI MẬT KHẨU CÁ NHÂN

## Nội dung
- Tất cả tài khoản đang hoạt động được tự đổi mật khẩu của chính mình.
- Áp dụng: Tài xế, Điều phối, Kế toán, Hành chính đội xe, Ban Giám đốc và Quản trị hệ thống.
- Người dùng thường không có quyền đổi mật khẩu của người khác.
- Quản trị viên vẫn có quyền đặt lại mật khẩu cho tài khoản khác trong trang quản lý tài khoản.

## Cách người dùng đổi mật khẩu

### Nhân viên văn phòng / Ban Giám đốc / Kế toán / Điều phối / Đội xe
1. Đăng nhập.
2. Mở **Hồ sơ**.
3. Nhập **Mật khẩu mới**.
4. Nhập lại **Xác nhận mật khẩu**.
5. Bấm **LƯU THAY ĐỔI**.

### Tài xế
1. Mở **Tài khoản**.
2. Nhập **Mật khẩu mới** và **Xác nhận mật khẩu**.
3. Bấm **LƯU THÔNG TIN**.

## Triển khai frontend
Không cần chạy migration SQL và không cần deploy lại Edge Function `manage-user`.

Trên Windows:
```powershell
npm run verify:source
npm run check
npm run build
```

Upload thư mục `dist` lên Ubuntu rồi chạy:
```bash
/home/danglee/uploads/ubuntu/deploy-static.sh   dieuphoixe.matsaigontravinh.vn   /home/danglee/uploads/dieuphoixe.matsaigontravinh.vn/dist   5
```

Kiểm tra:
```bash
curl -I https://dieuphoixe.matsaigontravinh.vn/ho-so
```

Sau khi cập nhật, thử bằng một tài khoản không phải Quản trị viên:
- đổi mật khẩu;
- đăng xuất;
- đăng nhập lại bằng mật khẩu mới.
