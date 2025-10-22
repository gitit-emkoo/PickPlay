#!/usr/bin/env bash
set -euo pipefail

echo "========================================"
echo "🔧 [EAS Hook] Post-Install Final Cleanup"
echo "========================================"

echo "📂 Current directory: $(pwd)"

# ios/Pods 존재 확인
if [ ! -d "ios/Pods" ]; then
  echo "❌ ios/Pods not found - SKIPPING"
  exit 0
fi

echo "✅ ios/Pods found"

# xcconfig 파일 정화 (perl 방식)
echo "🧹 Cleaning xcconfig files..."
xcconfig_count=0

find ios/Pods -name "*.xcconfig" -type f | while read file; do
  if grep -q "GCC_WARN_INHIBIT_ALL_WARNINGS" "$file" 2>/dev/null; then
    echo "  🧹 $(basename "$file")"
    perl -pi -e 's/-GCC_WARN_INHIBIT_ALL_WARNINGS//g' "$file"
    perl -pi -e 's/ -G / /g' "$file"
    xcconfig_count=$((xcconfig_count + 1))
  fi
done

echo "  ✅ Cleaned $xcconfig_count xcconfig files"

# project.pbxproj 정화
echo "🧹 Cleaning project.pbxproj..."
if [ -f "ios/Pods/Pods.xcodeproj/project.pbxproj" ]; then
  perl -pi -e 's/-GCC_WARN_INHIBIT_ALL_WARNINGS//g' ios/Pods/Pods.xcodeproj/project.pbxproj
  perl -pi -e 's/ -G / /g' ios/Pods/Pods.xcodeproj/project.pbxproj
  echo "  ✅ Cleaned project.pbxproj"
else
  echo "  ⚠️  project.pbxproj not found"
fi

# 최종 검증
echo "🔍 Final verification..."
if grep -r "GCC_WARN_INHIBIT_ALL_WARNINGS" ios/Pods/Target\ Support\ Files/ 2>/dev/null | grep -E "(BoringSSL|gRPC)"; then
  echo "  ⚠️  WARNING: Still found in BoringSSL/gRPC files!"
else
  echo "  ✅ All clean - no GCC_WARN_INHIBIT_ALL_WARNINGS found"
fi

# Response 캐시는 삭제하지 않음 (Codegen 파일이 여기 있음!)

echo "========================================"
echo "✅ [EAS Hook] Cleanup Complete"
echo "========================================"



echo "========================================"
echo "🔧 [EAS Hook] Post-Install Final Cleanup"
echo "========================================"

echo "📂 Current directory: $(pwd)"

# ios/Pods 존재 확인
if [ ! -d "ios/Pods" ]; then
  echo "❌ ios/Pods not found - SKIPPING"
  exit 0
fi

echo "✅ ios/Pods found"

# xcconfig 파일 정화 (perl 방식)
echo "🧹 Cleaning xcconfig files..."
xcconfig_count=0

find ios/Pods -name "*.xcconfig" -type f | while read file; do
  if grep -q "GCC_WARN_INHIBIT_ALL_WARNINGS" "$file" 2>/dev/null; then
    echo "  🧹 $(basename "$file")"
    perl -pi -e 's/-GCC_WARN_INHIBIT_ALL_WARNINGS//g' "$file"
    perl -pi -e 's/ -G / /g' "$file"
    xcconfig_count=$((xcconfig_count + 1))
  fi
done

echo "  ✅ Cleaned $xcconfig_count xcconfig files"

# project.pbxproj 정화
echo "🧹 Cleaning project.pbxproj..."
if [ -f "ios/Pods/Pods.xcodeproj/project.pbxproj" ]; then
  perl -pi -e 's/-GCC_WARN_INHIBIT_ALL_WARNINGS//g' ios/Pods/Pods.xcodeproj/project.pbxproj
  perl -pi -e 's/ -G / /g' ios/Pods/Pods.xcodeproj/project.pbxproj
  echo "  ✅ Cleaned project.pbxproj"
else
  echo "  ⚠️  project.pbxproj not found"
fi

# 최종 검증
echo "🔍 Final verification..."
if grep -r "GCC_WARN_INHIBIT_ALL_WARNINGS" ios/Pods/Target\ Support\ Files/ 2>/dev/null | grep -E "(BoringSSL|gRPC)"; then
  echo "  ⚠️  WARNING: Still found in BoringSSL/gRPC files!"
else
  echo "  ✅ All clean - no GCC_WARN_INHIBIT_ALL_WARNINGS found"
fi

# Response 캐시는 삭제하지 않음 (Codegen 파일이 여기 있음!)

echo "========================================"
echo "✅ [EAS Hook] Cleanup Complete"
echo "========================================"

