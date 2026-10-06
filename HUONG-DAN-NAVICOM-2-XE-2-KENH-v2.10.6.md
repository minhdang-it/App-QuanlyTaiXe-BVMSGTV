# Navicom – tài khoản 2 xe, mỗi xe 2 kênh

## Cấu hình server
```env
NAVICOM_MODE=cmsv6
NAVICOM_CMSV6_CHANNELS=2
NAVICOM_CMSV6_VEHICLE_ACTIONS=StandardApiAction_queryUserVehicle.action,StandardApiAction_getUserVehicle.action
```

## Kiểm tra tài khoản
```bash
NODE_BIN="$(command -v node)"
sudo "$NODE_BIN" --env-file=/etc/bvmsgtv/navicom-gateway.env /var/www/navicom-gateway/test-cmsv6.mjs
```
Kết quả mong đợi: `count: 2` và mỗi phần tử có `device_id`.

## Liên kết trong app
Hồ sơ xe → Chỉnh sửa → Tích hợp Navicom → “Lấy 2 xe từ tài khoản Navicom” → chọn đúng xe → Lưu.
Mỗi xe tự lưu `navicom_channel_count = 2`.

## Trạng thái camera
GPS và video là hai trạng thái khác nhau. Nếu GPS có tọa độ nhưng CMSV6 player báo `The Device Isn't Online!`, GPS vẫn được giữ để theo dõi; camera chỉ xem được khi thiết bị video thực sự online.
