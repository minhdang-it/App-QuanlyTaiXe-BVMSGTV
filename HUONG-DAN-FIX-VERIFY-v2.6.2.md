# Sửa lỗi `verify:source` – BVMSGTV v2.6.2

## Nguyên nhân

Project hiện tại là project cũ được cập nhật chồng patch v2.6.2 nên vẫn còn các file legacy/demo mà bản clean source đã yêu cầu loại bỏ:

- `create-website-user.mjs`: script tạo user cũ, từng chứa dữ liệu tài khoản/mật khẩu hard-code.
- `src/lib/demoData.ts`: dữ liệu demo và mật khẩu demo, không còn được runtime production sử dụng.
- Các hằng `*_DEMO_PHONE` trong `src/lib/constants.ts`: không còn được tham chiếu sau khi xóa demoData.

`npm run verify:source` đang hoạt động đúng khi chặn các file này. **Không nên sửa verifier để bỏ qua cảnh báo bí mật.**

## Cách áp dụng

1. Giải nén patch.
2. Chép 3 file của patch vào **thư mục gốc project**, nơi có `package.json`, `src`, `scripts`.
3. Chạy:

```bat
APPLY-FIX-VERIFY-v2.6.2.bat
```

Hoặc PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\APPLY-FIX-VERIFY-v2.6.2.ps1
```

## Kiểm tra sau khi sửa

Từ thư mục gốc project:

```bat
npm run verify:source
npm run check
npm run build
```

Kết quả verify đúng sẽ có dạng:

```text
Điều phối xe BVMSGTV source verification: OK (37 tệp TypeScript)
```

## Lưu ý

Nên chạy các lệnh npm tại thư mục gốc project, không phải trong `src`:

```text
D:\Website\Taixe\App Quản lý xe cho tài xế BVMSGTV>
```

Không cần chạy SQL migration cho lỗi này.
