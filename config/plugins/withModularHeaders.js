// Expo config plugin: Modular Headers 중심 빌드 설정
// useFrameworks 없이 modular headers로 RNFB/React/Google SDK 충돌 해결
const { withDangerousMod, IOSConfig } = require('@expo/config-plugins');

const withModularHeaders = (config) => {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const fs = require('fs');
      const path = require('path');
      const podfilePath = IOSConfig.Paths.getPodfilePath(cfg.modRequest.projectRoot);
      
      if (!fs.existsSync(podfilePath)) return cfg;
      
      let podfile = fs.readFileSync(podfilePath, 'utf8');
      
      // 1. use_modular_headers! 주입 (Podfile 상단, require 다음)
      const modularHeadersDeclaration = `
# Enable modular headers globally for better Swift/Objective-C interoperability
use_modular_headers!
`;
      
      if (!podfile.includes('use_modular_headers!')) {
        podfile = podfile.replace(
          /(require.*\n)/,
          `$1${modularHeadersDeclaration}\n`
        );
      }
      
      // 2. post_install 훅: RNFB 관련 경고 비활성화
      const postInstallCode = `
# Disable non-modular header warnings for React Native Firebase
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      # RNFB 관련 타겟에 대해 non-modular header 경고를 비활성화
      if target.name.start_with?('RNFB') || target.name.start_with?('React')
        config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'
      end
      
      # New Architecture 호환성 설정
      config.build_settings['OTHER_CPLUSPLUSFLAGS'] ||= ['$(inherited)']
    end
  end
end
`;
      
      // 기존 post_install이 없으면 추가, 있으면 병합
      if (!podfile.includes('post_install do |installer|')) {
        // target 'projectName' do ... end 블록 다음에 추가
        const targetEndMatch = podfile.match(/end\s*$/m);
        if (targetEndMatch) {
          const insertPosition = podfile.lastIndexOf('end');
          podfile = podfile.slice(0, insertPosition) + 
                    '\n' + postInstallCode + '\n' + 
                    podfile.slice(insertPosition);
        }
      } else if (!podfile.includes('CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE')) {
        // 기존 post_install 안에 설정 추가
        podfile = podfile.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      if target.name.start_with?('RNFB') || target.name.start_with?('React')
        config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'
      end
    end
  end
`
        );
      }
      
      fs.writeFileSync(podfilePath, podfile);
      
      return cfg;
    },
  ]);
};

module.exports = withModularHeaders;

