# PickPlay 푸시 알림 시스템 가이드

## 📋 목차
1. [시스템 구조](#시스템-구조)
2. [API 엔드포인트](#api-엔드포인트)
3. [관리자 페이지 사용법](#관리자-페이지-사용법)
4. [배포 가이드](#배포-가이드)
5. [테스트 방법](#테스트-방법)

---

## 시스템 구조

### 1. 앱 (React Native)
- 푸시 토큰 등록: `app/services/notifications.ts`
- Firestore `user_push_tokens/{uid}`에 토큰 저장
- 플랫폼 정보 포함 (iOS/Android)

### 2. 푸시 서버 (Cloud Run)
- 위치: `server/`
- 엔드포인트:
  - `/broadcast/daily` - 자동 스케줄러 (매일 20:15)
  - `/broadcast/custom` - 수동 전체 발송
  - `/broadcast/test` - 테스트 발송 (플랫폼 필터링)

### 3. 관리자 페이지 (React + Vite)
- 위치: `pickplay-admin/`
- 기능:
  - 수동 푸시 발송
  - 테스트 발송 (iOS/Android 필터링)
  - 발송 기록 조회
  - 스케줄러 설정 조회

### 4. Firestore 컬렉션
```
config/
  └─ pushScheduler      # 스케줄러 설정
user_push_tokens/
  └─ {uid}              # 사용자별 푸시 토큰
push_logs/
  └─ {logId}            # 발송 기록
```

---

## API 엔드포인트

### Base URL
```
https://pickplay-push-98121571371.asia-northeast3.run.app
```

### 1. GET `/health`
서버 상태 확인
```bash
curl https://pickplay-push-98121571371.asia-northeast3.run.app/health
```

### 2. POST `/broadcast/daily` (자동 스케줄러)
- Cloud Scheduler가 매일 호출
- Firestore `config/pushScheduler` 설정 사용
- Body 불필요

### 3. POST `/broadcast/custom` (수동 전체 발송)
모든 사용자에게 발송
```bash
curl -X POST https://pickplay-push-98121571371.asia-northeast3.run.app/broadcast/custom \
  -H "Content-Type: application/json" \
  -d '{
    "title": "중요 공지",
    "body": "앱 업데이트가 있습니다"
  }'
```

### 4. POST `/broadcast/test` (테스트 발송)

**iOS만**
```bash
curl -X POST https://pickplay-push-98121571371.asia-northeast3.run.app/broadcast/test \
  -H "Content-Type: application/json" \
  -d '{
    "title": "iOS 테스트",
    "body": "iOS 사용자만 받습니다",
    "platform": "ios"
  }'
```

**Android만**
```bash
curl -X POST https://pickplay-push-98121571371.asia-northeast3.run.app/broadcast/test \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Android 테스트",
    "body": "Android 사용자만 받습니다",
    "platform": "android"
  }'
```

**PowerShell (Windows)**
```powershell
$json = '{"title":"iOS 테스트","body":"iOS 사용자만 받습니다","platform":"ios"}'
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
Invoke-WebRequest -Method Post -Uri "https://pickplay-push-98121571371.asia-northeast3.run.app/broadcast/test" -Headers @{"Content-Type"="application/json"} -Body $bytes
```

---

## 관리자 페이지 사용법

### 1. 접속
```
https://pickplay-admin.web.app
```

### 2. 푸시 알림 메뉴

#### 전체 발송
1. "전체 발송" 탭 선택
2. 제목과 내용 입력
3. "📤 전체 발송" 버튼 클릭
4. ⚠️ **모든 사용자**에게 발송됨

#### 테스트 발송
1. "테스트 발송" 탭 선택
2. 제목과 내용 입력
3. 테스트 대상 선택:
   - 전체 사용자
   - iOS 사용자만
   - Android 사용자만
4. "🧪 테스트 발송" 버튼 클릭

#### 발송 기록
- 수동 발송 기록
- 자동 발송 기록 (매일 20:15)
- 성공/실패 통계

---

## 배포 가이드

### 1. 푸시 서버 배포 (Cloud Run)

```bash
cd pickplay

# Cloud Run에 배포
gcloud run deploy pickplay-push \
  --source ./server \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### 2. Firestore 규칙 배포

```bash
firebase deploy --only firestore:rules
```

### 3. 초기 스케줄러 설정 생성

```bash
cd pickplay
node scripts/init-push-scheduler.js
```

### 4. Cloud Scheduler 설정

Firebase Console → Cloud Scheduler

- **이름**: `daily-push-notification`
- **지역**: `asia-northeast3`
- **빈도**: `15 11 * * *` (UTC 11:15 = KST 20:15)
- **타임존**: `UTC`
- **대상 유형**: HTTP
- **URL**: `https://pickplay-push-98121571371.asia-northeast3.run.app/broadcast/daily`
- **HTTP 메서드**: POST
- **본문**: (비워둠 - Firestore 설정 사용)

---

## 테스트 방법

### 1. 로컬 서버 실행

```bash
cd pickplay
node server/index.js
```

### 2. 테스트 발송 (iOS만)

```bash
curl -X POST http://localhost:8080/broadcast/test \
  -H "Content-Type: application/json" \
  -d '{"title":"테스트","body":"iOS 테스트","platform":"ios"}'
```

### 3. 관리자 페이지에서 테스트

1. 로컬 개발 서버 실행:
```bash
cd pickplay-admin
npm run dev
```

2. http://localhost:5173 접속
3. 로그인 후 푸시 알림 메뉴 이동
4. 테스트 발송 탭에서 iOS 선택 후 발송

---

## 주의사항

### ⚠️ 테스트 발송
- "테스트 발송"은 **선택한 플랫폼의 모든 사용자**에게 발송됩니다
- 소수의 사용자에게만 테스트하려면 별도 개발 계정 필요

### ⚠️ 스케줄러 시간
- Cloud Scheduler는 **UTC 기준**
- KST 20:15 = UTC 11:15
- 크론 표현식: `15 11 * * *`

### ⚠️ 발송 로그
- 서버에서 자동으로 Firestore `push_logs` 컬렉션에 저장
- 관리자 페이지에서 조회 가능
- 타입 구분: `scheduled`, `manual`, `test`

---

## 문제 해결

### 푸시가 발송되지 않음
1. Cloud Run 로그 확인
2. Firestore Rules 확인 (`config` 읽기 권한)
3. 푸시 토큰 존재 여부 확인

### 스케줄러가 작동하지 않음
1. Cloud Scheduler 활성화 확인
2. Firestore `config/pushScheduler`의 `isEnabled` 확인
3. Cloud Scheduler 로그 확인

### 관리자 페이지 오류
1. 환경변수 확인 (`.env` 파일)
2. API URL 확인
3. 브라우저 콘솔 로그 확인

---

## 환경변수 (관리자 페이지)

`pickplay-admin/.env`:
```env
VITE_CUSTOM_PUSH_URL=https://pickplay-push-98121571371.asia-northeast3.run.app/broadcast/custom
VITE_TEST_PUSH_URL=https://pickplay-push-98121571371.asia-northeast3.run.app/broadcast/test
```

---

## 업데이트 이력

- **2025-01-15**: 초기 시스템 구축
  - 자동/수동/테스트 발송 분리
  - 플랫폼 필터링 기능 추가
  - Firestore 기반 스케줄러 설정

