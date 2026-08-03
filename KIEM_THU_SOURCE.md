# Kết quả kiểm tra source Điều phối xe BVMSGTV

Ngày kiểm tra: **03/08/2026**

## Đã kiểm tra thành công

- Cấu trúc source và các tệp bắt buộc.
- Toàn bộ import tương đối trong `src/` đều trỏ tới tệp tồn tại.
- Cú pháp TypeScript của ứng dụng bằng trình biên dịch TypeScript cục bộ.
- Cú pháp `vite.config.ts`.
- Cú pháp Supabase Edge Function `manage-user`.
- Cú pháp JavaScript của Service Worker.
- Định dạng JSON của `package.json`, manifest PWA, Vercel và các tsconfig.
- Kích thước và chữ ký PNG của icon PWA 192×192 và 512×512.
- Phân tích HTML cơ bản và cân bằng khối CSS.
- Cân bằng dollar-quote trong SQL và rà soát cấu trúc schema.
- Không có `.env`, service-role key hoặc khóa bí mật thật trong gói source.
- Kiểm tra phân quyền giao diện theo vai trò.
- Kiểm tra luồng checklist bất thường phải được điều phối duyệt.
- Kiểm tra thao tác offline dùng ID UUID ổn định để hạn chế tạo bản ghi trùng khi đồng bộ lại.
- Kiểm tra cú pháp luồng nén ảnh, lưu Blob trong IndexedDB và OCR kilomet tự điền.
- Kiểm tra nút lưu KM không cho gửi khi thiếu ảnh, thiếu số, OCR đang chạy hoặc KM cuối nhỏ hơn KM đầu.

## Chưa thể chạy trong môi trường tạo source

Lệnh `npm install` không hoàn thành vì môi trường tạo source không tải được đầy đủ dependency từ registry npm công khai, gồm Supabase và Tesseract.js. Vì vậy, tại đây chưa thể thực hiện bản build Vite production với dependency thật.

Đây là giới hạn của registry trong môi trường tạo source, không phải lỗi cú pháp được phát hiện trong dự án. Trên máy có Internet và registry npm công khai, chạy:

```bash
npm config set registry https://registry.npmjs.org/
npm install
npm run verify
```

`npm run verify` sẽ thực hiện kiểm tra source, TypeScript và build production.

## Kiểm thử bắt buộc trước khi dùng thật

1. Tạo Supabase project thử nghiệm.
2. Chạy `supabase/schema.sql` trên project trống.
3. Tạo tài khoản admin, điều phối và tài xế.
4. Kiểm thử trên hai thiết bị khác nhau.
5. Kiểm thử camera, microphone, GPS và mất mạng.
6. Kiểm thử quy trình điều xe từ đầu đến cuối.
7. Chạy thử với một xe trong 1–2 tuần trước khi triển khai toàn đội.

## Kiểm thử riêng cho OCR/KM đầu

1. Mở bằng Android Chrome qua HTTPS.
2. Chụp ảnh thật từ camera có dãy ODO 5–7 chữ số.
3. Xác nhận ảnh được nén, OCR tự điền số và vẫn cho sửa thủ công.
4. Thử ảnh bị lóa để xác nhận app cảnh báo thay vì tự tin lưu sai.
5. Lưu KM đầu ở chế độ Demo rồi tải lại trang, xác nhận KM và ảnh vẫn còn.
6. Lưu KM đầu bằng Supabase, kiểm tra đường dẫn ảnh trong bucket `vehicle-media` và cột `start_odometer`.

## Kiểm tra bổ sung v1.3.0

- Đã xóa import và giao diện `demoCredentials` khỏi `LoginPage.tsx`.
- Đã kiểm tra không còn chuỗi `Chọn nhanh tài khoản` trong source giao diện.
- Đã bổ sung bước xác nhận GPS trước trạng thái `active`.
- Đã lưu `start_lat`, `start_lng` cùng `started_at` khi bắt đầu chuyến.
- Đã bổ sung URL Google Maps Directions với `api=1`, `travelmode=driving` và `dir_action=navigate`.
- Đã bổ sung phương án mở cùng cửa sổ khi trình duyệt chặn popup.
- Đã chạy `scripts/verify-source.mjs` thành công.
- Đã kiểm tra transpile cú pháp toàn bộ tệp TypeScript/TSX bằng TypeScript 5.8.3.
- Không chạy được `npm install` trong môi trường đóng gói do registry nội bộ không có gói `@supabase/supabase-js`; cần chạy `npm run build` trên máy triển khai.
