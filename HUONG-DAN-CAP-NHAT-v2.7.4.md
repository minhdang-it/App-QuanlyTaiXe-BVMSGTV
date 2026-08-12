# Cập nhật BVMSGTV v2.7.4

## Thay đổi nghiệp vụ

### Đề nghị từ Trưởng khoa / đơn vị

Quy trình mới:

**Trưởng khoa gửi đề nghị → Hành chính đội xe duyệt → Điều phối chọn xe/tài xế và tạo chuyến → Tài xế nhận chuyến.**

Hành chính **không duyệt chuyến lần thứ hai** sau khi đã duyệt đề nghị.

Khi Điều phối tạo chuyến từ khối **“Đề nghị đã được Hành chính duyệt”**:

- Form hiển thị rõ đề nghị đã được duyệt.
- Không yêu cầu tải lại văn bản/kế hoạch.
- Nút cuối form là **TẠO CHUYẾN & GIAO TÀI XẾ**.
- Chuyến được tạo ở trạng thái `assigned`.
- Tài xế nhìn thấy và có thể tiếp nhận chuyến ngay.
- Người Hành chính đã duyệt đề nghị và thời gian duyệt được sao chép sang chuyến để đối soát.

### Chuyến do Điều phối tự tạo

Không thay đổi:

- Có văn bản/kế hoạch: Điều phối → Hành chính → Tài xế.
- Không có văn bản/kế hoạch: Điều phối → Hành chính → BGĐ → Tài xế.

## 1. Chép patch

Giải nén ZIP patch và chép đè vào thư mục gốc source.

## 2. Chạy SQL migration bắt buộc

Supabase Dashboard → SQL Editor → New query.

Mở file:

`supabase/migrate-v2.7.4-approved-request-direct-assignment.sql`

Copy toàn bộ và Run.

Migration cập nhật trigger + RLS để chuyến tạo từ một `vehicle_request_id` đã được Hành chính duyệt có thể chuyển trực tiếp sang `assigned` mà không quay về `pending_fleet`.

## 3. Build frontend

```powershell
npm run verify:source
npm run check
npm run build
```

## 4. Deploy Ubuntu

Upload `dist` mới và deploy như quy trình hiện tại cho domain:

`dieuphoixe.matsaigontravinh.vn`

## 5. Kiểm tra

1. Đăng nhập Trưởng khoa → gửi đề nghị.
2. Đăng nhập Hành chính → duyệt đề nghị.
3. Đăng nhập Điều phối → tại “Chờ Điều phối tạo chuyến” bấm “Tạo chuyến”.
4. Chọn xe + tài xế → bấm **TẠO CHUYẾN & GIAO TÀI XẾ**.
5. Chuyến phải ở trạng thái **Đã giao**, không xuất hiện lại trong tab **Chờ Hành chính**.
6. Đăng nhập tài xế → chuyến phải xuất hiện để tiếp nhận.

Không cần deploy lại Edge Function `manage-user` cho v2.7.4.
