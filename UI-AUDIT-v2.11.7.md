# Rà soát UI/UX Điều phối xe BVMSGTV — ưu tiên mobile

## P0 — Đã xử lý trong v2.11.7
- Không load camera iframe khi xe offline → hết popup Navicom gây khó chịu.
- Trạng thái xe dùng từ `Offline` rõ nghĩa hơn.
- Mobile form dùng font 16px để tránh trình duyệt tự zoom khi nhập.
- Tăng touch target cho filter, camera switch và bottom navigation.
- Tracking page stack 1 cột, camera 1 cột, danh sách xe scroll ngang có snap.

## P1 — Nên giữ nguyên/chuẩn hóa
- Một màn chỉ có 1 CTA chính màu xanh; thao tác phụ dùng outline.
- Badge trạng thái thống nhất: Online/xanh, Đang chạy/xanh dương, Offline/đỏ, Cảnh báo/vàng.
- Mọi ngày giờ hiển thị DD/MM/YYYY hoặc DD/MM/YYYY HH:mm.
- Tránh text nhỏ dưới 11px trên mobile.
- Các nút quan trọng tối thiểu 42–44px chiều cao.

## P2 — Đề xuất cho vòng nâng cấp tiếp theo
- Chuẩn hóa toàn bộ modal mobile thành bottom-sheet hoặc fullscreen sheet.
- Tạo component trạng thái dùng chung để không lệch màu/chữ giữa Điều xe, Hồ sơ xe, Chi phí, Sự cố.
- Bổ sung skeleton loading thay spinner đơn ở các màn có dữ liệu realtime.
- Báo cáo mobile dùng card KPI + drill-down thay bảng rộng.
- Khi camera offline: chỉ hiển thị lần cập nhật cuối và nút `Thử lại`, không hiển thị khung video trống.
