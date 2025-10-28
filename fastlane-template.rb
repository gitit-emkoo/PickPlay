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
    
    # 4. Match 실행으로 프로파일 다운로드 (entitlement 포함)
    # 5. Code Signing 설정 업데이트 (과거에 사용한 방법 재사용)
    puts "🔐 Fastlane Match로 인증서 및 프로비저닝 프로파일 설정 중 (프로파일 강제 재생성)..."
    
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
      force: true,  # Entitlement 변경사항 반영을 위해 강제 재생성
      force_for_new_devices: true,  # 새로운 디바이스/능력 추가 시 프로파일 재생성
      app_identifier: "com.pickplay.kwcc",
      team_id: ENV["APPLE_TEAM_ID"],
      api_key: api_key,
      git_url: ENV["MATCH_GIT_URL"],
      git_basic_authorization: Base64.strict_encode64("#{ENV['MATCH_GIT_USERNAME']}:#{ENV['MATCH_GIT_PASSWORD']}"),
      keychain_name: "build",
      keychain_password: "actions"
    )
    
    puts "✅ Fastlane Match 설정 완료"
    
    # Match 후 Xcode 프로젝트 파일에 provisioning profile 설정 업데이트
    # (과거 경험을 바탕으로 한 추가 조치)
    puts "🔧 Xcode 프로젝트에 provisioning profile 설정 업데이트 중..."
    update_code_signing_settings(
      path: ABSOLUTE_XCODEPROJ_PATH,
      code_sign_identity: "Apple Distribution",
      profile_name: "match AppStore com.pickplay.kwcc",
      bundle_identifier: "com.pickplay.kwcc"
    )
    puts "✅ Code signing 설정 업데이트 완료"
    
    # React Native Codegen 오류 방지 - 근본적인 해결
    puts "📁 모든 Codegen 경로에 더미 파일 생성 중..."
    build_generated_base = File.join(EXPO_PROJECT_ROOT, "ios/build/generated/ios")
    FileUtils.mkdir_p(build_generated_base)
    
    # 1. 루트 레벨 파일들
    FileUtils.touch(File.join(build_generated_base, "RCTAppDependencyProvider.h"))
    
    # 2. 알려진 모든 Codegen 모듈들 (프로액티브 생성)
    known_modules = [
      "lottiereactnative",
      "RNCWebViewSpec",
      "rngesturehandler_codegen",
      "RNGoogleMobileAdsSpec",
      "reanimated",
      "workletscore",
      "safeareacontext",
      "rnscreens"
    ]
    
    known_modules.each do |module_name|
      module_dir = File.join(build_generated_base, "react/renderer/components/#{module_name}")
      FileUtils.mkdir_p(module_dir)
      %w[States ShadowNodes RCTComponentViewHelpers Props EventEmitters ComponentDescriptors].each do |file|
        FileUtils.touch(File.join(module_dir, "#{file}.h"))
      end
    end
    
    # 3. 특수 케이스: rnasyncstorage (루트 경로)
    rnasyncstorage_dir = File.join(build_generated_base, "rnasyncstorage")
    FileUtils.mkdir_p(rnasyncstorage_dir)
    FileUtils.touch(File.join(rnasyncstorage_dir, "rnasyncstorage.h"))
    
    # 4. 특수 케이스: RNCWebViewSpec (루트 경로)
    rncwebviewspec_root = File.join(build_generated_base, "RNCWebViewSpec")
    FileUtils.mkdir_p(rncwebviewspec_root)
    FileUtils.touch(File.join(rncwebviewspec_root, "RNCWebViewSpec.h"))
    
    # 5. 특수 케이스: rngesturehandler_codegen (루트 경로)
    rngh_root = File.join(build_generated_base, "rngesturehandler_codegen")
    FileUtils.mkdir_p(rngh_root)
    FileUtils.touch(File.join(rngh_root, "rngesturehandler_codegen.h"))

    # 6. 특수 케이스: RNGoogleMobileAdsSpec (루트 경로)
    rnads_root = File.join(build_generated_base, "RNGoogleMobileAdsSpec")
    FileUtils.mkdir_p(rnads_root)
    FileUtils.touch(File.join(rnads_root, "RNGoogleMobileAdsSpec.h"))

    # 7. 특수 케이스: rnreanimated (루트 경로)
    rnreanimated_root = File.join(build_generated_base, "rnreanimated")
    FileUtils.mkdir_p(rnreanimated_root)
    FileUtils.touch(File.join(rnreanimated_root, "rnreanimated.h"))

    # 8. 선제 대응: 기타 모듈 루트 헤더 (재발 방지)
    %w[
      lottiereactnative
      workletscore
      safeareacontext
      rnscreens
      rnworklets
    ].each do |root_module|
      root_dir = File.join(build_generated_base, root_module)
      FileUtils.mkdir_p(root_dir)
      FileUtils.touch(File.join(root_dir, "#{root_module}.h"))
    end
    
    # 9. 루트 JSI 및 RCT Provider 헤더 선제 생성 (ReactCodegen 루트 복사 대비)
    %w[
      safeareacontextJSI.h
      rnworkletsJSI.h
      rnscreensJSI.h
      rnreanimatedJSI.h
      rngesturehandler_codegenJSI.h
      rnasyncstorageJSI.h
      RNGoogleMobileAdsSpecJSI.h
      RNCWebViewSpecJSI.h
      RCTUnstableModulesRequiringMainQueueSetupProvider.h
      RCTThirdPartyComponentsProvider.h
      RCTModulesConformingToProtocolsProvider.h
      RCTModuleProviders.h
    ].each do |header_name|
      FileUtils.touch(File.join(build_generated_base, header_name))
    end
    
    puts "✅ 모든 Codegen 더미 파일 생성 완료"
    
    # 7. 빌드 및 아카이브
    build_app(
      workspace: ABSOLUTE_WORKSPACE_PATH, 
      scheme: "PickPlay",
      configuration: "Release",
      export_method: "app-store",
      clean: true, # CI에서는 clean: true를 유지하여 안정성 확보
      skip_codesigning: false,
      xcargs: "SWIFT_OPTIMIZATION_LEVEL=-O DEVELOPMENT_TEAM='#{ENV["APPLE_TEAM_ID"]}' CODE_SIGN_STYLE=Manual GENERATE_PROFILING_CODE=NO ENABLE_PREVIEWS=YES"
    )
    
    # 8. TestFlight 업로드 및 Firebase App Distribution
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
 
