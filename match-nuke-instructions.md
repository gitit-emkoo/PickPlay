# Match Nuke 실행 가이드

## ⚠️ 중요 사항
이 작업은 기존 프로파일을 완전히 삭제하는 작업입니다. 반드시 로컬 Mac 환경에서 단 한 번만 실행하세요.

## 실행 전 준비사항

1. Fastlane이 설치되어 있어야 합니다
2. GitHub Secrets에 설정된 값들을 환경 변수로 준비해야 합니다
3. Git 저장소에 대한 액세스 권한이 있어야 합니다

## 환경 변수 설정

터미널에서 다음 명령어를 실행하여 환경 변수를 설정합니다:

```bash
# Apple Developer 설정
export APPLE_TEAM_ID="YSFH2ZX88C"  # 팀 ID

# Match Git 저장소 설정
export MATCH_GIT_URL="https://github.com/gitit-emkoo/PickPlay-Certificates.git"
export MATCH_GIT_USERNAME="eunmo koo"  # 또는 Git 사용자명
export MATCH_GIT_PASSWORD="YOUR_GIT_TOKEN"  # GitHub Personal Access Token

# Match 암호화 비밀번호
export MATCH_PASSWORD="YOUR_MATCH_PASSWORD"

# App Store Connect API 설정
export APP_STORE_CONNECT_API_KEY_ID="YOUR_KEY_ID"
export APP_STORE_CONNECT_API_ISSUER_ID="YOUR_ISSUER_ID"
export APP_STORE_CONNECT_API_KEY="YOUR_API_KEY"  # .p8 파일 내용
```

## Step 1: 기존 프로파일 삭제 (Nuke)

```bash
cd pickplay/ios

# App Store 프로파일 완전 삭제
fastlane match nuke appstore --app_identifier "com.pickplay.kwcc"
```

이 명령어는:
- Apple Developer Portal에서 `com.pickplay.kwcc`용 App Store 프로파일을 삭제합니다
- Match의 Git 저장소에서 해당 프로파일을 삭제합니다
- 인증서는 삭제하지 않습니다

## Step 2: 재빌드 실행

`match nuke` 실행 후, GitHub Actions에서 다시 빌드를 실행합니다:

1. GitHub 저장소로 이동
2. "Actions" 탭에서 "iOS Build and Deploy to TestFlight" 워크플로우 선택
3. "Run workflow" 버튼 클릭

또는 `release` 브랜치에 푸시를 하면 자동으로 빌드가 시작됩니다.

## 확인 사항

빌드 로그에서 다음 메시지를 확인하세요:

```
✨ Success: Entitlements에 'aps-environment' (Push Notification)가 포함되어 있습니다.
```

이 메시지가 보이면 프로파일에 Push Notification 권한이 제대로 포함된 것입니다.

## 문제 해결

### "git repository is already cloned" 오류가 발생하는 경우

Match의 Git 캐시를 삭제해야 합니다:

```bash
# Match 캐시 삭제
rm -rf ~/Library/Caches/fastlane/match
```

### "certificate not found" 오류가 발생하는 경우

인증서는 삭제되지 않아야 합니다. 이 오류는 무시하고 진행하세요.

## 참고사항

- `match nuke`는 기존 프로파일만 삭제하며, 인증서는 유지합니다
- 새 프로파일은 `force: true` 옵션에 의해 다시 생성됩니다
- 새로 생성된 프로파일은 App ID의 최신 권한(including Push Notifications)을 포함합니다

