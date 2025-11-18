const { withDangerousMod, IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * GoogleService-Info.plist 파일을 ios/ 디렉토리로 복사하는 Config Plugin
 * React Native Firebase가 이 파일을 읽어서 초기화합니다
 */
const withGoogleServicesFile = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosDir = path.join(projectRoot, 'ios');
      
      // app.json 또는 app.config.js에서 googleServicesFile 경로 가져오기
      const googleServicesFile = config.ios?.googleServicesFile;
      
      if (!googleServicesFile) {
        console.warn('⚠️ googleServicesFile이 app.json에 설정되지 않았습니다.');
        return config;
      }
      
      // 소스 파일 경로 (프로젝트 루트 기준)
      const sourcePath = path.resolve(projectRoot, googleServicesFile.replace('./', ''));
      
      // 대상 파일 경로 (ios/ 디렉토리)
      const targetPath = path.join(iosDir, 'GoogleService-Info.plist');
      
      // 소스 파일이 존재하는지 확인
      if (!fs.existsSync(sourcePath)) {
        console.error(`❌ GoogleService-Info.plist 파일을 찾을 수 없습니다: ${sourcePath}`);
        return config;
      }
      
      // ios/ 디렉토리가 없으면 생성
      if (!fs.existsSync(iosDir)) {
        fs.mkdirSync(iosDir, { recursive: true });
      }
      
      // 파일 복사
      try {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✅ GoogleService-Info.plist 파일을 복사했습니다: ${targetPath}`);
      } catch (error) {
        console.error(`❌ GoogleService-Info.plist 파일 복사 실패: ${error.message}`);
        throw error;
      }

      // Xcode 프로젝트에 파일 등록 (빌드 산출물에 포함)
      IOSConfig.Google.setGoogleServicesFile(config, {
        projectRoot,
        applePlatform: 'ios',
      });

      return config;
    },
  ]);
};

module.exports = withGoogleServicesFile;

