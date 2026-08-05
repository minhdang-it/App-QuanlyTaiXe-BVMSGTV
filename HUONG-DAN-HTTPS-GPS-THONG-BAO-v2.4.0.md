# Hướng dẫn bật HTTPS, GPS và thông báo cho tài xế

## Vì sao bật GPS trên điện thoại nhưng website vẫn không lấy được vị trí?

Điện thoại đang mở hệ thống bằng địa chỉ dạng:

```text
http://172.16.x.x:8080
```

Trình duyệt mobile không cấp GPS và thông báo hệ thống cho website HTTP sử dụng địa chỉ mạng LAN. Hệ thống cần được mở bằng HTTPS.

## Bước 1 — Cài mkcert trên máy chủ Windows

Cài công cụ `mkcert` từ dự án chính thức của FiloSottile. Sau khi cài, mở PowerShell hoặc Command Prompt mới và kiểm tra:

```powershell
mkcert -version
```

## Bước 2 — Tạo HTTPS nội bộ

Nhấn chuột phải và chạy bằng quyền Administrator:

```text
TAO-HTTPS-NOI-BO.bat
```

Script sẽ:

- cài CA tin cậy trên máy chủ;
- tạo chứng chỉ cho localhost, tên máy và các địa chỉ IPv4 hiện tại;
- tạo HTTPS cổng `8443`;
- mở Windows Firewall cho TCP `8080` và `8443`;
- build và khởi động lại website.

## Bước 3 — Cài CA trên điện thoại bệnh viện

Sau khi chạy script, lấy file:

```text
.certs\CA-GOC-MKCERT.crt
```

Chép file này sang điện thoại tài xế và cài vào **Chứng chỉ CA người dùng**. Tên menu khác nhau theo hãng máy, thường nằm trong:

```text
Cài đặt → Bảo mật → Mã hóa và thông tin xác thực → Cài chứng chỉ → Chứng chỉ CA
```

Chỉ cài CA này trên thiết bị bệnh viện được quản lý. Không chia sẻ CA ra ngoài đơn vị.

## Bước 4 — Mở đúng địa chỉ HTTPS

Ví dụ máy chủ có IP `172.16.84.86`:

```text
https://172.16.84.86:8443
```

Không tiếp tục sử dụng địa chỉ HTTP cũ.

## Bước 5 — Cấp quyền trong ứng dụng tài xế

Ứng dụng sẽ hiển thị màn hình **Sẵn sàng nhận chuyến**. Thực hiện lần lượt:

1. Bấm **Bật vị trí** và chọn **Cho phép khi dùng ứng dụng** hoặc quyền tương đương.
2. Bấm **Bật thông báo** và chọn **Cho phép**.
3. Khi cả ba dòng có dấu tích, giao diện chuyến xe mới được mở.

## Khi đã từng bấm Chặn

Mở biểu tượng ổ khóa hoặc thông tin trang web cạnh thanh địa chỉ, sau đó:

```text
Quyền trang web → Vị trí → Cho phép
Quyền trang web → Thông báo → Cho phép
```

Quay lại ứng dụng và bấm **Kiểm tra lại quyền**.

## Cài lại PWA

Nếu điện thoại đã cài biểu tượng ứng dụng từ bản HTTP cũ:

1. Gỡ ứng dụng/PWA cũ khỏi màn hình chính.
2. Xóa dữ liệu trang web cũ nếu cần.
3. Mở địa chỉ HTTPS mới.
4. Cài lại ứng dụng từ trình duyệt.

## Giới hạn cần biết

Bản này bảo đảm cảnh báo khi ứng dụng/PWA đang mở hoặc đang chạy nền và kết nối dữ liệu còn hoạt động. Để bảo đảm push tuyệt đối khi ứng dụng đã bị hệ điều hành đóng hoàn toàn, cần triển khai thêm dịch vụ Web Push phía máy chủ với VAPID/Supabase Edge Function.
