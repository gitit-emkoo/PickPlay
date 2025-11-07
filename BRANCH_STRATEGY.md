# 🌿 브랜치 전략 (Branch Strategy)

## 📋 브랜치 구조

```
main (프로덕션)
  ↑
release (릴리즈 후보, TestFlight 배포)
  ↑
develop (개발 브랜치, 새 기능 개발)
  ↑
feature/* (기능 브랜치)
```

## 🔄 브랜치별 역할

### 1. `develop` 브랜치
- **목적**: 새 기능 개발 및 일상적인 작업
- **워크플로우**: 
  - 새 기능 개발 시 `feature/*` 브랜치 생성
  - 완료 후 `develop`에 머지
  - 자동 빌드: ❌ (수동 실행만)

### 2. `release` 브랜치
- **목적**: TestFlight 배포 및 테스트
- **워크플로우**:
  - `develop`에서 안정화된 코드를 `release`로 머지
  - 자동 빌드: ✅ (푸시 시 Dev Client → TestFlight 자동 빌드)
  - TestFlight에서 테스트 완료 후 결정:
    - ✅ 문제없음 → `main`에 머지 + App Store 심사 제출
    - ❌ 문제있음 → 수정 후 `release`에 다시 푸시

### 3. `main` 브랜치
- **목적**: 프로덕션 안정 버전 (App Store 배포)
- **워크플로우**:
  - `release`에서 테스트 완료된 코드만 머지
  - 자동 빌드: ✅ (푸시 시 Dev Client → TestFlight 자동 빌드)
  - App Store 심사 제출 준비 완료 상태

## 🚀 배포 워크플로우

### 시나리오 A: Release 브랜치에서 테스트 후 Main으로 머지 (권장)

```
1. develop → release 머지
   git checkout release
   git merge develop
   git push origin release

2. GitHub Actions 자동 빌드 실행
   - Dev Client 빌드
   - TestFlight 업로드

3. TestFlight에서 테스트

4. 테스트 완료 후:
   - ✅ 문제없음:
     git checkout main
     git merge release
     git push origin main
     → App Store 심사 제출

   - ❌ 문제있음:
     release 브랜치에서 수정
     git checkout release
     # 수정 작업
     git commit -m "fix: ..."
     git push origin release
     → 다시 2번부터 반복
```

### 시나리오 B: Release 브랜치에서 바로 심사 제출

```
1. develop → release 머지
   git checkout release
   git merge develop
   git push origin release

2. GitHub Actions 자동 빌드 실행
   - Dev Client 빌드
   - TestFlight 업로드

3. TestFlight에서 테스트

4. 테스트 완료 후:
   - ✅ 문제없음:
     → Release 브랜치에서 바로 App Store 심사 제출
     → 심사 완료 후 main에 머지

   - ❌ 문제있음:
     release 브랜치에서 수정
     → 다시 2번부터 반복
```

## 🔄 새 기능 개발 중 Release 유지

### 방법 1: Release에 Develop 머지 (새 기능도 포함)

```
1. develop에서 새 기능 개발
   git checkout develop
   git checkout -b feature/new-feature
   # 개발 작업
   git checkout develop
   git merge feature/new-feature
   git push origin develop

2. Release에도 새 기능 포함시키기
   git checkout release
   git merge develop
   git push origin release
   → TestFlight에 새 기능 포함된 버전 배포
```

### 방법 2: Release는 안정화 유지, Develop은 계속 개발

```
1. Release에서 테스트 중일 때
   - Release 브랜치: 테스트 및 버그 수정만
   - Develop 브랜치: 새 기능 개발 계속

2. Release 완료 후
   git checkout develop
   git merge release  # Release의 버그 수정 사항 가져오기
   git push origin develop
   → Develop이 Release의 최신 상태를 반영
```

## 📝 실제 사용 예시

### 예시 1: 정기 배포

```bash
# 1. 새 기능 개발 완료 (develop 브랜치)
git checkout develop
git checkout -b feature/add-notification
# ... 개발 작업 ...
git checkout develop
git merge feature/add-notification
git push origin develop

# 2. Release 브랜치로 머지하여 테스트
git checkout release
git merge develop
git push origin release
# → GitHub Actions가 자동으로 빌드 및 TestFlight 업로드

# 3. TestFlight에서 테스트 완료
# → 문제없음 확인

# 4. Main으로 머지하여 심사 제출
git checkout main
git merge release
git push origin main
# → GitHub Actions가 자동으로 빌드 및 TestFlight 업로드
# → App Store 심사 제출
```

### 예시 2: 긴급 버그 수정 (핫픽스)

```bash
# 1. Release 브랜치에서 버그 발견
# ⚠️ release 브랜치에서 직접 수정하지 말고, hotfix 브랜치 생성!

git checkout release
git checkout -b hotfix/critical-bug
# ... 버그 수정 ...
git commit -m "fix: 긴급 버그 수정"
git push origin hotfix/critical-bug

# 2. Hotfix를 release에 머지
git checkout release
git merge hotfix/critical-bug
git push origin release
# → GitHub Actions가 자동으로 빌드 및 TestFlight 업로드

# 3. TestFlight에서 확인 완료
git checkout main
git merge release
git push origin main
# → App Store 심사 제출

# 4. Develop에도 버그 수정 반영 (중요!)
git checkout develop
git merge hotfix/critical-bug  # 또는 git merge release
git push origin develop
# → Develop 브랜치도 최신 버그 수정 사항 반영
```

## 🎯 권장 워크플로우 (Recommendation)

### ✅ **시나리오 A 채택**: Release → Main 머지 후 심사 제출

**이유:**
1. ✅ Main 브랜치가 항상 배포 가능한 상태 유지
2. ✅ Git 히스토리가 깔끔함 (main = 프로덕션 버전)
3. ✅ Rollback이 쉬움 (main의 이전 커밋으로 돌아가기)
4. ✅ 태그 관리가 명확함 (main 브랜치에 태그)

**핵심 규칙:**
- ✅ Release 브랜치에서는 직접 커밋하지 않기
- ✅ 버그 수정은 `hotfix/*` 브랜치 생성 후 머지
- ✅ 새 기능은 `develop` → `release` 머지
- ✅ Release 테스트 완료 후 `main`에 머지
- ✅ Hotfix 사항은 `develop`에도 반영

## 🔧 GitHub Actions 워크플로우 설정

현재 설정:
- `main` 브랜치 푸시: ✅ Dev Client + TestFlight 빌드
- `release` 브랜치 푸시: ✅ Dev Client + TestFlight 빌드
- `develop` 브랜치 푸시: ❌ 자동 빌드 없음 (수동 실행)

### 필요시 추가 설정

`develop` 브랜치에도 자동 빌드가 필요하다면:
```yaml
on:
  push:
    branches: [main, release, develop]  # develop 추가
```

## 📌 태그 전략

### 버전 태그 생성 시점

**방법 1: Main에 머지할 때**
```bash
git checkout main
git merge release
git tag v1.2.0
git push origin main
git push origin v1.2.0
```

**방법 2: Release에서 심사 제출할 때**
```bash
git checkout release
git tag v1.2.0
git push origin release
git push origin v1.2.0
```

## 🚨 주의사항

1. **Release 브랜치에서 직접 커밋하지 말 것**
   - ❌ `release` 브랜치에서 직접 수정 및 커밋
   - ✅ `hotfix/*` 브랜치를 만들어서 수정 후 release에 머지
   - ✅ 또는 `develop`에서 수정 후 release에 머지

2. **Release 브랜치 관리**
   - Release 브랜치는 테스트용이므로, 문제없으면 main에 머지 후 삭제해도 됨
   - 다음 릴리즈를 위해 새 release 브랜치 생성

3. **Develop 브랜치 동기화**
   - Release의 버그 수정 사항은 develop에도 머지하여 동기화 유지
   - Hotfix 브랜치의 수정사항도 develop에 머지 필요

4. **충돌 해결**
   - Release와 Develop에서 동시에 수정하면 충돌 발생 가능
   - 가능하면 Release 테스트 중에는 Develop에서만 작업

## 📚 참고

- Git Flow: https://nvie.com/posts/a-successful-git-branching-model/
- GitHub Flow: https://docs.github.com/en/get-started/quickstart/github-flow

