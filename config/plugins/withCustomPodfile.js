const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin: 커스텀 Podfile 주입
 * expo prebuild 이후 ios/Podfile 생성 직후 실행되어 템플릿으로 교체
 */
module.exports = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const src = path.join(projectRoot, 'ios-template', 'Podfile');
      const dest = path.join(projectRoot, 'ios', 'Podfile');
      
      console.log('🔧 [withCustomPodfile] Injecting custom Podfile...');
      console.log(`  Source: ${src}`);
      console.log(`  Destination: ${dest}`);
      
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log('✅ [withCustomPodfile] Custom Podfile injected successfully');
      } else {
        console.error('❌ [withCustomPodfile] Podfile template not found at', src);
        throw new Error(`Podfile template not found: ${src}`);
      }
      
      return config;
    },
  ]);
};

