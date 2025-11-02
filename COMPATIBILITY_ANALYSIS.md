# iOS 빌드 호환성 분석 및 권장 사항

## 현재 문제점

### 현재 버전 조합
- **Expo SDK**: 54.0.10
- **React**: 19.1.0
- **React Native**: 0.81.4
- **Firebase**: @react-native-firebase/* 23.4.0
- **AdMob**: react-native-google-mobile-ads 15.7.0

### 주요 문제
1. **Expo SDK 54 + React 19**: -G 플래그 충돌 발생 (gRPC 의존성 문제)
2. **React Native 0.81.4**: React 19 완전 지원 여부 불확실
3. **iOS 빌드 실패**: 200회 이상 실패

## 해결 방안: Expo SDK 53으로 다운그레이드

### 권장 조합 (안정적)

#### 옵션 1: React 18 사용 (가장 안정적)
```
- Expo SDK: ~53.0.0
- React: 18.3.1
- React Native: 0.76.x (Expo SDK 53 표준)
- @react-native-firebase/*: 21.x.x (SDK 53 호환)
- react-native-google-mobile-ads: 13.x.x (SDK 53 호환)
```

#### 옵션 2: React 19 유지 시도
```
- Expo SDK: ~53.0.0
- React: 19.1.0
- React Native: 0.76.x
- @react-native-firebase/*: 21.x.x
- react-native-google-mobile-ads: 13.x.x
```

### Expo SDK 53의 장점
1. **안정성**: React 19와의 충돌 없음
2. **-G 플래그 문제 없음**: gRPC 의존성 충돌 해결
3. **검증된 조합**: 많은 프로젝트에서 사용 중
4. **Firebase/AdMob 호환성**: 검증된 버전 조합

## 마이그레이션 계획

1. **Expo SDK 다운그레이드**
   ```bash
   npx expo install expo@~53.0.0
   ```

2. **React Native 버전 조정** (Expo가 자동 조정)

3. **Expo 모듈 버전 조정** (자동 처리)

4. **Firebase 버전 다운그레이드**
   ```bash
   npm install @react-native-firebase/app@^21.0.0 @react-native-firebase/auth@^21.0.0 @react-native-firebase/firestore@^21.0.0 @react-native-firebase/functions@^21.0.0 @react-native-firebase/app-check@^21.0.0
   ```

5. **AdMob 버전 다운그레이드**
   ```bash
   npm install react-native-google-mobile-ads@^13.0.0
   ```

6. **React 버전 결정** (옵션 1 또는 2 선택)

7. **iOS Pod 재설치**
   ```bash
   cd ios
   rm -rf Pods Podfile.lock
   pod install
   ```

## 검증 필요 사항

- [ ] Expo SDK 53 설치 후 자동 버전 조정 확인
- [ ] Firebase 기능 정상 작동 확인
- [ ] AdMob 광고 정상 작동 확인
- [ ] iOS 빌드 성공 확인
- [ ] Android 빌드 영향 확인 (없을 것으로 예상)

## 참고사항

- Android는 현재 정상 작동 중이므로 영향 없을 것으로 예상
- Firebase SDK는 하위 호환성이 있으므로 마이그레이션 용이
- AdMob SDK도 하위 호환성 유지
- React 18 → React 19 차이가 크지 않아 기능 영향 적을 것으로 예상



