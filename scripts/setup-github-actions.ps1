param(
    [Parameter(Mandatory=$true)]
    [string]$RepoUrl
)

Write-Host "🚀 GitHub Actions 설정 스크립트" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# GitHub 저장소 URL 확인
if ([string]::IsNullOrEmpty($RepoUrl)) {
    Write-Host "❌ GitHub 저장소 URL을 입력해주세요!" -ForegroundColor Red
    Write-Host "사용법: .\scripts\setup-github-actions.ps1 -RepoUrl <github-repo-url>" -ForegroundColor Yellow
    Write-Host "예시: .\scripts\setup-github-actions.ps1 -RepoUrl https://github.com/username/today-balance" -ForegroundColor Yellow
    exit 1
}

$RepoName = Split-Path $RepoUrl -Leaf
if ($RepoName -like "*.git") {
    $RepoName = $RepoName -replace "\.git$", ""
}

Write-Host "📁 저장소: $RepoName" -ForegroundColor Cyan
Write-Host "🔗 URL: $RepoUrl" -ForegroundColor Cyan

# 원격 저장소 설정
Write-Host ""
Write-Host "🌐 원격 저장소 설정 중..." -ForegroundColor Yellow
try {
    git remote add origin $RepoUrl 2>$null
} catch {
    git remote set-url origin $RepoUrl
}

# 브랜치 설정
Write-Host "🌿 브랜치 설정 중..." -ForegroundColor Yellow
try {
    git checkout -b main 2>$null
} catch {
    git checkout main
}
git push -u origin main

# develop 브랜치 생성
Write-Host "🌿 develop 브랜치 생성 중..." -ForegroundColor Yellow
git checkout -b develop
git push -u origin develop

# main 브랜치로 돌아가기
git checkout main

Write-Host ""
Write-Host "✅ GitHub Actions 설정 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 다음 단계:" -ForegroundColor Cyan
Write-Host "1. GitHub 저장소에서 Settings → Secrets and variables → Actions로 이동" -ForegroundColor White
Write-Host "2. 필요한 시크릿들을 설정:" -ForegroundColor White
Write-Host "   - EXPO_TOKEN" -ForegroundColor White
Write-Host "   - APPLE_ID (iOS 배포 시)" -ForegroundColor White
Write-Host "   - APPLE_APP_SPECIFIC_PASSWORD (iOS 배포 시)" -ForegroundColor White
Write-Host "   - GOOGLE_SERVICE_ACCOUNT_JSON (Android 배포 시)" -ForegroundColor White
Write-Host "3. 코드를 푸시하면 자동으로 워크플로우가 실행됩니다" -ForegroundColor White
Write-Host ""
Write-Host "🏷️  새 버전 배포 시:" -ForegroundColor Cyan
Write-Host "   git tag v1.0.0" -ForegroundColor White
Write-Host "   git push origin v1.0.0" -ForegroundColor White
Write-Host ""
Write-Host "🎉 모든 설정이 완료되었습니다!" -ForegroundColor Green

