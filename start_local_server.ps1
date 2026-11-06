# Pure PowerShell Native HTTP Server for SRCC Free Classroom Finder
param([int]$port = 3000)

$rootDir = "C:\Users\anand\.gemini\antigravity\scratch\srcc-free-classrooms\web_app"
$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Output "=========================================================="
    Write-Output "SRCC Free Classroom Finder Localhost Server Running!"
    Write-Output "URL: $prefix"
    Write-Output "Root Directory: $rootDir"
    Write-Output "Press Ctrl+C to stop the server"
    Write-Output "=========================================================="
    
    # Try opening default browser
    Start-Process $prefix
} catch {
    Write-Output "Error starting HttpListener on port $port : $($_.Exception.Message)"
    # Try fallback port 8080 if 3000 is occupied
    if ($port -eq 3000) {
        $port = 8080
        $prefix = "http://localhost:$port/"
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add($prefix)
        $listener.Start()
        Write-Output "Started on fallback URL: $prefix"
        Start-Process $prefix
    }
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".pdf"  = "application/pdf"
    ".csv"  = "text/csv; charset=utf-8"
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response

    $urlPath = $req.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($urlPath)) {
        $urlPath = "index.html"
    }

    $filePath = Join-Path $rootDir $urlPath

    # Also handle if requested with /web_app/ prefix
    if (-not (Test-Path $filePath) -and $urlPath.StartsWith("web_app/")) {
        $sub = $urlPath.Substring(8)
        $filePath = Join-Path $rootDir $sub
    }

    if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $contentType = $mimeTypes[$ext]
        if (-not $contentType) { $contentType = "application/octet-stream" }
        $res.ContentType = $contentType

        # Cache control for local dev
        $res.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")

        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $res.StatusCode = 404
        $notFoundMsg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
        $res.OutputStream.Write($notFoundMsg, 0, $notFoundMsg.Length)
    }
    $res.OutputStream.Close()
}
