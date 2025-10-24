# This file contains the fastlane.tools configuration
# You can find the documentation at https://docs.fastlane.tools

default_platform(:ios)

platform :ios do
  desc "Build and upload to TestFlight"
  lane :beta do
    # 인증서 및 프로파일 설정
    create_keychain(
      name: "build",
      password: "temp123",
      default_keychain: true,
      unlock: true,
      timeout: 3600
    )
    
    # 인증서 가져오기 (비밀번호 정제)
    clean_password = ENV["P12_PASSWORD"].to_s.strip.gsub(/[\r\n\t]/, '')
    import_certificate(
      certificate_path: "../certificate.p12",
      certificate_password: clean_password,
      keychain_name: "build"
    )
    
    # 프로비저닝 프로파일 설치
    install_provisioning_profile(
      path: "../provisioning_profile.mobileprovision"
    )
    
    # 빌드 및 아카이브
    build_app(
      workspace: "PickPlay.xcworkspace",
      scheme: "PickPlay",
      configuration: "Release",
      export_method: "app-store",
      export_options: "ExportOptions.plist"
    )
    
    # TestFlight 업로드
    upload_to_testflight(
      apple_id: ENV["APPLE_ID"],
      app_identifier: "com.kwcc.pickplay",
      skip_waiting_for_build_processing: true
    )
  end
end
