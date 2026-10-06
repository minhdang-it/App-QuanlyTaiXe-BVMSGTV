BVMSGTV v2.10.8.1 - Navicom picker build fix

Chép file src/pages/VehiclesPage.tsx đè lên source v2.10.8 hiện tại.
Sau đó chạy:
  npm.cmd run verify:source
  npm.cmd run check
  npm.cmd run build

Sửa 2 lỗi:
- TS2304 Cannot find name 'result'
- TS7006 Parameter 'item' implicitly has an 'any' type

Không cần SQL. Không cần cập nhật Navicom Gateway.
