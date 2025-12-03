# Firebase Cloud Functions - PickPlay AI 태그 생성

## 📋 개요

이 디렉토리는 PickPlay 앱의 AI 태그 생성 기능을 제공하는 Firebase Cloud Functions입니다.

### 주요 기능
- 사용자의 선택지 텍스트를 분석하여 형용사 태그 생성
- OpenAI GPT 모델을 활용한 자연어 처리
- 도메인별 형용사 매핑 (감정, 가치관, 습관, 관계)

## 🔧 설정

### 1. 의존성 설치

```bash
cd functions
npm install
```

### 2. OpenAI API 키 설정

Firebase Functions에 OpenAI API 키를 환경 변수로 설정해야 합니다.

#### 방법 1: Firebase CLI 사용 (권장)

```bash
# Firebase CLI로 설정
firebase functions:config:set openai.api_key="YOUR_OPENAI_API_KEY"

# 설정 확인
firebase functions:config:get
```

#### 방법 2: 환경 변수 사용 (로컬 개발)

`.env` 파일 생성 (`.gitignore`에 추가되어야 함):

```
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. 빌드

```bash
npm run build
```

### 4. 배포

```bash
# 모든 Functions 배포
firebase deploy --only functions

# 특정 Function만 배포
firebase deploy --only functions:generateTags
```

## 📝 함수 상세

### `generateTags`

사용자의 선택지를 분석하여 형용사 태그를 생성합니다.

#### 호출 방법 (클라이언트에서)

```typescript
import functions from '@react-native-firebase/functions';

const generateTags = functions().httpsCallable('generateTags');
const result = await generateTags({
  questionId: 'Q001',
  selectedText: '친구들과 외식하기',
  questionDomain: '관계'
});

const tags = result.data.tags; // ['활동가', '협상가']
```

#### 파라미터

- `questionId` (string, 필수): 질문 ID
- `selectedText` (string, 필수): 사용자가 선택한 선택지 텍스트
- `questionDomain` (string, 필수): 질문 도메인 ('감정' | '가치관' | '습관' | '관계')

#### 반환값

```typescript
{
  tags: string[]  // 생성된 형용사 태그 배열 (1-2개)
}
```

#### 에러 처리

- API 키가 설정되지 않은 경우: 폴백 태그 반환
- OpenAI API 호출 실패 시: 도메인별 랜덤 태그 반환
- 인증 실패: `unauthenticated` 에러

## 🔍 로컬 테스트

### Firebase Emulators 사용

```bash
# Emulators 시작
firebase emulators:start --only functions

# 다른 터미널에서 함수 호출 테스트
curl http://localhost:5001/today-balance-fa0a5/asia-northeast3/generateTags \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "questionId": "Q001",
      "selectedText": "친구들과 외식하기",
      "questionDomain": "관계"
    }
  }'
```

## 💰 비용 관리

- 사용 모델: `gpt-4o-mini` (비용 효율적인 모델)
- 타임아웃: 30초
- 메모리: 256MB

비용을 더 줄이려면:
- `gpt-3.5-turbo` 모델로 변경 가능
- 캐싱 로직 추가 고려

## 📚 참고

- [Firebase Functions 문서](https://firebase.google.com/docs/functions)
- [OpenAI API 문서](https://platform.openai.com/docs)
- 형용사 데이터: `../assets/data/adjectives_total.json`, `adjectives_total2.json`

