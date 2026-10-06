# v2.10.8 – Sửa chọn xe Navicom

- Chọn xe Navicom không còn tự thay đổi checkbox Kích hoạt Navicom.
- Dropdown dùng `item.key` riêng thay vì `device_id`, nên các bản ghi chưa có Device ID vẫn chọn đúng từng xe.
- Khi xe Navicom chưa trả Device ID, giữ nguyên trạng thái kích hoạt và hiển thị cảnh báo để nhập Device ID/IMEI thủ công.
- Đổi nút thành “Lấy danh sách xe Navicom”.
- Không thay đổi database/Gateway.
