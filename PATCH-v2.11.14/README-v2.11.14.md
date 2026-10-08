# BVMSGTV v2.11.14 — Tách trạng thái GPS và Camera Navicom

## Lỗi đã xác định

Trong bản v2.11.7, điều kiện mở camera ở TrackingPage được liên kết với `item.status` GPS (đang chạy hoặc đang dừng). Khi GPS chỉ **chậm cập nhật** (`stale`), app hiển thị "Xe đang offline" trên cả hai camera, dù CMSV6 có thể vẫn phát video.

Trong CMSV6 Gateway đang dùng, `state.online` thực tế dựa trên *độ mới của GPS*. Trường này không kiểm tra độc lập trạng thái video. Đối với camera CMSV6, `channel.online` thường không có giá trị; việc có URL player **không xác nhận** camera hoạt động.

## Cách xử lý

- Xe vẫn hiện GPS **Đang chạy / Đang dừng / Chậm cập nhật / Offline** dựa theo lịch sử Navicom; không đổi nhãn GPS thành online giả.
- Camera và GPS tách riêng trong giao diện. Trường hợp không xác minh được camera sẽ báo **"Camera chưa xác minh"**, không kết luận sai "Camera Offline".
- Chỉ tự nhúng video khi GPS còn mới + Gateway trả thành công, hoặc API camera trả `channel.online: true` rõ ràng.
- Nếu GPS chậm mà Gateway vẫn phản hồi kèm URL, hiển thị nút **"Thử mở camera"** cho từng kênh. Camera không tự mở gây popup liên tục. Người dùng có thể đóng lại bằng **"Tắt xem"**.
- Nếu Gateway đang lỗi 502 hoặc kênh trả `online:false`, không tự tải iframe. Khi đó phải kiểm tra Gateway/Navicom.
- Giữ nguyên nút phóng to ngang, hai camera song song, tối ưu mobile; không sửa Supabase SQL, không sửa Navicom Gateway.

## Cài đặt đúng thư mục trên Windows

1. Tải và copy `BVMSGTV-v2.11.14-FIX-GPS-CAMERA-STATUS.zip` vào thư mục FULL SOURCE có `src`, `public`, `package.json`.
2. Mở CMD ngay trong thư mục FULL SOURCE và chạy lần lượt:

```cmd
powershell -NoProfile -Command "Expand-Archive -LiteralPath '.\BVMSGTV-v2.11.14-FIX-GPS-CAMERA-STATUS.zip' -DestinationPath '.\PATCH-v2.11.14' -Force"
dir ".\PATCH-v2.11.14\APPLY-v2.11.14.mjs"
node ".\PATCH-v2.11.14\APPLY-v2.11.14.mjs"
npm.cmd run verify:source
npm.cmd run check
npm.cmd run build
```

Script **kiểm tra cấu trúc trước khi ghi file** và sao lưu thay đổi vào `_backup-v2.11.14-...`. Nếu khác version và script báo không nhận diện được `CameraPanel`, **không cố chạy**: hãy gửi `src/pages/TrackingPage.tsx` phiên bản đang dùng.

3. Deploy `dist` mới lên Ubuntu theo quy trình hiện hành. Tải lại app sau khi deploy để thay cache frontend.

## Kiểm tra

- Xe có GPS chậm: vẫn hiện `Chậm cập nhật`; camera hiện `Camera chưa xác minh` (không còn gắn nhãn Offline sai).
- Bấm `Thử mở camera` trước/cabin: trình phát chỉ bắt đầu tải theo thao tác người dùng.
- Xe có GPS mới: camera tự mở như trước nếu có URL và API Gateway thành công.
- Gateway 502: không nhúng luồng camera, hiển thị thông điệp Gateway chưa phản hồi.

### Giới hạn

Nếu iframe Navicom hiện `The Device Isn't Online!` sau khi tự bấm thử, đó là thông báo của trình phát Navicom thuộc domain khác. Không thể chặn `alert()` cross-origin từ frontend. Cần đối chiếu `Device ID`, `chns=0/1`, `jsession` và quyền API CMSV6. Bản vá này **không xác nhận camera thực sự hoạt động**; nó sửa cách app phân loại trạng thái và cách chủ động tải luồng.

Đã kiểm tra trên full source nền v2.11.6: `verify:source`, TypeScript `check`, `build` đều thành công. Bản nguồn đang chạy của bạn chưa được cung cấp, nên phải chạy kiểm tra cục bộ sau khi áp dụng patch.
