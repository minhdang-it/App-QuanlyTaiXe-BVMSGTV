## Nhận diện thương hiệu

- Tiêu đề hệ thống: **Điều phối xe Bệnh viện mắt Sài Gòn Trà Vinh**.
- Logo chính: `public/logo-bvmsgtv.png`.
- Favicon và biểu tượng cài PWA: `public/icons/icon-192.png`, `public/icons/icon-512.png`.
- Logo xuất hiện tại màn hình đăng nhập, thanh quản trị và giao diện tài xế.

# Điều phối xe Bệnh viện mắt Sài Gòn Trà Vinh

**Phiên bản:** 1.3.0 — xác nhận GPS trước khi xuất phát và tự mở Google Maps.

Website/PWA dành cho đội xe **Bệnh viện Mắt Sài Gòn Trà Vinh**.

Bộ source gồm hai giao diện trong cùng một ứng dụng:

- **Tài xế trên điện thoại:** nhận chuyến, checklist, chụp kilomet, gửi chi phí, báo sự cố và gọi điều phối.
- **Quản trị trên máy tính/điện thoại:** dashboard, điều xe, hồ sơ xe, duyệt chi phí, sự cố, bảo dưỡng và báo cáo.


## Cập nhật luồng xuất phát ở v1.3.0

- Đã loại bỏ hoàn toàn khu vực **Chọn nhanh tài khoản** trên màn hình đăng nhập.
- Tài khoản và mật khẩu không còn được tự điền khi mở trang.
- Sau khi hoàn thành checklist và lưu KM đầu, nút **Bắt đầu chuyến** mở bước xác nhận địa điểm.
- Tài xế phải cấp quyền GPS, kiểm tra điểm đón, điểm đến và tích xác nhận đang ở điểm đón.
- Hệ thống lưu lại tọa độ bắt đầu và thời gian bắt đầu chuyến.
- Sau khi cập nhật chuyến thành công, Google Maps tự mở với chế độ dẫn đường ô tô từ vị trí hiện tại đến điểm đến.
- Khi quay lại website, tài xế có nút **Tiếp tục dẫn đường Google Maps**.
- Không cần Google Maps API key vì ứng dụng sử dụng Google Maps Directions URL.

Không cần chạy lại SQL khi nâng cấp từ v1.2.1. Chỉ cần cập nhật frontend và build lại.

## 1. Chức năng hiện có

### Tài xế

- Chỉ hiển thị chuyến được giao cho tài khoản đang đăng nhập.
- Quy trình trạng thái: `Đã giao → Đã nhận → Checklist → KM đầu → Xác nhận GPS → Đang chạy → KM cuối → Hoàn thành`.
- Checklist Có/Không trước chuyến.
- Chụp ảnh cụm đồng hồ bằng camera điện thoại.
- Bắt buộc xác nhận GPS và điểm đón trước khi bắt đầu chuyến.
- Tự mở Google Maps để dẫn đường sau khi bắt đầu chuyến thành công.
- Tự nén ảnh trước khi lưu/upload để tránh lỗi ảnh quá lớn trên điện thoại.
- OCR đọc dãy số ODO/KM từ ảnh và tự điền vào ô kilomet; tài xế vẫn phải kiểm tra, có thể sửa thủ công.
- Kiểm tra KM cuối không nhỏ hơn KM đầu và cảnh báo số đọc chênh lệch bất thường.
- Gửi chi phí theo loại, số tiền, ghi chú và ảnh hóa đơn.
- Báo sự cố bằng ảnh, ghi âm trực tiếp bằng microphone và vị trí GPS.
- Nút gọi điều phối cố định.
- PWA cài lên màn hình chính.
- Khi mất mạng, thao tác được xếp hàng trong IndexedDB và tự đồng bộ khi có mạng.

### Điều phối

- Dashboard xe đang chạy, xe trống, xe sửa, chuyến trễ và chi phí hôm nay.
- Tạo chuyến, chọn xe, tài xế, loại chuyến, thời gian, điểm đón/đến và người liên hệ.
- Phát hiện sơ bộ trùng lịch xe hoặc tài xế.
- Theo dõi trạng thái chuyến theo thời gian thực.
- Hủy chuyến chưa hoàn thành.

### Hành chính đội xe

- Hồ sơ xe, kilomet hiện tại, đăng kiểm, bảo hiểm và mốc bảo dưỡng.
- Thêm/chỉnh sửa xe.
- Tạo lịch bảo dưỡng hoặc sửa chữa.
- Tiếp nhận và xử lý sự cố.

### Kế toán

- Xem ảnh hóa đơn.
- Duyệt, từ chối và đánh dấu đã thanh toán.
- Tổng hợp chi phí theo bộ lọc.

### Quản trị hệ thống

- Tạo tài khoản nhân viên bằng số điện thoại.
- Gán vai trò và khóa/mở tài khoản.
- Tạo người dùng qua Edge Function, không đưa service role key vào trình duyệt.

### Ban Giám đốc

- Dashboard tổng hợp.
- Báo cáo theo loại chuyến, xe, kilomet và chi phí.
- Xuất CSV mở bằng Excel.

## 2. Công nghệ

- React + TypeScript.
- Vite.
- Supabase Auth, PostgreSQL, Realtime và Storage.
- IndexedDB qua thư viện `idb` để xếp hàng thao tác offline và lưu ảnh Demo không làm đầy `localStorage`.
- Tesseract.js chạy OCR số kilomet ngay trên trình duyệt; ảnh không phải gửi đến dịch vụ OCR bên ngoài.
- PWA service worker viết trực tiếp, không phụ thuộc plugin.
- CSS responsive, không phụ thuộc framework giao diện.

## 3. Yêu cầu môi trường

- Node.js **22.12 trở lên**.
- npm đi kèm Node.js.
- Trình duyệt Chrome, Edge hoặc Safari phiên bản còn được hỗ trợ.
- HTTPS khi dùng camera, microphone, GPS và cài PWA trên tên miền thật.

## 4. Chạy nhanh chế độ Demo

Chế độ Demo không cần Supabase và lưu dữ liệu trong trình duyệt.

```bash
npm install
npm run verify:source
npm run dev
```

Mở địa chỉ Vite hiển thị, thường là:

```text
http://localhost:5173
```

Website không còn nút đăng nhập nhanh. Nhập thủ công một trong các tài khoản Demo sau, mật khẩu chung `123456`:

| Vai trò | Số điện thoại |
|---|---|
| Tài xế | 0901000001 |
| Điều phối | 0901000002 |
| Kế toán | 0901000003 |
| Ban Giám đốc | 0901000004 |

> Demo chỉ để xem và kiểm thử nghiệp vụ. Khi điền biến môi trường Supabase, ứng dụng tự chuyển sang chế độ dữ liệu trực tuyến.

## 5. Triển khai Supabase

### Bước 1 — Tạo project

1. Tạo project mới trên Supabase.
2. Ghi lại **Project URL** và **Publishable/Anon key**.
3. Chọn khu vực máy chủ phù hợp.
4. Không đưa `service_role key` vào source web.

### Bước 2 — Tạo cơ sở dữ liệu

Mở **SQL Editor**, chạy toàn bộ file:

```text
supabase/schema.sql
```

File này tạo:

- Các bảng dữ liệu.
- Ràng buộc kilomet và trạng thái.
- Trigger cập nhật trạng thái/odometer xe sau chuyến.
- Trigger audit log.
- Row Level Security theo vai trò.
- Bucket ảnh riêng tư `vehicle-media`.
- Chính sách Storage.
- Realtime cho các bảng vận hành.

Có thể chạy thêm dữ liệu xe mẫu:

```text
supabase/seed-vehicles.sql
```

### Bước 3 — Cấu hình đăng nhập số điện thoại

Trong Supabase:

1. Vào **Authentication → Providers → Phone**.
2. Kết nối nhà cung cấp SMS nếu muốn dùng OTP.
3. Với bản nội bộ sử dụng mật khẩu, tạo người dùng bằng số điện thoại trong **Authentication → Users**.
4. Sau khi tạo, trigger tự thêm hồ sơ với quyền mặc định `driver`.

Cập nhật tên và quyền bằng SQL:

```sql
update public.profiles
set full_name = 'Lê Minh Đăng', role = 'dispatcher', active = true
where phone = '+84901000002';
```

Các quyền hợp lệ:

```text
driver       Tài xế
dispatcher   Điều phối xe
accountant   Kế toán
fleet        Hành chính đội xe
director     Ban Giám đốc
admin        Quản trị hệ thống
```

Tạo thủ công tài khoản `admin` đầu tiên. Sau đó quản trị viên có thể tạo các tài khoản còn lại ngay trên web.

### Bước 3.1 — Deploy Edge Function quản lý tài khoản

Cài Supabase CLI, đăng nhập và liên kết project, sau đó chạy:

```bash
supabase functions deploy manage-user
```

Function nằm tại `supabase/functions/manage-user/index.ts`. Supabase tự cung cấp các biến `SUPABASE_URL`, `SUPABASE_ANON_KEY` và `SUPABASE_SERVICE_ROLE_KEY` cho function trên hosted platform.

### Bước 4 — Cấu hình biến môi trường

Sao chép file:

```bash
cp .env.example .env
```

Điền:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
VITE_APP_NAME=Điều phối xe Bệnh viện mắt Sài Gòn Trà Vinh
VITE_COORDINATOR_PHONE=0900000000
```

Không commit file `.env` lên GitHub.

### Bước 5 — Kiểm thử hai thiết bị

1. Đăng nhập điều phối trên máy tính.
2. Đăng nhập tài xế trên điện thoại khác.
3. Điều phối tạo chuyến.
4. Kiểm tra tài xế thấy chuyến gần như ngay lập tức.
5. Tài xế nhận chuyến, checklist và chụp KM đầu.
6. Bấm **Bắt đầu chuyến**, cấp quyền GPS, xác nhận điểm đón và kiểm tra Google Maps tự mở.
7. Kiểm tra dashboard chuyển xe sang **Đang chạy**.
8. Tài xế chụp KM cuối và hoàn thành.
9. Kiểm tra hồ sơ xe cập nhật kilomet.
10. Gửi chi phí và đăng nhập kế toán để duyệt.

## 6. Build production

```bash
npm run verify
npm run preview
```

Thư mục sau build:

```text
dist/
```

Camera, GPS, Storage và PWA cần chạy trên HTTPS, ngoại trừ `localhost` khi phát triển.

## 7. Triển khai GitHub Pages

Workflow đã có tại:

```text
.github/workflows/deploy-pages.yml
```

Tạo repository, push source, sau đó tạo hai repository secrets:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Trong GitHub vào **Settings → Pages → Source → GitHub Actions**.

Vì app không dùng URL router phía máy chủ và Vite dùng đường dẫn tương đối, nó có thể chạy trong thư mục con của GitHub Pages.

> GitHub Pages phù hợp cho frontend. Dữ liệu và ảnh vẫn nằm trong Supabase.

## 8. Triển khai bằng Docker trên server bệnh viện

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=YOUR_KEY \
  -t msg-car-web .

docker run -d --name msg-car-web \
  --restart unless-stopped \
  -p 8080:80 \
  msg-car-web
```

Đặt Nginx Proxy Manager, Caddy hoặc reverse proxy phía trước và cấp HTTPS cho tên miền, ví dụ:

```text
xe.matsaigontravinh.vn
```

## 9. Cài PWA trên điện thoại

### Android Chrome

1. Mở website.
2. Bấm menu ba chấm.
3. Chọn **Thêm vào màn hình chính** hoặc **Cài đặt ứng dụng**.
4. Biểu tượng Điều phối xe BVMSGTV xuất hiện như ứng dụng.

### iPhone Safari

1. Mở website bằng Safari.
2. Bấm **Chia sẻ**.
3. Chọn **Thêm vào Màn hình chính**.

## 10. Bảo mật đã triển khai

- Không suy đoán quyền từ tên tài khoản.
- Quyền lấy từ bảng `profiles` có RLS.
- Tài xế chỉ đọc chuyến, chi phí, checklist và sự cố của mình.
- Kế toán mới được duyệt chi phí.
- Điều phối mới được tạo chuyến.
- Hành chính/điều phối mới được sửa hồ sơ xe và bảo dưỡng.
- Ảnh nằm trong bucket private và được mở bằng signed URL có thời hạn.
- Driver không được sửa điểm đến, xe, tài xế hoặc giờ điều xe.
- Database chặn hoàn thành chuyến khi chưa có KM cuối.
- Audit log ghi thay đổi xe, chuyến, chi phí và sự cố.

## 11. OCR kilomet và lưu ảnh

- Sau khi chụp, website tự tối ưu ảnh rồi chạy OCR và điền số kilomet.
- Lần OCR đầu tiên có thể lâu hơn vì trình duyệt cần tải bộ nhận diện; những lần sau sẽ nhanh hơn nhờ cache.
- Khi ảnh rung, lóa, màn hình LED quá tối hoặc trong ảnh có nhiều dãy số, kết quả có thể sai. Tài xế bắt buộc đối chiếu ảnh trước khi bấm lưu.
- Trong chế độ Demo, ảnh được lưu trong IndexedDB thay vì nhét Base64 vào `localStorage`, khắc phục lỗi không lưu được KM đầu do vượt dung lượng trình duyệt.

## 12. Giới hạn phiên bản 1

Chưa triển khai:

- OCR số tiền hóa đơn.
- Theo dõi GPS liên tục khi màn hình tắt.
- Push notification qua FCM/Zalo/Telegram.
- Báo cáo bệnh nhân/ca mổ chi tiết vì cần thống nhất quy tắc dữ liệu với HIS/CSKH.
- Ký duyệt điện tử nhiều cấp.

Các chức năng trên nên làm sau khi đội xe sử dụng ổn định quy trình cơ bản.

## 13. Cấu trúc source

```text
MSG-Car-Web/
├── public/
│   ├── icons/
│   ├── manifest.webmanifest
│   └── sw.js
├── src/
│   ├── components/
│   ├── context/
│   ├── lib/
│   │   ├── backend.ts       Demo + Supabase + offline queue
│   │   ├── image.ts         Nén và tiền xử lý ảnh
│   │   ├── odometerOcr.ts   OCR và chọn dãy số KM phù hợp
│   │   ├── offline.ts       IndexedDB, hàng đợi và ảnh Demo
│   │   └── supabase.ts
│   ├── pages/
│   ├── types/
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── supabase/
│   ├── functions/manage-user/
│   ├── config.toml
│   ├── schema.sql
│   └── seed-vehicles.sql
├── Dockerfile
├── nginx.conf
├── package.json
└── README.md
```

## 14. Quy tắc vận hành trước khi dùng thật

- Không nhập dữ liệu bệnh nhân chi tiết không cần thiết vào ghi chú chuyến.
- Chỉ dùng tên/người liên hệ ở mức cần thiết cho việc đón đưa.
- Kiểm tra chính sách bảo vệ dữ liệu của bệnh viện trước khi dùng số điện thoại bệnh nhân.
- Thiết lập backup Supabase/PostgreSQL.
- Bật MFA cho tài khoản quản trị Supabase và GitHub.
- Kiểm thử trên ít nhất hai mẫu Android tài xế đang sử dụng.
- Chạy thử nội bộ 1–2 tuần với một xe trước khi triển khai toàn đội.

## 15. Xử lý lỗi cài package

Nếu `npm install` báo registry nội bộ không tìm thấy package, chuyển về npm công khai:

```bash
npm config set registry https://registry.npmjs.org/
npm cache verify
npm install
```

Sau khi cài xong, chạy kiểm tra đầy đủ:

```bash
npm run verify
```

Kết quả kiểm tra source tại thời điểm bàn giao nằm trong `KIEM_THU_SOURCE.md`.
