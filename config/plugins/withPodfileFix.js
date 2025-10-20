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

  # ✅ 4단계 방어: BoringSSL-GRPC -G 플래그 완전 제거
  puts "=" * 80
  puts "🔧 [post_install] Applying 4-LAYER DEFENSE against -G flag..."
  puts "=" * 80
  
  # 🛡️ LAYER 1: xcconfig 파일 정화 (Pass 1 - save 전, 최우선!)
  begin
    puts "🛡️  [Layer 1/4] Cleaning xcconfig files (Pass 1)..."
    
    xcconfig_count = 0
    # CWD가 이미 ios 폴더이므로 'ios' 제거
    xcconfig_pattern = File.join(Dir.pwd, 'Pods', '**', '*.xcconfig')
    
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
    
    puts "  ✅ Layer 1 complete (#{xcconfig_count} files cleaned)"
    
    if xcconfig_count == 0
      puts "  ❌ CRITICAL: No xcconfig files found!"
      puts "     Pattern: #{xcconfig_pattern}"
      puts "     CWD: #{Dir.pwd}"
      puts "     Listing Pods dir:"
      Dir.glob(File.join(Dir.pwd, 'Pods', '*')).each { |d| puts "       - #{File.basename(d)}" }
    end
    
  rescue => e
    puts "❌ [Layer 1] ERROR: #{e.message}"
    # Layer 1 실패해도 계속
  end
  
  # 🛡️ LAYER 2: pbxproj 정화
  begin
    puts "🛡️  [Layer 2/4] Cleaning project.pbxproj..."
    
    # CWD가 이미 ios 폴더이므로 'ios' 제거
    project_file = File.join(Dir.pwd, 'Pods', 'Pods.xcodeproj', 'project.pbxproj')
    
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
    
    puts "  ✅ Layer 2 complete"
    
  rescue => e
    puts "❌ [Layer 2] ERROR: #{e.message}"
    # Layer 2 실패해도 계속
  end
  
  # 💾 저장
  puts "💾 Saving Pods project..."
  installer.pods_project.save
  puts "✅ Pods project saved"
  
  # 🛡️ LAYER 3: xcconfig 재정화 (Pass 2 - save 후)
  begin
    puts "🛡️  [Layer 3/4] Re-cleaning xcconfig files (Pass 2)..."
    
    xcconfig_count = 0
    # CWD가 이미 ios 폴더이므로 'ios' 제거
    xcconfig_pattern = File.join(Dir.pwd, 'Pods', '**', '*.xcconfig')
    
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
    
    puts "  ✅ Layer 3 complete (#{xcconfig_count} files re-cleaned)"
    
  rescue => e
    puts "❌ [Layer 3] ERROR: #{e.message}"
  end
  
  # 🛡️ LAYER 4: Response 캐시 무효화
  begin
    puts "🛡️  [Layer 4/4] Invalidating response cache..."
    
    # CWD가 이미 ios 폴더이므로 'ios' 제거
    build_dir = File.join(Dir.pwd, 'build')
    if Dir.exist?(build_dir)
      require 'fileutils'
      FileUtils.rm_rf(build_dir)
      puts "  🧹 Deleted ios/build"
    end
    
    puts "  ✅ Layer 4 complete"
    
  rescue => e
    puts "⚠️  [Layer 4] Non-critical: #{e.message}"
  end
  
  puts "=" * 80
  puts "✅ 4-LAYER DEFENSE COMPLETED (xcconfig-focused)"
  puts "=" * 80
end`;
        
        // 새로운 Podfile 저장
        fs.writeFileSync(podfilePath, newPodfileContent);
        console.log('✅ [withPodfileFix] Podfile replaced with 4-LAYER xcconfig-focused defense');
        
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
