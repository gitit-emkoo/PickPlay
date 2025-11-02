# iOS 빌드 문제 근본 원인 분석 및 예방 대책

## 📊 문제 발생 이력 종합

200회 이상의 iOS 빌드 실패를 겪으면서 다음 문제들이 반복 발생했습니다.

---

## 🔴 근본 원인: 버전 호환성 불일치

### 핵심 문제
**Expo SDK 54 + React 19 + React Native 0.81.4 + Firebase 23.4.0 조합이 근본적으로 호환되지 않음**

이 조합이 원인이 된 문제들:
1. **-G 플래그 충돌**: gRPC 의존성이 React 19와 충돌하여 발생
2. **C++ 표준 충돌**: React Native 0.81.4가 C++20을 요구하지만 설정이 자동으로 적용되지 않음
3. **Hermes 빌드 실패**: C++ 표준 불일치로 인한 컴파일 에러
4. **기타 연쇄 반응**: 버전 불일치로 인한 부수적인 빌드 문제들

---

## 📋 발생했던 모든 문제 목록

### 1️⃣ -G 플래그 문제 (BoringSSL-GRPC)
**에러:**
```
error: unknown argument: '-G'
[BoringSSL-GRPC] Compilation failed
```

**원인:**
- Expo SDK 54 + React 19 조합에서 gRPC 의존성이 잘못된 컴파일러 플래그 사용
- `-G` 플래그는 Xcode/clang에서 지원하지 않는 플래그

**현재 해결책 (Podfile):**
```ruby
# BoringSSL-GRPC 타겟에서 모든 -G 플래그 제거
# 타겟 레벨, 파일 레벨 모두 처리
```

**근본 해결책:**
✅ **Expo SDK 53으로 다운그레이드** → -G 플래그 문제 자동 해결

---

### 2️⃣ C++ 표준 문제
**에러:**
```
error: unknown type name 'requires'
error: no member named 'thread' in namespace 'std'
```

**원인:**
- React Native 0.81.4는 C++20 concepts (`requires` 키워드)를 사용
- 하지만 Podfile에서 C++ 표준을 명시적으로 설정하지 않아 기본값(C++14/17) 사용
- `std::thread`는 C++11+, concepts는 C++20 필수

**현재 해결책 (Podfile):**
```ruby
# 모든 Pod 타겟에 gnu++20 강제 설정
# CLANG_CXX_LANGUAGE_STANDARD = 'gnu++20'
# CLANG_CXX_LIBRARY = 'libc++'
# OTHER_CPLUSPLUSFLAGS에 -std=gnu++20 추가
```

**근본 해결책:**
✅ **Expo SDK 53 + React Native 0.76.x** → C++ 표준이 자동으로 올바르게 설정됨

---

### 3️⃣ Hermes 스크립트 실패
**에러:**
```
PhaseScriptExecution [CP-User]\ [Hermes]\ Replace\ Hermes\ for\ the\ right\ configuration
ARCHIVE FAILED
```

**원인:**
- Hermes 엔진 스크립트가 CI 환경에서 실패
- 환경 차이로 인한 스크립트 실행 문제

**현재 해결책 (Podfile):**
```ruby
# Hermes 스크립트를 no-op으로 변환
bp.shell_script = 'echo "[CI] Skipping Hermes replacement script (no-op)."; exit 0'
```

**근본 해결책:**
✅ **안정적인 버전 조합 사용** → 스크립트 문제 발생 빈도 감소

---

### 4️⃣ lottie-react-native Codegen 헤더 누락
**에러:**
```
error: lstat(.../lottiereactnative/EventEmitters.h): No such file or directory
```

**원인:**
- Old Architecture 사용 시 Codegen이 헤더 파일을 생성하지 않음
- 하지만 ReactCodegen이 복사를 시도하여 파일 부재로 실패

**현재 해결책:**
- 워크플로우와 Fastfile에서 더미 파일 생성
- DerivedData 정리 후 즉시 재생성

**근본 해결책:**
✅ **New Architecture 활성화** 또는 **lottie-react-native 버전 다운그레이드** 고려
⚠️ 현재는 더미 파일 생성으로 유지

---

### 5️⃣ RCTAppDependencyProvider.h 누락
**에러:**
```
error: lstat(/path/to/RCTAppDependencyProvider.h): No such file or directory
```

**원인:**
- Expo prebuild로 생성된 프로젝트에서 일부 헤더 파일 누락
- ReactCodegen이 존재하지 않는 파일 복사 시도

**현재 해결책:**
- 워크플로우/Fastfile에서 더미 파일 생성

**근본 해결책:**
✅ **Expo SDK 안정 버전 사용** + **Expo prebuild 최적화**

---

### 6️⃣ react-native-reanimated New Architecture 충돌
**에러:**
```
[Reanimated] Reanimated requires the New Architecture to be enabled.
```

**원인:**
- `react-native-reanimated` 최신 버전이 New Architecture 필수 요구
- 하지만 우리는 Old Architecture 사용

**현재 해결책:**
```ruby
# Podfile
$RNReanimated = { :codegen_disabled => true }
# pod install 시: RCT_NEW_ARCH_ENABLED=1 (검사 우회용)
```

**근본 해결책:**
✅ **react-native-reanimated 호환 버전 사용** 또는 **New Architecture 마이그레이션 계획**

---

### 7️⃣ Push Notifications 프로파일 문제
**에러:**
```
error: "PickPlay" requires a provisioning profile with the Push Notifications feature.
```

**원인:**
- Apple Developer Portal의 프로파일에 Push Notifications capability 누락
- Match Git 저장소의 프로파일이 오래된 버전 유지

**현재 해결책:**
- Apple Developer Portal에서 수동 수정
- `fastlane match appstore --force` 실행

**근본 해결책:**
✅ **Match 저장소 정기적으로 동기화** + **자동화 스크립트**

---

### 8️⃣ Fastfile 경로 계산 오류
**에러:**
```
❌ PickPlay.xcworkspace 번들이 올바르지 않습니다.
```

**원인:**
- Fastfile의 상대 경로 계산 오류

**현재 해결책:**
```ruby
EXPO_PROJECT_ROOT = File.expand_path('..', __dir__)
ABSOLUTE_XCODEPROJ_PATH = File.join(EXPO_PROJECT_ROOT, "ios", "PickPlay.xcodeproj")
```

**근본 해결책:**
✅ **절대 경로 사용** → 이미 적용 완료

---

### 9️⃣ DerivedData 정리 후 파일 재생성
**원인:**
- DerivedData 정리 시 Codegen 더미 파일도 함께 삭제
- 빌드 시작 시 파일 부재로 실패

**현재 해결책:**
- DerivedData 정리 직후 즉시 더미 파일 재생성

**근본 해결책:**
✅ **정리 → 재생성 순서 보장** → 이미 적용 완료

---

### 🔟 Expo SDK 54 + React 19 호환성 문제
**원인:**
- Expo SDK 54는 React 19를 완전히 지원하지 않음
- 여러 의존성에서 예상치 못한 충돌 발생

**근본 해결책:**
✅ **Expo SDK 53 + React 18.3.1로 다운그레이드** → 모든 호환성 문제 일괄 해결

---

## 🎯 근본적인 예방 대책

### 1. **올바른 버전 조합 선택** (최우선)

#### ✅ 권장 조합 (안정적)
```
Expo SDK: ~53.0.0
React: 18.3.1
React Native: 0.76.x (Expo SDK 53 자동 선택)
@react-native-firebase/*: 21.x.x
react-native-google-mobile-ads: 13.x.x
```

#### ❌ 피해야 할 조합
```
Expo SDK: 54.x + React 19 + React Native 0.81.x
→ -G 플래그, C++ 표준, Hermes 등 다중 문제 발생
```

**체크리스트:**
- [ ] Expo 공식 문서에서 SDK별 권장 React 버전 확인
- [ ] React Native 버전 호환성 매트릭스 확인
- [ ] Firebase/AdMob 등 주요 라이브러리 호환 버전 확인
- [ ] 모든 의존성 버전을 `expo install --fix`로 정렬

---

### 2. **버전 업그레이드 전 철저한 검증**

#### 업그레이드 프로세스
```bash
# 1. 공식 호환성 매트릭스 확인
- Expo SDK 문서
- React Native 호환성 매트릭스
- 각 라이브러리 공식 문서

# 2. 테스트 환경에서 먼저 검증
- 로컬 빌드 테스트
- CI 테스트 빌드
- 실제 기기 테스트

# 3. 점진적 업그레이드
- 한 번에 하나씩만 업그레이드
- 각 단계마다 빌드/테스트

# 4. 롤백 계획 준비
- Git 브랜치/태그로 이전 버전 보존
- 롤백 절차 문서화
```

---

### 3. **Podfile 사전 설정 (방어적 코딩)**

#### 필수 설정
```ruby
post_install do |installer|
  # 1. C++ 표준 강제 (React Native 0.76+ 요구)
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++20'
      config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
    end
  end

  # 2. iOS 최소 타겟 통일
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
    end
  end

  # 3. New Architecture 명시적 비활성화
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      defs = (config.build_settings["GCC_PREPROCESSOR_DEFINITIONS"] ||= [])
      defs << "RCT_NEW_ARCH_ENABLED=0" unless defs.include?("RCT_NEW_ARCH_ENABLED=0")
    end
  end
end
```

#### 선택적 설정 (문제 발생 시에만)
```ruby
# -G 플래그 제거 (BoringSSL-GRPC 문제 발생 시)
# Hermes 스크립트 no-op (CI 실패 시)
# 더미 파일 생성 로직 (Codegen 문제 시)
```

---

### 4. **CI 워크플로우 검증 단계 추가**

#### 필수 검증 단계
```yaml
# 1. 버전 호환성 검증
- name: Verify package versions compatibility
  run: |
    # Expo SDK와 React 버전 호환성 확인
    # Firebase/AdMob 버전 호환성 확인

# 2. Podfile 설정 검증
- name: Verify Podfile configuration
  run: |
    # C++ 표준 설정 확인
    # New Architecture 설정 확인

# 3. 빌드 전 사전 체크
- name: Pre-build validation
  run: |
    # 필수 파일 존재 확인
    # 프로파일 유효성 확인
```

---

### 5. **의존성 관리 원칙**

#### Dos
- ✅ `npx expo install --fix`로 모든 패키지 버전 정렬
- ✅ `package-lock.json`을 Git에 커밋 (버전 고정)
- ✅ 주요 업그레이드는 브랜치로 분리하여 테스트
- ✅ 호환성 매트릭스를 문서화하여 팀 공유

#### Don'ts
- ❌ `^` 또는 `~` 범위로 주요 패키지 버전 관리 (예: Expo, React Native)
- ❌ 한 번에 여러 주요 패키지 업그레이드
- ❌ CI 실패 시 임시 해결책만 적용하고 근본 원인 무시

---

### 6. **문제 발생 시 대응 프로세스**

#### 단계별 대응
1. **즉시 조치**: 빌드 복구 (임시 해결책)
2. **근본 원인 분석**: 버전 호환성, 설정 오류 등
3. **근본 해결책 적용**: 버전 조정, 설정 수정
4. **예방 조치 추가**: CI 검증, 문서화
5. **재발 방지**: 동일 문제 재발 방지 스크립트 추가

---

## 📝 체크리스트

### 새 프로젝트 시작 시
- [ ] Expo SDK 선택 시 공식 호환성 매트릭스 확인
- [ ] React/React Native 버전이 Expo SDK와 호환되는지 확인
- [ ] Firebase/AdMob 등 주요 라이브러리 호환 버전 확인
- [ ] Podfile에 필수 설정 사전 추가
- [ ] CI 워크플로우에 검증 단계 포함

### 패키지 업그레이드 전
- [ ] 공식 호환성 문서 확인
- [ ] Breaking Changes 확인
- [ ] 테스트 브랜치에서 먼저 검증
- [ ] 롤백 계획 준비
- [ ] 한 번에 하나씩만 업그레이드

### 빌드 실패 시
- [ ] 에러 메시지에서 버전 관련 힌트 확인
- [ ] 호환성 매트릭스와 대조
- [ ] 임시 해결책과 근본 해결책 모두 고려
- [ ] 해결 후 예방 조치 추가

---

## 🎓 교훈

### 핵심 원칙
1. **버전 호환성을 가장 우선순위로** - 기능보다 안정성
2. **공식 문서를 신뢰** - 커뮤니티 해결책보다 공식 가이드
3. **점진적 업그레이드** - 한 번에 하나씩, 철저한 테스트
4. **방어적 설정** - Podfile에 필수 설정 사전 추가
5. **자동화 검증** - CI에서 버전/설정 검증 자동화

---

## 📚 참고 자료

- [Expo SDK Compatibility](https://docs.expo.dev/versions/latest/)
- [React Native Version Compatibility](https://reactnative.dev/docs/upgrading)
- [@react-native-firebase Compatibility](https://rnfirebase.io/)
- [react-native-google-mobile-ads Compatibility](https://github.com/react-native-google-mobile-ads/react-native-google-mobile-ads)

---

**마지막 업데이트:** 2025-01-XX  
**분석 기준:** 200회 이상의 빌드 실패 경험



