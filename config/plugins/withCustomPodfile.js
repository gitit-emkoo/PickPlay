const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin: 커스텀 Podfile 주입
 * expo prebuild 이후 ios/Podfile 생성 직후 실행되어 템플릿으로 교체
 */
module.exports = (config) => {
  console.log('\n========================================');
  console.log('🚀 [withCustomPodfile] PLUGIN STARTING');
  console.log('========================================\n');
  
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const src = path.join(projectRoot, 'ios-template', 'Podfile');
      const dest = path.join(projectRoot, 'ios', 'Podfile');
      
      console.log('🔧 [withCustomPodfile] Injecting custom Podfile...');
      console.log(`  📂 Project Root: ${projectRoot}`);
      console.log(`  📄 Source: ${src}`);
      console.log(`  📄 Destination: ${dest}`);
      console.log(`  ✓ Source exists: ${fs.existsSync(src)}`);
      console.log(`  ✓ Dest directory exists: ${fs.existsSync(path.dirname(dest))}`);
      
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log('✅ [withCustomPodfile] Custom Podfile injected successfully');
        
        // 검증: BoringSSL-GRPC 버전 고정 확인
        const podfileContent = fs.readFileSync(dest, 'utf8');
        if (podfileContent.includes("pod 'BoringSSL-GRPC'")) {
          console.log('✅ [withCustomPodfile] BoringSSL-GRPC version pinning VERIFIED');
        } else {
          console.warn('⚠️  [withCustomPodfile] BoringSSL-GRPC pinning NOT FOUND in copied Podfile!');
        }
      } else {
        console.error('❌ [withCustomPodfile] Podfile template not found at', src);
        throw new Error(`Podfile template not found: ${src}`);
      }
      
      console.log('\n========================================');
      console.log('✅ [withCustomPodfile] PLUGIN COMPLETED');
      console.log('========================================\n');
      
      return config;
    },
  ]);
};

          console.log('✅ [withCustomPodfile] BoringSSL-GRPC version pinning VERIFIED');
        } else {
          console.warn('⚠️  [withCustomPodfile] BoringSSL-GRPC pinning NOT FOUND in copied Podfile!');
        }
      } else {
        console.error('❌ [withCustomPodfile] Podfile template not found at', src);
        throw new Error(`Podfile template not found: ${src}`);
      }
      
      console.log('\n========================================');
      console.log('✅ [withCustomPodfile] PLUGIN COMPLETED');
      console.log('========================================\n');
      
      return config;
    },
  ]);
};

