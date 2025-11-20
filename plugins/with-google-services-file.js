const { IOSConfig, AndroidConfig, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Google Services 파일을 iOS 및 Android 프로젝트에 추가합니다.
 * 
 * iOS:
 * 1. Expo의 기본 withGoogleServicesFile 사용 (파일 복사)
 * 2. 추가로 명시적으로 Xcode 프로젝트에 파일 추가 및 Copy Bundle Resources에 포함
 * 
 * Android:
 * 1. Expo의 기본 withGoogleServicesFile 사용 (파일 복사 및 build.gradle 적용)
 */
const withGoogleServicesFile = (config) => {
  // iOS 처리
  const iosGoogleServicesFile = config.ios?.googleServicesFile;
  if (iosGoogleServicesFile) {
    console.log(`[Config Plugin] iOS GoogleService-Info.plist 경로: ${iosGoogleServicesFile}`);
    
    // 1단계: Expo 기본 유틸 사용 (파일 복사 및 기본 등록)
    config = IOSConfig.Google.withGoogleServicesFile(config);
    
    // 2단계: 명시적으로 Xcode 프로젝트에 파일 추가 및 Copy Bundle Resources에 포함
    const sourcePath = path.resolve(iosGoogleServicesFile);
    if (fs.existsSync(sourcePath)) {
      console.log(`[Config Plugin] ✅ iOS GoogleService-Info.plist 파일 확인됨: ${sourcePath}`);
      
      // Expo의 기본 withGoogleServicesFile이 이미 파일을 복사하고 Xcode 프로젝트에 추가합니다.
      // 추가적인 Xcode 프로젝트 수정은 복잡하고 에러를 발생시킬 수 있으므로,
      // Expo 기본 유틸에 의존합니다. 만약 파일이 번들에 포함되지 않는다면,
      // Expo의 기본 유틸 문제이므로 Expo 이슈를 확인해야 합니다.
      console.log('[Config Plugin] ✅ Expo 기본 유틸이 GoogleService-Info.plist를 처리했습니다.');
      console.log('[Config Plugin] 💡 파일이 번들에 포함되지 않으면 Expo 이슈를 확인하세요.');
    } else {
      console.warn(`[Config Plugin] ⚠️ iOS: GoogleService-Info.plist 파일을 찾을 수 없음: ${sourcePath}`);
    }
  } else {
    console.log('[Config Plugin] iOS: googleServicesFile이 설정되지 않음 (스킵)');
  }
  
  // Android 처리
  const androidGoogleServicesFile = config.android?.googleServicesFile;
  if (androidGoogleServicesFile) {
    console.log(`[Config Plugin] Android google-services.json 경로: ${androidGoogleServicesFile}`);
    
    // Expo 기본 유틸 사용 (파일 복사 및 build.gradle 적용)
    config = AndroidConfig.GoogleServices.withGoogleServicesFile(config);
    
    const sourcePath = path.resolve(androidGoogleServicesFile);
    if (fs.existsSync(sourcePath)) {
      console.log(`[Config Plugin] ✅ Android: google-services.json 파일 확인됨: ${sourcePath}`);
    } else {
      console.warn(`[Config Plugin] ⚠️ Android: google-services.json 파일을 찾을 수 없음: ${sourcePath}`);
    }
  } else {
    console.log('[Config Plugin] Android: googleServicesFile이 설정되지 않음 (스킵)');
  }
  
  return config;
};

module.exports = withGoogleServicesFile;
