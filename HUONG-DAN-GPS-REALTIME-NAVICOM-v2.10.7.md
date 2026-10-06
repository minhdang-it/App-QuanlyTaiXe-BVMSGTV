# GPS realtime Navicom v2.10.7

## Cách hoạt động

1. Gateway Navicom lấy `lat`, `lng`, tốc độ và thời gian GPS từ CMSV6.
2. Frontend gọi `/api/navicom/vehicle/:deviceId` mỗi 5 giây.
3. Khi tọa độ thay đổi, bản đồ trong app tự cập nhật marker theo vị trí mới.
4. Bản đồ sử dụng OpenStreetMap, không cần Google Maps API key.
5. GPS hoàn toàn lấy từ thiết bị Navicom; không sử dụng GPS điện thoại tài xế.

## Phân quyền

Bản đồ Navicom chỉ hiển thị trong các màn hình mà vai trò quản lý đã được phép xem Navicom: Ban Giám đốc, Hành chính, Điều phối, Quản trị.

## Lưu ý

- Nếu CMSV6 chỉ trả vị trí cũ, app sẽ hiển thị vị trí gần nhất và thời gian cập nhật thực tế.
- Camera có thể offline trong khi GPS vẫn có dữ liệu gần nhất; hai trạng thái được xử lý độc lập.
- Máy người dùng cần Internet để tải lớp bản đồ OpenStreetMap.
