# CHANGELOG v2.10.6 – Navicom 2 xe / 2 kênh

- Chuẩn hóa tài khoản Navicom hiện tại: 2 xe, mỗi xe 2 kênh camera.
- Thêm API gateway `GET /vehicles` để lấy danh sách xe của tài khoản CMSV6.
- Gateway thử `StandardApiAction_queryUserVehicle.action`, fallback `StandardApiAction_getUserVehicle.action`.
- Hồ sơ xe có nút “Lấy 2 xe từ tài khoản Navicom” để chọn đúng Device ID thay vì nhập tay.
- Mỗi xe cố định 2 kênh: Camera trước + Camera cabin.
- Tách trạng thái GPS và trạng thái video: GPS có thể còn dữ liệu trong khi player báo thiết bị video offline.
- Không thay đổi database.
