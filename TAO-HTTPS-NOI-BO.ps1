Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDir = [System.IO.Path]::GetFullPath($PSScriptRoot)
$CertDir = Join-Path $RootDir '.certs'
$CertFile = Join-Path $CertDir 'msg-car-cert.pem'
$KeyFile = Join-Path $CertDir 'msg-car-key.pem'
$CaFile = Join-Path $CertDir 'CA-GOC-MKCERT.crt'

function Write-Step([string]$Message) { Write-Host "[MSG-CAR] $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "[CANH BAO] $Message" -ForegroundColor Yellow }

try {
    $mkcert = Get-Command mkcert.exe -ErrorAction SilentlyContinue
    if ($null -eq $mkcert) { $mkcert = Get-Command mkcert -ErrorAction SilentlyContinue }
    if ($null -eq $mkcert) {
        Write-Host ''
        Write-Host '[LOI] Chua tim thay mkcert.' -ForegroundColor Red
        Write-Host 'Hay cai mkcert tren Windows, mo lai PowerShell bang quyen Administrator, sau do chay lai file nay.' -ForegroundColor Yellow
        Write-Host 'Co the tim "mkcert Windows" tren trang GitHub chinh thuc cua FiloSottile.' -ForegroundColor Yellow
        Write-Host ''
        pause
        exit 1
    }

    if (-not (Test-Path -LiteralPath $CertDir)) {
        New-Item -ItemType Directory -Path $CertDir -Force | Out-Null
    }

    Write-Step 'Dang cai CA tin cay cua mkcert tren may chu...'
    & $mkcert.Source -install
    if ($LASTEXITCODE -ne 0) { throw 'mkcert -install that bai.' }

    $addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
        Where-Object {
            $_.IPAddress -ne '127.0.0.1' -and
            $_.IPAddress -notlike '169.254.*' -and
            $_.AddressState -eq 'Preferred'
        } |
        Select-Object -ExpandProperty IPAddress -Unique

    $names = New-Object System.Collections.Generic.List[string]
    @('localhost', '127.0.0.1', '::1', $env:COMPUTERNAME) | ForEach-Object {
        if ($_ -and -not $names.Contains($_)) { $names.Add($_) }
    }
    foreach ($address in $addresses) {
        if (-not $names.Contains($address)) { $names.Add($address) }
    }

    Write-Step "Dang tao chung chi cho: $($names -join ', ')"
    $arguments = @('-cert-file', $CertFile, '-key-file', $KeyFile) + $names.ToArray()
    & $mkcert.Source @arguments
    if ($LASTEXITCODE -ne 0) { throw 'Khong tao duoc chung chi HTTPS.' }

    $caRoot = (& $mkcert.Source -CAROOT).Trim()
    $sourceCa = Join-Path $caRoot 'rootCA.pem'
    if (Test-Path -LiteralPath $sourceCa) {
        Copy-Item -LiteralPath $sourceCa -Destination $CaFile -Force
        Write-Ok "Da sao chep CA cho dien thoai: $CaFile"
    } else {
        Write-Warn 'Khong tim thay rootCA.pem de sao chep cho dien thoai.'
    }

    try {
        foreach ($port in @(8080, 8443)) {
            $ruleName = "MSG Car Web TCP $port"
            $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
            if ($null -eq $existingRule) {
                New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -Profile Private | Out-Null
            }
        }
        Write-Ok 'Da mo Windows Firewall cho cong 8080 va 8443 trong mang Private.'
    } catch {
        Write-Warn 'Khong tu mo duoc Firewall. Hay cho phep TCP 8080 va 8443 thu cong.'
    }

    Write-Host ''
    Write-Ok 'Da tao HTTPS noi bo.'
    foreach ($address in $addresses) {
        Write-Ok "Dien thoai mo: https://$address`:8443"
    }
    Write-Host ''
    Write-Warn 'BAT BUOC tren dien thoai: chep file CA-GOC-MKCERT.crt sang dien thoai va cai vao Chung chi CA nguoi dung.'
    Write-Warn 'Sau khi cai CA, dong trinh duyet/PWA cu, mo lai dia chi HTTPS va cap quyen Vi tri + Thong bao.'
    Write-Host ''

    $restart = Join-Path $RootDir 'service\service-manager.ps1'
    if (Test-Path -LiteralPath $restart) {
        Write-Step 'Dang build va khoi dong lai website...'
        & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $restart -Action Restart -Build
        exit $LASTEXITCODE
    }
}
catch {
    Write-Host ''
    Write-Host "[LOI] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ''
    pause
    exit 1
}
