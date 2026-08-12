# Điều phối xe – Bệnh viện Mắt Sài Gòn Trà Vinh

## Cập nhật v2.7.0

- Thêm vai trò **Trưởng khoa / Trưởng đơn vị** và trang **Đề nghị xe** kèm văn bản kế hoạch.
- Quy trình chuyến: Điều phối → Hành chính → BGĐ → Tài xế; hỗ trợ bỏ qua BGĐ cho công tác/đón bệnh nhân có văn bản đã phê duyệt.
- Sự cố và bảo dưỡng phải qua Ban Giám đốc duyệt.
- Quản trị hệ thống có thể xóa mềm tài khoản, giữ nguyên lịch sử nghiệp vụ.
- Chi phí có nút **Chi tiết** cho từng khoản và xem hóa đơn trực tiếp.

Xem `CHANGELOG-v2.7.0.md` và `HUONG-DAN-CAP-NHAT-v2.7.0.md`.

Phiên bản source sạch **2.6.0**, tối ưu cho triển khai Ubuntu Server + Nginx.

## Yêu cầu build

- Node.js `>=22.12.0`
- npm
- Supabase project đã chạy schema/migrations và Edge Functions cần thiết

## Cài đặt phát triển

```bash
cp .env.example .env.local
npm ci
npm run dev
```

## Kiểm tra và build production

```bash
cp .env.example .env.production
# Điền VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY và URL HTTPS
npm ci
npm run verify
```

Thư mục phát hành là `dist/`.

## Deploy Ubuntu

Đọc tài liệu:

```text
HUONG-DAN-TRIEN-KHAI-UBUNTU-MULTI-WEB.md
```

Các file hỗ trợ:

```text
deploy/ubuntu/nginx-site.conf.template
deploy/ubuntu/deploy-static.sh
deploy/ubuntu/rollback.sh
deploy/ubuntu/security-audit-readonly.sh
```

## Supabase

- Schema cơ sở: `supabase/schema.sql`
- Migrations bổ sung: `supabase/migrate-*.sql`
- Quản lý người dùng: `supabase/functions/manage-user/`
- Gemini OCR: `supabase/functions/analyze-odometer/`

## Tạo/cập nhật admin

Dùng script tương tác:

```bash
node scripts/bootstrap-admin.mjs
```

Script yêu cầu Supabase URL và service-role/secret key tại thời điểm chạy; không ghi key vào source.

## Bảo mật

Đọc `SECURITY.md` và chạy:

```bash
npm run verify:source
```
