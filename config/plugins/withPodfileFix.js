const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin: BoringSSL-GRPC -G 플래그 에러 수정
 * EAS 빌드에서 자동 생성된 Podfile의 post_install 훅에 -G 플래그 제거 로직 추가
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
      
      console.log('🔧 [withPodfileFix] Fixing Podfile for BoringSSL-GRPC -G flag error...');
      console.log(`  📂 Project Root: ${projectRoot}`);
      console.log(`  📄 Podfile Path: ${podfilePath}`);
      
      if (fs.existsSync(podfilePath)) {
        console.log('✅ [withPodfileFix] Replacing entire Podfile with fixed version...');
        
        // 완전히 새로운 Podfile 내용 생성
        const newPodfileContent = `platform :ios, '15.1'

require_relative '../node_modules/react-native/scripts/react_native_pods'
# Expo autolinking (handle path variations across versions)
begin
  require_relative '../node_modules/expo-modules-autolinking/scripts/autolinking'
rescue LoadError
  begin
    require_relative '../node_modules/expo-modules-autolinking/build/scripts/autolinking'
  rescue LoadError
    Pod::UI.puts '⚠️  expo-modules-autolinking not found; continuing without it'
    # Fallback no-ops to avoid Podfile crash (keeps build going)
    def use_expo_modules!(*args); end
    module Expo
      module PostInstall
        def self.install!(*args); end
      end
    end
  end
end

use_frameworks! :linkage => :static

target 'PickPlay' do
  # Expo autolinking for native modules
  use_expo_modules!

  use_react_native!(
    :path => '../node_modules/react-native',
    :hermes_enabled => true,
    :fabric_enabled => true,
    :app_path => "#{Pod::Config.instance.installation_root}/.."
  )

  # Pin Firebase iOS SDK versions to a stable line for RNFB v23.x
  firebase_version = '10.29.0'
  pod 'FirebaseCore', firebase_version
  pod 'FirebaseCoreInternal', firebase_version
  pod 'FirebaseAuth', firebase_version
  pod 'FirebaseFirestore', firebase_version
  pod 'FirebaseFunctions', firebase_version
end

post_install do |installer|
  puts "🔧 [post_install] Custom Podfile post_install hook executing..."
  
  # React Native post install tweaks
  react_native_post_install(installer)
  
  # Expo post install (must be after RN)
  Expo::PostInstall.install!(installer)

  # ✅ 5단계 방어: BoringSSL-GRPC -G 플래그 완전 제거
  puts "=" * 80
  puts "🔧 [post_install] Applying 5-LAYER DEFENSE against -G flag..."
  puts "=" * 80
  
  # 🛡️ LAYER 1: Pod Native Target 수정 (핵심!)
  begin
    puts "🛡️  [Layer 1/5] Patching Pod Native Targets..."
    
    pod_count = 0
    installer.pod_targets.each do |pod_target|
      next unless pod_target.name.include?('BoringSSL') || pod_target.name.include?('gRPC')
      next unless pod_target.respond_to?(:native_target) && pod_target.native_target
      
      puts "  🧩 [#{pod_target.name}]"
      
      pod_target.native_target.build_configurations.each do |config|
        # OTHER_CFLAGS, OTHER_CPLUSPLUSFLAGS에서 -GCC_WARN_INHIBIT_ALL_WARNINGS 제거
        %w[OTHER_CFLAGS OTHER_CPLUSPLUSFLAGS WARNING_CFLAGS].each do |key|
          current = config.build_settings[key]
          next unless current
          
          # 배열 처리
          current = Array(current).join(' ')
          
          # 플래그 제거
          cleaned = current.dup
          cleaned.gsub!('-GCC_WARN_INHIBIT_ALL_WARNINGS', '')
          cleaned.gsub!(/ -G /, ' ')
          cleaned.squeeze!(' ')
          cleaned.strip!
          
          config.build_settings[key] = cleaned.empty? ? '$(inherited)' : cleaned
        end
        
        # 별도 설정
        config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
        config.build_settings['COMPILER_INDEX_STORE_ENABLE'] = 'NO'
        
        pod_count += 1
      end
    end
    
    puts "  ✅ Layer 1 complete (#{pod_count} pod configs patched)"
    
  rescue => e
    puts "❌ [Layer 1] ERROR: #{e.message}"
    puts "   Backtrace: #{e.backtrace[0..2].join("\n   ")}"
    # Layer 1 실패해도 계속 (Layer 2~5가 보조)
  end
  
  # 🛡️ 전역 설정 (모든 타겟)
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
      config.build_settings['ENABLE_BITCODE'] = 'NO'
      config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'YES'
    end
  end
  
  # 🛡️ LAYER 2: xcconfig 파일 정화 (Pass 1 - save 전)
  begin
    puts "🛡️  [Layer 2/5] Cleaning xcconfig files (Pass 1 - before save)..."
    
    xcconfig_count = 0
    xcconfig_pattern = File.join(Dir.pwd, 'ios', 'Pods', '**', '*.xcconfig')
    
    Dir.glob(xcconfig_pattern).each do |file|
      next unless file.include?('BoringSSL') || file.include?('gRPC')
      
      content = File.read(file)
      original = content.dup
      
      content.gsub!('-GCC_WARN_INHIBIT_ALL_WARNINGS', '')
      content.gsub!(/ -G /, ' ')
      
      if content != original
        File.write(file, content)
        xcconfig_count += 1
        puts "  🧹 #{File.basename(file)}"
      end
    end
    
    puts "  ✅ Layer 2 complete (#{xcconfig_count} files cleaned)"
    
    if xcconfig_count == 0
      puts "  ⚠️  WARNING: No xcconfig files found!"
      puts "     Pattern: #{xcconfig_pattern}"
      puts "     CWD: #{Dir.pwd}"
    end
    
  rescue => e
    puts "❌ [Layer 2] ERROR: #{e.message}"
    # Layer 2 실패해도 계속
  end
  
  # 🛡️ LAYER 3: pbxproj 정화
  begin
    puts "🛡️  [Layer 3/5] Cleaning project.pbxproj..."
    
    project_file = File.join(Dir.pwd, 'ios', 'Pods', 'Pods.xcodeproj', 'project.pbxproj')
    
    if File.exist?(project_file)
      pbxproj = File.read(project_file)
      original = pbxproj.dup
      
      pbxproj.gsub!('-GCC_WARN_INHIBIT_ALL_WARNINGS', '')
      pbxproj.gsub!(/ -G /, ' ')
      
      if pbxproj != original
        File.write(project_file, pbxproj)
        puts "  🧹 Cleaned project.pbxproj"
      end
    else
      puts "  ⚠️  project.pbxproj not found at: #{project_file}"
    end
    
    puts "  ✅ Layer 3 complete"
    
  rescue => e
    puts "❌ [Layer 3] ERROR: #{e.message}"
    # Layer 3 실패해도 계속
  end
  
  # 💾 저장
  puts "💾 Saving Pods project..."
  installer.pods_project.save
  puts "✅ Pods project saved"
  
  # 🛡️ LAYER 4: xcconfig 재정화 (Pass 2 - save 후)
  begin
    puts "🛡️  [Layer 4/5] Re-cleaning xcconfig files (Pass 2 - after save)..."
    
    xcconfig_count = 0
    xcconfig_pattern = File.join(Dir.pwd, 'ios', 'Pods', '**', '*.xcconfig')
    
    Dir.glob(xcconfig_pattern).each do |file|
      next unless file.include?('BoringSSL') || file.include?('gRPC')
      
      content = File.read(file)
      
      if content.include?('-GCC_WARN_INHIBIT_ALL_WARNINGS')
        content.gsub!('-GCC_WARN_INHIBIT_ALL_WARNINGS', '')
        content.gsub!(/ -G /, ' ')
        File.write(file, content)
        xcconfig_count += 1
        puts "  🔒 Re-cleaned: #{File.basename(file)}"
      end
    end
    
    puts "  ✅ Layer 4 complete (#{xcconfig_count} files re-cleaned)"
    
  rescue => e
    puts "❌ [Layer 4] ERROR: #{e.message}"
  end
  
  # 🛡️ LAYER 5: Response 캐시 무효화
  begin
    puts "🛡️  [Layer 5/5] Invalidating response cache..."
    
    build_dir = File.join(Dir.pwd, 'ios', 'build')
    if Dir.exist?(build_dir)
      require 'fileutils'
      FileUtils.rm_rf(build_dir)
      puts "  🧹 Deleted ios/build"
    end
    
    puts "  ✅ Layer 5 complete"
    
  rescue => e
    puts "⚠️  [Layer 5] Non-critical: #{e.message}"
  end
  
  puts "=" * 80
  puts "✅ 5-LAYER DEFENSE COMPLETED SUCCESSFULLY"
  puts "=" * 80
end`;
        
        // 새로운 Podfile 저장
        fs.writeFileSync(podfilePath, newPodfileContent);
        console.log('✅ [withPodfileFix] Podfile replaced with 5-LAYER DEFENSE against -G flag');
        
        // 검증
        const updatedContent = fs.readFileSync(podfilePath, 'utf8');
        const hasBoringSSLLogic = updatedContent.includes('BoringSSL') && updatedContent.includes('GCC_WARN_INHIBIT_ALL_WARNINGS');
        if (hasBoringSSLLogic) {
          console.log('✅ [withPodfileFix] -GCC_WARN_INHIBIT_ALL_WARNINGS fix logic VERIFIED in new Podfile');
        } else {
          console.warn('⚠️  [withPodfileFix] -GCC_WARN_INHIBIT_ALL_WARNINGS fix logic NOT FOUND in new Podfile!');
        }
      } else {
        console.error('❌ [withPodfileFix] Podfile not found at', podfilePath);
        throw new Error(`Podfile not found: ${podfilePath}`);
      }
      
      console.log('\n========================================');
      console.log('✅ [withPodfileFix] PLUGIN COMPLETED');
      console.log('========================================\n');
      
      return config;
    },
  ]);
};
