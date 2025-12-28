# 한글 커밋 메시지를 위한 스크립트
param(
    [Parameter(Mandatory=$true)]
    [string]$Message
)

$tempFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tempFile, $Message, [System.Text.Encoding]::UTF8)
git commit -F $tempFile
Remove-Item $tempFile


