# Deploy Navicom Gateway trên Ubuntu

## Frontend

Build frontend như hiện tại và deploy `dist` vào `dieuphoixe.matsaigontravinh.vn`.

## Gateway

Tạo thư mục:

```bash
sudo mkdir -p /var/www/navicom-gateway
sudo cp server/navicom-gateway/server.mjs /var/www/navicom-gateway/
sudo mkdir -p /etc/bvmsgtv
sudo cp server/navicom-gateway/.env.example /etc/bvmsgtv/navicom-gateway.env
sudo chmod 600 /etc/bvmsgtv/navicom-gateway.env
sudo chown root:root /etc/bvmsgtv/navicom-gateway.env
```

Tự điền tài khoản Navicom vào file server này. Không đưa file đó vào source frontend.

## systemd

Copy `server/navicom-gateway/navicom-gateway.service.example` thành:

```bash
/etc/systemd/system/bvmsgtv-navicom-gateway.service
```

Sau đó:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bvmsgtv-navicom-gateway
sudo systemctl status bvmsgtv-navicom-gateway
```

## Nginx

Thêm nội dung trong `server/navicom-gateway/nginx-location.example.conf` vào server block của `dieuphoixe.matsaigontravinh.vn`.

Kiểm tra:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Frontend gọi `/api/navicom/...`; tài khoản/mật khẩu Navicom không bao giờ đi xuống trình duyệt.
