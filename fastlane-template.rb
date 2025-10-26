# This file contains the fastlane.tools configuration
# You can find the documentation at https://docs.fastlane.tools

default_platform(:ios)

# Fastlane 실행 위치 자동 감지 및 프로젝트 루트 계산
# 로그: "🔍 현재 실행 위치: /Users/runner/work/PickPlay/PickPlay/pickplay/ios/fastlane"
#     즉, ios/fastlane에서 실행됨

# iOS 프로젝트 루트는 ios/ 디렉토리 (iOS 프로젝트 관점)
IOS_PROJECT_ROOT = File.expand_path('..', __dir__)

# Expo 프로젝트 루트는 ios/ 한 단계 위 (package.json이 있는 곳)
EXPO_PROJECT_ROOT = File.expand_path('../..', __dir__)

puts "🔍 iOS 프로젝트 루트: #{IOS_PROJECT_ROOT}"
puts "🔍 Expo 프로젝트 루트: #{EXPO_PROJECT_ROOT}"

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
      update_code_signing_settings(
        use_automatic_signing: false,
        path: "PickPlay.xcodeproj",
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
    # 현재 Fastlane 실행 위치 확인
    puts "🔍 ===== 디버깅: 현재 실행 위치 ====="
    puts "🔍 Dir.pwd: #{Dir.pwd}"
    puts "🔍 __dir__: #{__dir__}"
    puts "🔍 IOS_PROJECT_ROOT: #{IOS_PROJECT_ROOT}"
    puts "🔍 EXPO_PROJECT_ROOT: #{EXPO_PROJECT_ROOT}"
    
    # 각 디렉토리 존재 여부 확인
    puts "🔍 ===== 디렉토리 존재 확인 ====="
    puts "📁 IOS_PROJECT_ROOT 존재: #{Dir.exist?(IOS_PROJECT_ROOT)}"
    puts "📁 EXPO_PROJECT_ROOT 존재: #{Dir.exist?(EXPO_PROJECT_ROOT)}"
    
    # package.json 위치 확인
    package_json_path = File.join(EXPO_PROJECT_ROOT, "package.json")
    puts "📁 package.json 경로: #{package_json_path}"
    puts "📁 package.json 존재: #{File.exist?(package_json_path)}"
    
    # Expo prebuild는 이미 GitHub Actions에서 실행됨
    # 여기서는 workspace만 확인
    
    # 현재 위치 확인 및 ios/로 이동
    puts "📁 현재 위치: #{Dir.pwd}"
    
    # 현재 위치가 ios/fastlane이므로 ios/로 이동
    unless Dir.pwd.end_with?('/ios')
      Dir.chdir(IOS_PROJECT_ROOT)
      puts "📁 ios/로 이동: #{Dir.pwd}"
    else
      puts "📁 이미 ios/에 있음: #{Dir.pwd}"
    end
    
    puts "📁 ios/ 디렉토리 내용:"
    system("ls -la")
    
    # 빌드 번호 자동 증분 (버전 충돌 방지)
    puts "📈 빌드 번호 자동 증분 중..."
    begin
      increment_build_number(
        xcodeproj: "PickPlay.xcodeproj"
      )
      puts "✅ 빌드 번호 증분 완료"
    rescue => ex
      puts "⚠️ 빌드 번호 증분 중 오류 (무시하고 계속): #{ex.message}"
    end
    
    # 이제 `fastlane` 액션들은 `ios/` 내부에서 실행됩니다.
    
    # workspace 존재 여부만 간단히 확인
    puts "🔍 PickPlay.xcworkspace 확인 중..."
    workspace_path = "PickPlay.xcworkspace"
    unless File.exist?("#{workspace_path}/contents.xcworkspacedata")
      UI.user_error!("❌ PickPlay.xcworkspace 번들이 올바르지 않습니다. Expo prebuild가 Pods 설치에 실패했습니다.")
    end
    puts "✅ PickPlay.xcworkspace 확인 완료"
    
    # Xcode 버전 자동 감지 및 설정
    puts "🔍 Xcode 버전 자동 감지 중..."
    xcode_version = `xcodebuild -version | head -1 | cut -d' ' -f2`.strip
    puts "📱 감지된 Xcode 버전: #{xcode_version}"
    
    # 사용 가능한 Xcode 버전 확인
    available_xcodes = `ls /Applications/ | grep -i xcode`.strip.split("\n")
    puts "📱 사용 가능한 Xcode 버전들: #{available_xcodes.join(', ')}"
    
    # 가장 최신 Xcode 사용 (버전 일관성 개선)
    if available_xcodes.any? { |x| x.include?("Xcode") }
      # 버전 번호가 가장 높은 Xcode 선택
      latest_xcode = available_xcodes
        .select { |x| x.include?("Xcode") }
        .sort_by { |x| 
          # 버전 번호 추출하여 정렬
          version_match = x.match(/Xcode_(\d+)\.(\d+)(?:\.(\d+))?/)
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
    
    # Match 실행 (인증서 만료 시 자동 갱신)
    begin
      match(
        type: "appstore",
        readonly: true,  # 먼저 기존 인증서 시도
        app_identifier: "com.pickplay.kwcc",
        team_id: ENV["APPLE_TEAM_ID"],
        api_key: api_key,
        git_url: ENV["MATCH_GIT_URL"],
        git_basic_authorization: Base64.strict_encode64("#{ENV['MATCH_GIT_USERNAME']}:#{ENV['MATCH_GIT_PASSWORD']}"),
        keychain_name: "build",
        keychain_password: "actions"
      )
      puts "✅ 기존 인증서 사용 성공"
    rescue => ex
      puts "⚠️ 기존 인증서 사용 실패, 새로 생성 시도: #{ex.message}"
      # 인증서 만료 시 새로 생성
      match(
        type: "appstore",
        readonly: false,  # 새 인증서 생성
        app_identifier: "com.pickplay.kwcc",
        team_id: ENV["APPLE_TEAM_ID"],
        api_key: api_key,
        git_url: ENV["MATCH_GIT_URL"],
        git_basic_authorization: Base64.strict_encode64("#{ENV['MATCH_GIT_USERNAME']}:#{ENV['MATCH_GIT_PASSWORD']}"),
        keychain_name: "build",
        keychain_password: "actions"
      )
      puts "✅ 새 인증서 생성 완료"
    end
    
    puts "✅ Fastlane Match 설정 완료"
    
    # 빌드 및 아카이브 (Match가 자동으로 코드 서명 설정)
    build_app(
      workspace: "PickPlay.xcworkspace",
      scheme: "PickPlay",
      configuration: "Release",
      export_method: "app-store",
      # export_options 제거 - Fastlane이 자동으로 생성하도록 함
      # 빌드 안정성 설정
      clean: true,
      skip_codesigning: false,
      skip_package_dependencies_resolution: false,
      # Match가 자동으로 코드 서명을 설정하므로 xcargs 단순화
      xcargs: "SWIFT_OPTIMIZATION_LEVEL=-O"
    )
    
    # TestFlight 업로드 (재시도 로직 및 에러 처리 개선)
    begin
      upload_to_testflight(
        apple_id: ENV["APPLE_ID"],
        app_identifier: "com.pickplay.kwcc",
        skip_waiting_for_build_processing: true,
        skip_submission: true,
        # API Key 사용으로 권한 문제 해결
        api_key: api_key
      )
      puts "✅ TestFlight 업로드 성공!"
    rescue => ex
      puts "⚠️ TestFlight 업로드 실패: #{ex.message}"
      
      # 권한 문제인 경우 재시도
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