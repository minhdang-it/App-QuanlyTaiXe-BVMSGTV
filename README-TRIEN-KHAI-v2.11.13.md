# BVMSGTV v2.11.13 – Nhật ký GPS hành trình

## Phạm vi

- Mỗi xe, mỗi chuyến lưu mẫu GPS Navicom mỗi ~10 giây từ **Ubuntu**, kể cả khi không ai mở web.
- Ghi **tọa độ bắt đầu, tọa độ kết thúc, vị trí đạt tốc độ cao nhất và thời gian tương ứng**; đồng thời lưu mẫu chi tiết lịch sử.
- **Xe mất tín hiệu**: không ghi tọa độ cũ thành tọa độ đầu/cuối. Cần mẫu GPS hợp lệ trong 90 giây sau lúc bắt đầu và 90 giây trước lúc kết thúc.
- Tốc độ `>160 km/h` vẫn được hiển thị nếu Navicom ghi nhận (đến tối đa 240 km/h), đồng thời có cảnh báo cần kiểm tra tính chính xác trước khi kết luận. Đây là quy tắc chất lượng dữ liệu, **không phải giới hạn tốc độ pháp luật**.
- BGĐ, Hành chính, Điều phối, Quản trị được xem nhật ký qua RLS; tài xế không thể tự sửa GPS.
- Không thay đổi camera, không dùng GPS điện thoại, không thay OpenStreetMap hiện có.

## 1. Backup Supabase

Sao lưu database từ giao diện Supabase/pg_dump trước khi chạy migration. Thực hiện trên staging trước production nếu có.

## 2. Cập nhật database — bắt buộc

Supabase > SQL Editor > New Query, chạy toàn bộ:

`supabase/migrate-v2.11.13-trip-gps-audit.sql`

Kiểm tra:

```sql
select table_name from information_schema.tables
where table_schema='public' and table_name in ('trip_gps_samples','trip_gps_summaries');
```

Kết quả phải có đủ 2 bảng. Tập tin SQL không xóa lịch sử cũ, không sửa flow duyệt.

## 3. Cập nhật frontend — chạy trong FULL SOURCE v2.11.12

Giải nén ZIP patch vào thư mục source hiện tại. Mở CMD tại thư mục có `package.json`, `src`, `public`:

```cmd
node ".\BVMSGTV-v2.11.13-GPS-TRIP-AUDIT\APPLY-v2.11.13.mjs"
npm.cmd run verify:source
npm.cmd run check
npm.cmd run build
```

Deploy `dist` lên Ubuntu theo quy trình đang dùng. Script backup file cũ trước khi sửa.

## 4. Cài bộ thu GPS chạy nền trên Ubuntu — bắt buộc

Upload cả thư mục `server/trip-telemetry/` lên Ubuntu, ví dụ `/home/danglee/uploads/trip-telemetry`.

```bash
sudo bash /home/danglee/uploads/trip-telemetry/install-ubuntu.sh
sudo nano /etc/bvmsgtv/trip-telemetry.env
```

Thay các giá trị mẫu thành cấu hình **THẬT**:

- `SUPABASE_URL`: URL project Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: service role, **CHỈ LƯU trên Ubuntu**, tuyệt đối không đưa vào frontend.
- `SUPABASE_ANON_KEY`: Supabase anon/publishable key.
- `COLLECTOR_EMAIL`, `COLLECTOR_PASSWORD`: tài khoản **riêng** trên Supabase Auth, được gán vai trò `fleet` hoặc `admin` trong `profiles` để Gateway cho phép đọc Navicom. Không sử dụng tài khoản cá nhân.
- `NAVICOM_GATEWAY_URL=http://127.0.0.1:3020`: service gateway nội bộ. Nếu gateway thực tế có đường dẫn khác, chỉnh và test trước khi kích hoạt.

Tài khoản collector phải đăng nhập được Supabase Auth bằng email/password và được API Navicom hiện tại chấp nhận Bearer token. Nếu hệ thống đang dùng luồng xác thực đặc thù khác, cần điều chỉnh adapter trước khi dùng production.

Chạy test an toàn (không ghi dữ liệu nếu `--self-test`):

```bash
node /opt/bvmsgtv-trip-telemetry/collector.mjs --self-test
sudo systemctl enable --now bvmsgtv-trip-telemetry
sudo systemctl status bvmsgtv-trip-telemetry --no-pager
sudo journalctl -u bvmsgtv-trip-telemetry -n 60 --no-pager
```

Để chạy đúng 1 chu kỳ thử:

```bash
sudo systemctl stop bvmsgtv-trip-telemetry
sudo bash -c 'set -a; source /etc/bvmsgtv/trip-telemetry.env; set +a; node /opt/bvmsgtv-trip-telemetry/collector.mjs --once'
sudo systemctl start bvmsgtv-trip-telemetry
```

**Lưu ý:** Nếu hệ thống khởi chạy Gateway bằng API khác với `/vehicle/:deviceId`, hãy xác nhận endpoint nội bộ trước. Không mở cổng 3020 ra Internet.

## 5. Test thực tế

1. Đảm bảo xe Navicom đang online; tạo chuyến thử được duyệt.
2. Tài xế nhận, ghi KM đầu, bắt đầu. Chạy thử ít nhất 2–3 phút tại vị trí an toàn (không thao tác điện thoại khi lái).
3. Kết thúc chuyến, kiểm tra mẫu GPS ghi và `trip_gps_summaries`.
4. Trong **Theo dõi xe realtime**, bấm **Nhật ký GPS** trên thẻ xe, mở đầu/cuối/max qua Google Maps.
5. Tắt thiết bị/Navicom giả lập offline hoặc thử trường hợp mất GPS: phải ghi “Chưa có tọa độ xác thực”, không lấy GPS cũ.
6. Thử tài khoản tài xế/kế toán không được xem bảng GPS lịch sử.

Câu SQL kiểm tra:

```sql
select t.id, v.plate_number, s.started_at, s.ended_at,
       s.start_lat, s.start_lng, s.end_lat, s.end_lng,
       s.max_speed_kph, s.max_speed_lat, s.max_speed_lng,
       s.sample_count, s.outlier_count
from public.trip_gps_summaries s
join public.trips t on t.id=s.trip_id
join public.vehicles v on v.id=t.vehicle_id
order by s.started_at desc limit 20;
```

## 6. Rollback

- Frontend: khôi phục các file trong `_backup-v2.11.13-...`, build lại.
- Collector: `sudo systemctl disable --now bvmsgtv-trip-telemetry`; không xóa dữ liệu lịch sử.
- Database: giữ các bảng để bảo toàn bằng chứng GPS; **không DROP TABLE** khi đã có dữ liệu.

## Lưu ý vận hành

- Dữ liệu mới chỉ phát sinh sau khi cài collector; không thể suy ra toàn bộ lịch sử chuyến cũ từ vị trí cuối cùng của thiết bị.
- Mẫu GPS là số liệu nhà cung cấp; lỗi cập nhật, mất sóng hoặc nhảy tọa độ có thể gây khoảng trống.
- Không suy đoán xe “vi phạm tốc độ” chỉ từ tốc độ cao nhất: giới hạn thực tế còn tùy đường và loại phương tiện.
- Lịch sử GPS là dữ liệu nhạy cảm; giới hạn người xem, cần có chính sách lưu giữ/xóa theo quy định nội bộ.
