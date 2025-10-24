#!/usr/bin/env zx

/**
 * Expo prebuild 후 필요한 파일들을 복원하는 스크립트
 * 성공 사례(MJ Studio) 방식을 참고하여 구현
 */

import { $ } from 'zx'

console.log('🔧 Expo prebuild 후 설정 복원 중...')

try {
  // 1. Fastfile 복원
  console.log('📋 Fastfile 복원 중...')
  await $`mkdir -p ios/fastlane`
  await $`cp fastlane-template.rb ios/fastlane/Fastfile`
  
  // 2. ExportOptions.plist 복원
  console.log('📋 ExportOptions.plist 복원 중...')
  await $`cp export-options-template.plist ios/ExportOptions.plist`
  
  // 3. 파일 권한 설정 (성공 사례에서 중요하게 언급됨)
  console.log('🔐 파일 권한 설정 중...')
  await $`chmod +x ios/fastlane/Fastfile`
  await $`chmod 644 ios/ExportOptions.plist`
  
  // 4. 파일 존재 확인
  console.log('✅ 파일 존재 확인 중...')
  await $`ls -la ios/fastlane/Fastfile`
  await $`ls -la ios/ExportOptions.plist`
  
  console.log('🎉 모든 파일이 성공적으로 복원되었습니다!')
  
} catch (error) {
  console.error('❌ 파일 복원 중 오류 발생:', error.message)
  process.exit(1)
}
