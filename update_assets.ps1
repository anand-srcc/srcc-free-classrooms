Add-Type -AssemblyName System.Drawing

$centenarySrc = "C:\Users\anand_fua08yg\.gemini\antigravity-ide\scratch\srcc_timetable_scraper\centenary_official.png"
$crestSrc = "C:\Users\anand_fua08yg\.gemini\antigravity-ide\scratch\srcc_timetable_scraper\srcc_crest_official.png"

$assetsDir = "C:\Users\anand_fua08yg\.gemini\antigravity-ide\scratch\srcc_timetable_scraper\web_app\assets"
$webAppDir = "C:\Users\anand_fua08yg\.gemini\antigravity-ide\scratch\srcc_timetable_scraper\web_app"

# Helper function to resize with high quality bicubic interpolation
function Resize-Image($srcPath, $dstPath, $targetWidth, $targetHeight) {
    $srcImg = [System.Drawing.Bitmap]::FromFile($srcPath)
    $dstImg = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dstImg)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($srcImg, 0, 0, $targetWidth, $targetHeight)
    $dstImg.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $dstImg.Dispose()
    $srcImg.Dispose()
    Write-Output "Saved $dstPath ($targetWidth x $targetHeight)"
}

# 1. Save 100 Years Logo (512x512)
Resize-Image $centenarySrc "$assetsDir\srcc_100years.png" 512 512

# 2. Save Favicon (64x64 and 32x32)
Resize-Image $centenarySrc "$webAppDir\favicon.png" 64 64
Resize-Image $centenarySrc "$webAppDir\favicon.ico" 64 64

# 3. Save Crest Logo with matched square bounding box (512x512 with crest centered so heights match)
$crestRaw = [System.Drawing.Bitmap]::FromFile($crestSrc)
# Crest is 310w x 324h. Let's place it into a square 512x512 canvas centered with transparent background!
$crestSquare = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g2 = [System.Drawing.Graphics]::FromImage($crestSquare)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g2.Clear([System.Drawing.Color]::Transparent)

# Calculate centered dimensions preserving aspect ratio (height 512, width 512 * 310 / 324 = 490)
$targetH = 500
$targetW = [int](500.0 * $crestRaw.Width / $crestRaw.Height)
$posX = [int]((512 - $targetW) / 2)
$posY = [int]((512 - $targetH) / 2)

$g2.DrawImage($crestRaw, $posX, $posY, $targetW, $targetH)
$crestSquare.Save("$assetsDir\srcc_crest.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose()
$crestSquare.Dispose()
$crestRaw.Dispose()
Write-Output "Saved $assetsDir\srcc_crest.png (512x512 centered)"
