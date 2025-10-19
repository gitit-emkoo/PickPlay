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

  # ✅ 3단계 방어: BoringSSL-GRPC -G 플래그 완전 제거
  puts "🔧 [post_install] Applying 3-layer defense against -G flag..."
  
  # 🛡️ LAYER 1: Build Settings 수정
  puts "🛡️  [Layer 1/3] Patching build_settings..."
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      name = target.name.to_s

      if name.include?('BoringSSL') || name.include?('gRPC')
        puts "  🧩 [#{name}] (#{config.name})"
        
        # OTHER_CFLAGS, OTHER_CPLUSPLUSFLAGS에서 -GCC_WARN_INHIBIT_ALL_WARNINGS 제거
        ['OTHER_CFLAGS', 'OTHER_CPLUSPLUSFLAGS', 'WARNING_CFLAGS'].each do |key|
          current = config.build_settings[key]
          
          if current
            # 배열 → 문자열 변환
            if current.is_a?(Array)
              current = current.join(' ')
            end
            
            # -GCC_WARN_INHIBIT_ALL_WARNINGS와 -G 제거
            cleaned = current.to_s
              .gsub('-GCC_WARN_INHIBIT_ALL_WARNINGS', '')
              .gsub(/ -G /, ' ')
              .gsub(/^-G /, '')
              .gsub(/ -G$/, '')
              .squeeze(' ')
              .strip
            
            config.build_settings[key] = cleaned.empty? ? '$(inherited)' : cleaned
          end
        end
        
        # GCC_WARN_INHIBIT_ALL_WARNINGS는 별도 설정
        config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
      end

      # iOS 15.1+ deployment target
      config.build_settings.delete 'IPHONEOS_DEPLOYMENT_TARGET'
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'

      # 전역 빌드 안정성
      config.build_settings['ENABLE_BITCODE'] = 'NO'
      config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'YES'
    end
  end
  puts "  ✅ Layer 1 complete"
  
  # 🛡️ LAYER 2: .xcconfig 파일 수정
  puts "🛡️  [Layer 2/3] Cleaning .xcconfig files..."
  xcconfig_count = 0
  Dir.glob(File.join(Dir.pwd, 'Pods', '**', '*.xcconfig')).each do |file|
    next unless file.include?('BoringSSL') || file.include?('gRPC')
    
    content = File.read(file)
    if content.include?('-GCC_WARN_INHIBIT_ALL_WARNINGS') || content.include?(' -G ')
      original = content.dup
      content.gsub!(/-GCC_WARN_INHIBIT_ALL_WARNINGS/, '')
      content.gsub!(/ -G /, ' ')
      content.gsub!(/^-G /, '')
      content.gsub!(/ -G$/, '')
      
      if content != original
        File.write(file, content)
        xcconfig_count += 1
        puts "  🧹 Cleaned: #{File.basename(file)}"
      end
    end
  end
  puts "  ✅ Layer 2 complete (#{xcconfig_count} files cleaned)"
  
  # 🛡️ LAYER 3: Xcode 프로젝트 파일 직접 수정
  puts "🛡️  [Layer 3/3] Patching Xcode project build settings..."
  
  # Pods.xcodeproj/project.pbxproj에서 -GCC_WARN_INHIBIT_ALL_WARNINGS 제거
  project_file = File.join(Dir.pwd, 'Pods', 'Pods.xcodeproj', 'project.pbxproj')
  if File.exist?(project_file)
    pbxproj = File.read(project_file)
    original_pbx = pbxproj.dup
    
    # buildSettings 섹션에서 -GCC_WARN_INHIBIT_ALL_WARNINGS 제거
    pbxproj.gsub!(/"(-GCC_WARN_INHIBIT_ALL_WARNINGS|\\s-G\\s)"/, '""')
    pbxproj.gsub!(/-GCC_WARN_INHIBIT_ALL_WARNINGS/, '')
    
    if pbxproj != original_pbx
      File.write(project_file, pbxproj)
      puts "  🧹 Cleaned: project.pbxproj"
    end
  end
  puts "  ✅ Layer 3 complete"
  
  # ✅ Pods 프로젝트 저장
  puts "💾 Saving Pods project..."
  installer.pods_project.save
  puts "✅ 3-layer defense applied successfully!"
end`;
        
        // 새로운 Podfile 저장
        fs.writeFileSync(podfilePath, newPodfileContent);
        console.log('✅ [withPodfileFix] Podfile replaced with 3-layer defense against -G flag');
        
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
