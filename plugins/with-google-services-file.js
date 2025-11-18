const { IOSConfig } = require('@expo/config-plugins');

/**
 * Expo가 제공하는 withGoogleServicesFile 유틸을 그대로 사용합니다.
 * app.json의 ios.googleServicesFile 값을 읽어 자동으로 복사 및 Xcode 등록을 수행합니다.
 */
const withGoogleServicesFile = (config) => {
  return IOSConfig.Google.withGoogleServicesFile(config);
};

module.exports = withGoogleServicesFile;

