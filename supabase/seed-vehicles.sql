-- Dữ liệu xe mẫu. Chỉ chạy khi muốn tạo dữ liệu thử trên Supabase thật.
insert into public.vehicles
(plate_number, vehicle_name, vehicle_type, seats, status, odometer, registration_expiry, insurance_expiry, next_maintenance_date, next_maintenance_odometer, fuel_norm_l_per_100km, notes)
values
('84A-123.45', 'Toyota Innova', 'Xe 7 chỗ', 7, 'available', 128450, current_date + 22, current_date + 46, current_date + 15, 130000, 9.2, 'Xe phục vụ đoàn khám cộng đồng'),
('84B-678.90', 'Ford Transit', 'Xe 16 chỗ', 16, 'maintenance', 201240, current_date + 120, current_date + 18, current_date, 201000, 12.5, 'Đang kiểm tra hệ thống điều hòa'),
('84A-456.78', 'Hyundai Accent', 'Xe 5 chỗ', 5, 'available', 76420, current_date + 210, current_date + 190, current_date + 60, 80000, 6.8, null)
on conflict (plate_number) do nothing;
