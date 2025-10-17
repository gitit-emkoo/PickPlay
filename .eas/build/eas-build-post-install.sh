#!/bin/bash
# EAS Build Hook: Podfile 주입 (post-install - 자동 실행)

set -e

echo "🔧 [eas-build-post-install] Injecting custom Podfile for iOS..."
echo "🏗️ [eas-build-post-install] Current directory: $(pwd)"

# 디렉토리 및 파일 존재 확인
echo "📂 Checking ios-template directory:"
ls -la ios-template || echo "⚠️  ios-template directory not found"

echo "📂 Checking ios directory:"
ls -la ios || echo "⚠️  ios directory not found"

if [ -d "ios" ] && [ -f "ios-template/Podfile" ]; then
  echo "📝 Copying ios-template/Podfile to ios/Podfile"
  cp ios-template/Podfile ios/Podfile
  echo "✅ Custom Podfile injected successfully"
  
  # Podfile 내용 확인 (디버깅용)
  echo "📄 Podfile contents (first 40 lines):"
  head -n 40 ios/Podfile
  
  echo "📄 Checking post_install hook:"
  grep -A 5 "post_install do" ios/Podfile || echo "⚠️  post_install hook not found!"
else
  echo "❌ [eas-build-post-install] Failed: ios/ directory or ios-template/Podfile not found"
  exit 1
fi

echo "✅ [eas-build-post-install] Hook completed successfully"
