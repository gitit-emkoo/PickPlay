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

## GitHub Actions 워크플로우 (`.github/workflows/ios-build-and-deploy.yml`)
- Base64로 저장한 App Store Connect API 키를 `.p8` 파일로 복원
  ```bash
  python3 <<'PY'
  import os, base64
  key_base64 = os.environ['ASC_P8_BASE64']
  key = base64.b64decode(key_base64).decode('utf-8')
  path = os.environ['KEY_PATH']
  with open(path, 'w', encoding='utf-8') as f:
      f.write(key)
  PY
  ```
  - 복원한 경로를 `APP_STORE_CONNECT_API_KEY_PATH`로 export
- 잡 구성
  - `ios-dev-client`: Fastlane `ios dev_client` 실행 후 IPA를 아티팩트로 업로드
- 런타임 환경
  - `ruby/setup-ruby@v1`으로 Ruby 3.2 설치
  - CocoaPods 버전 고정 (`1.15.2`)

## Fastlane (`fastlane/Fastfile`)
### `dev_client` 레인 흐름
1. `prepare_ci!`로 임시 키체인 구성
2. `app_store_connect_api_key`로 API 토큰 생성 → `api_key` 변수에 저장
3. `ENV.delete("APP_STORE_CONNECT_API_KEY_PATH")`로 `match` 충돌 방지
4. `match` 실행
   - `api_key` 전달, `readonly: false`
   - 필요 시 신규 Development 인증서/프로비저닝 프로파일 작성
5. 프로비저닝 프로파일 확보
   - `profile_uuid` = `SharedValues::SIGH_UUID` → `SharedValues::SIGH_UDID` → `ENV["sigh_<bundle>_development"]`
   - `profile_path` = `ENV["sigh_<bundle>_development_profile-path"]` → `SharedValues::SIGH_PROFILE_PATH`
   - 경로가 없으면 `~/Library/MobileDevice/Provisioning Profiles/<UUID>.mobileprovision` 폴백
   - UUID 또는 경로 미확보 시 즉시 에러 (`fastlane ios bootstrap_dev_profiles` 재안내)
6. `pod install`, Xcode Debug 설정 업데이트
   - `PROVISIONING_PROFILE_SPECIFIER` = UUID
   - `CODE_SIGN_STYLE` = `Manual`, `CODE_SIGN_IDENTITY` = `Apple Development`
7. `build_app`
   - `scheme`: `PickPlay`, `configuration`: `Debug`
   - `export_options`에서 `method: "development"`, `signingStyle: "manual"`
   - 출력: `dist/dev-client/pickplay-dev-client.ipa`
8. 빌드 산출물 업로드
   - GitHub Actions 아티팩트에 IPA 업로드

### AdMob 테스트 기기 로그
- `plugins/with-admob-test-device.js`가 Dev Client 빌드 시 `AppDelegate.mm`에 IDFA 로깅 코드 삽입
- Dev Client 실행 시 Metro 콘솔에 `[PickPlay][AdMob]` 로그 출력 → AdMob 콘솔에 복사 후 테스트 기기 등록

## 로컬 실행 참고
1. Metro 서버 실행: `npx expo start --dev-client`
2. Dev Client IPA를 Xcode/Apple Configurator로 설치 또는 `expo run:ios`
3. QR 코드 스캔 또는 `npx uri-scheme open`으로 Dev Client 실행
4. Metro 터미널에서 JS 오류와 AdMob 로그 확인

## 자주 발생한 오류
| 증상 | 원인 | 해결 |
|------|------|------|
| `invalid curve name (OpenSSL::PKey::ECError)` | Fastlane에 JSON 형태 키 전달 | Base64 → `.p8` 디코드 후 경로 전달 |
| `Unresolved conflict between options: 'api_key_path' and 'api_key'` | `match`가 ENV 경로와 `api_key` 객체를 동시에 감지 | `ENV.delete("APP_STORE_CONNECT_API_KEY_PATH")` 후 `match` 호출 |
| `❌ Development 프로비저닝 프로파일을 찾을 수 없습니다.` | Fastlane 2.228 이후 UUID 상수 변경 | `SharedValues::SIGH_UUID` 우선 사용, ENV 폴백 |
| `no implicit conversion of nil into String` | 프로파일 경로 nil 상태에서 파일명 추출 | ENV→lane_context→폴백 경로 순으로 확인 |
| `GoogleMobileAds.h file not found` | Pods에 Google Ads SDK 미설치 | Podfile에 `Google-Mobile-Ads-SDK` 추가 후 `pod install` |

## 빌드 후 체크 리스트
- GitHub Actions `ios-build-and-deploy` 성공 여부 확인
- `ios-dev-client` 아티팩트에서 IPA 다운로드
- iPhone 설치 → Metro 연결 → JS 오류 재현 및 로그 수집
- `[PickPlay][AdMob]` 로그로 테스트 기기 ID 확보 후 AdMob 콘솔 등록
- 문제 수정 뒤 `release` 검증 → `main` 머지 → TestFlight/심사 진행

## 후속 관리
- Fastlane/Expo 버전 업데이트 시 `fastlane/Fastfile`과 워크플로우 스크립트를 함께 점검
- Dev Client 빌드가 필요한 기능 완료 시마다 본 문서를 참고하여 반복 실행한다.
