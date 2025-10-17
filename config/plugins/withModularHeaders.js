// Expo config plugin: React Native Firebase 헤더 경고 완화 (강화 버전)
const { withDangerousMod, IOSConfig } = require('@expo/config-plugins');

const withRNFBHeaderFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const fs = require('fs');
      const podfilePath = IOSConfig.Paths.getPodfilePath(cfg.modRequest.projectRoot);

      if (!fs.existsSync(podfilePath)) return cfg;

      let podfile = fs.readFileSync(podfilePath, 'utf8');

      const marker = "# Fix React Native Firebase non-modular header warnings (Enhanced)";
      const hasPostInstall = podfile.includes('post_install do |installer|');
      const alreadyInjected = podfile.includes(marker);

      if (alreadyInjected) {
        console.log('✅ [withModularHeaders] Already injected, skipping');
        return cfg;
      }

      // post_install 블록이 없을 때만 안전하게 추가
      if (!hasPostInstall) {
        const postInstallCode = `
${marker}
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      # Target RNFB and React modules specifically
      is_rnfb_or_react = target.name.start_with?('RNFB') || 
                         target.name.start_with?('React') || 
                         target.name.start_with?('RCT')
      
      if is_rnfb_or_react
        # Core fix: Allow non-modular header includes
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'
        
        # Prevent warnings from being treated as errors
        config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
        
        # Ensure modules are properly defined
        config.build_settings['DEFINES_MODULE'] = 'YES'
        config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
        config.build_settings['USE_HEADERMAP'] = 'YES'
        
        # Add compiler flag to suppress specific warning
        cflags = config.build_settings['OTHER_CFLAGS'] || ['$(inherited)']
        unless cflags.include?('-Wno-error=non-modular-include-in-framework-module')
          cflags << '-Wno-error=non-modular-include-in-framework-module'
        end
        config.build_settings['OTHER_CFLAGS'] = cflags
        
        puts "✅ Applied modular header fix to: #{target.name}"
      end
    end
  end
  
  # Call react_native_post_install if available
  begin
    react_native_post_install(
      installer,
      config[:reactNativePath] || "../node_modules/react-native",
      :mac_catalyst_enabled => false
    )
  rescue => e
    puts "⚠️  react_native_post_install not available or failed: #{e.message}"
  end
end
`;

        podfile = podfile.trimEnd() + '\n' + postInstallCode;
        fs.writeFileSync(podfilePath, podfile);
        console.log('✅ [withModularHeaders] Injected enhanced post_install hook');
      } else {
        console.log('⚠️  [withModularHeaders] post_install already exists, skipping to avoid conflicts');
      }

      return cfg;
    },
  ]);
};

module.exports = withRNFBHeaderFix;
