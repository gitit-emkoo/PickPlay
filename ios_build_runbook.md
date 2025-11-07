# iOS 빌드 런북 (GitHub Actions + Fastlane)

## 📋 개요

Expo 기반 iOS 앱을 GitHub Actions + Fastlane 조합으로 빌드하면서 겪은 모든 주요 이슈와 해결 과정을 한 파일에 정리했습니다. `EAS Build → GitHub Actions` 전환 이후 누적된 문제와 재발 방지를 위한 예방법까지 포함합니다.

> **최근 성공 태그:** `ios-build-success-2025-11-06`

---

## 🔴 문제 이력 & 근본 원인

### 1. 버전 호환성 불일치 (Expo SDK 54 + React 19)

- **현상**: -G 플래그 충돌, C++ 표준 불일치, Hermes 스크립트 실패 등 연쇄적인 빌드 오류 발생
- **원인**: Expo SDK 54와 React 19/React Native 0.81.x 조합이 아직 안정화되지 않음
- **근본 해법**: Expo SDK 53 + React 18.3.1 + React Native 0.76.x로 다운그레이드
- **예방**: 주요 의존성 업그레이드 전 공식 호환성 문서 확인, `expo install --fix`로 버전 정렬

### 2. Folly Coroutine 헤더 & C++20 설정 누락

- **현상**: `fatal error: 'folly/coro/Coroutine.h' file not found`, `__cplusplus >= 201703L` 어설션 실패
- **원인**: Pods 빌드 설정이 타깃별로 덮어써져 `gnu++14`가 적용되고, Folly 헤더가 존재하지 않음
- **최종 해결 (2025-11-06)**:
  1. `vendor/folly/coro/Coroutine.h`를 프로젝트에 포함 (Folly v2024.10.14.00)
  2. Podfile `post_install`에서 모든 타깃에 `gnu++20` & Folly 매크로(`FOLLY_HAS_COROUTINES=0` 등) 강제
  3. 동기화 코드로 Pods 헤더 디렉터리에 Folly Coroutine 헤더 복사
- **참고 커밋**: `f49945d`
- **체크포인트**: Expo SDK 업그레이드 시 Folly 버전 변경 여부 확인

### 3. Push Notifications 프로비저닝 프로파일 누락

- **현상**: `requires a provisioning profile with the Push Notifications feature`
- **원인**: Apple Developer Portal의 프로파일에서 Push Notifications capability 비활성화, Match 저장소가 오래된 버전 유지
- **해결**: Apple Developer Portal에서 capability 재설정 후 `fastlane match appstore --force`
- **예방**: Match 저장소를 정기적으로 동기화하고, Podfile/Fastlane에서 프로파일 로그 출력

### 4. lottie-react-native Codegen 헤더 부재

- **현상**: `lstat(.../lottiereactnative/ComponentDescriptors.h): No such file or directory`
- **원인**: Old Architecture에서 Codegen 헤더가 생성되지 않지만 ReactCodegen이 복사를 시도
- **해결**: GitHub Actions 워크플로우와 Fastlane에서 더미 헤더 생성, DerivedData 정리 후 즉시 재생성
- **예방**: 필요 시 New Architecture 전환 또는 라이브러리 버전 점검

### 5. RCTAppDependencyProvider.h 누락

- **현상**: `lstat(.../RCTAppDependencyProvider.h): No such file or directory`
- **해결**: 워크플로우·Fastlane에서 더미 파일 생성, DerivedData 정리 후 즉시 재생성

### 6. react-native-reanimated New Architecture 요구

- **현상**: `[Reanimated] Reanimated requires the New Architecture to be enabled.`
- **해결**: Podfile에서 `codegen_disabled: true` 설정, `fabric_enabled: false`, `pod install` 시 `RCT_NEW_ARCH_ENABLED=1`로 검사 우회

### 7. Fastfile 상대 경로 계산 오류

- **현상**: `PickPlay.xcworkspace 번들이 올바르지 않습니다.`
- **해결**: Fastfile에서 절대 경로 변수를 선언하고 사용 (`File.expand_path('..', __dir__)`)

### 8. DerivedData 정리 시 더미 파일 삭제

- **현상**: DerivedData 초기화 후 Codegen 더미 파일이 사라져 다음 빌드 실패
- **해결**: 워크플로우에서 DerivedData 삭제 직후 더미 파일 재생성 스텝 추가

---

## 🧹 패치 정리 연대표

다음은 Expo SDK 53 안정화 과정에서 수행한 패치 정리와 그 영향입니다.

1. **필수 패치 도입기**
   - `-G` 플래그 제거: `BoringSSL-GRPC` 빌드 시 clang 미지원 플래그 제거
   - Hermes 교체 스크립트 비활성화: CI에서 실패하던 `[CP-User] [Hermes] Replace Hermes...` 스크립트를 no-op 처리
   - C++ 표준 강제: 모든 Pod 타깃에 `gnu++20` 적용, Folly 매크로 초기화
   - Codegen 더미 디렉터리 생성: `lottiereactnative`, `RCTAppDependencyProvider` 헤더들을 `touch`로 생성
   - `[RN]Check rncore` 스크립트 비활성화: Old Architecture 사용 시 불필요한 실패 제거
   - Expo Modules Core 자동 생성 Swift 파일 패치: `import React` 가드 추가 및 기타 패치 적용
   - `react-native-screens` 헤더 복사 패치: Expo Head 의존 모듈이 Old Architecture에서 정상 동작하도록 보완

2. **패치 누적에 따른 부작용**
   - patch-package와 Podfile 수정이 중복되며 빌드 변동성이 증가
   - Expo SDK 53로 돌아온 뒤에도 불필요한 패치가 남아 유지 보수 비용 증가

3. **대청소 & 재정비 (2025-11)**
   - 더 이상 필요 없는 patch-package/스크립트를 제거하여 Podfile을 단순화
   - 실수로 삭제된 Hermes/Codegen 더미 생성 로직은 즉시 복구하여 유지
   - 마지막으로 Folly 헤더/플래그를 재정비해 `vendor/folly` + C++20 강제 주입으로 일관성 확보

> 현재는 **필수 방어 코드만 남아 있으며**, patch-package는 Expo Modules Core 최소 패치만 유지합니다. 과거 패치는 필요 시 이 연대표를 참고해 선택적으로 재도입할 수 있습니다.

---

## ✅ 최종 해결 흐름 (2025-11-06 기준)

1. **Expo SDK 53 조합 유지**: `expo install --fix`로 패키지 전역 버전 정렬
2. **Podfile 방어 코드**
   ```ruby
   require 'fileutils'

   post_install do |installer|
     folly_definitions = [
       'FOLLY_NO_CONFIG=1',
       'FOLLY_HAS_COROUTINES=0',
       'FOLLY_USE_COROUTINES=0',
       'FOLLY_USE_CPP_COROUTINES=0'
     ]

     apply_folly_settings = lambda do |config|
       config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++20'
       config.build_settings['CLANG_CXX_LIBRARY']          = 'libc++'

       defs = Array(config.build_settings['GCC_PREPROCESSOR_DEFINITIONS']).flat_map { |d| d.to_s.split(' ') }
       defs = ['$(inherited)'] if defs.empty?
       defs.concat(folly_definitions)
       config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs.uniq

       cppflags = Array(config.build_settings['OTHER_CPLUSPLUSFLAGS'])
       cppflags << '$(inherited)' if cppflags.empty?
       cppflags << '-std=gnu++20'
       cppflags.concat(%w[-UFOLLY_HAS_COROUTINES -DFOLLY_HAS_COROUTINES=0 -DFOLLY_USE_COROUTINES=0 -DFOLLY_USE_CPP_COROUTINES=0])
       config.build_settings['OTHER_CPLUSPLUSFLAGS'] = cppflags.uniq
     end

     (installer.pods_project.targets + installer.aggregate_targets.flat_map(&:user_targets)).each do |target|
       target.build_configurations.each(&apply_folly_settings)
     end

     if installer.respond_to?(:user_project)
       installer.user_project.targets.each do |target|
         target.build_configurations.each(&apply_folly_settings) if target.respond_to?(:build_configurations)
       end
     end

     folly_vendor_root = File.expand_path('../vendor/folly', __dir__)
     folly_header_src = File.join(folly_vendor_root, 'coro', 'Coroutine.h')
     folly_pods_header_dir = File.join(__dir__, 'Pods', 'Headers', 'Public', 'RCT-Folly', 'folly', 'coro')

     if File.exist?(folly_header_src)
       FileUtils.mkdir_p(folly_pods_header_dir)
       FileUtils.cp(folly_header_src, File.join(folly_pods_header_dir, 'Coroutine.h'))
       Pod::UI.puts "[Folly] Synced Coroutine.h into Pods headers."
     end
   end
   ```
3. **Folly 헤더 관리**: `vendor/folly/` 디렉터리에 Folly 헤더를 추가하고 Git으로 버전 관리
4. **Fastlane 안정화**: `SCHEME`, `XCODEPROJ`, `WORKSPACE` 등에서 소문자 프로젝트명 사용, `xcargs`에 `4(inherited)` 이스케이프
5. **Fastlane beta 성공**: 빌드 성공 커밋 `f49945d` → 태그 `ios-build-success-2025-11-06`
6. **테스트 전략**: TestFlight 업로드 후 실기기 검증

---

## 🧪 GitHub Actions 워크플로우 핵심 단계

- `Clean caches`: DerivedData 및 Pod 캐시 정리 → 더미 파일 재생성 스텝 포함
- `Install Expo autolinking CLI` → `expo prebuild` 조건부 실행 준비
- `Debug iOS folder`: 최근 Expo prebuild 출력 확인을 위한 로깅 단계
- `Verify post_install cleaned BoringSSL-GRPC`: Podfile 패치가 적용됐는지 확인
- `Verify C++ standard is gnu++20`/`Verify critical Podspecs are resolvable`: Folly/C++ 설정이 유지되는지 검증
- `Fastlane beta`: 실제 빌드 및 TestFlight 업로드 (성공 시 초록 카드)

---

## 🧾 커밋 & 태그 로그

- `07a2529`: Folly 헤더를 `vendor/`로 이동하여 Expo prebuild 영향 제거
- `f49945d`: Folly 플래그 강제 및 헤더 동기화 로직 도입 – **성공 빌드**
- `346ba4e`: 사용하지 않는 실험 문서/템플릿 제거, 문서 업데이트
- 태그 `ios-build-success-2025-11-06`: 상기 구성으로 빌드 성공한 시점 고정

---

## 📚 체크리스트 (빌드 전/후)

### 빌드 전 확인
- [ ] `expo install --fix`로 의존성 버전 재정렬
- [ ] `Podfile`의 Folly/C++ 설정이 최신인지 확인
- [ ] `vendor/folly/coro/Coroutine.h` 존재 여부 확인 (`git ls-files`)
- [ ] Apple Developer Portal에서 최신 Push 프로파일 사용 중인지 확인
- [ ] Fastlane `beta`가 사용할 인증서/프로파일이 GitHub Secrets에 최신으로 등록되어 있는지 확인

### 빌드 실패 시 대응
1. `/Users/runner/Library/Logs/gym/pickplay-pickplay.log` 확인
2. 에러 패턴 판별
   - `lstat(...): No such file or directory` → 더미 파일/헤더 경로 문제
   - `requires a provisioning profile...` → Apple Portal/Match 재확인
   - `FOLLY_HAS_COROUTINES` 경고 → Podfile 플래그 주입 여부 확인
3. 재발 방지 스크립트/문서 업데이트

---

## 🎯 교훈 & 원칙

1. **버전 호환성을 최우선**: Expo 릴리즈 노트와 공식 호환성 표 확인 후 업그레이드
2. **방어적 Podfile**: Expo가 생성한 기본 설정에 의존하지 말고 필요한 플래그는 직접 주입
3. **자동화 검증**: GitHub Actions에서 C++ 표준, Folly 헤더, Podspec 상태를 검사
4. **문서화 & 태그**: 성공 빌드 시점에 태그를 남겨 비교 가능하게 만들기
5. **점진적 업그레이드**: 큰 범위 업그레이드는 브랜치로 분리하고 단계별 테스트

---

## 📎 참고 자료

- [Fastlane Match](https://docs.fastlane.tools/actions/match/)
- [Expo SDK 호환성](https://docs.expo.dev/versions/latest/)
- [React Native 업그레이드 가이드](https://reactnative.dev/docs/upgrading)
- [@react-native-firebase 호환성](https://rnfirebase.io/)
- [react-native-google-mobile-ads](https://github.com/react-native-google-mobile-ads/react-native-google-mobile-ads)

---

**마지막 업데이트:** 2025-11-06  
**담당:** iOS 빌드 자동화 (GitHub Actions + Fastlane)

