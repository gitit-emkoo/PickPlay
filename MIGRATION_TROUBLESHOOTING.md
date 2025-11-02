# 마이그레이션 문제 해결

## ❌ 발생한 에러

```
npm error ERESOLVE unable to resolve dependency tree
npm error peer react@"^19.1.0" from react-native@0.81.4
```

**원인:**
- React Native 0.81.4가 아직 package.json에 있음
- React Native 0.81.4는 React 19를 요구함
- 하지만 우리는 React 18.3.1로 변경했음
- 버전 불일치 발생!

---

## ✅ 해결 방법

React Native 버전이 아직 0.81.4로 남아있어서 발생한 문제입니다.
`npx expo install --fix`가 React Native 버전을 자동으로 조정하지만, 그 전에 먼저 설치가 되어야 합니다.

### 방법 1: --legacy-peer-deps로 우회 후 expo install --fix (권장)

```powershell
# 1. --legacy-peer-deps로 일단 설치
npm install --legacy-peer-deps

# 2. Expo가 React Native 버전을 자동 조정
npx expo install --fix

# 3. 이제 정상 설치 가능 (또는 다시 --legacy-peer-deps 필요 없을 수도)
npm install
```

### 방법 2: package.json에서 React Native 버전 직접 제거 후 설치

```powershell
# 1. package.json에서 react-native 라인 제거 또는 주석 처리
# "react-native": "0.81.4",  ← 이 줄 삭제 또는 제거

# 2. 설치 시도 (Expo가 자동으로 React Native 버전 설정)
npm install

# 3. expo install --fix로 정리
npx expo install --fix
```

---

## 🎯 권장 순서 (방법 1)

```powershell
# 현재 상태: React Native 0.81.4가 React 19를 요구함
# 해결: --legacy-peer-deps로 우회 → expo install --fix로 버전 조정

# 1. --legacy-peer-deps로 설치 (일단 설치 완료)
npm install --legacy-peer-deps

# 2. Expo가 모든 버전을 SDK 53에 맞게 자동 조정
# 이 단계에서 React Native가 0.76.x로 자동 변경됨
npx expo install --fix

# 3. 버전 확인
cat package.json | Select-String "react-native"

# 4. (선택) 깔끔하게 다시 설치 (이번엔 --legacy-peer-deps 없이 가능할 수도)
rm -rf node_modules package-lock.json
npm install  # 또는 npm install --legacy-peer-deps (여전히 필요할 수 있음)
```

---

## 📝 설명

**왜 --legacy-peer-deps가 필요했나?**
1. React Native 0.81.4가 아직 package.json에 있음
2. 0.81.4는 React 19를 요구하지만 우리는 React 18.3.1 사용
3. npm이 버전 충돌 감지하여 설치 거부
4. `--legacy-peer-deps`로 우회하여 일단 설치
5. `expo install --fix`가 React Native를 0.76.x로 자동 변경
6. 이후에는 정상 설치 가능

---

**지금 바로 실행하세요:**
```powershell
npm install --legacy-peer-deps
npx expo install --fix
```



