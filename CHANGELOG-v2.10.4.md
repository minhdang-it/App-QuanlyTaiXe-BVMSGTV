# CHANGELOG v2.10.4

- Sửa lỗi Windows launcher khiến Vite có thể chạy nhưng Navicom Gateway chưa thực sự lắng nghe port 3020.
- `START-LOCAL-NAVICOM.cmd` giờ bắt buộc chờ Gateway health OK trước khi chạy frontend.
- `START-NAVICOM-GATEWAY.cmd` chạy Node gateway trực tiếp, giảm lỗi quoting của `start/cmd/npm` trên Windows.
- `CHECK-NAVICOM-GATEWAY.cmd` bổ sung kiểm tra health và port 3020.
- Bổ sung hướng dẫn riêng cho lỗi `HTTP 502` / `ECONNREFUSED 127.0.0.1:3020`.
