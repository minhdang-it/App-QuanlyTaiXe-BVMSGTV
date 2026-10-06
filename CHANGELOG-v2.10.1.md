# CHANGELOG v2.10.1 – Local Ready / Flow chuẩn

- Giữ giao diện doanh nghiệp v2.10.0.
- Chuẩn hóa flow mới: Điều phối → Hành chính duyệt → Tài xế; BGĐ không duyệt chuyến.
- Đề nghị khoa/phòng đã được Hành chính duyệt thì Điều phối tạo chuyến và giao thẳng, không duyệt lần hai.
- Giữ chuyến đột xuất: tài xế đi ngay, Hành chính/Điều phối xác nhận báo cáo sau.
- Kế toán không còn thấy GPS/vị trí realtime ở Dashboard hoặc Chi tiết chuyến.
- Bỏ `pending_director` khỏi số việc điều xe hiện hành (chỉ giữ tương thích dữ liệu cũ ở model/migration).
- Thêm bộ chạy local Windows: SETUP-LOCAL.cmd, START-LOCAL.cmd, CHECK-LOCAL.cmd, BUILD-LOCAL.cmd, START-LOCAL-HTTPS.cmd.
- Thêm kiểm tra `.env.local` và hỗ trợ HTTPS local tùy chọn trong Vite.
- Dọn metadata build/Supabase local khỏi source đóng gói.
- Không cần SQL mới nếu database đã ở v2.9.0.
