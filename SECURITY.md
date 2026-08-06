# Quy tắc bảo mật dự án

1. Không commit hoặc đóng gói `.env` thật.
2. Không lưu Supabase `service_role`, `sb_secret_...`, Gemini API key hoặc TLS private key trong frontend.
3. Frontend chỉ dùng Supabase anon/publishable key; dữ liệu phải được bảo vệ bằng RLS.
4. Gemini key chỉ lưu trong Supabase Edge Function Secrets.
5. Không đặt certificate/private key vào source hoặc thư mục web public.
6. Không hard-code tài khoản, số điện thoại thật hoặc mật khẩu trong script.
7. Build production bằng user thường, không dùng root.
8. Chạy `npm run verify` trước khi phát hành.
9. Định kỳ rà soát dependency bằng `npm audit` trong môi trường test; không tự động nâng phiên bản lớn trực tiếp trên production.
10. Sao lưu cấu hình Nginx, DNS, Supabase và kiểm thử rollback trước khi thay đổi lớn.
