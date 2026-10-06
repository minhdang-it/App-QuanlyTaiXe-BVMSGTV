# v2.10.2 – Navicom Ready + Driver Minimal Flow

- Bỏ GPS điện thoại tài xế.
- Bỏ Google Maps trên toàn giao diện tài xế.
- Bỏ checklist bắt buộc trước chuyến.
- Không yêu cầu chụp tổng quan xe.
- Flow tài xế: Nhận chuyến → KM đầu → Bắt đầu → KM cuối → Kết thúc.
- Gửi chi phí/Báo sự cố chỉ là thao tác phát sinh.
- Bổ sung Navicom Gateway chạy tách khỏi frontend.
- Bổ sung Camera/GPS Navicom trong Tổng quan và Chi tiết chuyến.
- Chỉ BGĐ/Hành chính/Điều phối/Quản trị có quyền xem Navicom.
- Bổ sung trường Navicom vào Hồ sơ xe.
- Bổ sung migration Supabase v2.10.2.
- Bổ sung chế độ mock để test local trước khi map API Navicom thật.
