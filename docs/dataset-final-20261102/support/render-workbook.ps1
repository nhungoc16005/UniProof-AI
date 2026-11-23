param([string]$Directory)
Add-Type -AssemblyName System.Drawing
$pages=Get-Content -Raw -Encoding utf8 (Join-Path $Directory 'pages.json') | ConvertFrom-Json
$font=[Drawing.Font]::new('Segoe UI',11)
$bold=[Drawing.Font]::new('Segoe UI',11,[Drawing.FontStyle]::Bold)
foreach($p in $pages){
 $width=[int](40+($p.widths|Measure-Object -Sum).Sum);$height=50+($p.rows.Count*155)
 $bmp=[Drawing.Bitmap]::new($width,$height);$g=[Drawing.Graphics]::FromImage($bmp);$g.Clear([Drawing.Color]::White)
 $g.TextRenderingHint=[Drawing.Text.TextRenderingHint]::AntiAliasGridFit
 $g.DrawString($p.name+' - selected cells',$bold,[Drawing.Brushes]::Black,20,10)
 $y=45
 foreach($row in $p.rows){$x=20;for($c=0;$c -lt $p.widths.Count;$c++){
   $cell=$row[$c];$w=[int]$p.widths[$c]
   $fill=if($cell.fill){[Drawing.ColorTranslator]::FromHtml('#'+$cell.fill.Substring($cell.fill.Length-6))}else{[Drawing.Color]::White}
   $color=if($cell.color){[Drawing.ColorTranslator]::FromHtml('#'+$cell.color.Substring($cell.color.Length-6))}else{[Drawing.Color]::FromArgb(30,41,59)}
   $brush=[Drawing.SolidBrush]::new($fill);$ink=[Drawing.SolidBrush]::new($color)
   $g.FillRectangle($brush,$x,$y,$w,155);$g.DrawRectangle([Drawing.Pens]::LightGray,$x,$y,$w,155)
   $rect=[Drawing.RectangleF]::new($x+7,$y+7,$w-14,141)
   $g.DrawString([string]$cell.text, $(if($cell.bold){$bold}else{$font}),$ink,$rect)
   $brush.Dispose();$ink.Dispose();$x+=$w
 };$y+=155}
 $bmp.Save((Join-Path $Directory $p.file),[Drawing.Imaging.ImageFormat]::Png);$g.Dispose();$bmp.Dispose()
}
$font.Dispose();$bold.Dispose()
