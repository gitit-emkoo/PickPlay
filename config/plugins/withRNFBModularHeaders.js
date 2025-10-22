const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * React Native Firebase 모듈형 헤더 에러 해결 플러그인
 * 
 * 문제: use_frameworks! :linkage => :static 사용 시
 * RNFB가 non-modular header를 include하여 빌드 실패
 * 
 * 해결: post_install 훅에서 RNFB/React 타겟의 빌드 설정 수정
 */
module.exports = (config) => {
  console.log('\n🔧 [withRNFBModularHeaders] Plugin starting...');
  
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.projectRoot, 'ios', 'Podfile');
      
      if (!fs.existsSync(podfilePath)) {
        console.log('⚠️  [withRNFBModularHeaders] Podfile not found, skipping');
        return config;
      }
      
      let podfileContent = fs.readFileSync(podfilePath, 'utf8');
      
      // 수정 코드 (post_install 안에 삽입될 내용)
      const modularHeadersFix = `
  # =====================================================
  # Fix RNFB non-modular header warnings
  # =====================================================
  puts "🔧 Applying RNFB modular headers fix..."
  
  installer.pods_project.targets.each do |target|
    # RNFB와 React 관련 타겟만 처리
    if target.name.start_with?('RNFB') || 
       target.name.start_with?('React') || 
       target.name.start_with?('RCT')
      
      target.build_configurations.each do |config|
        # 핵심 수정: non-modular include 허용
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'
        
        # 경고를 에러로 처리하지 않음
        config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
        
        # 모듈 설정 보장
        config.build_settings['DEFINES_MODULE'] = 'YES'
        config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
        
        # 컴파일러 플래그 추가
        cflags = config.build_settings['OTHER_CFLAGS'] || ['$(inherited)']
        cflags = [cflags] unless cflags.is_a?(Array)
        
        unless cflags.include?('-Wno-error=non-modular-include-in-framework-module')
          cflags << '-Wno-error=non-modular-include-in-framework-module'
        end
        
        config.build_settings['OTHER_CFLAGS'] = cflags
      end
      
      puts "  ✅ Fixed: #{target.name}"
    end
  end
  
  puts "🎉 RNFB modular headers fix completed"
`;

      // post_install do |installer| 찾기
      const postInstallMatch = podfileContent.match(/post_install do \|installer\|/);
      
      if (postInstallMatch) {
        const postInstallIndex = postInstallMatch.index + postInstallMatch[0].length;
        
        // 이미 적용되었는지 확인
        if (podfileContent.includes('Fix RNFB non-modular header warnings')) {
          console.log('✅ [withRNFBModularHeaders] Already applied, skipping');
          return config;
        }
        
        // post_install 블록 시작 직후에 삽입
        podfileContent = 
          podfileContent.slice(0, postInstallIndex) +
          modularHeadersFix +
          podfileContent.slice(postInstallIndex);
        
        fs.writeFileSync(podfilePath, podfileContent, 'utf8');
        console.log('✅ [withRNFBModularHeaders] Applied modular headers fix to post_install');
      } else {
        console.log('❌ [withRNFBModularHeaders] post_install block not found!');
      }
      
      return config;
    },
  ]);
};

