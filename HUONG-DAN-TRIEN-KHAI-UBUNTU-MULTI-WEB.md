# Hướng dẫn triển khai Điều phối xe lên Ubuntu Server và vận hành nhiều website

Tài liệu này dùng cho ứng dụng **Điều phối xe – Bệnh viện Mắt Sài Gòn Trà Vinh**, đồng thời thiết kế máy chủ để sau này chạy thêm nhiều website.

## 1. Kiến trúc khuyến nghị

Ứng dụng hiện tại là React/Vite tĩnh, dữ liệu và xác thực đặt trên Supabase. Kiến trúc production nên là:

```text
Internet / mạng nội bộ
        ↓ HTTPS 443
      Nginx
        ├── xe.tenmien.vn       → /var/www/xe.tenmien.vn/current
        ├── web2.tenmien.vn     → /var/www/web2.tenmien.vn/current
        └── app3.tenmien.vn     → reverse proxy đến 127.0.0.1:PORT nếu là web động

Ứng dụng Điều phối xe → Supabase HTTPS/WSS
```

### Vì sao chọn cách này

- Nginx là cổng duy nhất mở ra Internet cho HTTP/HTTPS.
- Mỗi website có tên miền, thư mục, log và cấu hình riêng.
- Website React tĩnh không cần chạy Node.js liên tục trên production.
- Các ứng dụng động sau này chỉ lắng nghe trên `127.0.0.1`, không mở trực tiếp port ứng dụng ra Internet.
- Có thể deploy theo từng release và rollback nhanh bằng symbolic link `current`.

## 2. Những việc phải làm ngay khi mới nhận server

> Thực hiện theo đúng thứ tự. Khi thay đổi SSH, luôn giữ phiên SSH hiện tại và mở thêm một cửa sổ mới để kiểm tra trước khi đóng phiên cũ.

### Bước 2.1 – Ghi lại thông tin ban đầu

Lưu ở nơi an toàn:

- IP public và IP private.
- Tài khoản ban đầu do nhà cung cấp cấp.
- Thông tin truy cập console/KVM của nhà cung cấp.
- DNS đang quản lý ở đâu.
- Dung lượng CPU, RAM, ổ đĩa.
- Snapshot hoặc backup ban đầu của nhà cung cấp.

Kiểm tra server:

```bash
cat /etc/os-release
uname -a
ip -br address
df -hT
free -h
ss -tulpn
```

Nếu được chọn lại hệ điều hành, nên dùng một bản Ubuntu Server LTS. Tài liệu này tương thích Ubuntu 24.04 LTS và 26.04 LTS.

### Bước 2.2 – Đặt hostname và múi giờ

```bash
sudo hostnamectl set-hostname web01-bvmsgtv
sudo timedatectl set-timezone Asia/Ho_Chi_Minh
hostnamectl
timedatectl
```

### Bước 2.3 – Cập nhật toàn bộ hệ thống

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt autoremove --purge -y
```

Kiểm tra có cần khởi động lại không:

```bash
if [ -f /var/run/reboot-required ]; then
  cat /var/run/reboot-required
fi
```

Nếu cần:

```bash
sudo reboot
```

### Bước 2.4 – Tạo tài khoản quản trị riêng

Không dùng `root` để làm việc hằng ngày.

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
```

Trên máy Windows của bạn, tạo SSH key bằng PowerShell:

```powershell
ssh-keygen -t ed25519 -a 64 -C "deploy-bvmsgtv"
```

Chép public key lên server. Cách đơn giản từ Windows PowerShell:

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh TAI_KHOAN_BAN_DAU@IP_SERVER "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

Nếu muốn dùng tài khoản `deploy`, trên server:

```bash
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudo nano /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Mở **một cửa sổ terminal mới** và kiểm tra:

```powershell
ssh deploy@IP_SERVER
```

Chỉ tiếp tục khi đăng nhập bằng key thành công.

### Bước 2.5 – Khóa SSH an toàn

Tạo file cấu hình riêng, không sửa trực tiếp toàn bộ file mặc định:

```bash
sudo nano /etc/ssh/sshd_config.d/99-bvmsgtv-hardening.conf
```

Nội dung:

```text
PermitRootLogin no
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowUsers deploy
```

Kiểm tra trước khi áp dụng:

```bash
sudo sshd -t
```

Nếu không có lỗi:

```bash
sudo systemctl reload ssh
```

Mở cửa sổ SSH mới để kiểm tra lại. Không đóng phiên cũ cho đến khi chắc chắn tài khoản `deploy` đăng nhập được.

> Không cần đổi port SSH chỉ để “ẩn” dịch vụ. Quan trọng hơn là SSH key, tắt root/password, firewall và cập nhật bảo mật.

### Bước 2.6 – Bật firewall UFW

Cho phép SSH **trước** khi bật firewall:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Production chỉ nên mở công khai:

- `22/tcp` hoặc port SSH thực tế.
- `80/tcp` cho HTTP và cấp chứng chỉ.
- `443/tcp` cho HTTPS.

Không mở trực tiếp port Vite, Node.js, database hoặc dashboard quản trị ra Internet.

### Bước 2.7 – Bật cập nhật bảo mật tự động

```bash
sudo apt install -y unattended-upgrades update-notifier-common
sudo dpkg-reconfigure -plow unattended-upgrades
```

Kiểm tra:

```bash
systemctl status unattended-upgrades --no-pager
systemctl list-timers --all | grep apt
sudo unattended-upgrade --dry-run --debug
```

Có thể xem log tại:

```bash
sudo less /var/log/unattended-upgrades/unattended-upgrades.log
```

Không nên tự động reboot giữa giờ làm việc. Nếu cần reboot tự động, đặt giờ bảo trì riêng và thông báo trước.

### Bước 2.8 – Cài công cụ vận hành cơ bản

```bash
sudo apt install -y \
  nginx \
  rsync \
  unzip \
  curl \
  ca-certificates \
  git \
  htop \
  jq \
  fail2ban
```

Bật Nginx và Fail2ban:

```bash
sudo systemctl enable --now nginx
sudo systemctl enable --now fail2ban
sudo systemctl status nginx --no-pager
sudo systemctl status fail2ban --no-pager
```

Cấu hình Fail2ban tối thiểu cho SSH:

```bash
sudo nano /etc/fail2ban/jail.d/sshd.local
```

```ini
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 1h
```

```bash
sudo systemctl restart fail2ban
sudo fail2ban-client status sshd
```

### Bước 2.9 – Kiểm tra dịch vụ không cần thiết

```bash
ss -tulpn
systemctl --type=service --state=running
systemctl --failed
```

Nếu thấy dịch vụ không sử dụng, tìm hiểu rõ trước khi tắt. Không chạy lệnh xóa hàng loạt dịch vụ trên server mới.

### Bước 2.10 – Thiết lập backup và snapshot

Ít nhất cần backup:

- `/etc/nginx/`
- `/var/www/`
- tài liệu cấu hình triển khai;
- source Git;
- cấu hình DNS;
- Supabase database/storage theo chính sách backup của Supabase;
- secrets của Edge Functions trong kho quản lý mật khẩu, không lưu trong source.

Trước mỗi thay đổi lớn, tạo snapshot ở nhà cung cấp VPS hoặc hypervisor.

## 3. Chuẩn bị tên miền cho nhiều website

Ví dụ:

```text
xe.matsaigontravinh.vn       → hệ thống điều phối xe
khammat.matsaigontravinh.vn  → website khám mắt
noibo.matsaigontravinh.vn    → ứng dụng nội bộ khác
```

Tạo bản ghi DNS:

```text
A     xe       IP_PUBLIC_SERVER
A     khammat  IP_PUBLIC_SERVER
A     noibo    IP_PUBLIC_SERVER
```

Nếu có IPv6 và đã cấu hình firewall IPv6 đúng, mới thêm bản ghi `AAAA`.

Mỗi website dùng một file Nginx riêng:

```text
/etc/nginx/sites-available/xe.matsaigontravinh.vn
/etc/nginx/sites-available/khammat.matsaigontravinh.vn
/etc/nginx/sites-available/noibo.matsaigontravinh.vn
```

Không dồn tất cả website vào một file cấu hình lớn.

## 4. Chuẩn bị source Điều phối xe

### Bước 4.1 – Giải nén source sạch

```bash
mkdir -p ~/apps
cd ~/apps
unzip BVMSGTV-Dieu-phoi-xe-v2.6.0-clean-source.zip
cd BVMSGTV-Dieu-phoi-xe-v2.6.0-clean
```

### Bước 4.2 – Tạo cấu hình production

```bash
cp .env.example .env.production
nano .env.production
```

Điền:

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=SUPABASE_ANON_OR_PUBLISHABLE_KEY
VITE_APP_NAME=Điều phối xe Bệnh viện mắt Sài Gòn Trà Vinh
VITE_COORDINATOR_PHONE=SO_DIEN_THOAI_DIEU_PHOI
VITE_PUBLIC_HTTPS_URL=https://xe.matsaigontravinh.vn
VITE_ODOMETER_GEMINI_VERIFY_ALL=false
```

### Quy tắc bảo mật rất quan trọng

- Các biến bắt đầu bằng `VITE_` được nhúng vào JavaScript phía trình duyệt và **không phải bí mật**.
- Chỉ dùng Supabase anon/publishable key ở frontend.
- Tuyệt đối không đưa `service_role`, `sb_secret_...`, Gemini API key hoặc private key TLS vào `.env.production` frontend.
- Gemini API key phải nằm trong Supabase Edge Function Secrets.
- Quyền dữ liệu phải được bảo vệ bằng Supabase RLS, không dựa vào việc giấu anon key.

### Bước 4.3 – Build ứng dụng

#### Phương án khuyến nghị: build trên máy phát triển/CI

Production server chỉ cần Nginx, không cần Node.js chạy thường trực.

```bash
npm ci
npm run verify
```

Lệnh `npm run verify` sẽ kiểm tra source, TypeScript và tạo thư mục `dist`.

#### Phương án build trực tiếp trên Ubuntu server

Ứng dụng yêu cầu Node.js `>=22.12.0`. Cài Node bằng công cụ quản lý phiên bản đáng tin cậy cho tài khoản `deploy`, sau đó:

```bash
cd ~/apps/BVMSGTV-Dieu-phoi-xe-v2.6.0-clean
npm ci
npm run verify
```

Không chạy `npm install` hoặc build bằng `root`.

## 5. Tạo cấu trúc deploy theo release

Ví dụ tên miền:

```bash
export DOMAIN=xe.matsaigontravinh.vn
sudo mkdir -p /var/www/$DOMAIN/releases
sudo chown -R deploy:www-data /var/www/$DOMAIN
sudo chmod -R 0755 /var/www/$DOMAIN
```

Deploy lần đầu bằng script đi kèm:

```bash
cd ~/apps/BVMSGTV-Dieu-phoi-xe-v2.6.0-clean
./deploy/ubuntu/deploy-static.sh "$DOMAIN" ./dist 5
```

Cấu trúc sau deploy:

```text
/var/www/xe.matsaigontravinh.vn/
├── current -> releases/20260805-151500
└── releases/
    └── 20260805-151500/
        ├── index.html
        ├── assets/
        ├── sw.js
        └── ...
```

## 6. Cấu hình Nginx cho website

Tạo file từ template:

```bash
cd ~/apps/BVMSGTV-Dieu-phoi-xe-v2.6.0-clean
sed "s/__DOMAIN__/$DOMAIN/g" deploy/ubuntu/nginx-site.conf.template \
  | sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null
```

Kích hoạt website:

```bash
sudo ln -s /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Kiểm tra HTTP:

```bash
curl -I http://$DOMAIN
curl -I http://$DOMAIN/tong-quan
```

Trang `/tong-quan`, `/dieu-xe`, `/chi-phi` phải trả về ứng dụng, không phải 404.

## 7. Cài HTTPS bằng Let’s Encrypt

Điều kiện:

- tên miền đã trỏ đúng về server;
- port 80 và 443 mở trên UFW và firewall nhà cung cấp;
- website HTTP đang truy cập được.

Cài Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Cấp chứng chỉ:

```bash
sudo certbot --nginx -d $DOMAIN
```

Chọn chuyển hướng toàn bộ HTTP sang HTTPS.

Kiểm tra gia hạn:

```bash
systemctl status certbot.timer --no-pager
sudo certbot renew --dry-run
```

Sau khi HTTPS hoạt động ổn định, có thể thêm HSTS vào **server block HTTPS**:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

Chỉ bật `includeSubDomains` khi chắc chắn toàn bộ subdomain đều dùng HTTPS.

### Trường hợp chỉ dùng IP nội bộ

Let’s Encrypt không cấp chứng chỉ trực tiếp cho IP LAN như `172.16.x.x`. Để GPS và Notification hoạt động ổn định trên mobile, nên dùng một tên miền HTTPS hợp lệ. Nếu hệ thống chỉ chạy nội bộ, dùng DNS nội bộ/split DNS và CA nội bộ được cài tin cậy trên điện thoại.

## 8. Deploy phiên bản mới và rollback

Build phiên bản mới:

```bash
npm ci
npm run verify
```

Deploy:

```bash
./deploy/ubuntu/deploy-static.sh "$DOMAIN" ./dist 5
sudo nginx -t
sudo systemctl reload nginx
```

Xem danh sách release:

```bash
ls -lah /var/www/$DOMAIN/releases
readlink -f /var/www/$DOMAIN/current
```

Rollback:

```bash
./deploy/ubuntu/rollback.sh "$DOMAIN" RELEASE_ID
sudo nginx -t
sudo systemctl reload nginx
```

## 9. Cách chạy nhiều loại website trên cùng server

### 9.1 Website tĩnh React/Vue/HTML

Mỗi site có:

- thư mục `/var/www/domain/current`;
- một server block Nginx;
- chứng chỉ riêng;
- log riêng.

### 9.2 Ứng dụng Node.js/Python/.NET động

Mỗi ứng dụng nên:

- có user Linux riêng hoặc ít nhất service riêng;
- chạy bằng systemd;
- chỉ bind `127.0.0.1:PORT`;
- Nginx reverse proxy từ domain đến port nội bộ;
- không mở port ứng dụng bằng UFW.

Ví dụ Nginx:

```nginx
server {
    listen 80;
    server_name api.example.vn;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 9.3 Database

Không cài database public trên cùng máy nếu chưa có nhu cầu rõ ràng. Nếu bắt buộc:

- bind localhost/private network;
- không mở port database ra Internet;
- dùng user riêng cho từng ứng dụng;
- backup và kiểm thử restore;
- mã hóa kết nối và mật khẩu mạnh.

## 10. Giám sát và bảo trì định kỳ

### Hằng ngày

```bash
systemctl --failed
sudo tail -n 100 /var/log/nginx/DOMAIN.error.log
sudo fail2ban-client status sshd
df -h
```

### Hằng tuần

```bash
sudo apt update
apt list --upgradable
sudo journalctl -p warning --since "7 days ago"
sudo nginx -t
```

### Hằng tháng

- kiểm thử restore backup;
- rà soát user SSH và sudo;
- rà soát DNS và chứng chỉ;
- xóa release cũ;
- kiểm tra Supabase RLS/Storage policies;
- kiểm tra tài khoản bị khóa hoặc không còn làm việc;
- cập nhật dependency ứng dụng trong môi trường test trước khi lên production.

Script kiểm tra chỉ đọc đi kèm:

```bash
./deploy/ubuntu/security-audit-readonly.sh
```

## 11. Checklist trước khi đưa vào sử dụng

- [ ] Đăng nhập SSH bằng key thành công.
- [ ] Root login và password login đã tắt.
- [ ] UFW chỉ mở SSH, HTTP, HTTPS.
- [ ] Cập nhật bảo mật tự động hoạt động.
- [ ] Nginx `nginx -t` không lỗi.
- [ ] HTTPS hợp lệ, Certbot dry-run thành công.
- [ ] `.env`, service-role key, Gemini key và TLS private key không nằm trong web root/source.
- [ ] `/tong-quan`, `/dieu-xe`, `/chi-phi` tải đúng khi mở trực tiếp.
- [ ] GPS và thông báo hoạt động trên điện thoại HTTPS.
- [ ] Supabase RLS đang bật và đã kiểm thử từng vai trò.
- [ ] Có snapshot/backup và đã biết cách rollback.

## 12. Nguồn tài liệu chính thức

- Ubuntu release cycle: https://ubuntu.com/about/release-cycle
- Ubuntu Server OpenSSH: https://ubuntu.com/server/docs/how-to/security/openssh-server/
- Ubuntu Server firewall/UFW: https://ubuntu.com/server/docs/how-to/security/firewalls/
- Ubuntu automatic updates: https://ubuntu.com/server/docs/how-to/software/automatic-updates/
- Ubuntu Nginx installation: https://ubuntu.com/server/docs/how-to/web-services/install-nginx/
- Ubuntu Nginx configuration: https://ubuntu.com/server/docs/how-to/web-services/configure-nginx/
- Nginx `try_files`: https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files
- Certbot Nginx instructions: https://certbot.eff.org/instructions
