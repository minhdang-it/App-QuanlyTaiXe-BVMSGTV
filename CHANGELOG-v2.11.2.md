# v2.11.2 – Ổn định thông báo Navicom + tăng cỡ chữ

- Chặn thông báo “xe vừa online” lặp liên tục khi GPS chuyển qua lại giữa trạng thái cập nhật chậm và cập nhật mới.
- Chỉ phát “vừa online” khi xe thật sự chuyển từ `offline` sang trạng thái online.
- Thêm cooldown theo từng xe và từng loại sự kiện để chống spam khi tín hiệu Navicom chập chờn.
- Chặn các lượt polling Navicom chạy chồng nhau.
- Tăng cỡ chữ toast và Trung tâm thông báo, đặc biệt trên mobile.
- Toast hiển thị 8,5 giây để có đủ thời gian đọc.
- Bao gồm toàn bộ sửa lỗi v2.11.1: Hành chính duyệt chuyến, lỗi `[object Object]`, migration đồng bộ workflow hiện hành.
