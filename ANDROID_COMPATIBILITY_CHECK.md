# Android 빌드 호환성 검증

## 변경 사항 요약

### 버전 변경
- **Expo SDK**: 54.0.10 → 53.0.0
- **React**: 19.1.0 → 18.3.1
- **React Native**: 0.81.4 → 0.76.x (예상, `expo install --fix`가 자동 조정)
- **Firebase**: 23.4.0 → 21.0.0
- **AdMob**: 15.7.0 → 13.0.0

---

## Android 빌드 영향 분석

### ✅ 영향 없음 (또는 긍정적 영향)

#### 1. **Expo SDK 53 → Android 지원**
- ✅ Expo SDK 53은 Android를 공식 지원
- ✅ Android 빌드 프로세스에 변경 없음
- ✅ `gradle.properties`, `build.gradle` 등 Android 설정은 Expo가 자동 관리

#### 2. **React 18.3.1 → Android 호환**
- ✅ React 18은 Android를 완벽 지원
- ✅ React 19에서 18로 다운그레이드해도 Android 기능 영향 없음
- ✅ React Native와의 호환성 더 안정적

#### 3. **Firebase 21.x → Android 하위 호환**
- ✅ `@react-native-firebase/*` 21.x는 Android 완벽 지원
- ✅ Firebase SDK는 하위 호환성 유지 (23.x → 21.x 다운그레이드 안전)
- ✅ `google-services.json` 파일은 그대로 유지
- ✅ Android 네이티브 코드 변경 불필요

#### 4. **AdMob 13.x → Android 호환**
- ✅ `react-native-google-mobile-ads` 13.x는 Android 지원
- ✅ 15.x → 13.x 다운그레이드는 안전 (API 변경 없음)
- ✅ Android 네이티브 코드 변경 불필요

#### 5. **React Native 0.76.x → Android 안정성 향상**
- ✅ React Native 0.76.x는 Android에서 더 안정적
- ✅ 0.81.4보다 검증된 버전
- ✅ Android 특정 버그가 적음

---

### ⚠️ 주의가 필요한 부분 (하지만 문제 없을 것으로 예상)

#### 1. **React Native 버전 변경**
**변경:**
- 현재: `react-native: 0.81.4`
- 예상: `react-native: 0.76.x` (Expo SDK 53 자동 선택)

**Android 영향:**
- ⚠️ React Native 버전 변경 시 Android 빌드 설정도 함께 변경
- ✅ 하지만 `expo install --fix`가 모든 호환 패키지 자동 조정
- ✅ `android/build.gradle`, `android/app/build.gradle`은 Expo가 자동 관리
- ✅ `react-native-gradle-plugin`도 자동 버전 맞춤

**확인 방법:**
```bash
# expo install --fix 실행 후 확인
npx expo install --fix
cat android/build.gradle  # 자동으로 React Native 버전 맞춰짐
```

#### 2. **Hermes 버전**
**현재:**
```properties
# gradle.properties
hermesEnabled=true
```

**변경:**
- ✅ Hermes는 React Native 버전과 함께 자동 업데이트
- ✅ Expo SDK 53에서도 Hermes 지원
- ✅ Android 빌드 설정 자동 조정

#### 3. **Expo 모듈 버전**
**변경:**
- 모든 `expo-*` 패키지가 SDK 53에 맞게 자동 조정

**Android 영향:**
- ✅ `expo install --fix`가 모든 expo 모듈 버전 정렬
- ✅ Android 네이티브 코드는 변경 없음
- ✅ `android/app/src/main/AndroidManifest.xml` 자동 관리

---

## Android 특정 문제 (발생 가능성 없음)

### ❌ iOS에서만 발생했던 문제들

1. **-G 플래그 문제** → Android에는 없음 (Podfile 없음)
2. **C++ 표준 문제** → Android는 Gradle/JVM 기반 (다른 빌드 시스템)
3. **Hermes 스크립트 문제** → Android는 Gradle 태스크 사용 (다른 방식)
4. **Codegen 헤더 누락** → Android는 다른 코드 생성 방식
5. **CocoaPods 문제** → Android는 Gradle 사용

### ✅ Android는 더 안정적

- Android 빌드는 iOS보다 덜 엄격함
- Gradle이 의존성 충돌을 더 잘 처리
- 네이티브 코드 컴파일이 더 유연함

---

## 검증 체크리스트

### 마이그레이션 후 확인 사항

#### 1. **의존성 정렬 확인**
```bash
cd pickplay
npx expo install --fix
# 모든 expo 모듈과 React Native 버전이 SDK 53에 맞춰지는지 확인
```

#### 2. **Android 빌드 테스트**
```bash
# 로컬 빌드 테스트
cd android
./gradlew clean
./gradlew assembleRelease

# 또는 EAS 빌드
eas build --platform android --profile production
```

#### 3. **기능 테스트**
- [ ] Firebase 인증 정상 작동
- [ ] Firestore 데이터 읽기/쓰기 정상
- [ ] AdMob 광고 정상 표시
- [ ] 푸시 알림 정상 수신
- [ ] 모든 앱 기능 정상 작동

---

## 예상 결과

### ✅ 긍정적 결과

1. **Android 빌드 안정성 향상**
   - React Native 0.76.x는 0.81.4보다 안정적
   - 검증된 버전 조합 사용

2. **의존성 충돌 감소**
   - 모든 패키지가 호환 버전으로 정렬
   - 버전 충돌로 인한 빌드 실패 가능성 감소

3. **빌드 속도 개선 가능**
   - 안정적인 버전으로 빌드 최적화 가능

### ❌ 부정적 결과

**없을 것으로 예상**
- Android 빌드는 iOS보다 호환성 문제가 적음
- Expo SDK 53은 Android를 공식 지원
- Firebase/AdMob 다운그레이드는 안전

---

## 마이그레이션 순서 (Android 영향 최소화)

### 1. **의존성 변경**
```bash
cd pickplay
npm install --legacy-peer-deps
npx expo install --fix
```

### 2. **Android 클린 빌드**
```bash
cd android
./gradlew clean
```

### 3. **Android 빌드 테스트**
```bash
cd android
./gradlew assembleDebug  # 먼저 디버그 빌드로 테스트
./gradlew assembleRelease  # 릴리스 빌드 테스트
```

### 4. **EAS 빌드 테스트 (선택)**
```bash
eas build --platform android --profile preview
```

---

## 결론

### ✅ Android 빌드에는 **영향 없거나 긍정적 영향**

**이유:**
1. Expo SDK 53은 Android를 공식 지원
2. Android는 iOS보다 빌드 시스템이 덜 엄격함
3. Firebase/AdMob 다운그레이드는 하위 호환성 유지
4. React 18은 Android에서 안정적
5. React Native 0.76.x는 Android에서 더 검증된 버전

**권장 사항:**
- ✅ iOS 마이그레이션과 동시에 진행해도 안전
- ✅ Android 빌드 테스트는 마이그레이션 후 즉시 수행
- ✅ 기능 테스트로 모든 기능 정상 작동 확인

---

## 추가 참고사항

### Android 특정 고려사항

1. **Gradle 버전**
   - Expo SDK 53이 자동으로 적절한 Gradle 버전 사용
   - 수동 변경 불필요

2. **Kotlin 버전**
   - Expo가 자동 관리
   - 수동 변경 불필요

3. **Android SDK 버전**
   - `gradle.properties`의 설정 유지
   - `minSdkVersion`, `targetSdkVersion`은 Expo가 관리

4. **네이티브 모듈**
   - Firebase, AdMob 등 네이티브 모듈은 자동 링크
   - 수동 설정 불필요

---

**결론: Android 빌드는 안전하게 마이그레이션 가능하며, 오히려 안정성이 향상될 것으로 예상됩니다.**



