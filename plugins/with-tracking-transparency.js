const { withInfoPlist } = require('@expo/config-plugins');

/**
 * Info.plist에 NSUserTrackingUsageDescription 추가
 * iOS App Tracking Transparency (ATT) 권한 요청을 위해 필수
 */
const withTrackingTransparency = (config) => {
  return withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;
    
    // NSUserTrackingUsageDescription이 이미 있는지 확인
    if (infoPlist.NSUserTrackingUsageDescription) {
      console.log('[Config Plugin] ✅ NSUserTrackingUsageDescription이 이미 Info.plist에 있습니다.');
      return config;
    }
    
    // app.json에서 가져오거나 기본값 사용
    const description = config.ios?.infoPlist?.NSUserTrackingUsageDescription 
      || '이 정보를 사용하여 더 관련성 높은 맞춤형 광고를 제공합니다.';
    
    infoPlist.NSUserTrackingUsageDescription = description;
    console.log('[Config Plugin] ✅ NSUserTrackingUsageDescription이 Info.plist에 추가되었습니다.');
    console.log(`[Config Plugin] 📝 내용: ${description}`);
    
    return config;
  });
};

module.exports = withTrackingTransparency;

