# iOS Dev Client 빌드 Runbook

## 목적
- 릴리스 빌드에서 확인되지 않는 JavaScript 오류를 iOS 실기기에서 실시간으로 추적하기 위해 Dev Client를 빌드한다.
- Dev Client 실행 시 Metro 로그에 AdMob 테스트 기기 ID를 자동 출력하여 등록 절차를 단축한다.

## 사전 준비 사항
- **Apple Developer 계정**: `com.pickplay.kwcc` 번들 ID 활성화 및 테스트 기기 UDID 등록.
- **Expo 패키지**: `expo-dev-client`가 `package.json`에 포함되어 있어야 한다.
- **GitHub Secrets** 확인
  - `APP_STORE_CONNECT_API_KEY_BASE64`, `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`
  - `MATCH_GIT_URL`, `MATCH_GIT_USERNAME`, `MATCH_GIT_PASSWORD`
  - 기타 슬랙 웹훅 등 선택적 환경변수
- **Fastlane Match repo**: Dev/Prod가 공유하는 인증서 저장소 접근 권한 필요.

## CI 워크플로우 (`.github/workflows/ios-build-and-deploy.yml`)
- Base64로 저장한 App Store Connect API 키를 `.p8` 파일로 복원하고 `APP_STORE_CONNECT_API_KEY_PATH`에 export
- 현재는 `ios-dev-client` 잡만 실행되며, TestFlight용 `ios-beta` 잡은 비활성화됨
- 런타임 환경: `ruby/setup-ruby@v1`(Ruby 3.2), CocoaPods 1.15.2, Node.js 20, `npm ci --omit=dev`
- 빌드 산출물은 `actions/upload-artifact`로 `dev-client-ipa` 이름으로 업로드

## Fastlane (`fastlane/Fastfile`) - `ios dev_client`
1. `prepare_ci!`로 임시 키체인 구성
2. `app_store_connect_api_key` → `api_key` 객체 생성
3. `ENV.delete("APP_STORE_CONNECT_API_KEY_PATH")` 후 `match` 실행 (`readonly:false`, `api_key` 전달)
4. `SharedValues::SIGH_UUID` 등에서 UUID/경로 수집, 없으면 `~/Library/MobileDevice/Provisioning Profiles/<UUID>.mobileprovision` 폴백
5. `pod install`, `update_project_team`, `embedded.mobileprovision` 복사
6. `build_app` (Debug, development export)
7. 빌드 결과 경로: `dist/dev-client/pickplay-dev-client.ipa`

## AdMob 테스트 기기 로그
- `plugins/with-admob-test-device.js`가 `AppDelegate.mm`에 IDFA 로깅 및 테스트 기기 등록 코드 주입
- Dev Client 실행 시 Metro 로그에서 `[PickPlay][AdMob]` 섹션 확인 → 콘솔에서 ID 복사 → AdMob 테스트 기기 등록

## 로컬 실행 참고
1. `npx expo start --dev-client`
2. Dev Client IPA를 기기에 설치 (`expo run:ios`, TestFlight, Apple Configurator 등)
3. QR 스캔 또는 `npx uri-scheme open`으로 Dev Client 실행
4. Metro 로그에서 JS 오류 및 AdMob 로그 확인

## 주요 오류 & 해결책
| 증상 | 원인 | 해결 |
|------|------|------|
| `invalid curve name (OpenSSL::PKey::ECError)` | Fastlane에 JSON 형태 키 전달 | Base64 → `.p8` 디코드 후 경로 전달 |
| `Unresolved conflict between options: 'api_key_path' and 'api_key'` | `match`가 ENV 경로와 `api_key` 객체를 동시에 감지 | `ENV.delete("APP_STORE_CONNECT_API_KEY_PATH")` 후 `match` 호출 |
| `❌ Development 프로비저닝 프로파일을 찾을 수 없습니다.` | Fastlane 2.228 이후 UUID 상수 변경 | `SharedValues::SIGH_UUID` 우선 사용, ENV 폴백 |
| `no implicit conversion of nil into String` | 프로파일 경로 nil 상태에서 `File.basename` 호출 | Guard 로직에서 `to_s` 사용 및 경로 검증 강화 |
| `GoogleMobileAds.h file not found` | Podfile에 Google Ads SDK 미추가 | `pod 'Google-Mobile-Ads-SDK'` 추가 후 `pod install` |

## 빌드 후 체크
- GitHub Actions `ios-dev-client` 잡 결과 확인 → 아티팩트에서 IPA 다운로드
- iPhone 설치 → Metro 연결 → JS 오류 재현 및 로그 확보
- `[PickPlay][AdMob]` 로그로 테스트 기기 ID 등록
- 문제 해결 후 `release`에서 검증 → `main` 머지 → TestFlight/심사 진행

## 유지보수 메모
- TestFlight 빌드가 필요해지면 `ios-build-and-deploy.yml`에서 `ios-beta` 잡 복구
- Fastlane/Expo 업데이트 시 Podfile/Fastfile의 Folly 설정과 config plugin을 함께 점검
- dev client 로그가 필요한 기능 추가 시 본 문서를 기준으로 반복 실행
