# Hướng dẫn triển khai Gemini OCR đồng hồ kilomet v2.5.0

## Kiến trúc

Ảnh đồng hồ được xử lý theo mô hình lai:

1. Tesseract OCR chạy trực tiếp trên điện thoại.
2. Gemini Vision kiểm tra lại số ODO qua Supabase Edge Function.
3. Nếu hai kết quả giống nhau, hệ thống đánh dấu đã đối chiếu.
4. Nếu khác nhau, tài xế phải nhìn ảnh và chọn kết quả đúng.
5. Tài xế bắt buộc đánh dấu xác nhận trước khi lưu.

Gemini API key không được đặt trong React, JavaScript frontend hoặc `.env` của Vite.

## Chuẩn bị

- Supabase CLI hoặc dùng lệnh `npx supabase`.
- Project Supabase đã được link với source.
- Gemini API key lấy từ Google AI Studio.

## Triển khai nhanh trên Windows

Chạy:

```text
TRIEN-KHAI-GEMINI-OCR.bat
```

Script sẽ:

- đăng nhập Supabase;
- đặt secret `GEMINI_API_KEY`;
- đặt model `GEMINI_ODOMETER_MODEL`;
- deploy function `analyze-odometer`.

## Triển khai thủ công

```bash
npx supabase login
npx supabase link --project-ref MA_PROJECT
npx supabase secrets set GEMINI_API_KEY=YOUR_KEY GEMINI_ODOMETER_MODEL=gemini-3.6-flash
npx supabase functions deploy analyze-odometer
```

Sau đó build frontend:

```bash
npm install
npm run build
```

## Kiểm tra

1. Đăng nhập bằng tài khoản tài xế.
2. Mở mục Chụp KM đầu hoặc KM cuối.
3. Chụp gần vùng ODO/TOTAL.
4. Kiểm tra có hai khối kết quả: OCR trên điện thoại và Gemini Vision.
5. Nếu hai kết quả khác nhau, nút lưu chỉ hoạt động sau khi tài xế chọn số và xác nhận.

## Cấu hình tùy chọn

Trong `.env` frontend:

```env
VITE_ODOMETER_GEMINI_VERIFY_ALL=true
```

- `true`: Gemini kiểm tra mọi ảnh, ưu tiên độ chính xác.
- `false`: Gemini chỉ được gọi khi OCR cục bộ có độ tin cậy thấp, có nhiều ứng viên hoặc chênh lệch bất thường.

## Xử lý lỗi

- `Chưa cấu hình GEMINI_API_KEY`: chạy lại script triển khai.
- `Phiên đăng nhập không hợp lệ`: đăng xuất và đăng nhập lại.
- `Ảnh quá lớn`: chụp gần vùng ODO; ứng dụng sẽ tự tối ưu ảnh.
- `Gemini chưa xác định được ODO`: tránh phản sáng, chụp thẳng, không để Trip A/B chiếm vùng chính.
