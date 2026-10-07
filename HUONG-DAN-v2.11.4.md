# Hướng dẫn cập nhật v2.11.4

## Google Maps
Trong `.env.local` trước khi build production, thêm:

```env
VITE_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_JAVASCRIPT_API_KEY
```

API key cần bật Maps JavaScript API và nên giới hạn theo domain `dieuphoixe.matsaigontravinh.vn`. Nếu để trống, hệ thống tự dùng OpenStreetMap dự phòng và vẫn có nút +/- để thu phóng.

## Camera trên điện thoại
Mỗi khung Camera trước/Camera cabin có nút **Phóng to ngang**. Android Chrome sẽ yêu cầu fullscreen và khóa landscape nếu được hỗ trợ. Với Safari/iPhone, nếu hệ điều hành không cho khóa hướng, app tự xoay khung camera 90 độ trong chế độ toàn màn hình giả lập.

## Trạng thái xe
Ngoài tốc độ Navicom, hệ thống so sánh tọa độ giữa các lần cập nhật. Nếu GPS thay đổi ít nhất khoảng 18 m trong tối đa 3 phút thì xe được nhận diện là **Đang chạy** ngay cả khi CMSV6 tạm trả tốc độ 0 km/h.
