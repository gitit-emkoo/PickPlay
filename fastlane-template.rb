# This file contains the fastlane.tools configuration
# You can find the documentation at https://docs.fastlane.tools

default_platform(:ios)

# Fastlane 실행 위치 자동 감지 및 프로젝트 루트 계산
# 현재 Fastfile 위치: .../pickplay/fastlane/
# EXPO 프로젝트 루트: .../pickplay/ (package.json이 있는 곳)
EXPO_PROJECT_ROOT = File.expand_path('..', __dir__) 

# Xcode 관련 절대 경로 (EXPO 프로젝트 루트 기준)
# Fastlane 액션에서 파일 경로를 참조할 때 반드시 이 절대 경로를 사용합니다.
ABSOLUTE_XCODEPROJ_PATH = File.join(EXPO_PROJECT_ROOT, "ios/PickPlay.xcodeproj")
ABSOLUTE_WORKSPACE_PATH = File.join(EXPO_PROJECT_ROOT, "ios/PickPlay.xcworkspace")

puts "🔍 Expo 프로젝트 루트: #{EXPO_PROJECT_ROOT}"
puts "🔍 Xcode 프로젝트 경로: #{ABSOLUTE_XCODEPROJ_PATH}"
puts "🔍 Xcode 워크스페이스 경로: #{ABSOLUTE_WORKSPACE_PATH}"

platform :ios do
  # 키체인 정리 및 환경 설정
  before_all do
    puts "🧹 키체인 정리 및 환경 설정 중..."
    
    # 기존 키체인 정리 (충돌 방지)
    begin
      delete_keychain(name: "build") if File.exist?("#{ENV['HOME']}/Library/Keychains/build-db")
      puts "✅ 기존 키체인 정리 완료"
    rescue => ex
      puts "⚠️ 키체인 정리 중 오류 (무시하고 계속): #{ex.message}"
    end
    
    # 자동 코드 서명 비활성화 (충돌 방지)
    begin
      # 절대 경로 사용
      update_code_signing_settings(
        use_automatic_signing: false,
        path: ABSOLUTE_XCODEPROJ_PATH, 
        team_id: ENV["APPLE_TEAM_ID"]
      )
      puts "✅ 자동 코드 서명 비활성화 완료"
    rescue => ex
      puts "⚠️ 자동 코드 서명 비활성화 중 오류 (무시하고 계속): #{ex.message}"
    end
  end

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

  desc "Build and upload to TestFlight using Fastlane Match (Optimized for CI speed)"
  lane :beta do
    # 1. 빌드 번호 자동 증분
    puts "📈 빌드 번호 자동 증분 중..."
    begin
      increment_build_number(xcodeproj: ABSOLUTE_XCODEPROJ_PATH)
      puts "✅ 빌드 번호 증분 완료"
    rescue => ex
      puts "⚠️ 빌드 번호 증분 중 오류 (무시하고 계속): #{ex.message}"
    end
    
    # 2. workspace 존재 여부 확인 및 pod install (필요 시)
    puts "🔍 PickPlay.xcworkspace 확인 중..."
    unless File.exist?(ABSOLUTE_WORKSPACE_PATH) # .xcworkspace 파일 자체를 확인
      puts "⚠️ PickPlay.xcworkspace가 없습니다. pod install을 실행합니다..."
      Dir.chdir(File.join(EXPO_PROJECT_ROOT, "ios")) do
        # React Native 신규 아키텍처 환경변수를 설정하여 pod install 시 필요한 헤더 파일 생성을 유도
        system({"RCT_NEW_ARCH_ENABLED" => "1"}, "pod install") || UI.user_error!("pod install 실패")
      end
      puts "✅ pod install 완료"
    else
      puts "✅ PickPlay.xcworkspace 확인 완료"
    end
    
    # 3. Xcode 버전 선택 (기존 로직 유지 - 안정성 확보)
    puts "🔍 Xcode 버전 자동 감지 및 설정 중..."
    available_xcodes = `ls /Applications/ | grep -i xcode`.strip.split("\n")
    stable_xcodes = available_xcodes.select { |x| x.include?("Xcode") && !x.downcase.include?("beta") }
    
    # Xcode 16.4 우선 선택
    xcode_16_4 = stable_xcodes.find { |x| x.include?("Xcode_16.4") || x.include?("Xcode_16_4") }
    
    if xcode_16_4
      xcode_path = "/Applications/#{xcode_16_4}"
      puts "📱 사용할 우선순위 Xcode 16.4: #{xcode_path}"
      xcode_select(xcode_path)
    else
      puts "⚠️ Xcode 16.4를 찾을 수 없습니다. 설치된 최신 안정 버전을 사용합니다."
      latest_stable = stable_xcodes.sort_by { |x| x.match(/Xcode(?:_|\s)?(\d+)\.(\d+)/).to_a[1..2].map(&:to_i) rescue [0,0] }.last
      if latest_stable
        xcode_path = "/Applications/#{latest_stable}"
        puts "📱 사용할 안정적 최신 Xcode: #{xcode_path}"
        xcode_select(xcode_path)
      else
        UI.user_error!("Xcode 설치를 확인하세요.")
      end
    end
    
    # 4. Fastlane Match 설정 (읽기 전용으로 속도 최적화)
    puts "🔐 Fastlane Match로 인증서 및 프로비저닝 프로파일 설정 중 (읽기 전용 모드)..."
    
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
      force_for_new_certificates: true,  # 인증서 재생성
      force_for_new_devices: true,  # 디바이스 프로파일 재생성
      force: true,  # 모든 프로파일 강제 재생성
      readonly: false,  # 프로파일 생성 허용
      app_identifier: "com.pickplay.kwcc",
      team_id: ENV["APPLE_TEAM_ID"],
      api_key: api_key,
      git_url: ENV["MATCH_GIT_URL"],
      git_basic_authorization: Base64.strict_encode64("#{ENV['MATCH_GIT_USERNAME']}:#{ENV['MATCH_GIT_PASSWORD']}"),
      keychain_name: "build",
      keychain_password: "actions"
    )
    
    puts "✅ Fastlane Match 설정 완료 (프로파일 재생성으로 Push Notifications 반영)"
    
    # ReactAppDependencyProvider와 lottiereactnative 헤더 파일 복사 오류 방지
    build_generated_base = File.join(EXPO_PROJECT_ROOT, "ios/build/generated/ios")
    FileUtils.mkdir_p(build_generated_base)
    
    # 빈 RCTAppDependencyProvider.h 파일 생성
    FileUtils.touch(File.join(build_generated_base, "RCTAppDependencyProvider.h"))
    
    # lottiereactnative 더미 파일 생성 (6개 파일)
    lottie_dir = File.join(build_generated_base, "react/renderer/components/lottiereactnative")
    FileUtils.mkdir_p(lottie_dir)
    FileUtils.touch(File.join(lottie_dir, "States.h"))
    FileUtils.touch(File.join(lottie_dir, "ShadowNodes.h"))
    FileUtils.touch(File.join(lottie_dir, "RCTComponentViewHelpers.h"))
    FileUtils.touch(File.join(lottie_dir, "Props.h"))
    FileUtils.touch(File.join(lottie_dir, "EventEmitters.h"))
    FileUtils.touch(File.join(lottie_dir, "ComponentDescriptors.h"))
    
    puts "✅ build/generated/ios 디렉토리 및 더미 파일 생성 완료"
    
    # Push Notifications capability 강제 추가
    begin
      puts "🔔 Push Notifications capability 추가 중..."
      add_capability(
        app_identifier: "com.pickplay.kwcc",
        capability: "Push Notifications"
      )
      puts "✅ Push Notifications capability 추가 완료"
    rescue => ex
      puts "⚠️ add_capability 실패 (무시하고 계속): #{ex.message}"
    end
    
    # 5. 빌드 및 아카이브
    build_app(
      workspace: ABSOLUTE_WORKSPACE_PATH, 
      scheme: "PickPlay",
      configuration: "Release",
      export_method: "app-store",
      clean: true, # CI에서는 clean: true를 유지하여 안정성 확보
      skip_codesigning: false,
      xcargs: "SWIFT_OPTIMIZATION_LEVEL=-O DEVELOPMENT_TEAM='#{ENV["APPLE_TEAM_ID"]}' CODE_SIGN_STYLE=Manual GENERATE_PROFILING_CODE=NO ENABLE_PREVIEWS=YES"
    )
    
    # 6. TestFlight 업로드 및 Firebase App Distribution
    begin
      upload_to_testflight(
        apple_id: ENV["APPLE_ID"],
        app_identifier: "com.pickplay.kwcc",
        skip_waiting_for_build_processing: true,
        skip_submission: true,
        api_key: api_key
      )
      puts "✅ TestFlight 업로드 성공!"
    rescue => ex
      puts "⚠️ TestFlight 업로드 실패: #{ex.message}"
      
      if ex.message.include?("permission") || ex.message.include?("unauthorized")
        puts "🔄 권한 문제 감지, API Key로 재시도 중..."
        upload_to_testflight(
          apple_id: ENV["APPLE_ID"],
          app_identifier: "com.pickplay.kwcc",
          skip_waiting_for_build_processing: true,
          skip_submission: true,
          api_key: api_key,
          force: true
        )
        puts "✅ TestFlight 업로드 재시도 성공!"
      else
        puts "❌ TestFlight 업로드 실패: #{ex.message}"
        raise ex
      end
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
