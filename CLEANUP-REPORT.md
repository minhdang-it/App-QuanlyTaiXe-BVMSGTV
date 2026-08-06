# Báo cáo làm gọn source v2.6.0

## Kết quả

- Source nhận ban đầu: khoảng **151 MB**.
- Source sạch sau loại bỏ file phát triển/tạm và dependency: dưới **10 MB** trước khi nén.
- TypeScript kiểm tra thành công.
- Vite production build thành công trong môi trường kiểm thử.
- Script xác minh source kiểm tra 37 file TypeScript và không phát hiện file `.env`, certificate, `node_modules` hoặc chuỗi bí mật phổ biến.

## Đã xóa vì không cần cho production Ubuntu

- `.git/` và lịch sử Git đóng gói nhầm.
- `node_modules/`.
- `.env` thật.
- `.certs/` chứa certificate/private key nội bộ.
- `.service/` và PID cũ.
- `supabase/.temp/`.
- Các file `*.tsbuildinfo`.
- Toàn bộ changelog/hướng dẫn cập nhật cũ theo từng phiên bản.
- Script Windows `.bat`, `.ps1` và thư mục Windows service.
- GitHub Pages, Vercel, CNAME và cấu hình Docker không dùng trong phương án Ubuntu + Nginx đã chọn.
- File `create-website-user.mjs` vì có dữ liệu tài khoản/mật khẩu được ghi trực tiếp trong source.
- Script tạo admin cũ dùng cơ chế phone auth không đồng nhất; giữ lại một script `scripts/bootstrap-admin.mjs` theo cơ chế email nội bộ hiện tại.
- Các ảnh trùng lặp hoặc không còn được code tham chiếu.

## Đã xóa khỏi code runtime

- Toàn bộ `demoBackend` không được sử dụng trong production.
- Dữ liệu demo và danh sách mật khẩu demo.
- Các helper lưu media demo trong IndexedDB.
- CSS `.demo-notice` và `.mode-pill.demo` không còn được dùng.

## Đã sửa

- Service Worker không còn precache các file ảnh đã thiếu hoặc đã đổi tên.
- Service Worker chỉ precache shell tối thiểu để tránh lỗi cài PWA.
- Vite dùng base `/`, phù hợp deploy mỗi website ở root của một domain.
- Mặc định thời gian tạo chuyến mới là 30 phút tới và làm tròn theo 15 phút, thay vì phụ thuộc file dữ liệu demo.
- Error message Edge Function không còn nhắc script Windows.
- Bổ sung kiểm tra source chống đóng gói nhầm secret.

## Không xóa tự động

File `src/styles.css` có nhiều lớp ghi đè lịch sử. Tôi không dùng công cụ purge CSS tự động vì giao diện có class động theo vai trò/trạng thái; xóa mù có thể làm hỏng PC, mobile, modal, PWA hoặc tài xế. Việc refactor CSS nên thực hiện theo module và kiểm thử ảnh chụp từng vai trò ở một nhánh riêng.
