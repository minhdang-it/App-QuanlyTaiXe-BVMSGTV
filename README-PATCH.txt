PATCH v2.6.1

1. Sao lưu package.json và scripts/verify-source.mjs hiện tại.
2. Chép đè 2 tệp trong patch vào thư mục dự án.
3. Chạy:
   npm run verify:source
   npm run check
   npm run build

Lưu ý:
- verify:source cho phép .env, node_modules, dist trên máy phát triển.
- verify:package là chế độ nghiêm ngặt dành cho bản sao sạch trước khi tạo ZIP.
