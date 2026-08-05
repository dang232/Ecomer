$BaseDir = "C:\Users\dangq\OneDrive\Documents\GitHub\Full-Stack-E-commerce"
$Out = "$BaseDir\fe\scripts\_check_output.txt"
$sb = [System.Text.StringBuilder]::new()

$null = $sb.AppendLine("=== GIT STATUS FOR TARGET FILES ===")
$files = @(
  "fe/scripts/migrate-icons.mjs",
  "fe/src/app/pages/Root.tsx",
  "fe/src/app/pages/seller/SellerPage.tsx",
  "fe/src/app/pages/admin/AdminPage.tsx",
  "fe/src/app/components/form-dialog.tsx",
  "fe/src/app/components/form-dialog.test.tsx",
  "fe/src/app/components/image-with-fallback.tsx",
  "fe/src/app/components/image-with-fallback.test.tsx",
  "fe/src/app/components/seller-product-modal.tsx",
  "fe/src/app/components/seller-product-modal.test.tsx"
)
foreach ($f in $files) {
  $err = $null
  $null = git ls-files --error-unmatch $f 2>$null
  if ($LASTEXITCODE -eq 0) { $null = $sb.AppendLine("IN_INDEX: $f") }
  elseif ($LASTEXITCODE -eq 1) { $null = $sb.AppendLine("NOT_IN_INDEX: $f") }
  else { $null = $sb.AppendLine("ERROR($LASTEXITCODE): $f") }
}

$null = $sb.AppendLine("")
$null = $sb.AppendLine("=== CURRENT COMMIT ===")
$h = (git rev-parse HEAD 2>$null)
$null = $sb.AppendLine("HEAD: $h")

$null = $sb.AppendLine("")
$null = $sb.AppendLine("=== RUNNING check-cutover.test.mjs ===")
$proc = Start-Process node -ArgumentList "fe/scripts/check-cutover.test.mjs" -WorkingDirectory $BaseDir -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$BaseDir\fe\scripts\_check_stdout.txt" -RedirectStandardError "$BaseDir\fe\scripts\_check_stderr.txt"
$null = $sb.AppendLine("EXIT_CODE: $($proc.ExitCode)")

if (Test-Path "$BaseDir\fe\scripts\_check_stdout.txt") {
  $s = Get-Content "$BaseDir\fe\scripts\_check_stdout.txt" -Raw
  $null = $sb.AppendLine("STDOUT: $s")
}
if (Test-Path "$BaseDir\fe\scripts\_check_stderr.txt") {
  $e = Get-Content "$BaseDir\fe\scripts\_check_stderr.txt" -Raw
  $null = $sb.AppendLine("STDERR: $e")
}

[System.IO.File]::WriteAllText($Out, $sb.ToString(), [System.Text.Encoding]::UTF8)
