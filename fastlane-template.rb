# This file contains the fastlane.tools configuration
# You can find the documentation at https://docs.fastlane.tools

default_platform(:ios)

# Fastlane 실행 위치 자동 감지 및 프로젝트 루트 계산
# 현재 Fastfile 위치: .../pickplay/ios/fastlane/
# EXPO 프로젝트 루트: .../pickplay/ (package.json이 있는 곳)
EXPO_PROJECT_ROOT = File.expand_path('../..', __dir__) 

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

  desc "Build and upload to TestFlight using Fastlane Match"
  lane :beta do
    # 🚨 참고: Expo prebuild는 CI/CD 환경의 Fastlane 실행 전에 이미 완료되었으므로,
    # 중복 실행을 방지하고 빌드 시간을 단축하기 위해 해당 로직을 여기서 제거합니다.
    
    # 빌드 번호 자동 증분 (버전 충돌 방지)
    puts "📈 빌드 번호 자동 증분 중..."
    begin
      # 절대 경로 사용
      increment_build_number(
        xcodeproj: ABSOLUTE_XCODEPROJ_PATH 
      )
      puts "✅ 빌드 번호 증분 완료"
    rescue => ex
      puts "⚠️ 빌드 번호 증분 중 오류 (무시하고 계속): #{ex.message}"
    end
    
    # workspace 존재 여부만 간단히 확인
    puts "🔍 PickPlay.xcworkspace 확인 중..."
    # 절대 경로 변수 사용 (bundle 확인)
    unless File.exist?(File.join(ABSOLUTE_WORKSPACE_PATH, "contents.xcworkspacedata"))
      UI.user_error!("❌ PickPlay.xcworkspace 번들이 올바르지 않습니다. Expo prebuild가 Pods 설치에 실패했습니다.")
    end
    puts "✅ PickPlay.xcworkspace 확인 완료"
    
    # Xcode 버전 자동 감지 및 설정 (CI 환경 안정성 확보)
    puts "🔍 Xcode 버전 자동 감지 중..."
    xcode_version = `xcodebuild -version | head -1 | cut -d' ' -f2`.strip
    puts "📱 감지된 Xcode 버전: #{xcode_version}"
    
    # 사용 가능한 Xcode 버전 확인 및 설정 로직 개선
    available_xcodes = `ls /Applications/ | grep -i xcode`.strip.split("\n")
    puts "📱 사용 가능한 Xcode 버전들: #{available_xcodes.join(', ')}"
    
    # 베타 버전을 제외한 안정 버전 필터링
    stable_xcodes = available_xcodes
      .select { |x| x.include?("Xcode") && !x.downcase.include?("beta") }
    
    # Xcode 16.4 우선 선택 (가장 안정적인 버전)
    xcode_16_4 = stable_xcodes.find { |x| x.include?("Xcode_16.4") || x.include?("Xcode_16_4") }
    
    if xcode_16_4
      xcode_path = "/Applications/#{xcode_16_4}"
      puts "📱 사용할 우선순위 Xcode 16.4: #{xcode_path}"
      xcode_select(xcode_path)
    else
      # Xcode 16.4가 없으면 다른 Xcode 16.x 중 최신 버전 선택
      xcode_16_versions = stable_xcodes.select { |x| x.match(/Xcode_?16/i) }
      
      if xcode_16_versions.any?
        latest_xcode_16 = xcode_16_versions
          .sort_by { |x| 
            version_match = x.match(/Xcode_?16(?:_|\s)?(\d+)?\.?(\d+)?(?:\.(\d+))?/i)
            if version_match
              patch = version_match[1]&.to_i || version_match[3]&.to_i || 0
              sub_patch = version_match[2]&.to_i || 0
              [16, patch, sub_patch]
            else
              [16, 0, 0]
            end
          }
          .last
        
        xcode_path = "/Applications/#{latest_xcode_16}"
        puts "📱 사용할 Xcode 16.x: #{xcode_path}"
        xcode_select(xcode_path)
      else
        # Xcode 16.x도 없으면 안정 버전 중 최신 선택
        puts "⚠️ Xcode 16.x를 찾을 수 없습니다. 설치된 최신 안정 버전을 사용합니다."
        latest_stable = stable_xcodes
          .sort_by { |x| 
            version_match = x.match(/Xcode(?:_|\s)?(\d+)\.(\d+)(?:\.(\d+))?/)
            if version_match
              major = version_match[1].to_i
              minor = version_match[2].to_i
              patch = version_match[3]&.to_i || 0
              [major, minor, patch]
            else
              [0, 0, 0]
            end
          }
          .last
        
        if latest_stable
          xcode_path = "/Applications/#{latest_stable}"
          puts "📱 사용할 안정적 최신 Xcode: #{xcode_path}"
          xcode_select(xcode_path)
        else
          puts "❌ 사용 가능한 Xcode 버전이 없습니다."
          UI.user_error!("Xcode 설치를 확인하세요.")
        end
      end
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
    
    # Match 실행: Push Notification과 같은 새로운 권한을 반영할 수 있도록
    # force: true를 사용하여 기존 프로파일을 강제로 재생성합니다.
    match(
      type: "appstore",
      readonly: false,  # 인증서 만료 및 새로운 권한 반영을 위해 읽기 전용 비활성화
      force: true,  # 기존 프로파일을 강제로 재생성하여 Push Notifications 권한 반영
      force_for_new_devices: true,  # 새로운 capabilities를 위한 프로파일 강제 재생성
      force_for_new_certificates: true,  # 새 인증서용 프로파일 재생성
      skip_certificate_matching: false,  # 인증서 매칭 활성화
      app_identifier: "com.pickplay.kwcc",
      team_id: ENV["APPLE_TEAM_ID"],
      api_key: api_key,
      git_url: ENV["MATCH_GIT_URL"],
      git_basic_authorization: Base64.strict_encode64("#{ENV['MATCH_GIT_USERNAME']}:#{ENV['MATCH_GIT_PASSWORD']}"),
      keychain_name: "build",
      keychain_password: "actions"
    )
    
    puts "✅ Fastlane Match 설정 완료 (최신 프로필로 업데이트/설치 확인)"
    
    # 빌드 및 아카이브 (Match가 자동으로 코드 서명 설정)
    # 절대 경로 사용
    build_app(
      workspace: ABSOLUTE_WORKSPACE_PATH, 
      scheme: "PickPlay",
      configuration: "Release",
      export_method: "app-store",
      clean: true,
      skip_codesigning: false,
      skip_package_dependencies_resolution: false,
      xcargs: "SWIFT_OPTIMIZATION_LEVEL=-O"
    )
    
    # TestFlight 업로드
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
