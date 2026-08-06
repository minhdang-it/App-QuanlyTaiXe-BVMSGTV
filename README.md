# Điều phối xe – Bệnh viện Mắt Sài Gòn Trà Vinh

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
