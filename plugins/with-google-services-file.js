const { IOSConfig, AndroidConfig, withAppDelegate } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Google Services 파일을 iOS 및 Android 프로젝트에 추가합니다.
 * 
 * iOS:
 * 1. Expo의 기본 withGoogleServicesFile 사용 (파일 복사)
 * 2. AppDelegate에 Firebase 초기화 코드 추가
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
    
    // 2단계: AppDelegate에 Firebase 초기화 코드 추가
    config = withAppDelegate(config, (config) => {
      const appDelegate = config.modResults;
      
      // 이미 Firebase 초기화 코드가 추가된 경우 건너뛰기
      if (appDelegate.contents.includes('[PickPlay][Firebase] Initialization')) {
        console.log('[Config Plugin] ✅ Firebase 초기화 코드가 이미 AppDelegate에 추가되어 있습니다.');
        return config;
      }
      
      // Firebase import 추가 (파일 상단에)
      const firebaseImport = `#import <Firebase.h>
#import <React/RCTLog.h>
`;
      
      // AppDelegate.h import 다음에 Firebase import 추가
      if (!appDelegate.contents.includes('#import <Firebase.h>')) {
        // AppDelegate.h import를 찾아서 그 다음 줄에 추가
        appDelegate.contents = appDelegate.contents.replace(
          /(#import "AppDelegate\.h")/,
          `$1\n${firebaseImport}`
        );
        console.log('[Config Plugin] ✅ Firebase.h 및 RCTLog.h import가 AppDelegate에 추가되었습니다.');
      } else if (!appDelegate.contents.includes('#import <React/RCTLog.h>')) {
        // Firebase import는 있지만 RCTLog import가 없는 경우
        appDelegate.contents = appDelegate.contents.replace(
          /(#import <Firebase\.h>)/,
          `$1\n#import <React/RCTLog.h>`
        );
        console.log('[Config Plugin] ✅ RCTLog.h import가 AppDelegate에 추가되었습니다.');
      }
      
      // didFinishLaunchingWithOptions 메서드에 Firebase 초기화 코드 추가
      const firebaseInitCode = `
  // MARK: - Firebase Initialization
  // React Native Firebase는 네이티브에서 자동으로 GoogleService-Info.plist를 읽어서 초기화합니다.
  // 파일이 앱 번들에 포함되어 있으면 FirebaseApp.configure()가 자동으로 호출됩니다.
  // 하지만 명시적으로 초기화를 보장하기 위해 여기에 코드를 추가합니다.
  if ([FIRApp defaultApp] == nil) {
    [FIRApp configure];
    RCTLogInfo(@"[PickPlay][Firebase] Firebase initialized in AppDelegate");
  } else {
    RCTLogInfo(@"[PickPlay][Firebase] Firebase already initialized");
  }
`;
      
      // didFinishLaunchingWithOptions 메서드 찾기 (다양한 패턴 지원)
      const patterns = [
        /(- \(BOOL\)application:\(UIApplication \*\)application\s+didFinishLaunchingWithOptions:\(NSDictionary \*\)launchOptions\s*\{[^}]*)(  return YES;)/,
        /(- \(BOOL\)application:\(UIApplication \*\)application\s+didFinishLaunchingWithOptions:\([^)]+\)\s*\{[^}]*)(  return YES;)/,
      ];
      
      let added = false;
      for (const pattern of patterns) {
        if (pattern.test(appDelegate.contents)) {
          appDelegate.contents = appDelegate.contents.replace(
            pattern,
            (match, beforeReturn, returnStatement) => {
              // 이미 추가된 경우 건너뛰기
              if (beforeReturn.includes('[PickPlay][Firebase] Initialization')) {
                return match;
              }
              added = true;
              return `${beforeReturn}${firebaseInitCode}${returnStatement}`;
            }
          );
          if (added) {
            console.log('[Config Plugin] ✅ Firebase 초기화 코드가 didFinishLaunchingWithOptions에 추가되었습니다.');
            break;
          }
        }
      }
      
      // 패턴 매칭이 실패한 경우, return YES 앞에 수동으로 추가 시도
      if (!added && appDelegate.contents.includes('didFinishLaunchingWithOptions')) {
        appDelegate.contents = appDelegate.contents.replace(
          /(  return YES;\s*\n\s*\})/,
          `${firebaseInitCode}$1`
        );
        console.log('[Config Plugin] ✅ Firebase 초기화 코드가 return YES 앞에 추가되었습니다.');
      }
      
      return config;
    });
    
    // 파일 경로 확인
    const sourcePath = path.resolve(config.modRequest.projectRoot, iosGoogleServicesFile.replace('./', ''));
    if (fs.existsSync(sourcePath)) {
      console.log(`[Config Plugin] ✅ iOS GoogleService-Info.plist 파일 확인됨: ${sourcePath}`);
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
    
    const sourcePath = path.resolve(config.modRequest?.projectRoot || '.', androidGoogleServicesFile.replace('./', ''));
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
