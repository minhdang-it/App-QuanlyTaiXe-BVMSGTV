import { useEffect, useState } from 'react'
import { dateTimeToVietnamInput, dateToVietnamInput, vietnamDateTimeToLocalIso, vietnamDateToIso } from '../lib/utils'

type Props = {
  value: string
  onChange: (value: string) => void
  mode?: 'date' | 'datetime'
  required?: boolean
  disabled?: boolean
  className?: string
  min?: string
  max?: string
  showHint?: boolean
  'aria-label'?: string
}

function normalizeNativeValue(value: string, mode: 'date' | 'datetime') {
  if (!value) return ''
  if (mode === 'datetime') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
    return match ? `${match[1]}T${match[2]}` : ''
  }
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] ?? ''
}

function autoFormatVietnamDate(value: string, mode: 'date' | 'datetime') {
  const trimmed = value.trim()
  if (!trimmed) return ''

  // Hỗ trợ dán chuỗi ISO mà không làm đảo ngày/tháng.
  if (mode === 'datetime' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return dateTimeToVietnamInput(trimmed)
  }
  if (mode === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return dateToVietnamInput(trimmed)
  }

  const maxDigits = mode === 'datetime' ? 12 : 8
  const digits = trimmed.replace(/\D/g, '').slice(0, maxDigits)
  if (!digits) return ''

  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)
  let result = day
  if (digits.length > 2) result += `/${month}`
  if (digits.length > 4) result += `/${year}`

  if (mode === 'datetime' && digits.length > 8) {
    const hour = digits.slice(8, 10)
    const minute = digits.slice(10, 12)
    result += ` ${hour}`
    if (digits.length > 10) result += `:${minute}`
  }
  return result
}

export function VietnamDateInput({
  value,
  onChange,
  mode = 'date',
  required,
  disabled,
  className,
  min,
  max,
  showHint = false,
  ...rest
}: Props) {
  const format = mode === 'datetime' ? dateTimeToVietnamInput : dateToVietnamInput
  const parse = mode === 'datetime' ? vietnamDateTimeToLocalIso : vietnamDateToIso
  const [text, setText] = useState(() => format(value))

  useEffect(() => {
    const next = format(value)
    if (next !== text && parse(text) !== value) setText(next)
  }, [value])

  const nativeType = mode === 'datetime' ? 'datetime-local' : 'date'
  const nativeValue = normalizeNativeValue(value, mode)
  const nativeMin = normalizeNativeValue(min ?? '', mode)
  const nativeMax = normalizeNativeValue(max ?? '', mode)
  const placeholder = mode === 'datetime' ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY'

  return <div className={`vietnam-date-control ${className ?? ''}`}>
    <div className="vietnam-date-input-row">
      <input
        {...rest}
        className="vietnam-date-text-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        pattern={mode === 'datetime' ? '\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}' : '\\d{2}/\\d{2}/\\d{4}'}
        title={mode === 'datetime' ? 'Nhập DD/MM/YYYY HH:mm hoặc bấm biểu tượng lịch.' : 'Nhập DD/MM/YYYY hoặc bấm biểu tượng lịch.'}
        required={required}
        disabled={disabled}
        value={text}
        onChange={(event) => {
          const nextText = autoFormatVietnamDate(event.target.value, mode)
          setText(nextText)
          event.currentTarget.setCustomValidity('')
          if (!nextText.trim()) {
            onChange('')
            return
          }
          const parsed = parse(nextText)
          if (parsed) onChange(parsed)
        }}
        onBlur={(event) => {
          const parsed = parse(event.target.value)
          event.currentTarget.setCustomValidity(event.target.value.trim() && !parsed
            ? (mode === 'datetime' ? 'Vui lòng nhập đúng DD/MM/YYYY HH:mm.' : 'Vui lòng nhập đúng DD/MM/YYYY.')
            : '')
        }}
        onInput={(event) => event.currentTarget.setCustomValidity('')}
      />
      <span className="vietnam-native-picker-button">
        <span className="vietnam-calendar-icon" aria-hidden="true"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg></span>
        <input
          className="vietnam-native-picker-input"
          type={nativeType}
          value={nativeValue}
          min={nativeMin || undefined}
          max={nativeMax || undefined}
          disabled={disabled}
          tabIndex={-1}
          aria-label={mode === 'datetime' ? 'Chọn ngày và giờ trên lịch' : 'Chọn ngày trên lịch'}
          onChange={(event) => {
            const next = event.target.value
            onChange(next)
            setText(format(next))
          }}
        />
      </span>
    </div>
    {showHint && <small className="vietnam-date-hint">
      {mode === 'datetime'
        ? <>Bấm <b>lịch</b> hoặc gõ liền 12 số, ví dụ <b>120820261430</b> → 12/08/2026 14:30.</>
        : <>Bấm <b>lịch</b> hoặc gõ liền 8 số, ví dụ <b>12082026</b> → 12/08/2026.</>}
    </small>}
  </div>
}
