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
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');
        
        // post_install 훅이 이미 있는지 확인
        if (podfileContent.includes('post_install do |installer|')) {
          console.log('✅ [withPodfileFix] post_install hook already exists, adding -G flag removal logic...');
          
          // 기존 post_install 훅에 -G 플래그 제거 로직 추가
          const gFlagRemovalLogic = `
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
    end
  end`;
          
          // post_install 훅 끝 부분에 로직 추가 (end 앞에)
          const endPattern = /(\s+)(end\s*)$/m;
          if (endPattern.test(podfileContent)) {
            podfileContent = podfileContent.replace(endPattern, `$1${gFlagRemovalLogic}\n$1end`);
          }
        } else {
          console.log('✅ [withPodfileFix] Adding new post_install hook with -G flag removal logic...');
          
          // 새로운 post_install 훅 추가
          const newPostInstallHook = `
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
    
  puts "✅ [post_install] Custom build settings applied successfully"
end`;
          
          podfileContent += newPostInstallHook;
        }
        
        // 수정된 Podfile 저장
        fs.writeFileSync(podfilePath, podfileContent);
        console.log('✅ [withPodfileFix] Podfile fixed successfully');
        
        // 검증
        const updatedContent = fs.readFileSync(podfilePath, 'utf8');
        if (updatedContent.includes('BoringSSL') && updatedContent.includes('-G')) {
          console.log('✅ [withPodfileFix] -G flag removal logic VERIFIED in Podfile');
        } else {
          console.warn('⚠️  [withPodfileFix] -G flag removal logic NOT FOUND in updated Podfile!');
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
