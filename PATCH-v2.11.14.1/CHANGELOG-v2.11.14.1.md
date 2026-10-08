# v2.11.14.1 – Hotfix kiểm tra cấu trúc CameraPanel

- Sửa lỗi `Chỉ tìm thấy 0/2 CameraPanel cũ` khi hai thẻ JSX có thuộc tính `key`.
- Dò props `channel`, `title`, `deviceOnline`/`vehicleOnline` độc lập thứ tự thuộc tính; kiểm tra đúng hai kênh.
- Giữ logic tách GPS chậm và trạng thái camera của v2.11.14.
- Kiểm tra cú pháp trước khi sửa; sao lưu và dừng an toàn nếu source khác cấu trúc hỗ trợ.
- Không SQL, không thay Navicom Gateway, không thay OpenStreetMap.
