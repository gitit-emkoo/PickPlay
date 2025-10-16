// Expo config plugin: 강제로 특정 iOS Pods에 modular headers를 적용합니다.
const { withDangerousMod, IOSConfig } = require('@expo/config-plugins');

const TARGET_PODS = [
  // React 계열(필요시 확장)
  'React-Core',
  'RCTTypeSafety',
  'ReactCommon',
  'React-RCTBridge',
  'React-RCTNetwork',
  'React-RCTSettings',
  'React-RCTAnimation',
  'RCT-Folly',
  'React-Codegen',
  'ReactCommon/turbomodule/core',
  // RNFB 계열(사용 중인 것만)
  'RNFBApp',
  'RNFBAuth',
  'RNFBFirestore',
  'RNFBFunctions',
];

function injectModularHeaders(podfileContent) {
  return podfileContent.replace(
    /use_frameworks!\s*:linkage => :static/g,
    (m) => `${m}\n\n  # Force modular headers for specific pods\n  ${TARGET_PODS.map(p => `pod '${p}', :modular_headers => true`).join('\n  ')}\n`
  );
}

function injectPostInstallForRNFB(podfileContent) {
  const block = `post_install do |installer|
  installer.pods_project.targets.each do |target|
    if target.name.start_with?('RNFB') || target.name.start_with?('React') || target.name.start_with?('RCT')
      target.build_configurations.each do |config|
        config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'
      end
    end
  end
end`;

  if (/post_install\s+do\s+\|installer\|/m.test(podfileContent)) {
    // 이미 post_install 블럭이 있으면, end 앞에 우리 설정을 주입
    return podfileContent.replace(/post_install\s+do\s+\|installer\|[\s\S]*?end/gm, (match) => {
      if (match.includes("CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE")) return match; // 이미 주입됨
      const trimmed = match.replace(/end\s*$/, '');
      return `${trimmed}\n  # Injected by withModularHeaders: disable non-modular warnings for RNFB*/React*/RCT*\n  installer.pods_project.targets.each do |target|\n    if target.name.start_with?('RNFB') || target.name.start_with?('React') || target.name.start_with?('RCT')\n      target.build_configurations.each do |config|\n        config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'\n      end\n    end\n  end\nend`;
    });
  }

  // post_install이 없으면 파일 끝에 추가
  return `${podfileContent}\n\n${block}\n`;
}

const withModularHeaders = (config) => {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const fs = require('fs');
      const file = IOSConfig.Paths.getPodfilePath(cfg.modRequest.projectRoot);
      if (!fs.existsSync(file)) return cfg;
      const podfile = fs.readFileSync(file, 'utf8');
      let updated = injectModularHeaders(podfile);
      updated = injectPostInstallForRNFB(updated);
      if (updated !== podfile) fs.writeFileSync(file, updated);
      return cfg;
    },
  ]);
};

module.exports = withModularHeaders;




