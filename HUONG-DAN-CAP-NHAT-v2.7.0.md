# HƯỚNG DẪN CẬP NHẬT v2.7.0

Hệ thống: Điều phối xe Bệnh viện mắt Sài Gòn Trà Vinh  
Domain: `https://dieuphoixe.matsaigontravinh.vn`  
Ubuntu user: `danglee`  
Script deploy: `/home/danglee/uploads/ubuntu`

> Phiên bản này thay đổi cấu trúc database và Edge Function. Không chỉ chép `dist` là đủ.

## 1. Sao lưu trước khi cập nhật

Trên máy Windows, sao chép toàn bộ source đang chạy sang một thư mục backup.

Trên Ubuntu:

```bash
readlink -f /var/www/dieuphoixe.matsaigontravinh.vn/current
ls -lah /var/www/dieuphoixe.matsaigontravinh.vn/releases
```

Ghi lại tên release hiện tại để có thể rollback frontend.

## 2. Cập nhật Supabase database trước

Vào:

**Supabase Dashboard → SQL Editor → New query**

Mở file:

```text
supabase/migrate-v2.7.0-workflows.sql
```

Dán toàn bộ nội dung và bấm **Run**.

Migration sẽ bổ sung:
- vai trò Trưởng khoa / Trưởng đơn vị;
- xóa mềm tài khoản;
- bảng `vehicle_requests`;
- trạng thái chờ Hành chính và chờ BGĐ của chuyến;
- văn bản kế hoạch và lịch sử người duyệt;
- workflow duyệt sự cố;
- workflow duyệt bảo dưỡng;
- RLS và trigger kiểm soát quyền;
- Realtime cho đề nghị xe.

Nếu SQL báo lỗi, **không deploy frontend mới** cho tới khi migration chạy thành công.

## 3. Deploy lại Edge Function manage-user

Phiên bản mới của `manage-user` hỗ trợ:
- vai trò `department_head`;
- xóa tài khoản;
- bảo vệ quản trị viên cuối cùng;
- xóa mềm Auth để giữ dữ liệu lịch sử.

Nếu đã đăng nhập Supabase CLI:

```powershell
supabase functions deploy manage-user
```

Có thể kiểm tra:

```powershell
supabase functions list
```

## 4. Chép source v2.7.0 vào project Windows

Không chép đè `.env.production` nếu file hiện tại đang đúng.

Kiểm tra:

```powershell
npm run verify:source
npm run check
npm run build
```

Kết quả cần có:

```text
Điều phối xe BVMSGTV source verification: OK
```

và thư mục:

```text
dist\
```

## 5. Upload `dist` lên Ubuntu

Từ thư mục project Windows:

```powershell
ssh danglee@IP_SERVER "rm -rf ~/uploads/dieuphoixe.matsaigontravinh.vn/dist"
scp -r .\dist danglee@IP_SERVER:/home/danglee/uploads/dieuphoixe.matsaigontravinh.vn/
```

## 6. Tạo release mới

SSH vào server:

```powershell
ssh danglee@IP_SERVER
```

Chạy:

```bash
export DOMAIN=dieuphoixe.matsaigontravinh.vn

/home/danglee/uploads/ubuntu/deploy-static.sh \
  "$DOMAIN" \
  "/home/danglee/uploads/$DOMAIN/dist" \
  5
```

Kiểm tra:

```bash
readlink -f /var/www/$DOMAIN/current
curl -I https://$DOMAIN
curl -I https://$DOMAIN/de-nghi-xe
curl -I https://$DOMAIN/dieu-xe
```

## 7. Checklist kiểm thử sau cập nhật

### Quản trị hệ thống
1. Tạo một tài khoản thử vai trò **Trưởng khoa / Trưởng đơn vị**.
2. Xóa một tài khoản thử không phải tài khoản đang đăng nhập.
3. Xác nhận tài khoản biến mất khỏi danh sách và không đăng nhập lại được.
4. Kiểm tra dữ liệu cũ của tài khoản đã xóa vẫn còn trong lịch sử nghiệp vụ.

### Trưởng khoa / Trưởng đơn vị
1. Đăng nhập tài khoản Trưởng khoa.
2. Vào **Đề nghị xe**.
3. Tạo đề nghị mới.
4. Đính kèm PDF/Word/Excel/ảnh kế hoạch.
5. Xác nhận trạng thái **Chờ Hành chính**.

### Hành chính đội xe
1. Mở **Đề nghị xe** và duyệt đề nghị.
2. Vào **Điều xe** và kiểm tra chuyến **Chờ Hành chính**.
3. Chuyến thường: bấm **Hành chính trình BGĐ**.
4. Chuyến có kèm kế hoạch/văn bản: kiểm tra **Hành chính duyệt & giao tài xế**, không qua BGĐ.
5. Kiểm tra Bảo dưỡng: tạo đề nghị → trạng thái Chờ BGĐ.

### Ban Giám đốc
1. Vào Điều xe → duyệt chuyến đang **Chờ Ban Giám đốc**.
2. Vào Sự cố → duyệt/từ chối sự cố.
3. Vào Bảo dưỡng → duyệt/từ chối đề nghị bảo dưỡng.
4. Vào Chi phí → quy trình chi phí cũ vẫn hoạt động bình thường.

### Tài xế
1. Trước khi BGĐ/Hành chính duyệt xong, tài xế không được thấy chuyến mới.
2. Sau khi duyệt xong, chuyến xuất hiện để tài xế **Nhận chuyến**.
3. Báo một sự cố → kiểm tra trạng thái chuyển sang **Chờ Ban Giám đốc**.

### Chi phí
1. Vào Chi phí.
2. Bấm **Chi tiết** trên từng khoản.
3. Xem ảnh hóa đơn trực tiếp.
4. Kiểm tra lịch sử BGĐ → Kế toán → Chi trả.

## 8. Rollback frontend nếu có lỗi

Liệt kê release:

```bash
ls -lah /var/www/dieuphoixe.matsaigontravinh.vn/releases
```

Rollback:

```bash
/home/danglee/uploads/ubuntu/rollback.sh \
  dieuphoixe.matsaigontravinh.vn \
  TEN_RELEASE_CU
```

Sau đó:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

> Không tự ý rollback database bằng cách xóa cột/bảng khi hệ thống đã có dữ liệu. Các cột v2.7.0 được thiết kế để frontend cũ có thể bỏ qua, nên ưu tiên rollback frontend trước.

## 9. Các lần chỉnh code tiếp theo

Nếu chỉ sửa React/CSS/hình ảnh:

```powershell
npm run verify:source
npm run check
npm run build
```

Sau đó upload `dist` và chạy `deploy-static.sh` như mục 5–6.

Nếu sửa `supabase/functions/manage-user`:

```powershell
supabase functions deploy manage-user
```

Nếu có file migration SQL mới: chạy migration **trước frontend**.
