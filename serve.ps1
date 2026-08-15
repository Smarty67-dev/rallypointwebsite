$root = (Get-Location).Path
$prefix = "http://localhost:8000/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Error "Failed to start listener on $prefix - try a different port or run as admin."
  exit 1
}
Write-Output "Serving $root on $prefix. Press Ctrl+C to stop."
while ($listener.IsListening) {
  $context = $listener.GetContext()
  $rawUrl = $context.Request.Url.AbsolutePath
  $relPath = $rawUrl.TrimStart('/')
  if ($relPath -eq '') { $relPath = 'index.html' }
  $filePath = Join-Path $root $relPath
  if (Test-Path $filePath) {
    try {
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes,0,$bytes.Length)
    } catch {
      $context.Response.StatusCode = 500
      $err = [System.Text.Encoding]::UTF8.GetBytes("Server error")
      $context.Response.OutputStream.Write($err,0,$err.Length)
    }
  } else {
    $context.Response.StatusCode = 404
    $msg = "404 Not Found"
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($msg)
    $context.Response.ContentLength64 = $buffer.Length
    $context.Response.OutputStream.Write($buffer,0,$buffer.Length)
  }
  $context.Response.OutputStream.Close()
}
