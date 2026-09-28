Add-Type -AssemblyName System.Drawing

$img1Path = "C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\cc9a2567-d3f5-4998-95fa-eee43b11134f\.user_uploaded\media_1788668269231.png"
$img2Path = "C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\cc9a2567-d3f5-4998-95fa-eee43b11134f\.user_uploaded\media_1788668280082.png"

$bmp1 = New-Object System.Drawing.Bitmap($img1Path)
$bmp2 = New-Object System.Drawing.Bitmap($img2Path)

Write-Output "Image 1 (100 Years) Size: $($bmp1.Width) x $($bmp1.Height)"
Write-Output "Image 2 (Crest) Size: $($bmp2.Width) x $($bmp2.Height)"

# Inspect bounds of Image 1 (circle)
$minX1 = $bmp1.Width; $maxX1 = 0; $minY1 = $bmp1.Height; $maxY1 = 0
for ($y = 0; $y -lt $bmp1.Height; $y++) {
    for ($x = 0; $x -lt $bmp1.Width; $x++) {
        $c = $bmp1.GetPixel($x, $y)
        # Check if not pure white
        if ($c.R -lt 245 -or $c.G -lt 245 -or $c.B -lt 245) {
            if ($x -lt $minX1) { $minX1 = $x }
            if ($x -gt $maxX1) { $maxX1 = $x }
            if ($y -lt $minY1) { $minY1 = $y }
            if ($y -gt $maxY1) { $maxY1 = $y }
        }
    }
}
Write-Output "Img1 bounds: minX=$minX1, maxX=$maxX1, minY=$minY1, maxY=$maxY1, W=$($maxX1-$minX1), H=$($maxY1-$minY1)"

# Inspect bounds of Image 2 (Crest)
$minX2 = $bmp2.Width; $maxX2 = 0; $minY2 = $bmp2.Height; $maxY2 = 0
for ($y = 0; $y -lt $bmp2.Height; $y++) {
    for ($x = 0; $x -lt $bmp2.Width; $x++) {
        $c = $bmp2.GetPixel($x, $y)
        if ($c.A -gt 10 -and ($c.R -lt 245 -or $c.G -lt 245 -or $c.B -lt 245)) {
            if ($x -lt $minX2) { $minX2 = $x }
            if ($x -gt $maxX2) { $maxX2 = $x }
            if ($y -lt $minY2) { $minY2 = $y }
            if ($y -gt $maxY2) { $maxY2 = $y }
        }
    }
}
Write-Output "Img2 bounds: minX=$minX2, maxX=$maxX2, minY=$minY2, maxY=$maxY2, W=$($maxX2-$minX2), H=$($maxY2-$minY2)"

$bmp1.Dispose()
$bmp2.Dispose()
