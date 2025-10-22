const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * 완전한 iOS 빌드 문제 해결 플러그인
 * 
 * 해결하는 문제들:
 * 1. RNFB non-modular header 에러
 * 2. BoringSSL-GRPC -G flag 에러
 * 3. gRPC C++17/C++20 충돌
 * 4. Deployment target 경고
 * 5. Swift 호환성
 * 
 * 방식: Expo가 생성한 Podfile의 post_install 블록 내부에 코드 삽입
 */
module.exports = (config) => {
  console.log('\n========================================');
  console.log('🚀 [CompleteIOSFix] STARTING');
  console.log('========================================\n');
  
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.projectRoot, 'ios', 'Podfile');
      
      if (!fs.existsSync(podfilePath)) {
        console.log('⚠️  Podfile not found - will run after prebuild');
        return config;
      }
      
      let podfileContent = fs.readFileSync(podfilePath, 'utf8');
      
      // 이미 적용되었는지 확인
      if (podfileContent.includes('🔧 COMPLETE iOS FIX')) {
        console.log('✅ Already applied, skipping');
        return config;
      }
      
      // ===================================================
      // 모든 수정사항을 하나의 블록으로 정의
      // ===================================================
      const completeFix = `
  # ===================================================
  # 🔧 COMPLETE iOS FIX - All build issues resolved
  # ===================================================
  
  puts ""
  puts "=" * 80
  puts "🔧 Applying Complete iOS Build Fixes..."
  puts "=" * 80
  
  # ===================================================
  # CRITICAL: Enable modular headers for all pods
  # ===================================================
  puts "🔧 Enabling modular headers for all pods..."
  
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      # Enable modular headers for all targets
      config.build_settings['DEFINES_MODULE'] = 'YES'
      config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
      config.build_settings['USE_HEADERMAP'] = 'YES'
    end
  end
  
  puts "  ✅ Modular headers enabled for all pods"
  
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      
      # ===================================================
      # FIX 1: RNFB Non-Modular Headers (RNFB ONLY!)
      # ===================================================
      # CRITICAL: Only apply to RNFB targets, NOT React/Expo core!
      if target.name.start_with?('RNFB')
        
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'
        config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
        config.build_settings['DEFINES_MODULE'] = 'YES'
        config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
        
        cflags = config.build_settings['OTHER_CFLAGS'] || ['$(inherited)']
        cflags = [cflags] unless cflags.is_a?(Array)
        cflags << '-Wno-error=non-modular-include-in-framework-module' unless cflags.include?('-Wno-error=non-modular-include-in-framework-module')
        config.build_settings['OTHER_CFLAGS'] = cflags
        
        puts "  ✅ RNFB Fix: #{target.name}"
      end
      
      # ===================================================
      # FIX 2: BoringSSL-GRPC -G Flag
      # ===================================================
      if target.name == 'BoringSSL-GRPC'
        if config.build_settings['COMPILER_FLAGS']
          original = config.build_settings['COMPILER_FLAGS']
          config.build_settings['COMPILER_FLAGS'] = original
            .gsub('-GCC_WARN_INHIBIT_ALL_WARNINGS', '')
            .gsub(/(?<![^-])\\b-G\\b/, '')
            .strip
        end
        
        puts "  ✅ BoringSSL Fix: Removed -G flag"
      end
      
      # ===================================================
      # FIX 3: gRPC C++17 Enforcement
      # ===================================================
      if target.name.start_with?('gRPC-C++') || target.name.start_with?('gRPC-Core')
        # Force C++17
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        config.build_settings['GCC_C_LANGUAGE_STANDARD'] = 'c17'
        
        # Remove any C++20 flags and set C++17
        cxxflags = config.build_settings['OTHER_CPLUSPLUSFLAGS'] || '$(inherited)'
        cxxflags = cxxflags.is_a?(Array) ? cxxflags.join(' ') : cxxflags.to_s
        cxxflags = cxxflags.gsub(/-std=c\\+\\+\\d+/, '').strip
        cxxflags = "#{cxxflags} -std=c++17 -Wno-missing-template-arg-list-after-template-kw".strip
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] = cxxflags
        
        # Suppress warnings
        warning_flags = config.build_settings['WARNING_CFLAGS'] || '$(inherited)'
        warning_flags = warning_flags.is_a?(Array) ? warning_flags.join(' ') : warning_flags.to_s
        
        suppressed = [
          '-Wno-missing-template-arg-list-after-template-kw',
          '-Wno-shorten-64-to-32',
          '-Wno-comma',
          '-Wno-unreachable-code'
        ]
        
        suppressed.each { |flag| warning_flags = warning_flags.gsub(flag, '').strip }
        warning_flags = "#{warning_flags} #{suppressed.join(' ')}".strip
        config.build_settings['WARNING_CFLAGS'] = warning_flags
        
        puts "  ✅ gRPC Fix: C++17 enforced for #{target.name}"
      end
      
      # ===================================================
      # FIX 4: Deployment Target (iOS 12.0 minimum)
      # ===================================================
      deployment_target = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
      if deployment_target && deployment_target.to_f < 12.0
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '12.0'
        puts "  📱 Deployment: #{target.name} (#{deployment_target} → 12.0)"
      end
      
      # ===================================================
      # FIX 5: Swift & Module Compatibility
      # ===================================================
      config.build_settings['SWIFT_VERSION'] = '5.0'
      config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'YES'
      
      # Additional Swift compatibility flags
      config.build_settings['SWIFT_COMPILATION_MODE'] = 'wholemodule'
      config.build_settings['SWIFT_OPTIMIZATION_LEVEL'] = '-O'
      config.build_settings['SWIFT_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
      
      # Xcode 16 compatibility
      config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
      
    end
  end
  
  puts "=" * 80
  puts "🎉 Complete iOS Fix Applied Successfully!"
  puts "=" * 80
  puts ""
`;

      // ===================================================
      // post_install 블록 찾아서 내용 삽입
      // ===================================================
      
      // react_native_post_install 호출 후에 삽입 (Expo 기본 설정 완료 후)
      const reactNativePostInstallMatch = podfileContent.match(/(react_native_post_install\([^)]*\))/);
      
      if (reactNativePostInstallMatch) {
        const insertPosition = reactNativePostInstallMatch.index + reactNativePostInstallMatch[0].length;
        
        podfileContent = 
          podfileContent.slice(0, insertPosition) +
          completeFix +
          podfileContent.slice(insertPosition);
        
        fs.writeFileSync(podfilePath, podfileContent, 'utf8');
        
        console.log('✅ Applied complete iOS fix AFTER react_native_post_install');
        console.log('✅ Expo 기본 설정 완료 후 우리 수정 적용');
        console.log('✅ Expo autolinking preserved');
        console.log('✅ React Native post_install preserved');
        
        console.log('\n========================================');
        console.log('✅ [CompleteIOSFix] COMPLETED');
        console.log('========================================\n');
      } else {
        console.log('❌ Could not find react_native_post_install call!');
        console.log('⚠️  This should not happen with Expo prebuild');
      }
      
      return config;
    },
  ]);
};

