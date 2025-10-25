# This file contains the fastlane.tools configuration
# You can find the documentation at https://docs.fastlane.tools

default_platform(:ios)

platform :ios do
  desc "Initialize Fastlane Match (run this first)"
  lane :match_init do
    # Match 초기화 및 첫 번째 인증서 생성
    puts "🔐 Fastlane Match 초기화 중..."
    
    match(
      type: "appstore",
      readonly: false,
      app_identifier: "com.kwcc.pickplay",
      team_id: ENV["APPLE_TEAM_ID"],
      username: ENV["FASTLANE_USER"],
      password: ENV["FASTLANE_PASSWORD"],
      git_url: ENV["MATCH_GIT_URL"],
      git_basic_authorization: Base64.strict_encode64("#{ENV['MATCH_GIT_USERNAME']}:#{ENV['MATCH_GIT_PASSWORD']}"),
      keychain_name: "build",
      keychain_password: "actions"
    )
    
    puts "✅ Fastlane Match 초기화 완료!"
  end

  desc "Build and upload to TestFlight using Fastlane Match"
  lane :beta do
    # Xcode 버전 명시적 설정 (안정적인 버전 사용)
    xcode_select("/Applications/Xcode_16.3.app")
    
    # Fastlane Match를 사용한 자동 인증서 및 프로비저닝 프로파일 관리
    puts "🔐 Fastlane Match로 인증서 및 프로비저닝 프로파일 설정 중..."
    
    match(
      type: "appstore",
      readonly: true,  # 기존 인증서만 사용
      app_identifier: "com.kwcc.pickplay",
      team_id: ENV["APPLE_TEAM_ID"],
      username: ENV["FASTLANE_USER"],
      password: ENV["FASTLANE_PASSWORD"],
      git_url: ENV["MATCH_GIT_URL"],
      git_basic_authorization: Base64.strict_encode64("#{ENV['MATCH_GIT_USERNAME']}:#{ENV['MATCH_GIT_PASSWORD']}"),
      keychain_name: "build",
      keychain_password: "actions"
    )
    
    puts "✅ Fastlane Match 설정 완료"
    
    # 빌드 및 아카이브 (Match가 자동으로 코드 서명 설정)
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
      # Match가 자동으로 코드 서명을 설정하므로 xcargs 단순화
      xcargs: "SWIFT_OPTIMIZATION_LEVEL=-O"
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