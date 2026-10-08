# v2.11.11 - OpenStreetMap tile fix

- Sửa các ô bản đồ "API KEY REQUIRED" từ nguồn CARTO.
- Sử dụng trực tiếp OpenStreetMap tile URL không cần API key.
- Không còn fallback từ CARTO sang OSM vì CARTO có thể trả ảnh lỗi HTTP 200.
- Chỉ thông báo lỗi rõ ràng nếu không thể tải tile OSM.
- Sửa `touch-action:none` cho Leaflet nhận pinch-to-zoom trên iOS/Android.
- Giữ nguyên các tính năng v2.11.10 khác: GPS realtime, marker, Ctrl+wheel, fullscreen và follow.
- Không thay đổi Supabase hoặc Navicom Gateway.
