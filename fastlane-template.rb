# This file contains the fastlane.tools configuration
# You can find the documentation at https://docs.fastlane.tools

default_platform(:ios)

platform :ios do
  desc "Initialize Fastlane Match (run this first)"
  lane :match_init do
    # Match 초기화 및 첫 번째 인증서 생성
    puts "🔐 Fastlane Match 초기화 중..."
    
    # App Store Connect API Key 설정
    api_key = app_store_connect_api_key(
      key_id: ENV["APP_STORE_CONNECT_API_KEY_ID"],
      issuer_id: ENV["APP_STORE_CONNECT_API_ISSUER_ID"],
      key_content: ENV["APP_STORE_CONNECT_API_KEY"],
      duration: 1200, # 20분
      in_house: false
    )
    
    match(
      type: "appstore",
      readonly: false,
      app_identifier: "com.pickplay.kwcc",
      team_id: ENV["APPLE_TEAM_ID"],
      api_key: api_key,
      git_url: ENV["MATCH_GIT_URL"],
      git_basic_authorization: Base64.strict_encode64("#{ENV['MATCH_GIT_USERNAME']}:#{ENV['MATCH_GIT_PASSWORD']}"),
      keychain_name: "build",
      keychain_password: "actions"
    )
    
    puts "✅ Fastlane Match 초기화 완료!"
  end

  desc "Build and upload to TestFlight using Fastlane Match"
  lane :beta do
    # Xcode 버전 자동 감지 및 설정
    puts "🔍 Xcode 버전 자동 감지 중..."
    xcode_version = `xcodebuild -version | head -1 | cut -d' ' -f2`.strip
    puts "📱 감지된 Xcode 버전: #{xcode_version}"
    
    # 사용 가능한 Xcode 버전 확인
    available_xcodes = `ls /Applications/ | grep -i xcode`.strip.split("\n")
    puts "📱 사용 가능한 Xcode 버전들: #{available_xcodes.join(', ')}"
    
    # 가장 최신 Xcode 사용
    if available_xcodes.any? { |x| x.include?("Xcode") }
      latest_xcode = available_xcodes.find { |x| x.include?("Xcode") }
      xcode_path = "/Applications/#{latest_xcode}"
      puts "📱 사용할 Xcode: #{xcode_path}"
      xcode_select(xcode_path)
    else
      puts "⚠️ 특정 Xcode 버전을 찾을 수 없습니다. 기본 버전 사용"
    end
    
    # Fastlane Match를 사용한 자동 인증서 및 프로비저닝 프로파일 관리
    puts "🔐 Fastlane Match로 인증서 및 프로비저닝 프로파일 설정 중..."
    
    # App Store Connect API Key 설정
    api_key = app_store_connect_api_key(
      key_id: ENV["APP_STORE_CONNECT_API_KEY_ID"],
      issuer_id: ENV["APP_STORE_CONNECT_API_ISSUER_ID"],
      key_content: ENV["APP_STORE_CONNECT_API_KEY"],
      duration: 1200, # 20분
      in_house: false
    )
    
    match(
      type: "appstore",
      readonly: true,  # 기존 인증서만 사용
      app_identifier: "com.pickplay.kwcc",
      team_id: ENV["APPLE_TEAM_ID"],
      api_key: api_key,
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
        app_identifier: "com.pickplay.kwcc",
        skip_waiting_for_build_processing: true
      )
      puts "✅ TestFlight 업로드 완료"
    rescue => e
      puts "❌ TestFlight 업로드 실패: #{e.message}"
      puts "🔧 재시도 중..."
      sleep 30
      upload_to_testflight(
        apple_id: ENV["APPLE_ID"],
        app_identifier: "com.pickplay.kwcc",
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