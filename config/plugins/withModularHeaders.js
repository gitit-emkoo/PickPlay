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
        const postInstallCode = `\n${marker}\npost_install do |installer|\n  installer.pods_project.targets.each do |target|\n    target.build_configurations.each do |config|\n      if target.name.start_with?('RNFB', 'React', 'RCT', 'Yoga', 'DoubleConversion', 'glog', 'boost', 'Folly')\n        config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'\n        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'\n      end\n      config.build_settings['OTHER_CPLUSPLUSFLAGS'] ||= ['$(inherited)']\n    end\n  end\nend\n`;

        podfile = podfile.trimEnd() + '\n' + postInstallCode;
        fs.writeFileSync(podfilePath, podfile);
      }

      return cfg;
    },
  ]);
};

module.exports = withRNFBHeaderFix;

