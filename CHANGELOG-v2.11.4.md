# CHANGELOG v2.11.4

- Màn Theo dõi xe hỗ trợ Google Maps khi cấu hình `VITE_GOOGLE_MAPS_API_KEY`.
- Nếu chưa có Google Maps API Key, bản đồ OpenStreetMap dự phòng có nút phóng to/thu nhỏ.
- Trạng thái Đang chạy ưu tiên tốc độ Navicom và phát hiện thay đổi tọa độ, giảm trường hợp xe chạy nhưng vẫn hiện Đang dừng.
- Camera trước/cabin có nút `Phóng to ngang`. Android/Chrome tự khóa landscape khi trình duyệt cho phép.
- iPhone/Safari không hỗ trợ khóa hướng sẽ dùng chế độ xoay ngang giao diện dự phòng.
- Thoát fullscreen trả giao diện về bình thường và mở khóa hướng màn hình.
- Không thay đổi database và không thay đổi Navicom Gateway.
