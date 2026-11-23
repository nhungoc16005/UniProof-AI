$ErrorActionPreference = 'Stop'
$outputsRoot = (Resolve-Path -LiteralPath 'outputs').Path.TrimEnd('\')
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $outputsRoot 'archive/cleanup-manifest.json') | ConvertFrom-Json
if (-not $manifest.archive_verified) { throw 'Archive is not verified' }
# Resolve and hash-check every exact target before removing anything.
$targets = foreach ($item in $manifest.files) {
    $candidate = [IO.Path]::GetFullPath((Join-Path $outputsRoot $item.relative))
    if (-not $candidate.StartsWith($outputsRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Outside outputs: $candidate" }
    $resolved = (Resolve-Path -LiteralPath $candidate).Path
    if (-not $resolved.StartsWith($outputsRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Outside outputs: $resolved" }
    if ((Get-Item -LiteralPath $resolved).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Link target: $resolved" }
    if ((Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256) { throw "Changed since archive: $resolved" }
    $resolved
}
foreach ($target in $targets) { Remove-Item -LiteralPath $target -Force }
$oldFolders = @('tracker-20261027','review-20261102','supplement-20261102','recheck-38-20261102','synthetic-preview-20261101','synthetic-preview-incomplete-20261101')
foreach ($folder in $oldFolders) {
    $folderPath = [IO.Path]::GetFullPath((Join-Path $outputsRoot $folder))
    if (-not $folderPath.StartsWith($outputsRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe directory' }
    if (Test-Path -LiteralPath $folderPath) {
        $dirs = @(Get-ChildItem -LiteralPath $folderPath -Directory -Recurse | Where-Object {$_.FullName -notmatch '[\\/]node_modules([\\/]|$)'} | Sort-Object {$_.FullName.Length} -Descending)
        foreach ($dir in $dirs) { if (-not (Get-ChildItem -Force -LiteralPath $dir.FullName | Select-Object -First 1)) { Remove-Item -LiteralPath $dir.FullName } }
        if (-not (Get-ChildItem -Force -LiteralPath $folderPath | Select-Object -First 1)) { Remove-Item -LiteralPath $folderPath }
    }
}
Write-Output "Removed $($targets.Count) verified archived files from outputs."
