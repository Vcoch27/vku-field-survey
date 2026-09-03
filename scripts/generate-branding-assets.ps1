# ==============================================================================
# Script: generate-branding-assets.ps1
# Generates all PWA and Android Launcher icons from the official VKU logo
# Uses native Windows System.Drawing with HighQualityBicubic interpolation
# ==============================================================================

param(
    [string]$SourceLogo = "src\assets\branding\vku-field-survey-logo.png"
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $SourceLogo)) {
    Write-Error "Source logo not found at: $SourceLogo"
    exit 1
}

$srcImg = [System.Drawing.Image]::FromFile((Resolve-Path $SourceLogo).Path)
Write-Host "Loaded source logo: $($srcImg.Width) x $($srcImg.Height)"

function Generate-Icon {
    param(
        [int]$TargetWidth,
        [int]$TargetHeight,
        [string]$OutputPath,
        [double]$PaddingFraction = 0.12, # padding around logo
        [switch]$CircleCrop,
        [string]$BackgroundColor = $null # e.g. "#FFFFFF" or null for transparent
    )

    $outDir = Split-Path -Parent $OutputPath
    if (-not (Test-Path $outDir)) {
        New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    }

    $destBmp = New-Object System.Drawing.Bitmap($TargetWidth, $TargetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)

    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($BackgroundColor) {
        $color = [System.Drawing.ColorTranslator]::FromHtml($BackgroundColor)
        if ($CircleCrop) {
            $brush = New-Object System.Drawing.SolidBrush($color)
            $g.FillEllipse($brush, 0, 0, $TargetWidth, $TargetHeight)
            $brush.Dispose()
        } else {
            $g.Clear($color)
        }
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    # Calculate aspect-ratio-preserving dimensions with padding
    $availW = $TargetWidth * (1.0 - 2.0 * $PaddingFraction)
    $availH = $TargetHeight * (1.0 - 2.0 * $PaddingFraction)

    $scale = [Math]::Min($availW / $srcImg.Width, $availH / $srcImg.Height)
    $drawW = [int]($srcImg.Width * $scale)
    $drawH = [int]($srcImg.Height * $scale)
    $destX = [int](($TargetWidth - $drawW) / 2.0)
    $destY = [int](($TargetHeight - $drawH) / 2.0)

    $g.DrawImage($srcImg, $destX, $destY, $drawW, $drawH)
    $g.Dispose()

    $destBmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()

    Write-Host "Generated: $OutputPath ($TargetWidth x $TargetHeight)"
}

# 1. PWA Assets
Generate-Icon -TargetWidth 192 -TargetHeight 192 -OutputPath "public\pwa-192x192.png" -PaddingFraction 0.10
Generate-Icon -TargetWidth 512 -TargetHeight 512 -OutputPath "public\pwa-512x512.png" -PaddingFraction 0.10
Generate-Icon -TargetWidth 64 -TargetHeight 64 -OutputPath "public\favicon.png" -PaddingFraction 0.05
Generate-Icon -TargetWidth 180 -TargetHeight 180 -OutputPath "public\apple-touch-icon.png" -PaddingFraction 0.10

# 2. Android Mipmap Launcher Icons
$androidDensities = @(
    @{ Name = "mipmap-mdpi"; Size = 48; ForeSize = 108 },
    @{ Name = "mipmap-hdpi"; Size = 72; ForeSize = 162 },
    @{ Name = "mipmap-xhdpi"; Size = 96; ForeSize = 216 },
    @{ Name = "mipmap-xxhdpi"; Size = 144; ForeSize = 324 },
    @{ Name = "mipmap-xxxhdpi"; Size = 192; ForeSize = 432 }
)

$androidRes = "android\app\src\main\res"

foreach ($d in $androidDensities) {
    $dir = Join-Path $androidRes $d.Name
    $size = $d.Size
    $foreSize = $d.ForeSize

    # Standard launcher icon (with white rounded background for crispness)
    Generate-Icon -TargetWidth $size -TargetHeight $size -OutputPath (Join-Path $dir "ic_launcher.png") -PaddingFraction 0.12 -BackgroundColor "#FFFFFF"

    # Round launcher icon
    Generate-Icon -TargetWidth $size -TargetHeight $size -OutputPath (Join-Path $dir "ic_launcher_round.png") -PaddingFraction 0.14 -CircleCrop -BackgroundColor "#FFFFFF"

    # Adaptive icon foreground (transparent background, 28% padding according to Android adaptive icon spec)
    Generate-Icon -TargetWidth $foreSize -TargetHeight $foreSize -OutputPath (Join-Path $dir "ic_launcher_foreground.png") -PaddingFraction 0.26
}

$srcImg.Dispose()
Write-Host "Branding and Launcher asset generation completed successfully."
