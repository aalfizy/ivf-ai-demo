# Convert a dark-background JPEG (Zorrya logo) into a transparent PNG by
# mapping pixel luminance to alpha. Black -> transparent, bright -> opaque.
# Antialiased edges fade smoothly because alpha tracks luminance.
param(
  [Parameter(Mandatory = $true)] [string]$InputPath,
  [Parameter(Mandatory = $true)] [string]$OutputPath,
  [int]$LowThreshold = 14,     # luminance below this -> fully transparent
  [int]$HighThreshold = 90     # luminance at/above this -> fully opaque
)

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $InputPath))
$w = $src.Width
$h = $src.Height
Write-Host "Source size: ${w}x${h}"

# Convert source to 32bpp ARGB working bitmap so we can write alpha directly.
$work = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($work)
$g.DrawImage($src, 0, 0, $w, $h)
$g.Dispose()
$src.Dispose()

# Lock pixels for fast pointer-based access (BGRA order in memory).
$rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
$data = $work.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ptr = $data.Scan0
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($ptr, $bytes, 0, $bytes.Length)

$range = [double]($HighThreshold - $LowThreshold)
for ($y = 0; $y -lt $h; $y++) {
  $row = $y * $stride
  for ($x = 0; $x -lt $w; $x++) {
    $i = $row + $x * 4
    $b = $bytes[$i]
    $gByte = $bytes[$i + 1]
    $r = $bytes[$i + 2]
    # ITU-R BT.601 luma
    $lum = 0.299 * $r + 0.587 * $gByte + 0.114 * $b
    if ($lum -le $LowThreshold) {
      $alpha = 0
    } elseif ($lum -ge $HighThreshold) {
      $alpha = 255
    } else {
      $alpha = [int][Math]::Round((($lum - $LowThreshold) / $range) * 255.0)
    }
    $bytes[$i + 3] = [byte]$alpha
  }
}

[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
$work.UnlockBits($data)

# Save as PNG (preserves alpha).
$work.Save((Join-Path (Get-Location) $OutputPath), [System.Drawing.Imaging.ImageFormat]::Png)
$work.Dispose()
Write-Host "Wrote: $OutputPath"
