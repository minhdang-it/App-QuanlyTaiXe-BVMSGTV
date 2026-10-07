BVMSGTV v2.11.6 — TRACKING UX PATCH

Dùng trên FULL SOURCE v2.11.5 OpenStreetMap Stable.

THAY ĐỔI
- Xe offline/mất tín hiệu KHÔNG phát toast hoặc notification nữa; chỉ hiện trạng thái Offline/Mất tín hiệu trên danh sách và bản đồ.
- Khối Hoạt động gần đây cũng không hiển thị sự kiện offline cũ.
- Xe vừa online vẫn thông báo.
- Danh sách xe ưu tiên: Đang chạy -> Đang dừng -> Chậm cập nhật -> Mất tín hiệu -> Chưa dữ liệu.
- Trong cùng nhóm ưu tiên dữ liệu GPS mới nhất.
- PC: giữ Ctrl + lăn chuột để zoom OpenStreetMap.
- Mobile/tablet: chụm/mở 2 ngón tay để zoom.
- Chuột/1 ngón tay vẫn kéo bản đồ.
- Nút +, -, căn lại, fullscreen vẫn giữ.

CÁCH CẬP NHẬT
1. Giải nén patch.
2. Copy cả 3 file APPLY-v2.11.6.mjs, TrackingMap-v2.11.6.txt, tracking-v2.11.6.css.txt vào thư mục full source v2.11.5.
3. Mở CMD tại full source và chạy:

   node APPLY-v2.11.6.mjs
   npm.cmd run verify:source
   npm.cmd run check
   npm.cmd run build

Script tự backup các file trước khi sửa vào _backup-v2.11.6-...
Không cần SQL.
Không cần cập nhật Navicom Gateway.
