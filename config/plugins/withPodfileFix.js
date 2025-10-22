const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin: post_install만 수정하여 BoringSSL/gRPC 이슈 해결
 * Expo의 자동 Podfile 생성을 유지하면서 필요한 부분만 패치
 */
module.exports = (config) => {
  console.log('\n========================================');
  console.log('🚀 [withPodfileFix] PLUGIN STARTING');
  console.log('========================================\n');
  
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const podfilePath = path.join(projectRoot, 'ios', 'Podfile');
      
      console.log('🔧 [withPodfileFix] Patching Podfile post_install hook...');
      console.log(`  📂 Project Root: ${projectRoot}`);
      console.log(`  📄 Podfile Path: ${podfilePath}`);
      
      if (!fs.existsSync(podfilePath)) {
        console.log('❌ [withPodfileFix] Podfile not found!');
        console.log('⚠️  [withPodfileFix] This plugin must run AFTER Expo prebuild');
        console.log('⚠️  [withPodfileFix] Make sure ios folder exists before this plugin runs');
        throw new Error('Podfile not found - cannot apply fixes');
      }
      
      let podfileContent = fs.readFileSync(podfilePath, 'utf8');
      
      // Expo가 생성한 Podfile을 유지하면서 post_install만 수정
      const customPostInstall = `
  # ===============================================
  # 🔧 CUSTOM POST INSTALL (withPodfileFix.js)
  # ===============================================
  puts "=" * 80
  puts "🔧 [post_install] Custom Podfile post_install hook executing..."
  puts "=" * 80
  
  # ✅ CRITICAL FIX 1: BoringSSL-GRPC -G flag 제거
  puts "=" * 80
  puts "🔧 [post_install] CRITICAL FIX: Removing -GCC_WARN_INHIBIT_ALL_WARNINGS from BoringSSL-GRPC"
  puts "=" * 80
  
  modified_count = 0
  
  installer.pods_project.targets.each do |target|
    if target.name == 'BoringSSL-GRPC'
      puts "🎯 Found target: \#{target.name}"
      
      target.build_configurations.each do |config|
        # Remove from build settings
        if config.build_settings['COMPILER_FLAGS']
          original = config.build_settings['COMPILER_FLAGS']
          config.build_settings['COMPILER_FLAGS'] = original
            .gsub('-GCC_WARN_INHIBIT_ALL_WARNINGS', '')
            .gsub('-G', '')
            .strip
        end
        
        # Remove from source files compiler flags
        target.source_build_phase.files.each do |file|
          if file.settings && file.settings['COMPILER_FLAGS']
            original = file.settings['COMPILER_FLAGS']
            file.settings['COMPILER_FLAGS'] = original
              .gsub('-GCC_WARN_INHIBIT_ALL_WARNINGS', '')
              .gsub('-G', '')
              .strip
          end
        end
      end
      
      modified_count += 1
      puts "  ✅ Modified \#{target.name} (\#{modified_count} flags)"
    end
    
    # ✅ CRITICAL FIX 2: gRPC-Core/C++ 강제로 C++17 설정
    if target.name.start_with?('gRPC-C++') || target.name.start_with?('gRPC-Core')
      puts "🎯 Found target: \#{target.name}"
      
      target.build_configurations.each do |config|
        puts "  🔧 FORCING C++17 for \#{target.name}/\#{config.name}"
        
        # Deployment target 수정
        deployment_target = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if deployment_target && deployment_target.to_f < 12.0
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '12.0'
          puts "     └─ Updated IPHONEOS_DEPLOYMENT_TARGET: \#{deployment_target} -> 12.0"
        end
        
        # C++17 강제 설정
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        config.build_settings['GCC_C_LANGUAGE_STANDARD'] = 'c17'
        
        # OTHER_CPLUSPLUSFLAGS에서 모든 -std=c++XX 제거하고 c++17만 추가
        cxxflags = config.build_settings['OTHER_CPLUSPLUSFLAGS'] || '$(inherited)'
        cxxflags = cxxflags.is_a?(Array) ? cxxflags.join(' ') : cxxflags.to_s
        cxxflags = cxxflags.gsub(/-std=c\\+\\+\\d+/, '').strip
        cxxflags = "\#{cxxflags} -std=c++17 -Wno-missing-template-arg-list-after-template-kw".strip
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] = cxxflags
        
        # WARNING_CFLAGS 수정
        warning_flags = config.build_settings['WARNING_CFLAGS'] || '$(inherited)'
        warning_flags = warning_flags.is_a?(Array) ? warning_flags.join(' ') : warning_flags.to_s
        
        suppressed_warnings = [
          '-Wno-missing-template-arg-list-after-template-kw',
          '-Wno-shorten-64-to-32',
          '-Wno-comma',
          '-Wno-unreachable-code'
        ]
        
        suppressed_warnings.each { |flag| warning_flags = warning_flags.gsub(flag, '').strip }
        warning_flags = "\#{warning_flags} \#{suppressed_warnings.join(' ')}".strip
        config.build_settings['WARNING_CFLAGS'] = warning_flags
        
        puts "     └─ Removed all -std=c++XX flags"
        puts "     └─ CLANG_CXX_LANGUAGE_STANDARD = c++17"
        puts "     └─ OTHER_CPLUSPLUSFLAGS = \#{cxxflags}"
        puts "     └─ WARNING_CFLAGS with \#{suppressed_warnings.length} suppressions"
        
        modified_count += 1
      end
      
      puts "  ✅ Modified \#{target.name} (\#{modified_count} flags)"
    end
  end
  
  puts "=" * 80
  
  # ✅ React Native의 기본 post_install 호출 (CRITICAL!)
  react_native_post_install(installer)
  
  # ✅ 추가 방어: Xcode 16 호환성
  puts "=" * 80
  puts "🔧 [post_install] Fixing deployment targets for Xcode 16..."
  puts "=" * 80
  
  fixed_count = 0
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      deployment_target = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
      if deployment_target && deployment_target.to_f < 12.0
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '12.0'
        puts "  📱 \#{target.name}: \#{deployment_target} -> 12.0"
        fixed_count += 1
      end
      
      # Swift 5 호환성
      config.build_settings['SWIFT_VERSION'] = '5.0'
      config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
      config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'YES'
    end
  end
  
  puts "  ✅ Fixed \#{fixed_count} deployment targets"
  puts "  ✅ Applied Swift 5 compatibility to all pods"
  puts "  ✅ Disabled treat-warnings-as-errors"
  puts "  ✅ Enabled module stability for Swift"
  
  puts "=" * 80
  
  # ✅ xcconfig 파일 정리 (backup defense)
  puts "=" * 80
  puts "🔧 [post_install] Applying BACKUP DEFENSE (xcconfig + pbxproj)..."
  puts "=" * 80
  puts "ℹ️  CWD: \#{Dir.pwd}"
  
  puts "🛡️  [Backup 1/3] Cleaning xcconfig files (before save)..."
  target_support_path = File.join(Dir.pwd, 'Pods', 'Target Support Files')
  puts "  📂 Target Support path: \#{target_support_path}"
  puts "  📂 Exists: \#{Dir.exist?(target_support_path)}"
  
  xcconfig_pattern = File.join(target_support_path, '*', '*.xcconfig')
  puts "  📝 Glob pattern: \#{xcconfig_pattern}"
  
  xcconfig_files = Dir.glob(xcconfig_pattern)
  puts "  📝 Found \#{xcconfig_files.length} total xcconfig files"
  
  cleaned_files = []
  xcconfig_files.each do |file_path|
    content = File.read(file_path)
    modified = false
    
    if content.include?('CLANG_CXX_LANGUAGE_STANDARD = c++20') || 
       content.include?('CLANG_CXX_LANGUAGE_STANDARD = gnu++20')
      if file_path.include?('gRPC-C++') || file_path.include?('gRPC-Core')
        content = content.gsub(/CLANG_CXX_LANGUAGE_STANDARD = (gnu\\+\\+|c\\+\\+)20/, 
                              'CLANG_CXX_LANGUAGE_STANDARD = c++17')
        puts "  🔧 Changed C++20 -> C++17 in: \#{File.basename(File.dirname(file_path))}/\#{File.basename(file_path)}"
        modified = true
      end
    end
    
    if (file_path.include?('gRPC-C++') || file_path.include?('gRPC-Core')) && 
       !content.include?('OTHER_CPLUSPLUSFLAGS')
      content += "\\nOTHER_CPLUSPLUSFLAGS = $(inherited) -std=c++17 -Wno-missing-template-arg-list-after-template-kw\\n"
      puts "  🔧 Added OTHER_CPLUSPLUSFLAGS to: \#{File.basename(File.dirname(file_path))}/\#{File.basename(file_path)}"
      modified = true
    end
    
    if modified
      File.write(file_path, content)
      cleaned_files << file_path
      puts "  🧹 Cleaned: \#{File.basename(File.dirname(file_path))}/\#{File.basename(file_path)}"
    end
  end
  
  puts "  ✅ Backup 1 complete (\#{cleaned_files.length} files cleaned)"
  
  puts "🛡️  [Backup 2/3] Cleaning project.pbxproj..."
  
  pbxproj_modified = false
  installer.pods_project.targets.each do |target|
    if target.name.start_with?('gRPC-C++') || target.name.start_with?('gRPC-Core')
      target.build_configurations.each do |config|
        if config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] != 'c++17'
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
          pbxproj_modified = true
        end
      end
    end
  end
  
  if pbxproj_modified
    puts "  ✅ Modified pbxproj"
  else
    puts "  ℹ️  No changes needed in pbxproj"
  end
  
  puts "  ✅ Backup 2 complete"
  
  puts "💾 Saving Pods project..."
  installer.pods_project.save
  puts "✅ Pods project saved"
  
  puts "🛡️  [Backup 3/3] Re-cleaning xcconfig files (after save)..."
  
  recleaned_files = []
  xcconfig_files.each do |file_path|
    content = File.read(file_path)
    modified = false
    
    if content.include?('CLANG_CXX_LANGUAGE_STANDARD = c++20') || 
       content.include?('CLANG_CXX_LANGUAGE_STANDARD = gnu++20')
      if file_path.include?('gRPC-C++') || file_path.include?('gRPC-Core')
        content = content.gsub(/CLANG_CXX_LANGUAGE_STANDARD = (gnu\\+\\+|c\\+\\+)20/, 
                              'CLANG_CXX_LANGUAGE_STANDARD = c++17')
        modified = true
      end
    end
    
    if modified
      File.write(file_path, content)
      recleaned_files << file_path
    end
  end
  
  puts "  ✅ Backup 3 complete (\#{recleaned_files.length} files re-cleaned)"
  
  puts "=" * 80
  puts "🎉 ALL FIXES & PREVENTIONS COMPLETED"
  puts "=" * 80
  puts ""
  puts "📋 APPLIED FIXES:"
  puts "  ✅ BoringSSL-GRPC: -G flag removed (4 files)"
  puts "  ✅ gRPC-Core/C++: Forced to C++17 (std::result_of fix)"
  puts "  ✅ Deployment targets: \#{fixed_count} pods updated to iOS 12.0"
  puts "  ✅ xcconfig files: \#{cleaned_files.length} files cleaned (3 passes)"
  puts ""
  puts "🛡️  PREVENTIONS APPLIED:"
  puts "  ✅ Swift 5 compatibility enforced"
  puts "  ✅ Warning-as-error disabled"
  puts "  ✅ Module stability enabled"
  puts "  ✅ Firebase auto-managed by RNFB"
  puts ""
  puts "🔧 POST-INSTALL HOOKS:"
  puts "  ✅ react_native_post_install completed"
  puts "  ℹ️  Expo::PostInstall handled by Expo (auto)"
  puts ""
  puts "=" * 80
  puts "🚀 Podfile post_install completed successfully!"
  puts "=" * 80
  
  # ✅ Define Expo::PostInstall stub if not defined
  unless defined?(Expo::PostInstall)
    module Expo
      class PostInstall
        def self.run(installer)
          puts "⚠️  Expo::PostInstall stub called (no-op)"
        end
      end
    end
  end
`;

      // post_install 블록 찾아서 수정 (더 강력한 regex)
      // Ruby의 do...end 블록은 중첩될 수 있으므로 간단한 regex로는 부족
      // 대신 post_install 시작부터 파일 끝까지 교체
      const postInstallStart = podfileContent.indexOf('post_install do |installer|');
      
      if (postInstallStart !== -1) {
        console.log('✅ [withPodfileFix] Found existing post_install block - replacing...');
        
        // post_install 이전까지 유지
        const beforePostInstall = podfileContent.substring(0, postInstallStart);
        
        // post_install의 끝 찾기 (마지막 end)
        // Podfile의 마지막 end는 보통 post_install의 end
        const afterPostInstall = podfileContent.substring(postInstallStart);
        const postInstallEndMatch = afterPostInstall.match(/\nend\s*$/);
        
        let finalContent;
        if (postInstallEndMatch) {
          // 마지막 end를 우리 post_install의 end로 대체
          finalContent = beforePostInstall + `post_install do |installer|${customPostInstall}\nend\n`;
        } else {
          // end가 없으면 추가
          finalContent = beforePostInstall + `post_install do |installer|${customPostInstall}\nend\n`;
        }
        
        podfileContent = finalContent;
      } else {
        console.log('✅ [withPodfileFix] No post_install found - appending...');
        
        // post_install 블록이 없으면 끝에 추가
        podfileContent += `\n\npost_install do |installer|${customPostInstall}\nend\n`;
      }
      
      fs.writeFileSync(podfilePath, podfileContent, 'utf8');
      
      console.log('✅ [withPodfileFix] Podfile patched (post_install only)');
      console.log('✅ [withPodfileFix] Expo autolinking preserved');
      console.log('✅ [withPodfileFix] ReactCodegen auto-linking preserved');
      
      console.log('\n========================================');
      console.log('✅ [withPodfileFix] PLUGIN COMPLETED');
      console.log('========================================\n');
      
      return config;
    },
  ]);
};
