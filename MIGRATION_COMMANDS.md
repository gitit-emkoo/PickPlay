# Expo SDK 53 마이그레이션 실행 명령어

## 📋 실행 순서 (Windows PowerShell)

### 현재 디렉토리 확인
```powershell
# 현재 위치가 C:\kwccproject\pickplay 인지 확인
pwd
```

### 1단계: pickplay 디렉토리로 이동
```powershell
cd pickplay
```

### 2단계: 기존 의존성 삭제
```powershell
# Windows PowerShell 명령어
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json

# 또는 rm 명령어 (PowerShell에서도 작동)
rm -rf node_modules
rm -f package-lock.json
```

### 3단계: 의존성 재설치
```powershell
npm install --legacy-peer-deps
```

### 4단계: Expo 패키지 자동 조정 (가장 중요!)
```powershell
npx expo install --fix
```

이 단계가 완료되면 다음을 확인:
- React Native 버전이 자동으로 0.76.x로 변경되었는지
- 모든 expo-* 패키지가 SDK 53에 맞게 조정되었는지

---

## 🍎 iOS Pod 설치 (macOS에서만 실행 가능)

**중요:** Windows에서는 `pod install`을 실행할 수 없습니다.
iOS Pod는 다음 중 하나에서 실행해야 합니다:

### 옵션 1: macOS 로컬 머신
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
```

### 옵션 2: GitHub Actions CI
- 코드를 푸시하면 CI가 자동으로 `pod install` 실행
- `ios-build-and-deploy.yml` 워크플로우가 처리

### 옵션 3: macOS 빌드 서버/로컬 빌드
```bash
cd ios
pod install
```

---

## ✅ 마이그레이션 완료 확인

### package.json 확인
```powershell
# package.json에서 다음 버전들이 올바른지 확인
cat package.json | Select-String "expo|react|react-native"
```

확인할 버전:
- `"expo": "~53.0.0"`
- `"react": "18.3.1"`
- `"react-native": "0.76.x" (expo install --fix 후 자동 조정)`
- `"@react-native-firebase/*": "^21.0.0"`
- `"react-native-google-mobile-ads": "^13.0.0"`

### expo-* 패키지 확인
```powershell
# 모든 expo 패키지가 SDK 53에 맞게 조정되었는지 확인
cat package.json | Select-String "expo-"
```

---

## 🔄 다음 단계

### Windows에서 할 수 있는 것
1. ✅ 의존성 설치 완료
2. ✅ Expo 패키지 조정 완료
3. ✅ 코드 테스트 (TypeScript 컴파일 등)
4. ✅ Git 커밋 준비

### macOS/CI에서 해야 할 것
1. iOS Pod 설치 (`pod install`)
2. iOS 빌드 테스트
3. 실제 기기에서 테스트

---

## 📝 전체 명령어 요약 (Windows PowerShell)

```powershell
# 1. 프로젝트 디렉토리로 이동
cd pickplay

# 2. 기존 의존성 삭제
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue

# 3. 의존성 재설치
npm install --legacy-peer-deps

# 4. Expo 패키지 자동 조정 (중요!)
npx expo install --fix

# 5. 버전 확인
cat package.json | Select-String "expo|react|react-native"
```

---

## ⚠️ 주의사항

1. **Windows에서 pod install 불가**
   - iOS Pod는 macOS나 CI에서만 설치 가능
   - 코드 푸시 후 CI가 자동 처리

2. **npx expo install --fix 실행 필수**
   - 이 명령어가 모든 expo-* 패키지를 SDK 53에 맞게 조정
   - React Native 버전도 자동으로 조정

3. **각 단계 후 확인**
   - 에러가 발생하면 로그 확인
   - 각 단계가 성공적으로 완료되었는지 확인

---

## 🚨 문제 발생 시

### npm install 실패
```powershell
npm cache clean --force
npm install --legacy-peer-deps
```

### expo install --fix 실패
```powershell
npx expo install --fix --no-interactive
```

### 의존성 충돌
```powershell
# package.json 확인 후 수동으로 버전 조정
npm install --legacy-peer-deps
```

---

**마이그레이션 성공을 기원합니다!** 🚀



