# Expo SDK 53 마이그레이션 실행 가이드

## 🎯 마이그레이션 순서

### 1단계: 의존성 재설치
```bash
cd pickplay
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### 2단계: Expo 패키지 자동 조정
```bash
npx expo install --fix
```
이 명령어가 다음을 자동으로 처리:
- Expo SDK 53에 맞는 모든 expo-* 패키지 버전 조정
- React Native 버전 자동 조정 (0.76.x)
- 호환되는 다른 패키지들 버전 조정

### 3단계: iOS Pod 재설치
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
```

### 4단계: 빌드 테스트
```bash
# iOS 빌드 테스트
cd ios
xcodebuild -workspace PickPlay.xcworkspace -scheme PickPlay -configuration Debug

# 또는 EAS 빌드
eas build --platform ios --profile preview
```

---

## ✅ 검증 체크리스트

마이그레이션 후 확인:

- [ ] `package.json`에서 버전 확인
  - expo: ~53.0.0
  - react: 18.3.1
  - react-native: 0.76.x (예상)

- [ ] `npx expo install --fix` 실행 완료
  - 모든 expo-* 패키지 버전 조정 확인

- [ ] iOS Pod 설치 완료
  - Pods 폴더 생성 확인
  - Podfile.lock 생성 확인

- [ ] 앱 실행 테스트
  - 로컬에서 앱 실행 확인

- [ ] 기능 테스트
  - Firebase 인증 정상 작동
  - Firestore 데이터 읽기/쓰기 정상
  - AdMob 광고 정상 표시
  - AI 태그 생성 정상 작동

---

## 🚨 문제 발생 시

### 의존성 충돌
```bash
npm install --legacy-peer-deps
```

### Expo 버전 불일치
```bash
npx expo install --fix
```

### iOS Pod 오류
```bash
cd ios
rm -rf Pods Podfile.lock
pod install --repo-update
```

---

## 📝 참고 문서

- `COMPATIBILITY_ANALYSIS.md` - 호환성 분석
- `MIGRATION_TO_SDK53.md` - 마이그레이션 상세 가이드
- `FEATURE_COMPATIBILITY_ANALYSIS.md` - 기능 호환성 분석
- `AI_FUNCTION_COMPATIBILITY.md` - AI 기능 호환성 분석
- `ANDROID_COMPATIBILITY_CHECK.md` - Android 호환성 확인



