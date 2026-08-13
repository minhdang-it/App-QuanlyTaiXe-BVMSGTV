# Hotfix build v2.7.12

Sửa lỗi TypeScript trong `src/lib/backend.ts` khi tạo chuyến từ đề nghị đã được Hành chính duyệt.

## Lỗi cũ
`approvedRequest = requestData as typeof approvedRequest`

Do TypeScript control-flow đã thu hẹp `approvedRequest` về `null` tại vị trí cast, các truy cập
`plan_attachments`, `plan_document_url`, `fleet_reviewer_id`, `fleet_reviewed_at` bị suy luận thành `never`.

## Sửa
Tách kiểu dữ liệu thành `ApprovedVehicleRequest` và cast trực tiếp:
`approvedRequest = requestData as ApprovedVehicleRequest`.

Không thay đổi database, SQL migration, Edge Function hay nghiệp vụ.
