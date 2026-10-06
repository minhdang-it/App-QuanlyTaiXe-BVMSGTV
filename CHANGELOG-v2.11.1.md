# v2.11.1 – Sửa Hành chính duyệt chuyến

- Sửa lỗi giao diện hiển thị `[object Object]` khi Supabase trả lỗi.
- `updateTrip()` chuẩn hóa lỗi Supabase thành thông báo tiếng Việt dễ hiểu.
- Bổ sung migration đồng bộ workflow hiện hành: Điều phối → Hành chính duyệt → Tài xế.
- BGĐ không duyệt chuyến.
- Đồng bộ flow tài xế tối giản: Nhận → KM đầu → Bắt đầu → KM cuối → Kết thúc; không bắt buộc checklist/GPS điện thoại.
