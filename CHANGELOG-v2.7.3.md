# v2.7.3 — Sửa lỗi gửi đề nghị xe

- Chặn ngay trên form nếu **Thời gian dự kiến về** nhỏ hơn hoặc bằng **Thời gian khởi hành**.
- Khi đổi thời gian khởi hành làm thời gian về không còn hợp lệ, hệ thống tự xóa thời gian về để người dùng chọn lại.
- Ô **Thời gian dự kiến về** có `min` bằng thời gian khởi hành.
- Sửa lỗi hiển thị `[object Object]` khi Supabase trả lỗi dạng object; thay bằng thông báo tiếng Việt rõ ràng.
- Backend chuyển PostgREST error thành `Error` chuẩn trước khi trả về giao diện.

Ảnh lỗi thực tế: thời gian khởi hành 13/08/2026 nhưng thời gian dự kiến về 12/08/2026 nên vi phạm ràng buộc `vehicle_request_time_order`.
