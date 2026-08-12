# HƯỚNG DẪN CẬP NHẬT v2.7.1

## 1. Nội dung cập nhật
- Bổ sung/hiển thị rõ vai trò **Trưởng khoa** khi Quản trị thêm thành viên.
- Chốt quy trình duyệt điều xe:
  - Không có kế hoạch: Điều phối → Hành chính → BGĐ → Tài xế.
  - Có kế hoạch/văn bản: Điều phối → Hành chính → Tài xế.

## 2. Cập nhật Supabase
Nếu hệ thống đã ở v2.7.0, vào **Supabase Dashboard → SQL Editor** và chạy toàn bộ file:

`supabase/migrate-v2.7.1-trip-plan-bypass.sql`

Không cần deploy lại `manage-user` chỉ cho thay đổi workflow v2.7.1, vì role `department_head` đã được Edge Function v2.7.0 hỗ trợ.

## 3. Cập nhật source trên Windows
Chép source/patch mới vào project, sau đó từ thư mục gốc chạy:

```powershell
npm run verify:source
npm run check
npm run build
```

## 4. Deploy lên Ubuntu
Chỉ upload thư mục `dist` mới, sau đó chạy script release như tài liệu hiện tại với domain:

`dieuphoixe.matsaigontravinh.vn`

Script server hiện dùng tại:

`/home/danglee/uploads/ubuntu`

## 5. Kiểm tra sau cập nhật
1. Quản trị → Tài khoản → Thêm tài khoản → phải thấy **Trưởng khoa**.
2. Tạo chuyến không đính kèm kế hoạch → trạng thái đầu `Chờ Hành chính`; Hành chính duyệt → `Chờ BGĐ`; BGĐ duyệt → tài xế thấy chuyến.
3. Tạo chuyến có đính kèm kế hoạch → trạng thái đầu `Chờ Hành chính`; Hành chính duyệt → chuyển thẳng `Đã giao`; tài xế thấy chuyến ngay.
4. Tạo chuyến từ đề nghị Trưởng khoa đã kèm kế hoạch → Hành chính duyệt trực tiếp, không qua BGĐ.
