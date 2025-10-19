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
        # 모든 C/C++ 플래그 키에서 -G 제거
        flag_keys = [
          'OTHER_CFLAGS',
          'OTHER_CPLUSPLUSFLAGS', 
          'WARNING_CFLAGS',
          'OTHER_CFLAGS[sdk=iphoneos*]',
          'OTHER_CPLUSPLUSFLAGS[sdk=iphoneos*]',
          'WARNING_CFLAGS[sdk=iphoneos*]',
          'OTHER_CFLAGS[sdk=iphonesimulator*]',
          'OTHER_CPLUSPLUSFLAGS[sdk=iphonesimulator*]'
        ]
        
        flag_keys.each do |key|
          next unless config.build_settings[key]
          
          flags = config.build_settings[key]
          
          # 배열 처리
          if flags.is_a?(Array)
            flags.reject! { |f| f.to_s =~ /-G(\\s|$)/ }
            config.build_settings[key] = flags.empty? ? ['$(inherited)'] : flags
          # 문자열 처리
          elsif flags.is_a?(String)
            flags.gsub!(/ -G /, ' ')
            flags.gsub!(/ -G$/, '')
            flags.gsub!(/^-G /, '')
            config.build_settings[key] = flags.strip.empty? ? '$(inherited)' : flags
          end
        end

        puts "🧩 [#{name}] Scrubbed -G flags from all build settings (#{config.name})"
      end

      # iOS 15.1+ deployment target 강제
      config.build_settings.delete 'IPHONEOS_DEPLOYMENT_TARGET'
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'

      # ✅ 전역 빌드 안정성 설정
      config.build_settings['ENABLE_BITCODE'] = 'NO'
      config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'YES'
    end
  end
  
         # ✅ 추가: .xcconfig 파일에서도 -G 플래그 제거 (강화된 버전)
         puts "🧹 [post_install] Cleaning -G flags from xcconfig files..."
         
         xcconfig_path = File.join(Dir.pwd, 'Pods', 'Target Support Files')
         puts "📂 [post_install] Looking in: #{xcconfig_path}"
         
         if Dir.exist?(xcconfig_path)
           cleaned_files = 0
           Dir.glob("#{xcconfig_path}/**/*.xcconfig").each do |file|
             if file.include?('BoringSSL') || file.include?('gRPC')
               content = File.read(file)
               original_content = content.dup
               
               puts "  🔍 Checking: #{File.basename(file)}"
               
               # 더 강력한 -G 플래그 제거 (모든 경우의 수 커버)
               # 1. 공백으로 구분된 -G
               content.gsub!(/\s+-G\s+/, ' ')
               # 2. 줄 끝의 -G
               content.gsub!(/\s+-G$/, '')
               # 3. 줄 시작의 -G
               content.gsub!(/^-G\s+/, '')
               # 4. 단독 -G (공백 없이)
               content.gsub!(/\s+-G(?=\s|$)/, ' ')
               # 5. 다른 플래그와 붙어있는 경우
               content.gsub!(/-G\s+/, '')
               # 6. 공백이 여러 개인 경우 정리
               content.gsub!(/\s+/, ' ')
               content.strip!
               
               if content != original_content
                 File.write(file, content)
                 cleaned_files += 1
                 puts "  ✅ Cleaned: #{File.basename(file)}"
                 puts "    Before: #{original_content.gsub(/\n/, ' ').strip[0..100]}..."
                 puts "    After:  #{content.gsub(/\n/, ' ').strip[0..100]}..."
               else
                 puts "  ℹ️  No -G flags found in: #{File.basename(file)}"
               end
             end
           end
           
           puts "✅ [post_install] xcconfig files cleaned (#{cleaned_files} files modified)"
         else
           puts "⚠️  [post_install] xcconfig directory not found!"
         end
    
  puts "✅ [post_install] Custom build settings applied successfully"
end`;
        
        // 새로운 Podfile 저장
        fs.writeFileSync(podfilePath, newPodfileContent);
        console.log('✅ [withPodfileFix] Podfile completely replaced with fixed version');
        
        // 검증
        const updatedContent = fs.readFileSync(podfilePath, 'utf8');
        if (updatedContent.includes('BoringSSL') && updatedContent.includes('-G')) {
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
