const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * 최소 gRPC 수정 플러그인
 * BoringSSL-GRPC의 -G flag만 제거
 */
module.exports = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.projectRoot, 'ios', 'Podfile');
      
      if (!fs.existsSync(podfilePath)) {
        console.log('⚠️  Podfile not found, skipping gRPC fix');
        return config;
      }
      
      let podfileContent = fs.readFileSync(podfilePath, 'utf8');
      
      // post_install 블록에 최소한의 fix만 추가
      const minimalFix = `
  # Fix BoringSSL-GRPC -G flag issue
  installer.pods_project.targets.each do |target|
    if target.name == 'BoringSSL-GRPC'
      target.build_configurations.each do |config|
        if config.build_settings['COMPILER_FLAGS']
          config.build_settings['COMPILER_FLAGS'] = config.build_settings['COMPILER_FLAGS']
            .gsub('-GCC_WARN_INHIBIT_ALL_WARNINGS', '')
            .gsub('-G', '')
            .strip
        end
      end
    end
  end
`;
      
      // post_install 찾아서 내용 추가
      if (podfileContent.includes('post_install do |installer|')) {
        // react_native_post_install 호출 직전에 삽입
        podfileContent = podfileContent.replace(
          /(\s+)(react_native_post_install\(installer\))/,
          `${minimalFix}$1$2`
        );
        
        fs.writeFileSync(podfilePath, podfileContent, 'utf8');
        console.log('✅ Applied minimal gRPC fix to Podfile');
      } else {
        console.log('⚠️  Could not find post_install block');
      }
      
      return config;
    },
  ]);
};

