# CHANGELOG v2.11.14

- Tách camera khỏi trạng thái GPS stale/offline trong trang Theo dõi xe realtime.
- Giải quyết hiện tượng "GPS chậm cập nhật" nhưng camera bị kết luận "Xe đang offline".
- Mỗi kênh camera có nút thử phát khi chưa xác minh và có URL hợp lệ.
- Không tự nhúng iframe Navicom lúc gateway lỗi, kênh báo offline hoặc chưa kiểm tra được stream.
- Giữ phóng to ngang và bố cục responsive, không sửa SQL, GPS realtime, hệ thống thông báo.
