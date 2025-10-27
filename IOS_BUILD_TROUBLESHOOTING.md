# iOS 빌드 트러블슈팅 가이드 (GitHub Actions)

## 📋 개요
EAS Build에서 GitHub Actions + Fastlane으로 전환한 이후 발생한 주요 문제들과 해결 방법을 정리합니다.

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

**마지막 업데이트:** 2025-10-27  
**담당:** iOS 빌드 자동화 (GitHub Actions + Fastlane)


