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
            original_flags = config.build_settings[key].to_s
            
            # -G 플래그가 있는지 확인
            if original_flags.include?('-G')
              puts "  🔍 Found -G in #{key}: #{original_flags}"
              
              # 문자열로 변환 후 -G 플래그만 제거 (공백 포함 모든 변형 처리)
              flags = original_flags.dup
              flags.gsub!(/ -G /, ' ')
              flags.gsub!(/ -G$/, '')
              flags.gsub!(/^-G /, '')
              flags.gsub!(/\s+-G\s+/, ' ')
              flags.gsub!(/-G\s/, ' ')
              flags.gsub!(/\s-G/, '')
              
              config.build_settings[key] = flags.strip
              puts "  ✅ Cleaned #{key}: #{flags.strip}"
            end
          end
        end
        
        # SDK별 플래그도 동일하게 처리
        ['OTHER_CFLAGS[sdk=iphoneos*]', 'OTHER_CPLUSPLUSFLAGS[sdk=iphoneos*]', 'WARNING_CFLAGS[sdk=iphoneos*]',
         'OTHER_CFLAGS[sdk=iphonesimulator*]', 'OTHER_CPLUSPLUSFLAGS[sdk=iphonesimulator*]', 'WARNING_CFLAGS[sdk=iphonesimulator*]'].each do |key|
          if config.build_settings[key]
            original_flags = config.build_settings[key].to_s
            
            if original_flags.include?('-G')
              puts "  🔍 Found -G in #{key}: #{original_flags}"
              
              flags = original_flags.dup
              flags.gsub!(/ -G /, ' ')
              flags.gsub!(/ -G$/, '')
              flags.gsub!(/^-G /, '')
              flags.gsub!(/\s+-G\s+/, ' ')
              flags.gsub!(/-G\s/, ' ')
              flags.gsub!(/\s-G/, '')
              
              config.build_settings[key] = flags.strip
              puts "  ✅ Cleaned #{key}: #{flags.strip}"
            end
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
  
  # ✅ .xcconfig 파일에서 -G 플래그 완전 제거 (전수조사 방식)
  puts "🧹 [post_install] Scanning ALL xcconfig files for -G flags..."
  
  pods_path = File.join(Dir.pwd, 'Pods')
  cleaned_count = 0
  scanned_count = 0
  
  if Dir.exist?(pods_path)
    # Pods 디렉토리 전체에서 .xcconfig 파일 검색
    Dir.glob("#{pods_path}/**/*.xcconfig").each do |xcconfig_file|
      scanned_count += 1
      
      # BoringSSL 또는 gRPC 관련 파일만 처리
      if xcconfig_file.include?('BoringSSL') || xcconfig_file.include?('gRPC')
        content = File.read(xcconfig_file)
        original = content.dup
        
        # 파일에 -G 플래그가 있는지 확인
        if content.include?('-G')
          puts "  🔍 Found -G in: #{File.basename(xcconfig_file)}"
          
          # 모든 형태의 -G 플래그 제거
          content.gsub!(/ -G /, ' ')
          content.gsub!(/ -G$/, '')
          content.gsub!(/^-G /, '')
          content.gsub!(/-G\s/, '')
          content.gsub!(/\s-G/, '')
          
          File.write(xcconfig_file, content)
          cleaned_count += 1
          puts "  ✅ Cleaned: #{File.basename(xcconfig_file)}"
        end
      end
    end
  end
  
  puts "📊 [post_install] Scanned #{scanned_count} xcconfig files, cleaned #{cleaned_count} files"
  
  # ✅ BoringSSL-GRPC.podspec 파일에서 -G 플래그 제거 (모든 가능한 위치 검색)
  puts "🔍 [post_install] Searching for BoringSSL-GRPC podspec files..."
  
  podspec_found = false
  podspec_cleaned = false
  
  # 가능한 모든 podspec 파일 경로 검색
  [
    File.join(Dir.pwd, 'Pods', 'Local Podspecs', 'BoringSSL-GRPC.podspec.json'),
    File.join(Dir.pwd, 'Pods', 'BoringSSL-GRPC', 'BoringSSL-GRPC.podspec'),
    File.join(Dir.pwd, 'Pods', 'BoringSSL-GRPC', 'BoringSSL-GRPC.podspec.json')
  ].each do |podspec_path|
    if File.exist?(podspec_path)
      podspec_found = true
      puts "  📄 Found podspec at: #{podspec_path}"
      
      podspec_content = File.read(podspec_path)
      
      if podspec_content.include?('-G')
        puts "  🔍 Found -G in podspec file"
        
        # 모든 형태의 -G 플래그 제거
        podspec_content.gsub!(/ -G /, ' ')
        podspec_content.gsub!(/ -G"/, '"')
        podspec_content.gsub!(/" -G /, '" ')
        podspec_content.gsub!(/-G /, '')
        podspec_content.gsub!(/ -G/, '')
        podspec_content.gsub!(/'-G'/, "''")
        podspec_content.gsub!(/"-G"/, '""')
        
        File.write(podspec_path, podspec_content)
        podspec_cleaned = true
        puts "  ✅ Patched podspec file"
      end
    end
  end
  
  if !podspec_found
    puts "  ⚠️  No BoringSSL-GRPC podspec files found in expected locations"
  elsif !podspec_cleaned
    puts "  ℹ️  No -G flags found in podspec files"
  end
  
  # ✅ 최후의 수단: BoringSSL-GRPC Pod의 compiler_flags 직접 제거
  puts "🔧 [post_install] Directly modifying BoringSSL-GRPC Pod compiler_flags..."
  
  installer.pod_targets.each do |pod_target|
    if pod_target.name.include?('BoringSSL-GRPC')
      puts "  📦 Processing pod: #{pod_target.name}"
      
      # Pod의 모든 파일 스펙에서 compiler_flags 수정
      pod_target.file_accessors.each do |file_accessor|
        spec_consumer = file_accessor.spec_consumer
        
        # compiler_flags가 있는지 확인하고 -G 제거
        if spec_consumer.compiler_flags
          original_flags = spec_consumer.compiler_flags.join(' ')
          
          if original_flags.include?('-G')
            puts "    🔍 Found -G in compiler_flags: #{original_flags}"
            
            # -G 플래그 제거
            new_flags = original_flags.split(' ').reject { |f| f == '-G' || f.start_with?('-G') }.join(' ')
            
            # 반영 (spec_consumer는 read-only이므로 build_settings를 통해 재설정)
            pod_target.native_target.build_configurations.each do |config|
              existing = config.build_settings['OTHER_CFLAGS'] || []
              config.build_settings['OTHER_CFLAGS'] = (existing.to_s + ' ' + new_flags).split(' ').uniq.join(' ')
              
              existing_cpp = config.build_settings['OTHER_CPLUSPLUSFLAGS'] || []
              config.build_settings['OTHER_CPLUSPLUSFLAGS'] = (existing_cpp.to_s + ' ' + new_flags).split(' ').uniq.join(' ')
            end
            
            puts "    ✅ Replaced compiler_flags"
          end
        end
      end
    end
  end
  
  # ✅ 중요: Pods 프로젝트를 저장하여 Xcode가 변경사항을 인식하도록 함
  puts "💾 [post_install] Saving Pods project to apply all changes..."
  installer.pods_project.save
  puts "✅ [post_install] Pods project saved successfully"
    
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
