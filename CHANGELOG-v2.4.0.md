# CHANGELOG v2.4.0 — Tài xế mobile, GPS và thông báo bắt buộc

## Sửa nguyên nhân không lấy được vị trí
- Phát hiện rõ website đang chạy HTTP hay HTTPS.
- Chặn thao tác chuyến khi trình duyệt chưa đủ điều kiện dùng GPS.
- Nút mở nhanh địa chỉ HTTPS nội bộ `https://<IP>:8443`.
- GPS thử chế độ độ chính xác cao trước, sau đó tự chuyển sang chế độ dự phòng khi thiết bị bắt vị trí chậm.
- Thông báo lỗi quyền vị trí chi tiết hơn và hướng dẫn bật lại quyền đã chặn.
- Khi chuyến đang chạy, ứng dụng tiếp tục cập nhật vị trí định kỳ.

## Thiết lập bắt buộc cho tài xế
- Thêm màn hình kiểm tra bắt buộc gồm:
  1. Kết nối HTTPS bảo mật.
  2. Quyền vị trí GPS.
  3. Quyền thông báo chuyến xe.
- Chỉ mở giao diện thao tác chuyến sau khi ba điều kiện đều đạt.
- Khi quyền bị chặn, ứng dụng hướng dẫn tài xế mở Cài đặt trang web và kiểm tra lại.

## Thông báo chuyến xe
- Bắt buộc bật quyền thông báo đối với tài khoản tài xế.
- Hiển thị thông báo thử ngay khi bật thành công.
- Chuyến mới chờ nhận tạo thông báo ưu tiên, rung nhiều nhịp và giữ thông báo trên màn hình.
- Thông báo sử dụng Service Worker để ổn định hơn khi ứng dụng ở nền.
- Thêm xử lý nhấn vào thông báo để mở lại ứng dụng.
- Ứng dụng tự làm mới dữ liệu theo chu kỳ và khi quay lại màn hình.

## HTTPS nội bộ
- Máy chủ hỗ trợ đồng thời HTTP 8080 và HTTPS 8443.
- Khi có chứng chỉ, HTTP tự chuyển sang HTTPS.
- Thêm `TAO-HTTPS-NOI-BO.bat` và `TAO-HTTPS-NOI-BO.ps1` để tạo chứng chỉ bằng mkcert.
- Script sao chép CA gốc để cài trên điện thoại và mở Windows Firewall cho cổng 8080/8443.
