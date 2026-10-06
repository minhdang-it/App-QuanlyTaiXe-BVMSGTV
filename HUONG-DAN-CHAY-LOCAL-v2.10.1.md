# HƯỚNG DẪN CHẠY LOCAL – ĐIỀU PHỐI XE BVMSGTV v2.10.1

## A. Trường hợp bạn đang dùng Supabase hiện tại
Đây là cách nên dùng để test code mới: **frontend chạy trên máy Windows, database/Auth/Storage vẫn dùng Supabase hiện tại**. Không cần cài PostgreSQL hay Supabase Local.

### 1. Giải nén source
Nên dùng đường dẫn ngắn, không dấu để tránh lỗi npm:

```text
D:\Website\BVMSGTV-DieuPhoiXe
```

### 2. Kiểm tra Node.js
Mở CMD trong thư mục source:

```cmd
node -v
npm -v
```

Cần Node.js 22.12 trở lên. Node 24/26 vẫn có thể chạy nếu dependencies tương thích.

### 3. Chạy setup tự động
Double-click:

```text
SETUP-LOCAL.cmd
```

Lần đầu script sẽ tạo `.env.local` và mở Notepad.

### 4. Điền `.env.local`
Bắt buộc:

```env
VITE_SUPABASE_URL=https://PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=ANON_OR_PUBLISHABLE_KEY
```

Không đưa `service_role`/secret key vào frontend.

Lưu file rồi chạy lại `SETUP-LOCAL.cmd`. Script sẽ chạy `npm ci`, kiểm tra source và TypeScript.

### 5. Chạy website
Double-click:

```text
START-LOCAL.cmd
```

Mở:

```text
http://localhost:5173
```

`localhost` được trình duyệt coi là secure context cho nhiều API phát triển, nên phù hợp để test trên chính máy Windows.

## B. Test bằng điện thoại trong cùng Wi‑Fi/LAN
Nếu mở bằng dạng:

```text
http://172.16.x.x:5173
```

thì giao diện chạy được nhưng **GPS/camera/microphone có thể bị trình duyệt chặn vì HTTP**. Để test đầy đủ cần HTTPS.

### Cách dùng chứng chỉ local
1. Tạo thư mục `.certs`.
2. Tạo chứng chỉ có SAN cho `localhost`, IP máy tính và cài CA tin cậy trên thiết bị test. Công cụ thuận tiện là `mkcert`.
3. Đặt file:

```text
.certs\local-key.pem
.certs\local-cert.pem
```

4. Trong `.env.local` thêm:

```env
LOCAL_HTTPS_KEY=.certs/local-key.pem
LOCAL_HTTPS_CERT=.certs/local-cert.pem
VITE_PUBLIC_HTTPS_URL=https://IP-MAY-TINH:5173
```

5. Chạy:

```text
START-LOCAL-HTTPS.cmd
```

Lưu ý: điện thoại phải tin CA/chứng chỉ local thì GPS mới hoạt động ổn định.

## C. Kiểm tra code trước khi test

```text
CHECK-LOCAL.cmd
```

Tương đương:

```cmd
npm run local:check
npm run verify:source
npm run check
```

## D. Build production

```text
BUILD-LOCAL.cmd
```

Kết quả:

```text
dist\
```

## E. Database cần ở mức nào?
Nếu Supabase hiện tại đã chạy v2.9.0 thì **không chạy lại SQL** cho v2.10.0/v2.10.1. v2.10.x chủ yếu là giao diện và thiết lập local.

Database phải có ít nhất các migration:

```text
v2.7.x: workflow, đề nghị khoa/phòng, nhiều tệp, theo dõi xe
v2.9.0: chuyến đột xuất + flow Hành chính duyệt + trạng thái online
```

Nếu đây là Supabase project hoàn toàn mới, dùng `supabase/schema.sql` thay vì chạy rời từng migration cũ.

## F. Edge Functions
Chỉ cần deploy khi project Supabase chưa có hoặc code function đã thay đổi:

```text
manage-user       -> quản trị tài khoản
analyze-odometer  -> Gemini đọc đồng hồ KM
```

## G. Lỗi thường gặp
### npm ci báo EPERM / unlink
Đóng Vite, VS Code terminal và chương trình đang giữ `node_modules`, sau đó:

```cmd
rmdir /s /q node_modules
npm cache verify
npm ci
```

### PowerShell chặn npm.ps1
Không cần đổi ExecutionPolicy. Dùng các file `.cmd` trong source hoặc chạy:

```cmd
npm.cmd ci
npm.cmd run dev
```

### GPS báo chỉ hoạt động HTTPS
- Desktop: dùng `http://localhost:5173`.
- Điện thoại/IP LAN: dùng HTTPS với chứng chỉ tin cậy.

### Đăng nhập được nhưng không có dữ liệu
Kiểm tra `.env.local` có đúng Supabase project, RLS/schema đã cập nhật và user có bản ghi `profiles`.
