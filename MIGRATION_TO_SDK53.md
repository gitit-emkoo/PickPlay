# Expo SDK 53 마이그레이션 가이드

## 변경 사항 요약

### 핵심 버전 변경
- ✅ **Expo SDK**: 54.0.10 → 53.0.0
- ✅ **React**: 19.1.0 → 18.3.1 (안정성 향상)
- ✅ **Firebase**: @react-native-firebase/* 23.4.0 → 21.0.0 (SDK 53 호환)
- ✅ **AdMob**: react-native-google-mobile-ads 15.7.0 → 13.0.0 (SDK 53 호환)
- ✅ **React Types**: @types/react 19.1.0 → 18.3.12

### 예상 변경 사항 (자동 조정)
- **React Native**: 0.81.4 → 0.76.x (Expo SDK 53 표준)
- **Expo 모듈들**: 모든 expo-* 패키지 버전 자동 조정

## 실행 단계

### 1. 의존성 재설치
```bash
cd pickplay
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### 2. Expo 패키지 자동 조정
```bash
npx expo install --fix
```

이 명령어가 다음을 자동으로 처리합니다:
- Expo SDK 53에 맞는 모든 expo-* 패키지 버전 조정
- React Native 버전 조정 (예상: 0.76.x)
- 호환되는 다른 패키지들 버전 조정

### 3. iOS Pod 재설치
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
```

### 4. Podfile 정리 (선택 사항)
Expo SDK 53에서는 다음이 필요 없을 수 있습니다:
- C++20 강제 설정 (React Native 0.76.x는 기본값 사용)
- -G 플래그 제거 (문제 발생 시에만 필요)
- Hermes 스크립트 no-op 처리 (필요 시)

하지만 **일단 현재 Podfile 유지**하고, 빌드 성공 후 불필요한 부분 제거 권장.

### 5. 빌드 테스트
```bash
# iOS 빌드 테스트
cd ios
xcodebuild -workspace PickPlay.xcworkspace -scheme PickPlay -configuration Release

# 또는 EAS 빌드
eas build --platform ios --profile production
```

## 검증 체크리스트

빌드 전 확인:
- [ ] `package.json`에서 Expo SDK 53 확인
- [ ] `npx expo install --fix` 실행 완료
- [ ] React Native 버전이 0.76.x로 변경되었는지 확인
- [ ] 모든 expo-* 패키지 버전이 SDK 53 호환인지 확인

빌드 후 확인:
- [ ] iOS 빌드 성공
- [ ] Firebase 기능 정상 작동 (인증, Firestore 등)
- [ ] AdMob 광고 정상 작동
- [ ] 앱 실행 및 기본 기능 테스트

## 예상되는 개선 사항

1. **-G 플래그 에러 해결**: Expo SDK 53에서는 gRPC 의존성 충돌 없음
2. **C++ 표준 에러 해결**: React Native 0.76.x는 더 안정적
3. **빌드 성공률 향상**: 검증된 안정적인 조합
4. **호환성 문제 해결**: Firebase와 AdMob 버전이 SDK 53과 완전 호환

## 문제 발생 시 롤백

만약 문제가 발생하면:
```bash
git checkout package.json
npm install --legacy-peer-deps
```

## 참고사항

- Android 빌드는 영향 없을 것으로 예상
- Firebase SDK 21.x는 하위 호환성이 있어 기존 코드 작동 예상
- AdMob SDK 13.x도 하위 호환성 유지
- React 18 → 19 차이가 크지 않아 기능 영향 적을 것으로 예상



