const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * AndroidManifest.xml에 android:enable16kbPages="true" 추가
 * Android 15 (targetSdkVersion 35)에서 16KB 메모리 페이지 크기 지원을 위해 필수
 */
const with16kbPages = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    
    // manifest 태그 찾기
    const manifest = androidManifest.manifest;
    if (!manifest) {
      console.warn('[Config Plugin] ⚠️ AndroidManifest.xml에서 manifest 태그를 찾을 수 없습니다.');
      return config;
    }
    
    // application 태그 찾기
    const application = manifest.application?.[0];
    if (!application) {
      console.warn('[Config Plugin] ⚠️ AndroidManifest.xml에서 application 태그를 찾을 수 없습니다.');
      return config;
    }
    
    // 이미 enable16kbPages가 설정되어 있는지 확인
    if (application.$?.['android:enable16kbPages']) {
      console.log('[Config Plugin] ✅ android:enable16kbPages가 이미 설정되어 있습니다.');
      return config;
    }
    
    // enable16kbPages 속성 추가
    if (!application.$) {
      application.$ = {};
    }
    application.$['android:enable16kbPages'] = 'true';
    
    console.log('[Config Plugin] ✅ android:enable16kbPages="true"가 AndroidManifest.xml에 추가되었습니다.');
    
    return config;
  });
};

module.exports = with16kbPages;





