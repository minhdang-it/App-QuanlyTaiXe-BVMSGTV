# BVMSGTV — v2.11.14.2: Camera tự động, bỏ nút "Thử mở camera"

## Thay đổi

- Không còn nút **Thử mở camera**, không còn nút **Tắt xem**.
- Nếu Gateway phản hồi, có URL phát video và không có cờ `channel.online === false`: tự mở 2 kênh trước/cabin khi chọn xe (hoặc kênh được chọn).
- Nếu Navicom trả `channel.online === false`: hiện **Camera offline** thay video.
- Nếu không có URL: hiện **Chưa có tín hiệu camera**.
- Nếu Gateway lỗi 502: hiển thị **Không kết nối được Navicom Gateway**. Không nhầm với camera/xe offline.
- Nếu chỉ GPS `stale`/chậm, camera vẫn tự mở (không phụ thuộc GPS).
- Trong iframe Navicom, dùng `sandbox` không có quyền `allow-modals`, nhằm ngăn alert "The Device Isn't Online!" gây khó chịu.
- Duy trì xem hai kênh cùng lúc, phóng to ngang, bố cục mobile hiện tại.

### Giới hạn bắt buộc biết

CMSV6 hiện tại không trả trạng thái online riêng cho từng camera; URL `player_url` **không chứng minh camera đang thực sự online**. Vì vậy bản frontend chỉ có thể xác nhận offline khi Gateway trả cờ riêng `channel.online === false`, khi không có luồng, hoặc khi trình duyệt phát hiện lỗi tải media. Một số lỗi phát video bên trong iframe khác miền sẽ **không báo về frontend**. Chặn modals bằng sandbox có thể ảnh hưởng chức năng nội bộ của trình phát CMSV6; cần thử bằng xe đang online và xe offline thật trên trình duyệt đang dùng. Để biết online/offline chính xác trước khi tự mở video, cần bổ sung kiểm tra trạng thái camera độc lập trong Gateway/API nhà cung cấp.

## Cách cài trên Windows

1. Tải file ZIP và **copy vào thư mục FULL SOURCE** có `package.json`.
2. Mở CMD trong FULL SOURCE, chạy:

```cmd
powershell -NoProfile -Command "Expand-Archive -LiteralPath '.\BVMSGTV-v2.11.14.2-CAMERA-AUTO.zip' -DestinationPath '.\PATCH-v2.11.14.2' -Force"
dir ".\PATCH-v2.11.14.2\APPLY-v2.11.14.2.mjs"
node ".\PATCH-v2.11.14.2\APPLY-v2.11.14.2.mjs"
npm.cmd run verify:source
npm.cmd run check
npm.cmd run build
```

Script sẽ tự backup `TrackingPage.tsx`, `package*.json`, `public/sw.js` trước khi sửa. Nếu không khớp cấu trúc v2.11.14.1 thì dừng an toàn.

3. Upload `dist` lên Ubuntu theo quy trình hiện tại, xóa cache trình duyệt/PWA cũ nếu cần.

**Không cần chạy SQL và không cần sửa Navicom Gateway.**
