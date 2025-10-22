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
 * 6. libdav1d C++ 헤더 문제
 * 7. leveldb C++ 헤더 문제
 * 8. Hermes Engine 스크립트 문제
 * 9. React Native Dependencies 스크립트 문제
 * 10. 링킹 에러 예방 (Codegen, Firebase)
 * 11. 라이브러리 검색 경로 설정
 * 12. 추가 C++ 라이브러리 예방 (Lottie, Reanimated, Worklets, Linear Gradient)
 * 13. Google Mobile Ads C++ 예방
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
      # Enable modular headers for compatible targets only
      # Exclude problematic libraries like libdav1d, leveldb
      unless target.name.start_with?('libdav1d') || 
             target.name.start_with?('hermes-engine') ||
             target.name.start_with?('leveldb') ||
             target.name.include?('dav1d') ||
             target.name.include?('leveldb')
        
        config.build_settings['DEFINES_MODULE'] = 'YES'
        config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
        config.build_settings['USE_HEADERMAP'] = 'YES'
      end
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
      
      # ===================================================
      # FIX 6: C++ Standard Library (libdav1d + leveldb fix)
      # ===================================================
      if target.name.start_with?('libdav1d') || target.name.include?('dav1d') ||
         target.name.start_with?('leveldb') || target.name.include?('leveldb')
        config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        
        # Add C++ standard library headers path
        header_paths = config.build_settings['HEADER_SEARCH_PATHS'] || ['$(inherited)']
        header_paths = [header_paths] unless header_paths.is_a?(Array)
        header_paths << '/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/include/c++/v1'
        config.build_settings['HEADER_SEARCH_PATHS'] = header_paths
        
        puts "  🔧 C++ Library Fix: #{target.name}"
      end
      
      # ===================================================
      # FIX 7: Hermes Engine Script Issues (Prevention)
      # ===================================================
      if target.name == 'hermes-engine'
        config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
        config.build_settings['SKIP_INSTALL'] = 'YES'
        config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
        
        puts "  🔧 Hermes Script Fix: #{target.name}"
      end
      
      # ===================================================
      # FIX 8: React Native Dependencies Script Issues
      # ===================================================
      if target.name == 'ReactNativeDependencies'
        config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
        config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
        
        puts "  🔧 RNDeps Script Fix: #{target.name}"
      end
      
      # ===================================================
      # FIX 9: Linking Error Prevention
      # ===================================================
      # Prevent common linking errors
      config.build_settings['OTHER_LDFLAGS'] = (config.build_settings['OTHER_LDFLAGS'] || []) + [
        '-ObjC',
        '-lc++',
        '-lz',
        '-lsqlite3'
      ]
      
      # Ensure proper library search paths
      library_search_paths = config.build_settings['LIBRARY_SEARCH_PATHS'] || ['$(inherited)']
      library_search_paths = [library_search_paths] unless library_search_paths.is_a?(Array)
      library_search_paths << '$(SDKROOT)/usr/lib'
      library_search_paths << '$(TOOLCHAIN_DIR)/usr/lib'
      config.build_settings['LIBRARY_SEARCH_PATHS'] = library_search_paths
      
      # Prevent duplicate symbol errors
      config.build_settings['GCC_NO_COMMON_BLOCKS'] = 'YES'
      config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'NO'
      
      # Ensure proper framework search paths
      framework_search_paths = config.build_settings['FRAMEWORK_SEARCH_PATHS'] || ['$(inherited)']
      framework_search_paths = [framework_search_paths] unless framework_search_paths.is_a?(Array)
      framework_search_paths << '$(SDKROOT)/System/Library/Frameworks'
      config.build_settings['FRAMEWORK_SEARCH_PATHS'] = framework_search_paths
      
      # ===================================================
      # FIX 10: Codegen Linking Error Prevention
      # ===================================================
      # Ensure ReactCodegen and related modules link properly
      if target.name.include?('React') || target.name.include?('RCT') || target.name.include?('Codegen')
        config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
        config.build_settings['CLANG_MODULES_AUTOLINK'] = 'YES'
        config.build_settings['CLANG_MODULES_BUILD_SESSION_FILE'] = '$(DERIVED_FILE_DIR)/modules.session'
        
        # Ensure proper module map generation
        config.build_settings['CLANG_MODULE_MAP_FILE'] = '$(DERIVED_FILE_DIR)/module.modulemap'
        
        puts "  🔗 Codegen Linking: #{target.name}"
      end
      
      # ===================================================
      # FIX 11: Firebase Linking Error Prevention
      # ===================================================
      # Ensure Firebase modules link properly
      if target.name.start_with?('RNFB') || target.name.include?('Firebase')
        config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
        config.build_settings['CLANG_MODULES_AUTOLINK'] = 'YES'
        
        # Add Firebase-specific linking flags
        firebase_ldflags = config.build_settings['OTHER_LDFLAGS'] || []
        firebase_ldflags = [firebase_ldflags] unless firebase_ldflags.is_a?(Array)
        firebase_ldflags << '-framework' << 'FirebaseCore'
        firebase_ldflags << '-framework' << 'FirebaseAuth'
        firebase_ldflags << '-framework' << 'FirebaseFirestore'
        config.build_settings['OTHER_LDFLAGS'] = firebase_ldflags
        
        puts "  🔗 Firebase Linking: #{target.name}"
      end
      # ===================================================
      # Prevent C++ issues for other libraries
      if target.name.include?('lottie') || target.name.include?('Lottie') ||
         target.name.include?('reanimated') || target.name.include?('Reanimated') ||
         target.name.include?('worklets') || target.name.include?('Worklets') ||
         target.name.include?('linear') || target.name.include?('Linear') ||
         target.name.include?('protobuf') || target.name.include?('Protobuf')
        
        config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        
        # Add C++ standard library headers path
        header_paths = config.build_settings['HEADER_SEARCH_PATHS'] || ['$(inherited)']
        header_paths = [header_paths] unless header_paths.is_a?(Array)
        header_paths << '/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/include/c++/v1'
        config.build_settings['HEADER_SEARCH_PATHS'] = header_paths
        
        # Prevent C++ header issues
        config.build_settings['GCC_C_LANGUAGE_STANDARD'] = 'c17'
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        
        puts "  🔧 C++ Library Fix: #{target.name}"
      end
      
      # ===================================================
      # FIX 13: Google Mobile Ads C++ Prevention
      # ===================================================
      if target.name.include?('GoogleMobileAds') || target.name.include?('GAD') ||
         target.name.include?('google') || target.name.include?('Google')
        
        config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        
        # Add protobuf and gRPC specific settings
        cxxflags = config.build_settings['OTHER_CPLUSPLUSFLAGS'] || '$(inherited)'
        cxxflags = cxxflags.is_a?(Array) ? cxxflags.join(' ') : cxxflags.to_s
        cxxflags = "#{cxxflags} -std=c++17 -Wno-missing-template-arg-list-after-template-kw".strip
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] = cxxflags
        
        puts "  🔧 Google Ads C++ Fix: #{target.name}"
      end
      
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

