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
      
      // withXcodeProject로 Xcode 프로젝트 파일 직접 수정
      config = withXcodeProject(config, (config) => {
        const xcodeProject = config.modResults;
        
        // 타겟 찾기
        const targetName = config.ios?.bundleIdentifier?.split('.').pop() || config.name || 'pickplay';
        const target = xcodeProject.targets.find(t => t.name === targetName) || xcodeProject.targets[0];
        
        if (!target) {
          console.warn(`[Config Plugin] iOS 타겟을 찾을 수 없음: ${targetName}`);
          return config;
        }
        
        console.log(`[Config Plugin] iOS 타겟 발견: ${target.name}`);
        
        // GoogleService-Info.plist 파일 경로 (iOS 프로젝트 내 상대 경로)
        const pbxprojPath = `${targetName}/GoogleService-Info.plist`;
        
        // 파일 참조 추가 (이미 있으면 스킵)
        let fileRef = xcodeProject.findPBXFileKeyByPath(pbxprojPath);
        if (!fileRef) {
          console.log('[Config Plugin] iOS: GoogleService-Info.plist 파일 참조 추가 중...');
          fileRef = xcodeProject.addFile(pbxprojPath, target.uuid, {
            lastKnownFileType: 'text.plist.xml',
            sourceTree: '"<group>"',
          });
        } else {
          console.log('[Config Plugin] iOS: GoogleService-Info.plist 파일 참조가 이미 존재함');
        }
        
        // Copy Bundle Resources 빌드 단계에 추가
        const resourcesBuildPhase = target.buildPhases.find(
          phase => phase.isa === 'PBXResourcesBuildPhase'
        );
        
        if (resourcesBuildPhase) {
          // 이미 추가되어 있는지 확인
          const alreadyAdded = resourcesBuildPhase.files.some(
            file => file.fileRef === fileRef
          );
          
          if (!alreadyAdded) {
            console.log('[Config Plugin] iOS: GoogleService-Info.plist를 Copy Bundle Resources에 추가 중...');
            resourcesBuildPhase.files.push({
              fileRef: fileRef,
              uuid: xcodeProject.generateUuid(),
              isa: 'PBXBuildFile',
            });
            console.log('[Config Plugin] ✅ iOS: Copy Bundle Resources에 추가 완료');
          } else {
            console.log('[Config Plugin] ✅ iOS: GoogleService-Info.plist가 이미 Copy Bundle Resources에 포함됨');
          }
        } else {
          console.warn('[Config Plugin] ⚠️ iOS: Copy Bundle Resources 빌드 단계를 찾을 수 없음');
        }
        
        return config;
      });
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
