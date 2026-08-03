interface BrandLogoProps {
  className?: string
  compact?: boolean
}

export function BrandLogo({ className = '', compact = false }: BrandLogoProps) {
  return (
    <div className={`brand-identity ${compact ? 'compact' : ''} ${className}`.trim()}>
      <img
        className="brand-logo-image"
        src="./logo-bvmsgtv.png"
        alt="Logo Bệnh viện mắt Sài Gòn Trà Vinh"
      />
      <div className="brand-title-copy">
        <strong>Điều phối xe</strong>
        <span>Bệnh viện mắt Sài Gòn Trà Vinh</span>
      </div>
    </div>
  )
}
