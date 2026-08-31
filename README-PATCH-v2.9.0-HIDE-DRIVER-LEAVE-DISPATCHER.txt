BVMSGTV - HOTFIX QUYỀN HIỂN THỊ LỊCH NGHỈ TÀI XẾ

Mục tiêu:
- Tài khoản Điều phối (dispatcher): KHÔNG hiển thị "Lịch làm việc tài xế / Nghỉ phép theo tuần".
- Tài khoản Hành chính (fleet): vẫn hiển thị và được tick ngày nghỉ tài xế.
- Tài khoản Quản trị (admin): vẫn hiển thị và được quản lý.
- Điều phối vẫn giữ nguyên quyền tạo chuyến/xếp chuyến.

Cách cập nhật:
1. Giải nén patch vào thư mục project hiện tại.
2. Cho phép ghi đè file src/pages/DispatchPage.tsx.
3. Chạy: npm run build
4. Deploy lại thư mục dist.
5. Nếu điện thoại còn giao diện cũ, đóng PWA/mở lại hoặc xóa cache.

Không cần chạy SQL migration. Không thay đổi database.
