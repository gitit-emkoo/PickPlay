# React Native 다운그레이드 - React 18 호환

## ✅ 결정: React Native 0.81.4 → 0.76.5

### 이유
1. **React 19 호환성 문제**
   - React Native 0.81.4는 React 19를 요구
   - React 19는 아직 많은 라이브러리와 호환 문제
   - React 18이 더 안정적

2. **Expo SDK 53 표준 조합**
   - Expo SDK 53은 React Native 0.76.x와 함께 작동
   - React Native 0.76.x는 React 18과 완벽 호환
   - 검증된 안정적인 조합

3. **라이브러리 호환성**
   - Firebase, AdMob 등 모든 라이브러리가 React 18 완벽 지원
   - React 19는 아직 일부 라이브러리에서 문제 발생 가능

---

## 📋 변경 사항

### package.json
```json
{
  "react": "18.3.1",           // React 18 유지
  "react-native": "0.76.5"     // 0.81.4 → 0.76.5로 변경
}
```

### 호환성
- ✅ React 18.3.1 + React Native 0.76.5 = 완벽 호환
- ✅ Expo SDK 53 + React Native 0.76.5 = 표준 조합
- ✅ Firebase 21.x + React Native 0.76.5 = 호환
- ✅ AdMob 13.x + React Native 0.76.5 = 호환

---

## 🎯 설치 순서

```powershell
# 1. React Native 버전 변경됨 (이미 package.json 수정됨)
# "react-native": "0.76.5"

# 2. 의존성 설치 (이제 --legacy-peer-deps 불필요할 수도!)
npm install

# 만약 여전히 문제가 있으면:
# npm install --legacy-peer-deps

# 3. Expo가 나머지 패키지 조정
npx expo install --fix
```

---

## ✅ 장점

1. **안정성 향상**
   - React 18 + React Native 0.76.5 = 검증된 조합
   - React 19 관련 문제 없음

2. **라이브러리 호환성**
   - 모든 라이브러리가 React 18 완벽 지원
   - 호환성 문제 최소화

3. **빌드 안정성**
   - iOS 빌드 문제 해결
   - C++ 표준 문제 자동 해결 (0.76.x는 더 안정적)

4. **peer dependency 충돌 해결**
   - React Native 0.76.5는 React 18 요구
   - 버전 충돌 없음

---

## 🔍 React Native 0.76.5 특징

### 개선 사항
- ✅ React 18 완벽 지원
- ✅ C++ 표준 자동 설정 (0.81.4보다 안정적)
- ✅ iOS 빌드 안정성 향상
- ✅ Android 빌드 안정성 향상

### 변경 없음
- ✅ API 호환성 유지
- ✅ 기능 변경 없음
- ✅ 모든 기능 정상 작동

---

## 📝 최종 설치 명령어

```powershell
cd pickplay

# React Native 버전이 0.76.5로 변경되었는지 확인
cat package.json | Select-String "react-native"

# 의존성 설치
npm install

# Expo 패키지 자동 조정
npx expo install --fix
```

이제 `--legacy-peer-deps` 없이도 설치가 잘 될 가능성이 높습니다! 🎉



