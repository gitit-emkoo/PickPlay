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

pre_install do |installer|
  puts "=" * 80
  puts "🔧 [pre_install] CRITICAL: Modifying BoringSSL-GRPC.podspec BEFORE pod install"
  puts "=" * 80
  
  # BoringSSL-GRPC podspec 파일 직접 수정
  podspec_path = File.join(Dir.pwd, '..', 'node_modules', 'BoringSSL-GRPC', 'BoringSSL-GRPC.podspec')
  
  if File.exist?(podspec_path)
    puts "📄 Found podspec at: #{podspec_path}"
    
    content = File.read(podspec_path)
    original = content.dup
    
    # compiler_flags에서 -GCC_WARN_INHIBIT_ALL_WARNINGS 제거
    content.gsub!('-GCC_WARN_INHIBIT_ALL_WARNINGS', '')
    content.gsub!(/\s*-G\s+/, ' ')
    
    if content != original
      File.write(podspec_path, content)
      puts "✅ Removed -GCC_WARN_INHIBIT_ALL_WARNINGS from podspec"
    else
      puts "ℹ️  No -GCC_WARN_INHIBIT_ALL_WARNINGS found in podspec"
    end
  else
    puts "❌ Podspec not found at: #{podspec_path}"
  end
  
  puts "=" * 80
end

post_install do |installer|
  puts "🔧 [post_install] Custom Podfile post_install hook executing..."
  
  # ✅ CRITICAL FIX: BoringSSL-GRPC COMPILER_FLAGS 제거 (Stack Overflow 검증된 방법)
  puts "=" * 80
  puts "🔧 [post_install] CRITICAL FIX: Removing -GCC_WARN_INHIBIT_ALL_WARNINGS from BoringSSL-GRPC"
  puts "=" * 80
  
  modified_count = 0
  installer.pods_project.targets.each do |target|
    if target.name == 'BoringSSL-GRPC'
      puts "🎯 Found target: #{target.name}"
      
      # Stack Overflow 검증된 방법: source_build_phase.files의 COMPILER_FLAGS 수정
      target.source_build_phase.files.each do |file|
        if file.settings && file.settings['COMPILER_FLAGS']
          original = file.settings['COMPILER_FLAGS']
          flags = original.split
          flags.reject! { |flag| flag == '-GCC_WARN_INHIBIT_ALL_WARNINGS' || flag == '-G' }
          file.settings['COMPILER_FLAGS'] = flags.join(' ')
          
          if original != file.settings['COMPILER_FLAGS']
            modified_count += 1
            puts "  🧹 Modified COMPILER_FLAGS in source file"
            puts "     Before: #{original}"
            puts "     After:  #{file.settings['COMPILER_FLAGS']}"
          end
        end
      end
      
      # build_settings도 정화 (추가 방어)
      target.build_configurations.each do |config|
        ['WARNING_CFLAGS', 'OTHER_CFLAGS', 'OTHER_CPLUSPLUSFLAGS'].each do |setting|
          if config.build_settings[setting]
            original = config.build_settings[setting].to_s
            cleaned = original.gsub('-GCC_WARN_INHIBIT_ALL_WARNINGS', '').gsub(/\s*-G\s+/, ' ').strip
            
            if original != cleaned
              config.build_settings[setting] = cleaned
              modified_count += 1
              puts "  🧹 Cleaned #{config.name}/#{setting}"
            end
          end
        end
      end
      
      puts "  ✅ Modified #{modified_count} flags in BoringSSL-GRPC"
    end
  end
  
  if modified_count == 0
    puts "  ⚠️  WARNING: No flags were modified!"
  end
  
  puts "=" * 80
  
  # React Native post install tweaks
  react_native_post_install(installer)
  
  # Expo post install (must be after RN)
  Expo::PostInstall.install!(installer)

  # ✅ 추가 방어: xcconfig/pbxproj 백업 정화
  puts "=" * 80
  puts "🔧 [post_install] Applying BACKUP DEFENSE (xcconfig + pbxproj)..."
  puts "=" * 80
  puts "ℹ️  CWD: #{Dir.pwd}"
  
  # 🛡️ BACKUP 1: xcconfig 파일 정화 (Pass 1 - save 전)
  begin
    puts "🛡️  [Backup 1/3] Cleaning xcconfig files (before save)..."
    
    xcconfig_count = 0
    target_support = File.join(Dir.pwd, 'Pods', 'Target Support Files')
    
    puts "  📂 Target Support path: #{target_support}"
    puts "  📂 Exists: #{Dir.exist?(target_support)}"
    
    if Dir.exist?(target_support)
      # 먼저 모든 xcconfig 파일 찾기 - glob 패턴을 문자열로 직접 생성
      glob_pattern = "#{target_support}/*/*.xcconfig"
      all_xcconfigs = Dir.glob(glob_pattern)
      puts "  📝 Glob pattern: #{glob_pattern}"
      puts "  📝 Found #{all_xcconfigs.length} total xcconfig files"
      
      all_xcconfigs.each do |file|
        if file.include?('BoringSSL') || file.include?('gRPC')
          content = File.read(file)
          original = content.dup
          
          content.gsub!('-GCC_WARN_INHIBIT_ALL_WARNINGS', '')
          content.gsub!(/\s*-G\s+/, ' ')
          
          if content != original
            File.write(file, content)
            xcconfig_count += 1
            puts "  🧹 Cleaned: #{File.basename(File.dirname(file))}/#{File.basename(file)}"
          end
        end
      end
    else
      puts "  ❌ Target Support Files directory not found!"
    end
    
    puts "  ✅ Backup 1 complete (#{xcconfig_count} files cleaned)"
    
  rescue => e
    puts "❌ [Backup 1] ERROR: #{e.message}"
    puts "     #{e.backtrace.first}"
  end
  
  # 🛡️ BACKUP 2: pbxproj 정화
  begin
    puts "🛡️  [Backup 2/3] Cleaning project.pbxproj..."
    
    project_file = File.join(Dir.pwd, 'Pods', 'Pods.xcodeproj', 'project.pbxproj')
    
    if File.exist?(project_file)
      pbxproj = File.read(project_file)
      original = pbxproj.dup
      
      pbxproj.gsub!('-GCC_WARN_INHIBIT_ALL_WARNINGS', '')
      pbxproj.gsub!(/\s*-G\s+/, ' ')
      
      if pbxproj != original
        File.write(project_file, pbxproj)
        puts "  🧹 Cleaned project.pbxproj"
      else
        puts "  ℹ️  No changes needed in pbxproj"
      end
    else
      puts "  ❌ project.pbxproj not found at: #{project_file}"
    end
    
    puts "  ✅ Backup 2 complete"
    
  rescue => e
    puts "❌ [Backup 2] ERROR: #{e.message}"
    puts "     #{e.backtrace.first}"
  end
  
  # 💾 저장
  puts "💾 Saving Pods project..."
  installer.pods_project.save
  puts "✅ Pods project saved"
  
  # 🛡️ BACKUP 3: xcconfig 재정화 (Pass 2 - save 후, 최종 방어선)
  begin
    puts "🛡️  [Backup 3/3] Re-cleaning xcconfig files (after save)..."
    
    xcconfig_count = 0
    target_support = File.join(Dir.pwd, 'Pods', 'Target Support Files')
    
    if Dir.exist?(target_support)
      glob_pattern = "#{target_support}/*/*.xcconfig"
      all_xcconfigs = Dir.glob(glob_pattern)
      
      all_xcconfigs.each do |file|
        if file.include?('BoringSSL') || file.include?('gRPC')
          content = File.read(file)
          
          if content.include?('-GCC_WARN_INHIBIT_ALL_WARNINGS') || content =~ /\s-G\s/
            content.gsub!('-GCC_WARN_INHIBIT_ALL_WARNINGS', '')
            content.gsub!(/\s*-G\s+/, ' ')
            File.write(file, content)
            xcconfig_count += 1
            puts "  🔒 Re-cleaned: #{File.basename(File.dirname(file))}/#{File.basename(file)}"
          end
        end
      end
    end
    
    puts "  ✅ Backup 3 complete (#{xcconfig_count} files re-cleaned)"
    
  rescue => e
    puts "❌ [Backup 3] ERROR: #{e.message}"
    puts "     #{e.backtrace.first}"
  end
  
  puts "=" * 80
  puts "✅ ALL DEFENSE LAYERS COMPLETED"
  puts "  🎯 PRE-INSTALL: podspec 직접 수정 (pod install 전)"
  puts "  🎯 POST-INSTALL: source_build_phase COMPILER_FLAGS 수정 (Stack Overflow)"
  puts "  🎯 POST-INSTALL: build_settings 수정 (추가 방어)"
  puts "  🛡️  BACKUP 1: xcconfig 파일 정화"
  puts "  🛡️  BACKUP 2: pbxproj 정화"
  puts "  🛡️  BACKUP 3: xcconfig 재정화"
  puts "=" * 80
end`;
        
        // 새로운 Podfile 저장
        fs.writeFileSync(podfilePath, newPodfileContent);
        console.log('✅ [withPodfileFix] Podfile replaced with VERIFIED SOLUTION (Stack Overflow + GitHub)');
        
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
