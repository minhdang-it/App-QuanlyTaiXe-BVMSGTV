# CHANGELOG v2.7.4

## Luồng đề nghị xe của Trưởng khoa

- Đề nghị do Trưởng khoa/đơn vị gửi và đã được Hành chính đội xe duyệt chỉ cần duyệt **một lần**.
- Khi Điều phối bấm **Tạo chuyến** từ đề nghị đã duyệt, chuyến chuyển thẳng sang trạng thái **Đã giao** (`assigned`).
- Tài xế nhận chuyến ngay sau khi Điều phối chọn xe, tài xế và tạo chuyến.
- Không xuất hiện lại bước **Hành chính duyệt** và không qua BGĐ đối với đề nghị đã duyệt này.
- Lưu lại `fleet_reviewer_id` và `fleet_reviewed_at` từ đề nghị vào chuyến để bảo toàn lịch sử phê duyệt.
- Giao diện nút đổi thành **TẠO CHUYẾN & GIAO TÀI XẾ** và hiển thị rõ luồng xử lý.

## Luồng tạo chuyến độc lập vẫn giữ nguyên

- Điều phối tạo chuyến không dựa trên đề nghị của Trưởng khoa:
  - Có kế hoạch/văn bản: Điều phối → Hành chính → Tài xế.
  - Không có kế hoạch: Điều phối → Hành chính → BGĐ → Tài xế.
