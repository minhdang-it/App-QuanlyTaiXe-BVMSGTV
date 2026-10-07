# CHANGELOG v2.11.7

- Fix popup `The Device Isn't Online!` khi chọn xe offline bằng cách không load iframe Navicom khi thiết bị offline.
- Áp dụng offline camera guard cho TrackingPage và NavicomMonitor.
- Đổi nhãn `Mất tín hiệu` → `Offline`; KPI → `Xe offline`.
- Topbar số tài khoản hiển thị `x tài khoản` để tránh nhầm với số xe online.
- Nâng UI mobile: font dễ đọc, input 16px, touch target lớn hơn, camera 1 cột, danh sách xe snap ngang.
- Giữ OpenStreetMap, Ctrl+wheel, pinch 2 ngón và ưu tiên xe online từ v2.11.6.
- Không cần SQL / không cần cập nhật Navicom Gateway.
