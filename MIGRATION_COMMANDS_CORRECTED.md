# Expo SDK 53 마이그레이션 실행 명령어 (수정)

## 📋 올바른 실행 순서

### Windows PowerShell

```powershell
# 1. pickplay 디렉토리로 이동
cd pickplay

# 2. 기존 의존성 삭제
rm -rf node_modules
rm -f package-lock.json

# 3. 의존성 재설치 (일반 설치로 먼저 시도)
npm install

# 만약 peer dependency 경고/에러가 발생하면:
# npm install --legacy-peer-deps

# 4. Expo 패키지 자동 조정 (가장 중요!)
npx expo install --fix
```

---

## 💡 왜 일반 설치로 시도하나요?

### 이유
1. ✅ **이미 호환 버전으로 조정함**
   - package.json에서 Expo SDK 53, React 18.3.1 등 호환 버전으로 수정
   - `npx expo install --fix`가 추가로 모든 패키지를 정렬함

2. ✅ **정상 설치 가능**
   - 호환되는 버전 조합이면 `--legacy-peer-deps` 불필요

3. ✅ **경고 확인 가능**
   - 일반 설치로 실행하면 peer dependency 경고를 확인 가능
   - 실제 문제가 있는지 판단 가능

---

## 🔄 실행 전략

### 1단계: 일반 설치 시도
```powershell
npm install
```

**결과에 따라:**

#### ✅ 성공 (에러 없음, 경고만 있음)
- 그대로 진행
- `npx expo install --fix` 실행

#### ⚠️ 경고만 있음 (설치는 성공)
- 경고는 무시하고 진행
- `npx expo install --fix` 실행
- `expo install --fix`가 경고 해결할 수 있음

#### ❌ 설치 실패 (에러 발생)
- `npm install --legacy-peer-deps` 재시도
- 그래도 실패하면 에러 로그 확인

---

## 📝 최종 권장 순서

```powershell
# 1. 디렉토리 이동
cd pickplay

# 2. 기존 의존성 삭제
rm -rf node_modules package-lock.json

# 3. 일반 설치 시도
npm install

# 4. Expo 패키지 자동 조정 (경고 무시하고 실행)
npx expo install --fix

# 5. 버전 확인
cat package.json | Select-String "expo|react|react-native"
```

---

## 🎯 결론

**맞습니다!** 이미 호환 버전으로 조정했으니 일반 설치로 시도하는 게 맞습니다.

`--legacy-peer-deps`는:
- ❌ **필수가 아님** - 호환 버전이면 불필요
- ✅ **필요 시에만 사용** - 실제 peer dependency 에러 발생 시

먼저 일반 설치로 시도하고, 문제가 있으면 `--legacy-peer-deps`를 사용하세요! 🚀



