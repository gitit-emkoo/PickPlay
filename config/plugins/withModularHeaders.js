// Expo config plugin: React Native Firebase 헤더 충돌 해결
// useFrameworks: static 환경에서 RNFB 비모듈러 헤더 경고 비활성화
const { withDangerousMod, IOSConfig } = require('@expo/config-plugins');

const withRNFBHeaderFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const fs = require('fs');
      const podfilePath = IOSConfig.Paths.getPodfilePath(cfg.modRequest.projectRoot);
      
      if (!fs.existsSync(podfilePath)) return cfg;
      
      let podfile = fs.readFileSync(podfilePath, 'utf8');
      
      // post_install 훅: RNFB/React 관련 경고 완전 비활성화
      const postInstallCode = `
# Fix React Native Firebase non-modular header warnings
post_install do |installer|
  # Pod targets 처리
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      # RNFB, React, RCT로 시작하는 모든 타겟에 적용
      if target.name.start_with?('RNFB', 'React', 'RCT', 'Yoga', 'DoubleConversion', 'glog', 'boost', 'Folly')
        config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
      
      # New Architecture 호환성
      config.build_settings['OTHER_CPLUSPLUSFLAGS'] ||= ['$(inherited)']
    end
  end
  
  # Aggregate targets 처리 (추가 안전장치)
  installer.aggregate_targets.each do |aggregate_target|
    aggregate_target.user_project.native_targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
  end
end
`;
      
      // 기존 post_install 제거하고 새로 주입
      if (podfile.includes('post_install do |installer|')) {
        // 기존 post_install 블록 전체 제거
        podfile = podfile.replace(/post_install do \|installer\|[\s\S]*?^end\n/m, '');
      }
      
      // 파일 끝에 새 post_install 추가
      podfile = podfile.trimEnd() + '\n' + postInstallCode + '\n';
      
      fs.writeFileSync(podfilePath, podfile);
      
      return cfg;
    },
  ]);
};

module.exports = withRNFBHeaderFix;

