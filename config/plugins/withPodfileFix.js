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

  # ✅ BoringSSL-GRPC: -G 플래그 제거 (iOS arm64 타겟에서 에러)
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      name = target.name.to_s

      if name.include?('BoringSSL') || name.include?('gRPC')
        puts "🧩 [#{name}] Removing -G flags from compiler settings (#{config.name})"
        
        # GitHub Issue #36888 해결책: 기존 플래그 유지하면서 -G만 제거
        ['OTHER_CFLAGS', 'OTHER_CPLUSPLUSFLAGS', 'WARNING_CFLAGS'].each do |key|
          if config.build_settings[key]
            # 문자열로 변환 후 -G 플래그만 제거 (공백 포함 모든 변형 처리)
            flags = config.build_settings[key].to_s
            flags = flags.gsub(/ -G /, ' ')
            flags = flags.gsub(/ -G$/, '')
            flags = flags.gsub(/^-G /, '')
            flags = flags.gsub(/\s+-G\s+/, ' ')
            config.build_settings[key] = flags.strip
            
            puts "  ✅ Cleaned #{key}: #{flags.strip}"
          end
        end
        
        # SDK별 플래그도 동일하게 처리
        ['OTHER_CFLAGS[sdk=iphoneos*]', 'OTHER_CPLUSPLUSFLAGS[sdk=iphoneos*]', 'WARNING_CFLAGS[sdk=iphoneos*]',
         'OTHER_CFLAGS[sdk=iphonesimulator*]', 'OTHER_CPLUSPLUSFLAGS[sdk=iphonesimulator*]', 'WARNING_CFLAGS[sdk=iphonesimulator*]'].each do |key|
          if config.build_settings[key]
            flags = config.build_settings[key].to_s
            flags = flags.gsub(/ -G /, ' ').gsub(/ -G$/, '').gsub(/^-G /, '').gsub(/\s+-G\s+/, ' ')
            config.build_settings[key] = flags.strip
          end
        end
      end

      # iOS 15.1+ deployment target 강제
      config.build_settings.delete 'IPHONEOS_DEPLOYMENT_TARGET'
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'

      # ✅ 전역 빌드 안정성 설정
      config.build_settings['ENABLE_BITCODE'] = 'NO'
      config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'YES'
    end
  end
  
  # ✅ .xcconfig 파일에서 -G 플래그 완전 제거
  puts "🧹 [post_install] Cleaning -G flags from xcconfig files..."
  
  xcconfig_path = File.join(Dir.pwd, 'Pods', 'Target Support Files')
  cleaned_count = 0
  
  if Dir.exist?(xcconfig_path)
    ['BoringSSL-GRPC', 'gRPC-C++', 'gRPC-Core'].each do |pod_name|
      ['debug', 'release'].each do |config_type|
        xcconfig_file = File.join(xcconfig_path, pod_name, "#{pod_name}.#{config_type}.xcconfig")
        
        if File.exist?(xcconfig_file)
          content = File.read(xcconfig_file)
          original = content.dup
          
          # 모든 형태의 -G 플래그 제거 (간단하고 확실한 방법)
          content.gsub!(/ -G /, ' ')
          content.gsub!(/ -G$/, '')
          content.gsub!(/^-G /, '')
          content.gsub!(/-G(?=\s)/, '')
          
          if content != original
            File.write(xcconfig_file, content)
            cleaned_count += 1
            puts "  ✅ Cleaned: #{pod_name}.#{config_type}.xcconfig"
          end
        end
      end
    end
  end
  
  puts "✅ [post_install] Cleaned #{cleaned_count} xcconfig files"
    
  puts "✅ [post_install] Custom build settings applied successfully"
end`;
        
        // 새로운 Podfile 저장
        fs.writeFileSync(podfilePath, newPodfileContent);
        console.log('✅ [withPodfileFix] Podfile completely replaced with fixed version');
        
        // 검증
        const updatedContent = fs.readFileSync(podfilePath, 'utf8');
        const hasBoringSSLLogic = updatedContent.includes('BoringSSL') && updatedContent.includes('Resetting compiler flags');
        if (hasBoringSSLLogic) {
          console.log('✅ [withPodfileFix] -G flag removal logic VERIFIED in new Podfile');
        } else {
          console.warn('⚠️  [withPodfileFix] -G flag removal logic NOT FOUND in new Podfile!');
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
