# BVMSGTV v2.11.13.1 — Sửa cảnh báo bí mật giả và triển khai Nhật ký GPS

**Áp dụng khi:** Đã chép bản v2.11.13 vào full source, chạy `npm.cmd run verify:source` thì báo `Phát hiện chuỗi có thể là bí mật trong: tests\\collector-mock-test.mjs`.

**Nguyên nhân:** Bài kiểm thử sử dụng khóa/mật khẩu giả được viết trực tiếp trong đối tượng cấu hình; `scripts/verify-source.mjs` quét chuỗi này bằng biểu thức chính quy chung. Không phải chứng cứ lộ khóa thật. Hotfix thay mock fixture thành biến được sinh trong quá trình chạy, **giữ nguyên khả năng phát hiện khóa thật**.

## A. Sửa lỗi trên Windows

1. Dừng Vite/terminal đang chạy build nếu có.
2. Mở CMD tại **thư mục full source** có `package.json`, `src`, `public`, `scripts` (không phải thư mục patch). Ví dụ:

```cmd
cd /d "D:\Website\Taixe\App Quản lý xe cho tài xế BVMSGTV"
dir package.json
dir scripts\verify-source.mjs
```

3. Tải `BVMSGTV-v2.11.13.1-COLLECTOR-VERIFY-HOTFIX.zip` vào thư mục source rồi giải nén:

```cmd
powershell -NoProfile -Command "Expand-Archive -LiteralPath '.\BVMSGTV-v2.11.13.1-COLLECTOR-VERIFY-HOTFIX.zip' -DestinationPath '.\HOTFIX-v2.11.13.1' -Force"
dir ".\HOTFIX-v2.11.13.1\APPLY-v2.11.13.1.mjs"
```

4. Chạy **từ thư mục full source**:

```cmd
node ".\HOTFIX-v2.11.13.1\APPLY-v2.11.13.1.mjs"
```

Hotfix chỉ sửa những file có tên `collector-mock-test.mjs` thuộc source/patch đã giải nén, **không sửa `scripts/verify-source.mjs`**. Tệp gốc được sao lưu trong thư mục riêng nằm **ngoài thư mục source**, tránh bị verifier quét lại bản cũ.

5. Kiểm tra và build:

```cmd
npm.cmd run verify:source
npm.cmd run check
npm.cmd run build
```

6. Nếu muốn kiểm thử mock collector và có đủ 2 file `tests/collector-mock-test.mjs` + `server/trip-telemetry/collector.mjs`, chạy:

```cmd
node ".\tests\collector-mock-test.mjs"
```

Kết quả mong đợi: `MOCK COLLECTOR TEST PASSED...`. Nếu **thiếu** collector trong thư mục full source, chép riêng nó từ patch v2.11.13 vào `server/trip-telemetry/` trước khi thử; không phải điều kiện bắt buộc để build frontend.

### Nếu vẫn lỗi verify:source

- Kiểm tra thông báo đã chuyển sang file khác chưa. **Không tắt bộ quét** và không xóa file được báo nếu chưa xác minh.
- Nếu còn cảnh báo ở thư mục patch khác có bản mock cũ, chạy lại script một lần; script sẽ tìm và sửa tất cả bản mock đúng cấu trúc.
- Nếu có `.env.local` chưa cấu hình cũng không làm ảnh hưởng lỗi mock này; **không gửi khóa API/mật khẩu lên chat**.

## B. Triển khai database Supabase (chỉ khi CHƯA chạy migration v2.11.13)

1. Sao lưu database hoặc snapshot trước khi nâng cấp.
2. Vào **Supabase Dashboard → SQL Editor → New query**.
3. Mở file từ gói **v2.11.13 gốc**: `supabase/migrate-v2.11.13-trip-gps-audit.sql`.
4. Đọc kỹ, chạy toàn bộ SQL và chờ thành công. Hotfix v2.11.13.1 **không chứa SQL mới**.
5. Kiểm tra:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('trip_gps_samples', 'trip_gps_summaries')
order by table_name;
```

Phải trả về hai bảng. Nếu đã tồn tại, **không cần chạy lại migration** chỉ để sửa lỗi verify.

## C. Chuẩn bị tài khoản collector riêng trong Supabase

1. Tạo tài khoản hệ thống dành riêng để đọc API Navicom, không dùng tài khoản của nhân viên.
2. Trong **Authentication → Users**, tạo email/mật khẩu với email đã xác nhận.
3. Bảo đảm tài khoản có bản ghi tương ứng trong `public.profiles`, `active=true` và `role='fleet'` hoặc `role='admin'` (nên dùng `fleet`). Kiểm tra theo email từ `auth.users`:

```sql
select u.id, u.email, p.role, p.active
from auth.users u
left join public.profiles p on p.id = u.id
where u.email = 'email-collector-cua-ban@example.com';
```

Nếu chưa có `profiles` hoặc vai trò chưa đúng, cập nhật qua quy trình quản trị tài khoản hiện hành. **Không đổi vai trò tài khoản cá nhân đang dùng**.

## D. Cài Collector trên Ubuntu Server

Giả sử user SSH là `danglee` và Gateway Navicom chạy nội bộ tại `127.0.0.1:3020`.

1. Upload ZIP gốc **`BVMSGTV-v2.11.13-GPS-TRIP-AUDIT.zip`** vào `/home/danglee/uploads/` trên Ubuntu. Giải nén tại đó:

```bash
cd /home/danglee/uploads
unzip -o BVMSGTV-v2.11.13-GPS-TRIP-AUDIT.zip -d ./gps-audit-v2.11.13
find ./gps-audit-v2.11.13 -name install-ubuntu.sh -print
```

2. Dùng đường dẫn thực tế hiển thị từ `find`. Nếu ZIP có thư mục gốc `BVMSGTV-v2.11.13-GPS-TRIP-AUDIT` thì:

```bash
sudo bash /home/danglee/uploads/gps-audit-v2.11.13/BVMSGTV-v2.11.13-GPS-TRIP-AUDIT/server/trip-telemetry/install-ubuntu.sh
```

Nếu trong ZIP không có thư mục gốc, đường dẫn đúng là `.../gps-audit-v2.11.13/server/trip-telemetry/install-ubuntu.sh`. **Không đoán tên thư mục**, xem kết quả `find`.

3. Kiểm tra Node.js mà **root/systemd** sử dụng:

```bash
sudo which node
sudo node -v
```

Nên dùng Node 22 hoặc bản LTS hỗ trợ fetch. Nếu không tìm thấy Node khi dùng `sudo`, cài Node hệ thống trước khi tiếp tục; đừng trỏ service tới đường dẫn tạm hoặc bản Node trong NVM của một user khác nếu chưa kiểm tra quyền truy cập.

4. Chỉnh file môi trường server:

```bash
sudo nano /etc/bvmsgtv/trip-telemetry.env
sudo chmod 600 /etc/bvmsgtv/trip-telemetry.env
```

Các trường cần điền (không sao chép mật khẩu vào tài liệu/chat):

- `SUPABASE_URL`: URL project của bệnh viện.
- `SUPABASE_SERVICE_ROLE_KEY`: khóa **service role chỉ lưu trên Ubuntu**.
- `SUPABASE_ANON_KEY`: anon/publishable key đúng project.
- `COLLECTOR_EMAIL` / `COLLECTOR_PASSWORD`: tài khoản collector riêng vừa tạo.
- `NAVICOM_GATEWAY_URL`: thường là `http://127.0.0.1:3020`.
- `SAMPLE_INTERVAL_MS=10000`: lấy mẫu khoảng 10 giây/lần.

Không đưa `SUPABASE_SERVICE_ROLE_KEY` vào `.env.local` của frontend, Git, hoặc file ZIP gửi người dùng.

5. Chạy kiểm tra thuần dữ liệu, không gọi mạng:

```bash
node /opt/bvmsgtv-trip-telemetry/collector.mjs --self-test
```

Mong đợi `SELF-TEST OK`.

6. Kiểm tra Navicom Gateway:

```bash
sudo systemctl status bvmsgtv-navicom-gateway --no-pager
sudo ss -lntp | grep ':3020'
```

Nếu Gateway không chạy, xử lý Gateway trước khi kích hoạt collector. `GET /vehicle/:deviceId` có thể yêu cầu Bearer token; đừng kiểm tra bằng browser công khai rồi kết luận API hỏng nếu thiếu token.

7. Khởi chạy collector:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bvmsgtv-trip-telemetry
sudo systemctl status bvmsgtv-trip-telemetry --no-pager
sudo journalctl -u bvmsgtv-trip-telemetry -n 60 --no-pager
```

Chỉ tiếp tục nếu service **active (running)** và không lặp lỗi xác thực, lỗi 401/403/404/500.

8. Có thể chạy đúng 1 chu kỳ để kiểm tra (tạm dừng service để tránh ghi song song):

```bash
sudo systemctl stop bvmsgtv-trip-telemetry
sudo bash -c 'set -a; source /etc/bvmsgtv/trip-telemetry.env; set +a; node /opt/bvmsgtv-trip-telemetry/collector.mjs --once'
sudo systemctl start bvmsgtv-trip-telemetry
```

**Lưu ý:** Dùng bước này khi file `.env` đã chuẩn và không chứa cú pháp đặc biệt gây lỗi shell. Không in toàn bộ file `.env` hoặc giá trị khóa lên terminal để chụp màn hình.

## E. Upload frontend `dist` lên Ubuntu

1. Trên Windows, sau `npm.cmd run build` phải có `dist/index.html`.
2. Upload toàn bộ **nội dung** `dist` vào `/home/danglee/uploads/dist` (đảm bảo `index.html` nằm trực tiếp trong thư mục dist đó, không bị lồng thêm dist thứ hai).
3. Nếu đã có script triển khai tĩnh `/home/danglee/uploads/ubuntu/deploy-static.sh`:

```bash
ls -l /home/danglee/uploads/ubuntu/deploy-static.sh
bash /home/danglee/uploads/ubuntu/deploy-static.sh \
  dieuphoixe.matsaigontravinh.vn \
  /home/danglee/uploads/dist \
  5
sudo nginx -t
sudo systemctl reload nginx
```

Nếu hệ thống hiện tại dùng script triển khai khác, **ưu tiên script đang vận hành thành công**, không tự đổi Nginx root/symlink vì dễ ảnh hưởng web đang chạy.

4. Trên máy/điện thoại, mở lại `https://dieuphoixe.matsaigontravinh.vn`, hard-refresh để nhận bundle mới.

## F. Kiểm thử nghiệp vụ đầu cuối

1. Đăng nhập tài khoản BGĐ/Hành chính/Điều phối/Quản trị: có quyền mở **Theo dõi xe realtime → Nhật ký GPS**.
2. Tạo 1 chuyến thử đã duyệt, giao đúng xe có Navicom.
3. Tài xế nhận chuyến, ghi KM đầu, **Bắt đầu chuyến**.
4. Cho xe vận hành an toàn vài phút, tuyệt đối không thao tác điện thoại khi đang điều khiển xe.
5. Tài xế ghi KM cuối, kết thúc. Collector tiếp tục tổng hợp dữ liệu.
6. Trên Supabase SQL Editor, kiểm tra:

```sql
select v.plate_number, s.started_at, s.ended_at,
       s.start_lat, s.start_lng, s.end_lat, s.end_lng,
       s.max_speed_kph, s.max_speed_lat, s.max_speed_lng,
       s.sample_count, s.outlier_count
from public.trip_gps_summaries s
join public.vehicles v on v.id=s.vehicle_id
order by s.started_at desc limit 10;
```

7. Xác minh tọa độ bắt đầu, kết thúc và vị trí tốc độ cao nhất đều được mở đúng trên Google Maps (bản đồ nội bộ vẫn là OpenStreetMap).
8. Thử xe offline: không được lấy tọa độ cũ thay cho vị trí GPS xác thực, và không hiện thông báo pop-up camera khó chịu.
9. Kiểm tra tài khoản tài xế/Kế toán **không có quyền** xem dữ liệu lịch sử GPS nhạy cảm.

### Tình huống lỗi phổ biến

| Hiện tượng | Kiểm tra |
|---|---|
| `verify:source` báo test mock | Áp dụng hotfix v2.11.13.1; không tắt secret scanner. |
| `npm run check` báo TypeScript | Xem chính xác file/dòng lỗi; không sửa bằng `any` đại trà. |
| Collector `401/403` Gateway | Kiểm tra tài khoản collector, role `fleet`, Bearer token và cấu hình Gateway. |
| Collector `401/403` Supabase | Kiểm tra URL project và service role key trên Ubuntu (không công khai khóa). |
| Collector `404` | Đảm bảo đã chạy SQL và endpoint Gateway `/vehicle/:deviceId` đúng. |
| Không ghi mẫu GPS | Xe offline, Navicom ID không khớp, chưa bắt đầu chuyến hoặc GPS thiếu thời gian hợp lệ. |
| Mẫu có nhưng không có tọa độ đầu/cuối | Dữ liệu GPS không đủ gần thời điểm bắt đầu/kết thúc trong giới hạn 90 giây. |
| `203/EXEC` khi khởi động service | Kiểm tra `ExecStart` và đường dẫn Node bằng `sudo which node`. |

## G. Khôi phục / rollback

- **Hotfix**: file test gốc được lưu ở thư mục `BVMSGTV-backup-mock-test-...` nằm cạnh source. Chỉ khôi phục nếu thực sự cần, vì bản mock cũ sẽ gây lỗi verify lại.
- **Frontend**: dùng `dist`/release backup trước đó và script deploy cũ.
- **Collector**: nếu có lỗi nghiêm trọng, `sudo systemctl disable --now bvmsgtv-trip-telemetry` để dừng ghi mẫu.
- **Database**: không xóa bảng `trip_gps_samples` / `trip_gps_summaries` khi đã có dữ liệu thực tế; muốn rollback schema phải có kế hoạch chuyển dữ liệu và backup.

**Ngày/giờ trong giao diện**: DD/MM/YYYY HH:mm, nhất quán cho tất cả bộ phận.
