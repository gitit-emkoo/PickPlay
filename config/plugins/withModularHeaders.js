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

const withModularHeaders = (config) => {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const fs = require('fs');
      const file = IOSConfig.Paths.getPodfilePath(cfg.modRequest.projectRoot);
      if (!fs.existsSync(file)) return cfg;
      const podfile = fs.readFileSync(file, 'utf8');
      const updated = injectModularHeaders(podfile);
      if (updated !== podfile) fs.writeFileSync(file, updated);
      return cfg;
    },
  ]);
};

module.exports = withModularHeaders;



