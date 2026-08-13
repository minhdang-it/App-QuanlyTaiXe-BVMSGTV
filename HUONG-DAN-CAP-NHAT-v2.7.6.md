# Cập nhật v2.7.6 – Theo dõi xe cho tài xế

## Bắt buộc trước khi build
1. Chép toàn bộ patch vào thư mục gốc source hiện tại.
2. Chạy `APPLY-v2.7.6.bat` để xóa 2 file JavaScript cũ có thể làm Vite ưu tiên nhầm.
3. Vào Supabase → SQL Editor và chạy `supabase/migrate-v2.7.6-driver-vehicle-tracking.sql`.
4. Build lại:

```powershell
npm run verify:source
npm run check
npm run build
```

5. Upload thư mục `dist` lên Ubuntu và deploy như quy trình hiện tại.

## Tính năng
- Tài xế có nút **Theo dõi xe** trên mobile.
- Cập nhật: Bảo hiểm TNDS, đăng kiểm, phí sử dụng đường bộ, thay nhớt gần nhất/kế tiếp, mốc bảo dưỡng.
- Tài xế chỉ được cập nhật xe đang được phân công; database kiểm tra quyền bằng RPC riêng.
- Các mốc sắp hết hạn xuất hiện trong cảnh báo Tổng quan.
- Các ô ngày chính dùng `DD/MM/YYYY`; ngày giờ dùng `DD/MM/YYYY HH:mm`.
