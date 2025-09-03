# 픽플레이 (PickPlay)

## 앱 소개

"픽플레이"는 매일 새로운 밸런스 게임 질문에 참여하고 보상을 받는 앱입니다.

## 주요 기능

### 밸런스 게임
- **일일 질문**: 매일 새로운 A/B 선택 질문 제공
- **A/B 테스트**: 사용자 ID 기반으로 A/B 슬롯 자동 할당
- **실시간 투표**: 두 가지 옵션 중 하나 선택하여 투표
- **전국 결과**: 실시간으로 전체 참여자 결과 확인

### 보상 시스템
- **다수/소수 보상**: 다수 5P / 소수 10P (동률은 5P)
- **연속 참여 배수**: 10일째부터 2배, 20일째부터 3배 적용
- **광고 시청**: 보상 적립을 위해 리워드 전면광고 시청

### 사용자 관리
- **기기 고정 UID**: 디바이스별 UID로 사용자 식별(익명 로그인 대체)
- **포인트 적립**: 게임 참여로 포인트 적립 및 관리
- **연속 참여**: 하루라도 건너뛰면 1일부터 리셋
- **[MVP] UID 영속성**: AsyncStorage 기반 UID 자체 보정 사용. 추후 Firebase RN 세션 영속화 전환 예정

## 기술 스택

- **프론트엔드**: React Native + Expo
- **백엔드**: Firebase
- **인증**: Firebase Authentication (Anonymous)
- **데이터베이스**: Firestore
- **광고**: Google AdMob (리워드 광고)
- **언어**: TypeScript

## 시작하기

### 필수 요구사항
- Node.js 18+
- Expo CLI
- Firebase 프로젝트 설정

### 설치 및 실행
   ```bash
# 의존성 설치
   npm install

# Expo 개발 서버 실행
   npx expo start

# iOS 시뮬레이터 실행
npx expo run:ios

# Android 에뮬레이터 실행
npx expo run:android
```

## 환경 설정

### Firebase 설정
1. Firebase 콘솔에서 새 프로젝트 생성
2. Authentication → 익명 로그인 활성화
3. Firestore 데이터베이스 생성 (프로덕션 모드)
4. 웹 앱 추가 후 설정값 복사
5. `app/services/firebase.ts`에 설정값 입력

### 광고 설정
1. Google AdMob 계정 생성 및 앱 등록
2. 광고 단위 ID 발급(보상형 전면) 후 `app/services/ads.native.ts`의 AD_UNITS 교체
3. `app.json`의 `googleMobileAdsAppId` 확인(ios/android 모두)

## 데이터 구조

### Firestore 컬렉션
- **users**: 사용자 포인트, 연속 출석 정보
- **questions**: 일일 질문 데이터
- **votes**: 사용자 투표 기록

### 주요 데이터 모델
```typescript
interface Question {
  id: string;
  title: string;
  options: [string, string];
  dayIndex: number;
  slot: 'A' | 'B';
  active: boolean;
}

interface UserData {
  points: number;
  streakCount: number;
  lastAnswerDate: string;
}
```

## UI/UX 특징

- **심플한 원페이지 디자인**: 복잡한 네비게이션 없이 직관적
- **실시간 피드백**: 투표 후 즉시 결과 확인
- **친구 초대**: 공유 기능으로 앱 확산
- **반응형 레이아웃**: 다양한 화면 크기 지원

## 자동 배포 (GitHub Actions)

### GitHub Secrets 설정

GitHub 저장소의 Settings → Secrets and variables → Actions에서 다음 시크릿을 설정해야 합니다:

#### iOS 앱스토어 배포용
- `EXPO_TOKEN`: Expo 계정 토큰
- `APPLE_ID`: Apple ID
- `APPLE_APP_SPECIFIC_PASSWORD`: 앱별 비밀번호
- `APP_STORE_CONNECT_API_KEY_ID`: App Store Connect API 키 ID
- `APP_STORE_CONNECT_API_KEY_ISSUER_ID`: App Store Connect API 키 발급자 ID
- `APP_STORE_CONNECT_API_KEY_KEY`: App Store Connect API 키

#### Android Play Store 배포용
- `EXPO_TOKEN`: Expo 계정 토큰
- `GOOGLE_SERVICE_ACCOUNT_JSON`: Google Play Console 서비스 계정 JSON
- `GOOGLE_PLAY_TRACK`: 배포 트랙 (production, beta, alpha)

### 자동 배포 트리거

1. **태그 푸시**: `git tag v1.0.0 && git push origin v1.0.0`
2. **수동 실행**: GitHub Actions 탭에서 `workflow_dispatch` 사용
3. **브랜치 푸시**: main/develop 브랜치에 푸시 시 자동 빌드

### 워크플로우 파일

- `.github/workflows/ios-build.yml`: iOS 빌드 및 앱스토어 배포
- `.github/workflows/android-build.yml`: Android 빌드 및 Play Store 배포
- `.github/workflows/test.yml`: 코드 품질 검사 및 테스트

### EAS 설정 요약
- Android: `simple` 프로필로 APK 테스트 빌드, `production` 프로필로 배포 빌드
- iOS: `production` 프로필 사용, `autoIncrement: true`, `appVersionSource: remote`

## 상태 및 향후 계획

- [x] 푸시 알림: 20:15 일일 알림(중복 방지), 3/10일 축하 알림
- [x] 승자 가중 라우팅: 샘플 임계치 도달 시 인기 질문 우선 배정
- [ ] 리더보드 (포인트 순위)
- [ ] 다국어 지원
- [ ] Firebase RN 세션 영속화로 전환(getReactNativePersistence 기반)

### 고도화 계획 (동시 접속자 2만명+ 대응)

#### 서버 집계 아키텍처 전환
- [ ] 실시간 구독 대상 변경: `votes` 쿼리 → `aggregates/{questionId}` 단일 문서 구독
- [ ] 투표 저장 구조 변경: `votes/{questionId}/userVotes/{uid}` (유저당 1문서 고정)
- [ ] Cloud Functions 트리거: 투표 시 집계 문서 자동 업데이트
- [ ] 샤딩 구조: `aggregates/{questionId}/shards/{0..N}` 분산 처리
- [ ] 승자 라우팅 서버 처리: Cron 기반 일일 집계 및 라우팅 결정

#### 운영 인프라 구축
- [ ] 모니터링 대시보드: Crashlytics/Sentry + Cloud Monitoring
- [ ] BigQuery Export: 투표 데이터 분석 및 TTL 관리
- [ ] Functions 최적화: Gen2 + minInstances 설정으로 콜드스타트 최소화
- [ ] 보안 규칙 강화: 중복 투표 방지 및 데이터 무결성 보장

#### 성능 최적화
- [ ] 읽기 비용 절감: 단일 집계 문서 구독으로 팬아웃 방지
- [ ] 쓰기 분산: 샤드 기반 고성능 투표 처리 (2천 writes/sec 지원)
- [ ] 캐싱 전략: Redis/Cloud Memorystore 도입 검토

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🤝 기여하기

버그 리포트, 기능 제안, PR 등 모든 기여를 환영합니다!

---

**"오늘의 밸런스"로 매일 새로운 선택의 재미를 경험해보세요! 🎯**
