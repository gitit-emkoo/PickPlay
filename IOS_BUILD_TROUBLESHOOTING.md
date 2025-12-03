# iOS 빌드 트러블슈팅 가이드 (GitHub Actions)

## 📋 개요
EAS Build에서 GitHub Actions + Fastlane으로 전환한 이후 발생한 주요 문제들과 해결 방법을 정리합니다.

---

## ⚠️ 반복 발생하는 문제

### 🔄 Push Notifications 프로파일 미싱 (근본 원인)
**현상:**
- 에러가 한 번 해결되었다가 다시 발생
- 빌드할 때마다 다른 결과가 나옴

**원인:**
- Apple Developer Portal에는 Push Notifications가 활성화되어 있음
- 하지만 Match Git 저장소의 프로파일은 과거 버전을 유지
- `force: true`로 재생성해도 Git에 제대로 반영되지 않을 수 있음

**근본 해결:**
```bash
# 로컬에서 실행 (최초 1회)
cd pickplay
fastlane match appstore --force

# 또는 Apple Developer Portal에서 수동 재생성 후
# Match 저장소에 다시 커밋
```

---

## 🎯 해결된 주요 문제들

### 1️⃣ lottie-react-native Codegen 헤더 파일 누락
**에러 메시지:**
```
error: lstat(/path/to/lottiereactnative/EventEmitters.h): No such file or directory
error: lstat(/path/to/lottiereactnative/ComponentDescriptors.h): No such file or directory
```

**원인:**
- React Native Old Architecture에서 lottie-react-native가 Codegen 헤더 파일을 생성하지 않음
- 하지만 ReactCodegen이 빌드 시 해당 파일들을 복사하려고 시도하여 파일 부재로 실패

**해결:**
```yaml
# .github/workflows/ios-build-and-deploy.yml (11단계)
touch ios/build/generated/ios/react/renderer/components/lottiereactnative/States.h
touch ios/build/generated/ios/react/renderer/components/lottiereactnative/ShadowNodes.h
touch ios/build/generated/ios/react/renderer/components/lottiereactnative/RCTComponentViewHelpers.h
touch ios/build/generated/ios/react/generated/ios/react/renderer/components/lottiereactnative/Props.h
touch ios/build/generated/ios/react/renderer/components/lottiereactnative/EventEmitters.h
touch ios/build/generated/ios/react/renderer/components/lottiereactnative/ComponentDescriptors.h
```

```ruby
# fastlane/Fastfile (beta lane, build_app 전)
lottie_dir = File.join(build_generated_base, "react/renderer/components/lottiereactnative")
FileUtils.mkdir_p(lottie_dir)
%w[States ShadowNodes RCTComponentViewHelpers Props EventEmitters ComponentDescriptors].each do |file|
  FileUtils.touch(File.join(lottie_dir, "#{file}.h"))
end
```

**핵심 포인트:**
- 워크플로우와 Fastfile 양쪽에서 더미 파일 생성 (이중 보호)
- `touch`로 빈 파일 생성하여 Xcode 빌드 실패 방지

---

### 2️⃣ RCTAppDependencyProvider.h 누락
**에러 메시지:**
```
error: lstat(/path/to/RCTAppDependencyProvider.h): No such file or directory
```

**원인:**
- Expo prebuild로 생성된 iOS 프로젝트에서 ReactCodegen이 헤더를 복사할 때 파일이 존재하지 않음

**해결:**
```yaml
# 워크플로우에서
touch ios/build/generated/ios/RCTAppDependencyProvider.h
```

```ruby
# Fastfile에서
FileUtils.touch(File.join(build_generated_base, "RCTAppDependencyProvider.h"))
```

---

### 3️⃣ react-native-reanimated New Architecture 요구사항 충돌
**에러 메시지:**
```
[Reanimated] Reanimated requires the New Architecture to be enabled.
If you have RCT_NEW_ARCH_ENABLED=0 set in your environment you should remove it.
```

**원인:**
- `react-native-reanimated`가 New Architecture를 필수 요구
- 하지만 우리는 Old Architecture (`fabric_enabled: false`)를 사용해야 함

**해결:**
Podfile 수정:
```ruby
# Podfile 상단
$RNReanimated = { :codegen_disabled => true }

# target 내부
use_react_native!(
  :fabric_enabled => false,  # Old Architecture 유지
)

# post_install은 그대로 유지
```

pod install 시 환경변수 설정:
```bash
export RCT_NEW_ARCH_ENABLED=1
pod install
```

**핵심 포인트:**
- `RCT_NEW_ARCH_ENABLED=1`은 **pod install 검사 우회용**
- 실제 빌드는 `fabric_enabled: false`로 Old Architecture 유지

---

### 4️⃣ Push Notifications 프로비저닝 프로파일
**에러 메시지:**
```
error: "PickPlay" requires a provisioning profile with the Push Notifications feature.
Select a provisioning profile in the Signing & Capabilities editor.
```

**원인:**
- Apple Developer Portal에서 생성된 프로비저닝 프로파일에 Push Notifications capability가 포함되지 않음

**해결 (수동):**
1. [Apple Developer Portal](https://developer.apple.com/) → Certificates, Identifiers & Profiles
2. **Identifiers** → `com.pickplay.kwcc` → **Edit**
3. **Capabilities** → **Push Notifications** 체크 → **Save**
4. **Profiles** → 기존 AppStore 프로파일 삭제 → 새로 생성
5. GitHub Actions 재빌드

**자동화 가능한 방법:**
Fastlane Match를 사용하면 나중에 자동으로 관리 가능:
```bash
fastlane match appstore --force_for_new_certificates
```

---

### 5️⃣ Fastfile 경로 계산 오류
**에러 메시지:**
```
❌ PickPlay.xcworkspace 번들이 올바르지 않습니다.
```

**원인:**
- Fastfile이 `pickplay/fastlane/`에 있을 때 `File.expand_path('..', __dir__)`로 인해 잘못된 경로 계산

**해결:**
```ruby
# Fastfile 상단
EXPO_PROJECT_ROOT = File.expand_path('..', __dir__)  # pickplay 디렉토리
ABSOLUTE_XCODEPROJ_PATH = File.join(EXPO_PROJECT_ROOT, "ios", "PickPlay.xcodeproj")
ABSOLUTE_WORKSPACE_PATH = File.join(EXPO_PROJECT_ROOT, "ios", "PickPlay.xcworkspace")
```

---

### 6️⃣ DerivedData 정리 후 파일 재생성
**원인:**
- DerivedData 정리 시 Codegen 더미 파일도 함께 삭제됨
- 빌드 시작 전에 파일이 존재하지 않으면 실패

**해결:**
워크플로우 11단계에서 DerivedData 정리 후 **즉시** 더미 파일 재생성:

```yaml
# 워크플로우 11단계
- name: Clean DerivedData Before Build
  run: |
    # DerivedData 정리
    rm -rf ~/Library/Developer/Xcode/DerivedData/*
    
    # ✅ 즉시 더미 파일 재생성 (핵심!)
    mkdir -p ios/build/generated/ios
    touch ios/build/generated/ios/RCTAppDependencyProvider.h
    mkdir -p ios/build/generated/ios/react/renderer/components/lottiereactnative
    touch ios/build/generated/ios/react/renderer/components/lottiereactnative/*.h
```

---

### 7️⃣ Folly Coroutine 헤더 & C++ 표준 불일치
**에러 메시지:**
```
fatal error: 'folly/coro/Coroutine.h' file not found
static assertion failed: __cplusplus >= 201703L
```

**원인:**
- Expo prebuild로 생성된 iOS 프로젝트에서 Folly가 C++20 코루틴을 전제로 빌드되지만, Xcode 설정이 Pod마다 덮어쓰여 `gnu++14`로 회귀
- `FOLLY_HAS_COROUTINES` 매크로가 다시 1로 정의되면서 Folly가 `<folly/coro/Coroutine.h>`를 요구하지만 실제로는 iOS 워크스페이스에 해당 헤더가 없음

**최종 해결 (2025-11-06):**
1. `vendor/folly/coro/Coroutine.h`에 Folly 공식 헤더(2024.10.14.00)를 포함시켜 Git으로 추적
2. `Podfile` `post_install`에서 모든 타겟에 Folly/C++20 설정을 강제하고, 헤더를 Pods 경로에 동기화

```ruby
# ios/Podfile 발췌
require 'fileutils'

folly_definitions = [
  'FOLLY_NO_CONFIG=1',
  'FOLLY_HAS_COROUTINES=0',
  'FOLLY_USE_COROUTINES=0',
  'FOLLY_USE_CPP_COROUTINES=0'
]

cppflags.concat(%w[
  -UFOLLY_HAS_COROUTINES
  -DFOLLY_HAS_COROUTINES=0
  -DFOLLY_USE_COROUTINES=0
  -DFOLLY_USE_CPP_COROUTINES=0
])

folly_vendor_root = File.expand_path('../vendor/folly', __dir__)
folly_header_src = File.join(folly_vendor_root, 'coro', 'Coroutine.h')
folly_pods_header_dir = File.join(__dir__, 'Pods', 'Headers', 'Public', 'RCT-Folly', 'folly', 'coro')

if File.exist?(folly_header_src)
  FileUtils.mkdir_p(folly_pods_header_dir)
  FileUtils.cp(folly_header_src, File.join(folly_pods_header_dir, 'Coroutine.h'))
  Pod::UI.puts "[Folly] Synced Coroutine.h into Pods headers."
end
```

3. 성공 커밋: `f49945d` / 태그 `ios-build-success-2025-11-06`

**체크포인트:**
- Folly 헤더는 `vendor/folly`에서 Git으로 관리 → Expo prebuild가 iOS 디렉터리를 재생성해도 문제 없음
- 차후 SDK 업그레이드 시 Folly 버전이 바뀌면 헤더와 매크로 값 재검토

---

## 🔍 향후 에러 대응 체크리스트

### 빌드가 실패하면:
1. **로그 파일 위치 확인**
   ```
   /Users/runner/Library/Logs/gym/PickPlay-PickPlay.log
   ```

2. **주요 에러 패턴 확인:**
   - `lstat(...): No such file or directory` → 더미 파일 누락
   - `requires a provisioning profile with [Feature]` → Apple Developer Portal 수정 필요
   - `RCT_NEW_ARCH_ENABLED` 관련 → Podfile/fabric_enabled 확인
   - `pod install` 실패 → `export RCT_NEW_ARCH_ENABLED=1` 추가

3. **즉시 조치 가능한 항목:**
   - 더미 파일이면 워크플로우에서 생성 로직 추가
   - 환경변수 문제면 워크플로우에 export 추가
   - 프로비저닝은 Apple Developer Portal 수정

---

## 📝 주요 파일 및 설정

### 설정 파일 위치
- 워크플로우: `.github/workflows/ios-build-and-deploy.yml`
- Fastfile: `pickplay/fastlane/Fastfile`
- Podfile: `pickplay/ios/Podfile`
- app.json: `pickplay/app.json`
- gradle.properties: `pickplay/android/gradle.properties`

### 핵심 설정
- **Architecture:** Old Architecture (`fabric_enabled: false`)
- **Reanimated:** `codegen_disabled: true` (임시 우회)
- **pod install 시:** `RCT_NEW_ARCH_ENABLED=1` (검사 우회용)

---

## 🎯 예방 조치
1. **더미 파일:** 워크플로우 + Fastfile 양쪽에서 생성
2. **DerivedData 정리:** 정리 직후 즉시 파일 재생성
3. **환경변수:** pod install 전에 `RCT_NEW_ARCH_ENABLED=1` 설정
4. **프로비저닝:** Apple Developer Portal에서 능력(Capability) 확인

---

## 📚 참고 링크
- [Fastlane Match](https://docs.fastlane.tools/actions/match/)
- [React Native New Architecture](https://reactnative.dev/docs/new-architecture-landing-page)
- [lottie-react-native Issues](https://github.com/lottie-react-native/lottie-react-native/issues)

---

**마지막 업데이트:** 2025-11-06  
**담당:** iOS 빌드 자동화 (GitHub Actions + Fastlane)


