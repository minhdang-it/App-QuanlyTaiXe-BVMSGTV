BVMSGTV v2.7.12 - SQL HOTFIX

Lỗi cũ:
protect_vehicle_request_update() chặn bước backfill plan_attachments khi chạy từ Supabase SQL Editor.

Cách dùng:
1. Không cần chạy lại file SQL cũ.
2. Mở supabase/migrate-v2.7.12-multiple-plan-attachments.sql trong gói này.
3. Copy toàn bộ vào Supabase > SQL Editor > New Query.
4. Run.

File đã tạm disable USER TRIGGER trên vehicle_requests và trips chỉ trong transaction migration,
sau đó enable lại trước khi commit.
