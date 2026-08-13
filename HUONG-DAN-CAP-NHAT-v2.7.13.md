# Cập nhật v2.7.13

## Nguyên nhân lỗi nhiều tệp
Source cũ có đồng thời:
- `src/lib/backend.ts` và `src/lib/backend.js`
- `src/pages/DispatchPage.tsx` và `src/pages/DispatchPage.jsx`

Hai file `.js/.jsx` là bản cũ chỉ hỗ trợ một tệp và có thể được Vite resolve trước source TypeScript.

## Cách cập nhật
1. Giải nén patch và chép đè vào thư mục gốc project.
2. Chạy `APPLY-v2.7.13.bat` để xóa hai file legacy.
3. Chạy:

```powershell
npm run verify:source
npm run check
npm run build
```

## Hành vi mới
- Đề nghị và Điều xe: chọn nhiều tệp cùng lúc hoặc bấm thêm nhiều lần.
- Ảnh: xem trực tiếp trong web.
- PDF/Word/Excel/PowerPoint/TXT: mở tab mới.
- Không có migration SQL mới so với v2.7.12.
