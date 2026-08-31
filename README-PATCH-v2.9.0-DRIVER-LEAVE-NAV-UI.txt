PATCH UI LỊCH LÀM VIỆC TÀI XẾ - v2.9.0

File thay đổi:
- src/styles.css

Cách cập nhật:
1. Sao lưu source hiện tại.
2. Giải nén patch vào thư mục project và cho phép ghi đè file src/styles.css.
3. Không cần chạy SQL migration.
4. Chạy lại build frontend:
   npm run build
5. Deploy thư mục dist mới.
6. Trên điện thoại, đóng/mở lại PWA hoặc làm mới cache nếu giao diện cũ còn hiển thị.

Patch này chỉ chỉnh giao diện cụm nút chuyển tuần, không thay đổi chức năng.
