// Expo config plugin: GoogleUserMessagingPlatform을 정적 프레임워크로 강제 빌드
const { withDangerousMod, IOSConfig } = require('@expo/config-plugins');

const withStaticUMP = (config) => {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const fs = require('fs');
      const podfilePath = IOSConfig.Paths.getPodfilePath(cfg.modRequest.projectRoot);
      
      if (!fs.existsSync(podfilePath)) return cfg;
      
      let podfile = fs.readFileSync(podfilePath, 'utf8');
      
      // UMP를 정적 프레임워크로 빌드하도록 강제하는 코드
      const staticUMPCode = `
# Force GoogleUserMessagingPlatform to build as static framework
pre_install do |installer|
  installer.pod_targets.each do |pod|
    if pod.name.eql?('GoogleUserMessagingPlatform') || pod.name.start_with?('Google-Mobile-Ads-SDK')
      def pod.build_type;
        Pod::BuildType.static_framework
      end
    end
  end
end
`;
      
      // 이미 주입되어 있는지 확인
      if (!podfile.includes('Force GoogleUserMessagingPlatform to build as static framework')) {
        // require ... 다음, target 블록 전에 주입
        podfile = podfile.replace(
          /(require.*\n)/,
          `$1${staticUMPCode}\n`
        );
        
        fs.writeFileSync(podfilePath, podfile);
      }
      
      return cfg;
    },
  ]);
};

module.exports = withStaticUMP;

