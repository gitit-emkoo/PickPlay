#!/bin/bash

echo "🚀 GitHub Actions 설정 스크립트"
echo "================================"

# GitHub 저장소 URL 확인
if [ -z "$1" ]; then
    echo "❌ GitHub 저장소 URL을 입력해주세요!"
    echo "사용법: ./scripts/setup-github-actions.sh <github-repo-url>"
    echo "예시: ./scripts/setup-github-actions.sh https://github.com/username/today-balance"
    exit 1
fi

REPO_URL=$1
REPO_NAME=$(basename $REPO_URL .git)

echo "📁 저장소: $REPO_NAME"
echo "🔗 URL: $REPO_URL"

# 원격 저장소 설정
echo ""
echo "🌐 원격 저장소 설정 중..."
git remote add origin $REPO_URL 2>/dev/null || git remote set-url origin $REPO_URL

# 브랜치 설정
echo "🌿 브랜치 설정 중..."
git checkout -b main 2>/dev/null || git checkout main
git push -u origin main

# develop 브랜치 생성
echo "🌿 develop 브랜치 생성 중..."
git checkout -b develop
git push -u origin develop

# main 브랜치로 돌아가기
git checkout main

echo ""
echo "✅ GitHub Actions 설정 완료!"
echo ""
echo "📋 다음 단계:"
echo "1. GitHub 저장소에서 Settings → Secrets and variables → Actions로 이동"
echo "2. 필요한 시크릿들을 설정:"
echo "   - EXPO_TOKEN"
echo "   - APPLE_ID (iOS 배포 시)"
echo "   - APPLE_APP_SPECIFIC_PASSWORD (iOS 배포 시)"
echo "   - GOOGLE_SERVICE_ACCOUNT_JSON (Android 배포 시)"
echo "3. 코드를 푸시하면 자동으로 워크플로우가 실행됩니다"
echo ""
echo "🏷️  새 버전 배포 시:"
echo "   git tag v1.0.0"
echo "   git push origin v1.0.0"
echo ""
echo "🎉 모든 설정이 완료되었습니다!"

