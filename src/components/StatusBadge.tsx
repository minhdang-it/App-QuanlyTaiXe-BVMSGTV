const labels: Record<string, string> = {
  pending_fleet: 'Chờ Hành chính', pending_director: 'Chờ Ban Giám đốc', assigned: 'Đã giao', accepted: 'Đã nhận', ready: 'Sẵn sàng', active: 'Đang chạy', completed: 'Hoàn thành', cancelled: 'Đã hủy',
  available: 'Đang trống', in_use: 'Đang chạy', maintenance: 'Đang sửa', out_of_service: 'Ngừng dùng',
  pending_accountant: 'Chờ Kế toán', approved: 'Đã duyệt chi', rejected: 'Từ chối', paid: 'Đã chi trả',
  fleet_approved: 'Hành chính đã duyệt', converted: 'Đã tạo chuyến', reported: 'Đã được BGĐ duyệt', handling: 'Đang xử lý', resolved: 'Đã xử lý',
  scheduled: 'Đã lên lịch', in_progress: 'Đang thực hiện',
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status}`}>{labels[status] ?? status}</span>
}
