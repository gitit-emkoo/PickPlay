# 픽플레이 (PickPlay)

## 📱 앱 소개

**"픽플레이"**는 매일 새로운 밸런스 게임 질문에 참여하고 보상을 받는 앱입니다.

## 🎯 주요 기능

### 🎮 밸런스 게임
- **일일 질문**: 매일 새로운 A/B 선택 질문 제공
- **A/B 테스트**: 사용자 ID 기반으로 A/B 슬롯 자동 할당
- **실시간 투표**: 두 가지 옵션 중 하나 선택하여 투표
- **전국 결과**: 실시간으로 전체 참여자 결과 확인

### 🏆 보상 시스템
- **승패 보상**: 특별획득 5P!
- **출석 보너스**: 연속 3일 +30P, 연속 7일 +100P
- **광고 시청**: 보상 획득을 위한 리워드 광고 시청

### 🔐 사용자 관리
- **익명 인증**: Firebase Anonymous Auth로 사용자 식별
- **포인트 적립**: 게임 참여로 포인트 적립 및 관리
- **연속 출석**: 연속 참여 일수 추적

## 🛠 기술 스택

- **프론트엔드**: React Native + Expo
- **백엔드**: Firebase
- **인증**: Firebase Authentication (Anonymous)
- **데이터베이스**: Firestore
- **광고**: Google AdMob (리워드 광고)
- **언어**: TypeScript

## 🚀 시작하기

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

## ⚙️ 환경 설정

### Firebase 설정
1. Firebase 콘솔에서 새 프로젝트 생성
2. Authentication → 익명 로그인 활성화
3. Firestore 데이터베이스 생성 (프로덕션 모드)
4. 웹 앱 추가 후 설정값 복사
5. `app/services/firebase.ts`에 설정값 입력

### 광고 설정
1. Google AdMob 계정 생성
2. 리워드 광고 단위 ID 발급
3. `app/(tabs)/index.tsx`의 `REWARDED_AD_UNIT` 값 교체

## 📊 데이터 구조

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

## 🎨 UI/UX 특징

- **심플한 원페이지 디자인**: 복잡한 네비게이션 없이 직관적
- **실시간 피드백**: 투표 후 즉시 결과 확인
- **친구 초대**: 공유 기능으로 앱 확산
- **반응형 레이아웃**: 다양한 화면 크기 지원

## 🚀 자동 배포 (GitHub Actions)

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

### EAS 설정

`eas.json` 파일에서 빌드 및 배포 설정을 관리합니다:

```json
{
  "build": {
    "production": {
      "autoIncrement": "buildNumber"
    }
  },
  "submit": {
    "production": {
      "ios": { ... },
      "android": { ... }
    }
  }
}
```

## 🔮 향후 계획

- [ ] 푸시 알림 (일일 질문 알림)
- [ ] 리더보드 (포인트 순위)
- [ ] 테마 커스터마이징
- [ ] 다국어 지원
- [ ] 소셜 로그인 (Google, Apple)

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🤝 기여하기

버그 리포트, 기능 제안, PR 등 모든 기여를 환영합니다!

---

**"오늘의 밸런스"로 매일 새로운 선택의 재미를 경험해보세요! 🎯**
