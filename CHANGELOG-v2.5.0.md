# CHANGELOG v2.5.0

## OCR lai Tesseract + Gemini Vision
- Giữ Tesseract OCR chạy trực tiếp trên điện thoại để đọc nhanh và hỗ trợ khi mạng yếu.
- Bổ sung Gemini Vision qua Supabase Edge Function `analyze-odometer` để phân biệt ODO tổng với Trip A/B, giờ, nhiệt độ và các dãy số khác.
- Gemini API key chỉ lưu trong Supabase Secret, không xuất hiện trong frontend hoặc source đóng gói.

## Đối chiếu và xác nhận an toàn
- Hiển thị riêng kết quả OCR cục bộ và Gemini Vision.
- Khi hai kết quả giống nhau, hệ thống đánh dấu đã đối chiếu.
- Khi hai kết quả khác nhau, hệ thống không tự lưu mà yêu cầu tài xế chọn số đúng.
- Tài xế bắt buộc đánh dấu đã nhìn ảnh và xác nhận số ODO trước khi lưu.
- Bổ sung nhận diện chất lượng ảnh: rõ, lóa, mờ, bị cắt hoặc thiếu sáng.

## Triển khai
- Thêm Edge Function `supabase/functions/analyze-odometer`.
- Thêm `TRIEN-KHAI-GEMINI-OCR.bat` và PowerShell tương ứng.
- Thêm tài liệu `HUONG-DAN-GEMINI-OCR-v2.5.0.md`.
- Nâng cache PWA lên v2.5.0.
