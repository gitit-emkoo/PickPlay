# This file contains the fastlane.tools configuration
# You can find the documentation at https://docs.fastlane.tools

default_platform(:ios)

platform :ios do
  desc "Build and upload to TestFlight"
  lane :beta do
    # Xcode 버전 명시적 설정 (안정적인 버전 사용)
    # Xcode 16.4는 일부 라이브러리와 호환성 문제가 있어 16.3 사용
    xcode_select("/Applications/Xcode_16.3.app")
    
    # 인증서 및 프로파일 설정
    create_keychain(
      name: "build",
      password: "temp123",
      default_keychain: true,
      unlock: true,
      timeout: 3600
    )
    
    # 인증서 가져오기 (비밀번호 정제 및 에러 처리)
    # 워크플로우에서 성공한 방법 사용
    clean_password = `printf '%s' "#{ENV["P12_PASSWORD"]}" | sed 's/[[:space:]]*$//' | tr -d '\n\r\t ' | sed 's/[^[:print:]]//g'`.strip
    
    puts "🔍 정제된 비밀번호 길이: #{clean_password.length}"
    puts "🔍 비밀번호 첫 3자: #{clean_password[0..2]}***"
    
    # 직접 security 명령어로 인증서 설치 (더 정확한 에러 처리)
    puts "🔐 직접 security 명령어로 인증서 설치 시도..."
    import_result = `security import ../certificate.p12 -k build.keychain -P "#{clean_password}" -T /usr/bin/codesign 2>&1`
    import_exit_code = $?.exitstatus
    
    if import_exit_code == 0
      puts "✅ 인증서 설치 성공"
      
      # 인증서가 실제로 설치되었는지 확인
      puts "🔍 설치된 인증서 확인 중..."
      certificates = `security find-identity -v -p codesigning`
      if certificates.include?("iPhone Distribution")
        puts "✅ iPhone Distribution 인증서 확인됨"
      else
        puts "❌ iPhone Distribution 인증서를 찾을 수 없습니다"
        puts "🔍 사용 가능한 인증서:"
        puts certificates
        raise "iPhone Distribution 인증서가 설치되지 않았습니다."
      end
    else
      puts "❌ 인증서 설치 실패: #{import_result}"
      puts "🔍 비밀번호 길이: #{clean_password.length}"
      puts "🔍 비밀번호 첫 3자: #{clean_password[0..2]}***"
      puts "🔍 비밀번호 마지막 3자: ***#{clean_password[-3..-1]}"
      
      # 원본 비밀번호도 확인
      original_password = ENV["P12_PASSWORD"].to_s
      puts "🔍 원본 비밀번호 길이: #{original_password.length}"
      puts "🔍 원본 비밀번호 첫 3자: #{original_password[0..2]}***"
      
      raise "인증서 설치에 실패했습니다. 비밀번호를 확인해주세요."
    end
    
    # 프로비저닝 프로파일 설치
    begin
      install_provisioning_profile(
        path: "../provisioning_profile.mobileprovision"
      )
      puts "✅ 프로비저닝 프로파일 설치 성공"
      
      # 프로파일 정보 확인 (올바른 경로 사용)
      profile_info = `security cms -D -i ../provisioning_profile.mobileprovision 2>/dev/null || echo "프로파일 파일을 찾을 수 없습니다"`
      if profile_info.include?("aps-environment")
        puts "✅ Push Notifications 기능이 활성화되어 있습니다."
      else
        puts "⚠️ Push Notifications 기능 확인 실패: #{profile_info}"
        puts "🔧 프로비저닝 프로파일이 올바르게 설치되었는지 확인하세요."
      end
    rescue => e
      puts "❌ 프로비저닝 프로파일 설치 실패: #{e.message}"
      raise "프로비저닝 프로파일 설치에 실패했습니다."
    end
    
    # 빌드 및 아카이브 (안정성 개선)
    build_app(
      workspace: "PickPlay.xcworkspace",
      scheme: "PickPlay",
      configuration: "Release",
      export_method: "app-store",
      export_options: "ExportOptions.plist",
      # 빌드 안정성 설정
      clean: true,
      skip_codesigning: false,
      skip_package_dependencies_resolution: false,
      # xcargs를 사용한 빌드 설정 (Push Notifications 관련 설정 추가)
      xcargs: "CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM=#{ENV['APPLE_TEAM_ID']} CODE_SIGN_IDENTITY='iPhone Distribution' PROVISIONING_PROFILE_SPECIFIER='' SWIFT_OPTIMIZATION_LEVEL=-O"
    )
    
    # TestFlight 업로드 (재시도 로직 포함)
    begin
      upload_to_testflight(
        apple_id: ENV["APPLE_ID"],
        app_identifier: "com.kwcc.pickplay",
        skip_waiting_for_build_processing: true
      )
      puts "✅ TestFlight 업로드 완료"
    rescue => e
      puts "❌ TestFlight 업로드 실패: #{e.message}"
      puts "🔧 재시도 중..."
      sleep 30
      upload_to_testflight(
        apple_id: ENV["APPLE_ID"],
        app_identifier: "com.kwcc.pickplay",
        skip_waiting_for_build_processing: true
      )
      puts "✅ TestFlight 업로드 재시도 성공"
    end
    
    # Firebase App Distribution (토큰 확인 후 실행)
    if ENV["FIREBASE_TOKEN"] && !ENV["FIREBASE_TOKEN"].empty?
      begin
        firebase_app_distribution(
          app: ENV["FIREBASE_APP_ID"],
          groups: "testers",
          release_notes: "Automated build from GitHub Actions"
        )
        puts "✅ Firebase App Distribution 업로드 완료"
      rescue => e
        puts "⚠️ Firebase App Distribution 실패: #{e.message}"
        puts "🔧 Firebase 설정을 확인하세요."
      end
    else
      puts "⚠️ Firebase 토큰이 없습니다. Firebase App Distribution을 건너뜁니다."
    end
  end
end
