# CHANGELOG v2.10.5 – Navicom CMSV6 API thật

- Thêm `NAVICOM_MODE=cmsv6`.
- Đăng nhập CMSV6 Standard API bằng `StandardApiAction_login.action`, cache `jsession`.
- Tự thử mật khẩu plain/MD5 ở chế độ `auto`.
- GPS lấy từ `StandardApiAction_queryTrackDetail.action`; lấy điểm mới nhất, tốc độ, hướng, thời gian và vị trí mô tả nếu server trả.
- Camera dùng trang player HTML5 CMSV6 theo Device ID + jsession; có nút mở cửa sổ riêng khi iframe bị chặn.
- Số kênh camera lấy theo hồ sơ xe.
- Thêm `test-cmsv6.mjs` để chẩn đoán thật mà không in mật khẩu/session.
- Giữ xác thực Supabase và chỉ cho director/fleet/dispatcher/admin xem dữ liệu Navicom.
