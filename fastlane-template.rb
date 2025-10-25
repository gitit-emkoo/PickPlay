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
    clean_password = ENV["P12_PASSWORD"].to_s.strip.gsub(/[\r\n\t]/, '')
    
    begin
      import_certificate(
        certificate_path: "../certificate.p12",
        certificate_password: clean_password,
        keychain_name: "build"
      )
      puts "✅ 인증서 설치 성공"
    rescue => e
      puts "❌ 인증서 설치 실패: #{e.message}"
      puts "🔍 비밀번호 길이: #{clean_password.length}"
      puts "🔍 비밀번호 첫 3자: #{clean_password[0..2]}***"
      raise "인증서 설치에 실패했습니다. 비밀번호를 확인해주세요."
    end
    
    # 프로비저닝 프로파일 설치
    begin
      install_provisioning_profile(
        path: "../provisioning_profile.mobileprovision"
      )
      puts "✅ 프로비저닝 프로파일 설치 성공"
      
      # 프로파일 정보 확인
      profile_info = `security cms -D -i ../provisioning_profile.mobileprovision`
      if profile_info.include?("aps-environment")
        puts "✅ Push Notifications 기능이 활성화되어 있습니다."
      else
        puts "⚠️ Push Notifications 기능이 비활성화되어 있습니다."
        puts "🔧 Apple Developer Console에서 프로비저닝 프로파일을 다시 생성하세요."
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
      # 빌드 타임아웃 설정 (더 긴 시간 허용)
      build_timeout: 1800,
      # xcargs를 사용한 빌드 설정 (Push Notifications 관련 설정 추가)
      xcargs: "CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM=#{ENV['APPLE_TEAM_ID']} CODE_SIGN_IDENTITY='iPhone Distribution' PROVISIONING_PROFILE_SPECIFIER='' SWIFT_OPTIMIZATION_LEVEL=-O"
    )
    
    # TestFlight 업로드
    upload_to_testflight(
      apple_id: ENV["APPLE_ID"],
      app_identifier: "com.kwcc.pickplay",
      skip_waiting_for_build_processing: true
    )
    
    puts "✅ TestFlight 업로드 완료"
    
    # Firebase App Distribution (성공 사례에서 권장)
    firebase_app_distribution(
      app: ENV["FIREBASE_APP_ID"],
      groups: "testers",
      release_notes: "Automated build from GitHub Actions"
    )
    
    puts "✅ Firebase App Distribution 업로드 완료"
  end
end
