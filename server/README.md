# PickPlay Push Server (Expo Push + Cloud Scheduler)

- 클라이언트는 Expo Push 토큰을 Firestore `user_push_tokens/{uid}`에 저장합니다.
- 서버는 매일 KST 20:15에 전체 사용자에게 Expo Push를 발송합니다.
- 이 디렉터리는 Cloud Functions/Run에서 호출 가능한 HTTP 엔드포인트를 제공합니다.

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

2) 배포 대상 선택
- Cloud Run: Buildpack으로 Node.js 자동 감지
- Cloud Functions 2세대(HTTP): 소스 루트 `pickplay/server`, 엔트리포인트는 `index.js` 기본 export(app)

## API 엔드포인트

### 1. GET `/health`
서버 상태 확인
```json
Response: { "ok": true, "time": "2025-01-15T10:00:00Z" }
```

### 2. POST `/broadcast/daily` (자동 스케줄러 전용)
Cloud Scheduler가 매일 호출하는 엔드포인트
- Firestore `config/pushScheduler` 설정을 읽어서 발송
- 설정이 `isEnabled: false`면 발송하지 않음

```json
Request: (Body 없음 - Firestore 설정 사용)
Response: { "ok": true, "sent": 150, "type": "scheduled" }
```

### 3. POST `/broadcast/custom` (수동 발송)
관리자 페이지에서 수동으로 푸시 발송
- 모든 사용자에게 발송

```json
Request: {
  "title": "중요 공지",
  "body": "앱 업데이트가 있습니다"
}
Response: { "ok": true, "sent": 150, "type": "manual" }
```

### 4. POST `/broadcast/test` (테스트 발송)
플랫폼 필터링 또는 특정 사용자에게만 발송

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











