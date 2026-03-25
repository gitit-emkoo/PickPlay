# PickPlay Push Server (Expo Push)

- 클라이언트는 Expo Push 토큰을 Firestore `user_push_tokens/{uid}`에 저장합니다.
- **`POST /broadcast/*` 는 관리자 키가 있을 때만 동작합니다.** 환경변수 `ADMIN_PUSH_SECRET` 과 요청 헤더 `X-Admin-Push-Key` 가 일치해야 합니다. 미설정 시 해당 경로는 503입니다.
- 자동 스케줄은 운영 정책에 따라 Cloud Scheduler로 연결할 수 있으며, 상세는 `docs/push-admin-only-design.md` 를 참고합니다.

## 로컬 실행
```bash
# Windows PowerShell (프로젝트 루트에서)
cd pickplay
node .\server\index.js
# http://localhost:8080/health 확인
```

## Cloud Functions/Run 배포(HTTP)
1) GCP 프로젝트 선택 및 Firebase Admin 자격 증명 준비
- 서비스 계정 키(JSON)를 Secret Manager에 저장하거나, 환경변수 `GOOGLE_APPLICATION_CREDENTIALS`로 경로 설정
2) Cloud Run 환경변수  
   - **`ADMIN_PUSH_SECRET`**: 발송 API 보호용 (강력한 랜덤 문자열)  
   - **`ADMIN_PUSH_ALLOWED_UIDS`**: (선택) 쉼표로 UID 나열. 설정 시 **`audience: test`** 및 **`/broadcast/test`** 요청에서 요청 `uids`와 **교집합**만 발송. **비어 있으면** 수동 테스트는 요청한 UID 그대로 발송(관리자 키로 보호). Firestore 스케줄 `schedulerAudience: test` 인 **데일리 자동**은 이 목록의 UID만 사용(비어 있으면 스케줄 테스트 발송 스킵).  
   - **`ADMIN_PUSH_ALLOW_BROADCAST_ALL`**: `true`일 때만 **`POST /broadcast/custom`** 에서 `audience: "all"`(전체 토큰) + `confirmBroadcastAll: true` 요청을 허용합니다. 미설정·`false`면 403입니다.

3) 배포 대상 선택
- Cloud Run: Buildpack으로 Node.js 자동 감지
- Cloud Functions 2세대(HTTP): 소스 루트 `pickplay/server`, 엔트리포인트는 `index.js` 기본 export(app)

## API 엔드포인트

### 1. GET `/health`
서버 상태 확인
```json
Response: { "ok": true, "time": "2025-01-15T10:00:00Z" }
```

### 2. POST `/broadcast/daily` (자동 스케줄러 전용)
Cloud Scheduler가 호출할 수 있는 엔드포인트(선택)
- 헤더 **`X-Admin-Push-Key: <ADMIN_PUSH_SECRET>`** 필수
- Firestore `config/pushScheduler` 설정을 읽어서 발송
- 설정이 `isEnabled: false`면 발송하지 않음

```json
Request: (Body 없음 - Firestore 설정 사용)
Response: { "ok": true, "sent": 150, "type": "scheduled" }
```

### 3. POST `/broadcast/custom` (수동 발송)
관리자 페이지에서 수동으로 푸시 발송
- 헤더 **`X-Admin-Push-Key`** 필수
- **`audience`**: `"test"`(기본) | `"all"`
  - **`test`**: **`uids`: string[]** 필수. 서버 **`ADMIN_PUSH_ALLOWED_UIDS`** 와 교집합인 UID에만 발송
  - **`all`**: 전체 토큰. 서버에 **`ADMIN_PUSH_ALLOW_BROADCAST_ALL=true`** 필요. 본문에 **`confirmBroadcastAll`: true** 필수

```json
Request (테스트): {
  "title": "중요 공지",
  "body": "앱 업데이트가 있습니다",
  "audience": "test",
  "uids": ["firebaseUid1", "firebaseUid2"]
}
Request (전체): {
  "title": "중요 공지",
  "body": "앱 업데이트가 있습니다",
  "audience": "all",
  "confirmBroadcastAll": true
}
Response: { "ok": true, "sent": 150, "type": "manual", "audience": "test" }
```

### 4. POST `/broadcast/test` (UID 발송)
특정 UID에게만 발송 (플랫폼 전체·전체 사용자 발송은 제거됨)
- 헤더 **`X-Admin-Push-Key`** 필수
- 본문에 **`uids`: string[]** 필수. `ADMIN_PUSH_ALLOWED_UIDS` 와 교집합

**플랫폼 필터링 (iOS만)**
```json
Request: {
  "title": "iOS 테스트",
  "body": "iOS 사용자만 받습니다",
  "platform": "ios"
}
Response: { "ok": true, "sent": 50, "type": "test", "platform": "ios" }
```

**플랫폼 필터링 (Android만)**
```json
Request: {
  "title": "Android 테스트",
  "body": "Android 사용자만 받습니다",
  "platform": "android"
}
Response: { "ok": true, "sent": 100, "type": "test", "platform": "android" }
```

**특정 사용자에게만**
```json
Request: {
  "title": "개인 테스트",
  "body": "특정 사용자만 받습니다",
  "uids": ["user123", "user456"]
}
Response: { "ok": true, "sent": 2, "type": "test", "platform": "all" }
```

## Cloud Scheduler 설정
- 지역: `asia-northeast3` (Seoul 권장)
- 스케줄(크론): `15 11 * * *` (UTC 11:15 = KST 20:15)
- 대상: HTTP
- 메서드: POST
- URL: Cloud Run/Functions에 배포된 `/broadcast/daily`
- 본문(JSON):
```
{ "title": "오늘의 질문이 기다리고 있어요! 🎯", "body": "지금 참여하고 보상 받기!" }
```
- 인증: 서비스 계정(OIDC) 지정 권장

## 운영 팁
- 토큰 중복은 서버에서 자동 제거됩니다.
- iOS/Android 모두 지원합니다.
- 실패 로그는 Cloud 로그 탐색기에서 확인하세요.

> 시간대 주의: Cloud Scheduler는 UTC 기준입니다. KST 20:15 → UTC 11:15로 설정하세요.











