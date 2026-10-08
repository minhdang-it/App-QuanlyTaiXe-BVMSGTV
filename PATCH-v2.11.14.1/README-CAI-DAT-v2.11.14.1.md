# BVMSGTV – Hotfix v2.11.14.1 (CameraPanel compatibility)

## Tại sao v2.11.14 báo `Chỉ tìm thấy 0/2 CameraPanel cũ`?

Bộ cài v2.11.14 dùng biểu thức tìm kiếm chỉ nhận đúng thẻ `<CameraPanel channel={...} title={...} deviceOnline={...} />` và **không nhận dạng thẻ có thuộc tính `key={...}` ở trước `channel`**. Script báo `CHƯA thay file`, vì vậy code vẫn giữ nguyên trước khi vá.

Hotfix v2.11.14.1 nhận cả kiểu có/không `key`, kiểm tra thẻ ở hai kênh `front` / `cabin` trước khi ghi, sao lưu file và dừng nếu gặp cấu trúc khác.

## Triển khai trong thư mục FULL SOURCE trên Windows

1. Tải `BVMSGTV-v2.11.14.1-CAMERA-COMPAT-FIX.zip`, chép vào thư mục **full source** có `src`, `public`, `package.json`.
2. Mở CMD tại chính thư mục full source.
3. Chạy các lệnh sau:

```cmd
powershell -NoProfile -Command "Expand-Archive -LiteralPath '.\BVMSGTV-v2.11.14.1-CAMERA-COMPAT-FIX.zip' -DestinationPath '.\PATCH-v2.11.14.1' -Force"
dir ".\PATCH-v2.11.14.1\APPLY-v2.11.14.1.mjs"
node ".\PATCH-v2.11.14.1\APPLY-v2.11.14.1.mjs"
npm.cmd run verify:source
npm.cmd run check
npm.cmd run build
```

Không chạy lại `APPLY-v2.11.14.mjs` từ gói cũ. Nếu file ZIP nằm trong `Downloads`, chép ZIP vào source trước rồi giải nén.

## Kiểm tra sau khi deploy

- GPS `Chậm cập nhật` nhưng Gateway phản hồi và cung cấp URL: camera hiển thị `Camera chưa xác minh`, cho phép `Thử mở camera` theo từng kênh.
- GPS mới, Gateway tốt: video tự phát theo quy tắc trước đó.
- Gateway 502: không tự mở iframe gây popup từ Navicom.
- GPS/Camera dùng nguồn dữ liệu riêng, **không cam kết rằng camera thực sự online** chỉ từ nguồn GPS.
- Bản đồ Leaflet/OpenStreetMap, tài khoản, phân quyền, database và Navicom Gateway không thay đổi.

### Khôi phục

Script tạo thư mục `_backup-v2.11.14.1-*` trong thư mục full source trước khi sửa. Nếu check/build phát sinh lỗi do mã nguồn khác bản kiểm thử, gửi log và `src/pages/TrackingPage.tsx`; khôi phục file từ thư mục backup tương ứng. Không cần chạy SQL.

### Phạm vi kiểm thử

Đã chạy qua `verify:source`, `check`, `build` trên source nền v2.11.6 với thẻ `CameraPanel` hai kiểu: có `key` và không `key`. Chưa có full source **đúng phiên bản trên máy bạn**, nên không thể bảo đảm thành công cho mọi chỉnh sửa riêng trong source hiện tại. Nếu script báo không nhận diện được cấu trúc, **đừng ép chạy**.
