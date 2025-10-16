// Expo config plugin: React Native Firebase 헤더 경고 완화 (안전 모드)
// 기존 Podfile 구조를 건드리지 않고, post_install 블록이 없을 때만 추가
const { withDangerousMod, IOSConfig } = require('@expo/config-plugins');

const withRNFBHeaderFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const fs = require('fs');
      const podfilePath = IOSConfig.Paths.getPodfilePath(cfg.modRequest.projectRoot);

      if (!fs.existsSync(podfilePath)) return cfg;

      let podfile = fs.readFileSync(podfilePath, 'utf8');

      const marker = "# Fix React Native Firebase non-modular header warnings";
      const hasPostInstall = podfile.includes('post_install do |installer|');
      const alreadyInjected = podfile.includes(marker);

      if (alreadyInjected) {
        return cfg; // 이미 적용됨
      }

      // post_install 블록이 없을 때만 안전하게 추가
      if (!hasPostInstall) {
        const postInstallCode = `
${marker}
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      if target.name.start_with?('RNFB', 'React', 'RCT', 'Yoga', 'DoubleConversion', 'glog', 'boost', 'Folly')
        explicit_targets = ['React-Core', 'RCTTypeSafety', 'ReactCommon', 'React-NativeModulesApple']
        name_matches = target.name.start_with?('RNFB', 'React', 'RCT', 'Yoga', 'DoubleConversion', 'glog', 'boost', 'Folly') || explicit_targets.include?(target.name)
        if name_matches
          # Allow non-modular includes and prevent warning-as-error
          config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'
          config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
          config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
          config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
          # Ensure React*/RNFB pods define modules and use headermap for header resolution
          if target.name.start_with?('React', 'RCT', 'RNFB')
            config.build_settings['DEFINES_MODULE'] = 'YES'
          end
          config.build_settings['USE_HEADERMAP'] = 'YES'
          # Silence only this warning if any toolchain forces -Werror
          cflags = config.build_settings['OTHER_CFLAGS'] || ['$(inherited)']
          unless cflags.any? { |f| f.include?('-Wno-error=non-modular-include-in-framework-module') }
            cflags << '-Wno-error=non-modular-include-in-framework-module'
          end
          config.build_settings['OTHER_CFLAGS'] = cflags
        end
      end
      config.build_settings['OTHER_CPLUSPLUSFLAGS'] ||= ['$(inherited)']
    end
  end
end
`;

        podfile = podfile.trimEnd() + '\n' + postInstallCode;
        fs.writeFileSync(podfilePath, podfile);
      }

      return cfg;
    },
  ]);
};

module.exports = withRNFBHeaderFix;

