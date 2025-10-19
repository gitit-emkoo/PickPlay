#!/bin/bash
# EAS Build Hook: BoringSSL-GRPC -G 플래그 제거 (post-install)

set -e

echo "🔧 [eas-build-post-install] Removing -G flags from BoringSSL-GRPC and gRPC xcconfig files..."
echo "🏗️ [eas-build-post-install] Current directory: $(pwd)"

# iOS 디렉토리로 이동
if [ ! -d "ios" ]; then
  echo "⚠️  [eas-build-post-install] ios/ directory not found, skipping"
  exit 0
fi

cd ios

# Pods/Target Support Files에서 .xcconfig 파일 찾아서 -G 플래그 제거
echo "📂 Searching for BoringSSL-GRPC and gRPC xcconfig files..."

# BoringSSL-GRPC 관련 xcconfig 파일 수정
find Pods/Target\ Support\ Files/BoringSSL-GRPC -name "*.xcconfig" 2>/dev/null | while read -r file; do
  echo "🧹 Processing: $file"
  # macOS에서 sed는 -i '' 필요
  sed -i '' 's/ -G / /g' "$file" || true
  sed -i '' 's/ -G$//g' "$file" || true
  sed -i '' 's/^-G //g' "$file" || true
  echo "✅ Cleaned: $file"
done

# gRPC 관련 xcconfig 파일 수정
find Pods/Target\ Support\ Files/gRPC* -name "*.xcconfig" 2>/dev/null | while read -r file; do
  echo "🧹 Processing: $file"
  sed -i '' 's/ -G / /g' "$file" || true
  sed -i '' 's/ -G$//g' "$file" || true
  sed -i '' 's/^-G //g' "$file" || true
  echo "✅ Cleaned: $file"
done

echo "✅ [eas-build-post-install] -G flags removed from all xcconfig files"

# 검증: -G 플래그가 남아있는지 확인
echo "🔍 Verifying: Checking for remaining -G flags..."
if grep -r " -G " Pods/Target\ Support\ Files/BoringSSL-GRPC/*.xcconfig 2>/dev/null || \
   grep -r " -G " Pods/Target\ Support\ Files/gRPC*/*.xcconfig 2>/dev/null; then
  echo "⚠️  Warning: Some -G flags may still remain"
else
  echo "✅ Verification passed: No -G flags found"
fi

echo "✅ [eas-build-post-install] Hook completed successfully"

  sed -i '' 's/ -G$//g' "$file" || true
  sed -i '' 's/^-G //g' "$file" || true
  echo "✅ Cleaned: $file"
done

echo "✅ [eas-build-post-install] -G flags removed from all xcconfig files"

# 검증: -G 플래그가 남아있는지 확인
echo "🔍 Verifying: Checking for remaining -G flags..."
if grep -r " -G " Pods/Target\ Support\ Files/BoringSSL-GRPC/*.xcconfig 2>/dev/null || \
   grep -r " -G " Pods/Target\ Support\ Files/gRPC*/*.xcconfig 2>/dev/null; then
  echo "⚠️  Warning: Some -G flags may still remain"
else
  echo "✅ Verification passed: No -G flags found"
fi

echo "✅ [eas-build-post-install] Hook completed successfully"