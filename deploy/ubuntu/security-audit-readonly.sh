#!/usr/bin/env bash
set -u

echo '=== Hệ điều hành ==='
cat /etc/os-release 2>/dev/null | grep -E '^(PRETTY_NAME|VERSION_ID)=' || true
uname -a

echo '=== Thời gian / đồng bộ ==='
timedatectl status 2>/dev/null || true

echo '=== Ổ đĩa / RAM ==='
df -hT /
free -h

echo '=== Dịch vụ đang lắng nghe ==='
ss -tulpn 2>/dev/null || true

echo '=== UFW ==='
sudo ufw status verbose 2>/dev/null || true

echo '=== SSH cấu hình hiệu lực ==='
sudo sshd -T 2>/dev/null | grep -E '^(permitrootlogin|passwordauthentication|pubkeyauthentication|maxauthtries|x11forwarding)' || true

echo '=== Dịch vụ lỗi ==='
systemctl --failed --no-pager || true

echo '=== Tự động cập nhật ==='
systemctl status unattended-upgrades --no-pager 2>/dev/null | sed -n '1,12p' || true
systemctl list-timers --all --no-pager 2>/dev/null | grep -E 'apt-daily|certbot' || true

echo '=== Nginx ==='
sudo nginx -t 2>/dev/null || true
systemctl status nginx --no-pager 2>/dev/null | sed -n '1,12p' || true
