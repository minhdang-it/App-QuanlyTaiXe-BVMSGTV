# v2.8.0 – Mobile Operations Upgrade

Bản nâng cấp tập trung vào vận hành thực tế trên điện thoại, giảm số bước xử lý và giúp từng vai trò nhìn thấy việc quan trọng ngay khi mở hệ thống.

## Tính năng mới

1. **Việc cần xử lý theo vai trò**
   - Điều phối: đề nghị đã duyệt chờ tạo chuyến, chuyến trễ, checklist cần xác nhận.
   - Hành chính: đề nghị từ khoa/phòng, yêu cầu điều xe, sự cố và bảo dưỡng cần xử lý.
   - Ban Giám đốc: chuyến, chi phí, sự cố và bảo dưỡng đang chờ duyệt.
   - Kế toán: khoản chờ duyệt và khoản chờ chi trả.
   - Trưởng khoa: thống kê đề nghị chờ Hành chính, đã duyệt, đã tạo chuyến và cần xem lại.

2. **Dashboard “Hôm nay” dành cho mobile**
   - Tổng chuyến, xe đang chạy, việc chờ xử lý và cảnh báo.
   - Ưu tiên hiển thị gọn ở màn hình 360–430 px.

3. **Thông báo đi thẳng đúng việc cần xử lý**
   - Thông báo có mã bản ghi liên quan.
   - Bấm thông báo chuyến/chi phí sẽ mở trực tiếp chi tiết tương ứng.
   - Đề nghị, sự cố và bảo dưỡng sẽ tự cuộn tới bản ghi và làm nổi bật trong vài giây.
   - Thông báo hệ thống trên PWA/browser cũng có đường dẫn trực tiếp khi người dùng bấm từ nền.

4. **Lịch điều xe**
   - Danh sách / Ngày / Tuần / Tháng.
   - Chuyển nhanh Hôm nay, ngày trước/sau, tuần trước/sau, tháng trước/sau.
   - Bấm ngày hoặc chuyến để xem chi tiết.

5. **Dòng thời gian từng chuyến**
   - Tạo chuyến, Hành chính duyệt, BGĐ duyệt, checklist, KM đầu, bắt đầu chuyến, chi phí, sự cố, KM cuối và kết thúc.

6. **Tài xế – thao tác một chạm & kiểm tra trước chuyến**
   - Thanh tiến độ 4 bước: Nhận chuyến → Chuẩn bị → Đang chạy → Hoàn tất.
   - Tự kiểm tra trạng thái xe, đăng kiểm, bảo hiểm TNDS, phí đường bộ, thay nhớt và bảo dưỡng.
   - Cảnh báo nghiêm trọng sẽ chặn nút bắt đầu chuyến cho đến khi được xử lý.
   - Khi đang chạy, giao diện chuyển sang khối tập trung với Mở bản đồ và Báo sự cố.

7. **Offline / đồng bộ rõ ràng hơn**
   - Hiển thị số thao tác đang chờ đồng bộ.
   - Có nút “Đồng bộ ngay” khi mạng trở lại.
   - KM, checklist, chi phí, sự cố và các cập nhật được hỗ trợ bởi hàng đợi offline hiện có.

8. **Tự phát hiện dữ liệu/vận hành bất thường**
   - Giấy tờ xe quá hạn hoặc sắp hết hạn.
   - Quá lịch thay nhớt/bảo dưỡng.
   - KM cuối nhỏ hơn KM đầu.
   - Chuyến hoàn thành nhưng thiếu KM cuối.
   - Chuyến đang chạy quá thời gian dự kiến.
   - Một chứng từ/hóa đơn xuất hiện ở nhiều khoản chi.

9. **Tìm kiếm toàn hệ thống**
   - Tìm biển số, tài xế, địa điểm, SĐT, đề nghị, chi phí, sự cố và tài khoản.
   - Kết quả tự giới hạn theo quyền của vai trò hiện tại.

10. **Dashboard BGĐ nâng cấp**
   - Chuyến trong tháng, tổng KM đối soát, chi phí/km, xe sử dụng nhiều và sự cố đang mở.

## Thiết kế mobile-first
- Mobile là giao diện ưu tiên; kiểm tra chính ở 360–430 px.
- Nút thao tác quan trọng đủ lớn để bấm bằng một tay.
- Màn hình tài xế đang chạy giảm nội dung phụ để tập trung vào bản đồ, sự cố và kết thúc chuyến.

## Chuẩn ngày giờ
- Ngày: `DD/MM/YYYY`
- Ngày giờ: `DD/MM/YYYY HH:mm`
- Hàm hiển thị ngày giờ dùng định dạng cố định, không phụ thuộc thứ tự mặc định của trình duyệt.

## Database
Bản v2.8.0 không thêm bảng/cột mới. Không cần chạy SQL migration mới nếu v2.7.12 đã được migration thành công.

## Giai đoạn tiếp theo
QR dán trên từng xe và chữ ký xác nhận bằng tay được tách sang giai đoạn tiếp theo để không đưa thêm schema/phụ thuộc mới vào bản nâng cấp vận hành lõi này.
