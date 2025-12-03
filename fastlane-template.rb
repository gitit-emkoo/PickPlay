# frozen_string_literal: true
require "base64"

default_platform(:ios)

# 프로젝트 경로 (Fastfile 기준 상위가 리포 루트)
EXPO_PROJECT_ROOT       = File.expand_path('..', __dir__) # .../<repo>/pickplay/
ABSOLUTE_XCODEPROJ_PATH = File.join(EXPO_PROJECT_ROOT, "ios/PickPlay.xcodeproj")
ABSOLUTE_WORKSPACE_PATH = File.join(EXPO_PROJECT_ROOT, "ios/PickPlay.xcworkspace")
SCHEME_NAME             = "PickPlay"                      # <- Xcode의 실제 Scheme 이름과 동일해야 함
BUNDLE_ID               = "com.pickplay.kwcc"             # <- 앱 번들 ID

platform :ios do
  desc "(초기 1회) match 초기화: 인증서/프로파일 생성"
  lane :match_init do
    setup_ci
    ensure_xcode_version(version: "16.2")

    # 빌드용 키체인 생성/설정
    create_keychain(
      name: "build",
      password: ENV.fetch("KEYCHAIN_PASSWORD", "actions"),
      default_keychain: true,
      unlock: true,
      timeout: 3600,
      add_to_search_list: true
    )

    # App Store Connect API 키 (파일 경로 사용)
    api_key = app_store_connect_api_key(
      key_id:     ENV["APP_STORE_CONNECT_API_KEY_ID"],
      issuer_id:  ENV["APP_STORE_CONNECT_API_ISSUER_ID"],
      key_filepath: ENV["APP_STORE_CONNECT_API_KEY_PATH"],
      duration:   1200,
      in_house:   false
    )

    # 최초 1회만 생성(readonly: false)
    match(
      type: "appstore",
      readonly: false,
      app_identifier: BUNDLE_ID,
      team_id: ENV["APPLE_TEAM_ID"],
      api_key: api_key,
      git_url: ENV["MATCH_GIT_URL"],
      git_basic_authorization: Base64.strict_encode64("#{ENV['MATCH_GIT_USERNAME']}:#{ENV['MATCH_GIT_PASSWORD']}"),
      keychain_name: "build",
      keychain_password: ENV.fetch("KEYCHAIN_PASSWORD", "actions")
    )

    UI.success("✅ match_init 완료 (인증서/프로파일 생성)")
  end

  desc "TestFlight 배포 (안정 모드)"
  lane :beta do
    setup_ci
    ensure_xcode_version(version: "16.2")

    # 키체인 준비
    create_keychain(
      name: "build",
      password: ENV.fetch("KEYCHAIN_PASSWORD", "actions"),
      default_keychain: true,
      unlock: true,
      timeout: 3600,
      add_to_search_list: true
    )

    # ASC API 키 (파일 경로 사용)
    api_key = app_store_connect_api_key(
      key_id:     ENV["APP_STORE_CONNECT_API_KEY_ID"],
      issuer_id:  ENV["APP_STORE_CONNECT_API_ISSUER_ID"],
      key_filepath: ENV["APP_STORE_CONNECT_API_KEY_PATH"],
      duration:   1200,
      in_house:   false
    )

    # 인증서/프로파일 동기화 (일상 빌드: readonly)
    match(
      type: "appstore",
      readonly: true,
      app_identifier: BUNDLE_ID,
      team_id: ENV["APPLE_TEAM_ID"],
      api_key: api_key,
      git_url: ENV["MATCH_GIT_URL"],
      git_basic_authorization: Base64.strict_encode64("#{ENV['MATCH_GIT_USERNAME']}:#{ENV['MATCH_GIT_PASSWORD']}"),
      keychain_name: "build",
      keychain_password: ENV.fetch("KEYCHAIN_PASSWORD", "actions")
    )

    # 클린 & Pods 재설치 (Codegen/버전 미스 예방)
    sh("rm -rf ios/Pods ios/Podfile.lock ios/build")
    sh("rm -rf ~/Library/Developer/Xcode/DerivedData/*")
    cocoapods(
      podfile: "ios/Podfile",
      clean_install: true,
      repo_update: true
    )

    # (옵션) 빌드 번호 자동 증가
    increment_build_number(xcodeproj: ABSOLUTE_XCODEPROJ_PATH)

    # 빌드
    build_app(
      workspace:     ABSOLUTE_WORKSPACE_PATH,
      scheme:        SCHEME_NAME,
      configuration: "Release",
      export_method: "app-store",
      clean:         true,
      skip_codesigning: false,
      xcargs: "SWIFT_OPTIMIZATION_LEVEL=-O",
      # 일부 환경에서 자동 매칭 실패를 막기 위해 명시
      export_options: {
        provisioningProfiles: {
          BUNDLE_ID => "match AppStore #{BUNDLE_ID}"
        }
      }
    )

    # TestFlight 업로드
    upload_to_testflight(
      api_key: api_key,
      app_identifier: BUNDLE_ID,
      skip_waiting_for_build_processing: true,
      skip_submission: true
    )

    # (옵션) Firebase App Distribution
    if ENV["FIREBASE_TOKEN"].to_s.strip != "" && ENV["FIREBASE_APP_ID"].to_s.strip != ""
      begin
        firebase_app_distribution(
          app: ENV["FIREBASE_APP_ID"],
          groups: "testers",
          release_notes: "Automated build from GitHub Actions"
        )
        UI.success("✅ Firebase App Distribution 업로드 완료")
      rescue => e
        UI.important("⚠️ Firebase App Distribution 실패: #{e.message}")
      end
    end

    UI.success("✅ TestFlight 업로드 성공")
  end
end
