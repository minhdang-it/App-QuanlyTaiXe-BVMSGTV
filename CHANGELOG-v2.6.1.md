# CHANGELOG v2.6.1

- Sửa `npm run verify:source` để dùng được trên máy phát triển có `.env`, `node_modules` và `dist`.
- Bổ sung `npm run verify:package` để kiểm tra nghiêm ngặt trước khi tạo ZIP/chia sẻ source.
- Bỏ qua các thư mục build/phụ thuộc khi quét bí mật để kiểm tra nhanh hơn.
- Kiểm tra `.gitignore` phải chặn `.env`, `node_modules` và `dist`.
