# v2.10.8.1 — Navicom picker build fix

- Khôi phục lời gọi `fetchNavicomAccountVehicles()` bị thiếu trong `VehiclesPage.tsx`.
- Khai báo rõ `NavicomAccountVehicle[]` để TypeScript suy luận đúng kiểu cho callback `find`.
- Không thay đổi database, Gateway hay flow nghiệp vụ.
