# CHANGELOG v2.5.5

## Tinh gọn Tổng quan
- Xóa ba thẻ trùng nội dung: Phân quyền rõ ràng, Dữ liệu cập nhật và Kiểm soát bảo mật.
- Gom các chỉ số Tổng số xe, Xe đang chạy, Xe đang trống, Xe đang sửa, chuyến và chi phí thành các thẻ nhỏ gọn hơn.
- Đổi chỉ số chi phí thành "Chi phí đã duyệt hôm nay" để không cộng các khoản chưa qua quy trình duyệt.

## Quy trình duyệt chi phí 3 bước
1. Tài xế gửi chi phí → Chờ Ban Giám đốc.
2. Ban Giám đốc duyệt → Chuyển Kế toán kiểm tra.
3. Kế toán duyệt → Được phép chi; Kế toán xác nhận đã chi trả.

- Ban Giám đốc chỉ thấy nút duyệt/từ chối ở bước của Ban Giám đốc.
- Kế toán chỉ thấy nút duyệt/từ chối sau khi Ban Giám đốc đã duyệt.
- Chỉ Kế toán hoặc Quản trị mới xác nhận "Đã chi trả".
- Lưu riêng người và thời gian duyệt của Ban Giám đốc, Kế toán và người chi trả.
- Thêm thông báo theo từng bước duyệt cho đúng vai trò.

## Supabase
- Thêm migration: `supabase/migrate-v2.5.5-expense-approval.sql`.
- Thêm trigger bảo vệ thứ tự duyệt và ngăn bỏ qua bước.
- Nâng Service Worker cache lên v255.
