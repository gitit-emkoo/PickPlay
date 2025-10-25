# Appfile - Fastlane 앱 설정
# 이 파일은 fastlane 디렉토리에 Appfile로 저장됩니다

# Apple Developer 계정 정보
apple_id ENV["APPLE_ID"] || "your-apple-id@example.com"

# Apple Developer Team ID
team_id ENV["APPLE_TEAM_ID"]

# 앱 식별자
app_identifier "com.pickplay.kwcc"

# App Store Connect API Key (선택사항)
# api_key_path "path/to/your/AuthKey_XXXXXXXXXX.p8"
# api_key_id "XXXXXXXXXX"
# api_key_issuer_id "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
