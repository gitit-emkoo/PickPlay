import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import OpenAI from 'openai';

// Firebase Admin 초기화
admin.initializeApp();

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: functions.config().openai?.api_key || process.env.OPENAI_API_KEY,
});

/**
 * 사용자의 선택지 텍스트를 분석하여 형용사 태그를 생성하는 Cloud Function
 * 
 * @param questionId - 질문 ID
 * @param selectedText - 사용자가 선택한 선택지 텍스트
 * @param questionDomain - 질문 도메인 ('감정' | '가치관' | '습관' | '관계')
 * @returns 생성된 태그 배열
 */
export const generateTags = functions
  .region('asia-northeast3') // Firebase Functions 리전 설정
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .https
  .onCall(async (data, context) => {
    // 인증 확인
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '사용자가 인증되지 않았습니다.'
      );
    }

    const { questionId, selectedText, questionDomain } = data;

    // 파라미터 검증
    if (!questionId || !selectedText || !questionDomain) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '필수 파라미터가 누락되었습니다: questionId, selectedText, questionDomain'
      );
    }

    // 도메인 검증
    const validDomains = ['감정', '가치관', '습관', '관계'];
    if (!validDomains.includes(questionDomain)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `유효하지 않은 도메인입니다: ${questionDomain}`
      );
    }

    try {
      console.log(`[generateTags] 요청 받음:`, {
        questionId,
        selectedText,
        questionDomain,
        uid: context.auth.uid,
      });

      // OpenAI API 키 확인
      const apiKey = functions.config().openai?.api_key || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.warn(`[generateTags] OpenAI API 키가 설정되지 않았습니다. 폴백 태그를 사용합니다.`);
        throw new Error('OpenAI API 키가 설정되지 않았습니다.');
      }

      // 도메인별 형용사 리스트 가져오기 (Firestore 또는 하드코딩)
      const validAdjectives = getValidAdjectivesByDomain(questionDomain);

      // OpenAI 프롬프트 생성
      const prompt = generatePrompt(selectedText, questionDomain, validAdjectives);

      console.log(`[generateTags] OpenAI API 호출 시작... (모델: gpt-4o-mini)`);

      // OpenAI API 호출
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // 비용 효율적인 모델 사용
        messages: [
          {
            role: 'system',
            content: `당신은 사용자의 선택지를 분석하여 적절한 형용사 태그를 생성하는 전문가입니다. 
사용자가 선택한 선택지를 분석하여, 주어진 형용사 리스트 중에서 가장 적합한 형용사 1-2개를 선택하세요.
반드시 제공된 형용사 리스트 내의 형용사만 사용해야 합니다.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
        response_format: { type: 'json_object' },
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('OpenAI 응답이 비어있습니다.');
      }

      console.log(`[generateTags] OpenAI 응답:`, responseContent);

      // JSON 파싱
      let parsedResponse: { tags?: string[]; adjective?: string };
      try {
        parsedResponse = JSON.parse(responseContent);
      } catch (parseError) {
        console.error(`[generateTags] JSON 파싱 실패:`, parseError);
        throw new Error('OpenAI 응답 파싱에 실패했습니다.');
      }

      // 태그 추출
      let tags: string[] = [];
      if (Array.isArray(parsedResponse.tags)) {
        tags = parsedResponse.tags;
      } else if (typeof parsedResponse.adjective === 'string') {
        tags = [parsedResponse.adjective];
      }

      // 유효성 검증: 제공된 형용사 리스트 내에 있는지 확인
      const validTags = tags.filter(tag => 
        validAdjectives.some(adj => adj.adjective === tag)
      );

      if (validTags.length === 0) {
        // 유효한 태그가 없으면 랜덤 선택
        console.warn(`[generateTags] 유효한 태그가 없어 랜덤 선택:`, tags);
        const randomIndex = Math.floor(Math.random() * validAdjectives.length);
        validTags.push(validAdjectives[randomIndex].adjective);
      }

      console.log(`[generateTags] 최종 태그:`, validTags);

      return { tags: validTags };

    } catch (error: any) {
      console.error(`[generateTags] 오류 발생:`, error);
      
      // OpenAI API 키가 없는 경우 또는 기타 오류 발생 시 폴백
      const validAdjectives = getValidAdjectivesByDomain(questionDomain);
      const fallbackIndex = selectedText.length % validAdjectives.length;
      const fallbackTag = validAdjectives[fallbackIndex].adjective;

      console.warn(`[generateTags] 폴백 태그 사용:`, fallbackTag);

      return { tags: [fallbackTag] };
    }
  });

/**
 * 도메인별 유효한 형용사 리스트 반환
 * 실제 형용사 데이터는 adjectives_total.json과 adjectives_total2.json에 정의되어 있음
 */
function getValidAdjectivesByDomain(domain: string): Array<{ adjective: string; domain: string; keywords?: string[] }> {
  const allAdjectives: Array<{ adjective: string; domain: string; keywords?: string[] }> = [
    // 감정 도메인 (adjectives_total.json 기반)
    { adjective: '뜨거운', domain: '감정', keywords: ['열정', '몰입', '에너지', '감정표현'] },
    { adjective: '차가운', domain: '감정', keywords: ['거리감', '절제', '냉철함', '이성적'] },
    { adjective: '유연한', domain: '감정' },
    { adjective: '예민한', domain: '감정', keywords: ['민감함', '불안', '주의', '섬세함'] },
    { adjective: '느긋한', domain: '감정', keywords: ['여유', '느림', '안정감', '편안함'] },
    { adjective: '충동적인', domain: '감정', keywords: ['즉흥', '반사적', '감정적', '예측불가'] },
    { adjective: '냉정한', domain: '감정', keywords: ['침착', '절제', '거리두기', '판단력'] },
    { adjective: '감성적인', domain: '감정', keywords: ['감정이입', '공감', '섬세함', '감수성'] },
    
    // 가치관 도메인 (adjectives_total.json 기반)
    { adjective: '유연한', domain: '가치관', keywords: ['융통성', '적응', '타협', '개방성'] },
    { adjective: '뜨거운', domain: '가치관' },
    { adjective: '차가운', domain: '가치관', keywords: ['거리감', '절제', '냉철함', '이성적'] },
    { adjective: '충동적인', domain: '가치관', keywords: ['즉흥', '반사적', '감정적', '예측불가'] },
    { adjective: '냉정한', domain: '가치관' },
    { adjective: '예민한', domain: '가치관', keywords: ['민감함', '불안', '주의', '섬세함'] },
    
    // 습관 도메인 (adjectives_total2.json 기반)
    { adjective: '전략가', domain: '습관', keywords: ['계획', '분석', '통제', '판단력'] },
    { adjective: '탐험가', domain: '습관', keywords: ['모험', '탐구', '새로움', '자유'] },
    { adjective: '중재자', domain: '습관', keywords: ['조율', '중립', '갈등해결', '균형'] },
    { adjective: '창조자', domain: '습관', keywords: ['창의', '혁신', '독창성', '표현'] },
    { adjective: '분석가', domain: '습관', keywords: ['논리', '체계', '정확성', '연구'] },
    { adjective: '수호자', domain: '습관', keywords: ['보호', '안정', '책임', '전통'] },
    { adjective: '설득가', domain: '습관', keywords: ['설득', '표현력', '공감', '영향력'] },
    { adjective: '통찰자', domain: '습관', keywords: ['통찰력', '직관', '넓은 시야', '예측'] },
    
    // 관계 도메인 (adjectives_total2.json 기반)
    { adjective: '협상가', domain: '관계', keywords: ['타협', '소통', '이해', '합의'] },
    { adjective: '봉사가', domain: '관계', keywords: ['배려', '헌신', '돕기', '이타심'] },
    { adjective: '연구가', domain: '관계', keywords: ['탐구', '학습', '지식', '분석'] },
    { adjective: '추진가', domain: '관계', keywords: ['행동력', '추진', '실행', '결단'] },
    { adjective: '활동가', domain: '관계', keywords: ['활발', '에너지', '참여', '소통'] },
    { adjective: '행동가', domain: '관계', keywords: ['실행', '결단', '행동', '추진'] },
    { adjective: '인내가', domain: '관계', keywords: ['인내', '끈기', '지속', '견디기'] },
    { adjective: '관찰자', domain: '관계', keywords: ['관찰', '분석', '침착', '사려'] },
    { adjective: '통솔가', domain: '관계', keywords: ['리더십', '지휘', '통제', '책임'] },
    { adjective: '보호자', domain: '관계', keywords: ['보호', '수호', '배려', '안전'] },
  ];

  // 중복 제거 (같은 형용사가 여러 도메인에 있을 수 있으므로)
  const uniqueAdjectives = allAdjectives.filter((adj, index, self) =>
    index === self.findIndex(a => a.adjective === adj.adjective && a.domain === adj.domain)
  );

  return uniqueAdjectives.filter(adj => adj.domain === domain);
}

/**
 * OpenAI 프롬프트 생성
 */
function generatePrompt(
  selectedText: string,
  questionDomain: string,
  validAdjectives: Array<{ adjective: string; domain: string; keywords?: string[] }>
): string {
  // 형용사와 키워드를 함께 표시
  const adjectiveList = validAdjectives.map(adj => {
    if (adj.keywords && adj.keywords.length > 0) {
      return `${adj.adjective} (키워드: ${adj.keywords.join(', ')})`;
    }
    return adj.adjective;
  }).join('\n- ');

  return `사용자가 선택한 선택지를 분석하여 가장 적절한 형용사 태그를 생성해주세요.

**선택지**: "${selectedText}"
**도메인**: ${questionDomain}

**사용 가능한 형용사 리스트**:
- ${adjectiveList}

**지시사항**:
1. 선택지의 의미를 분석하여 해당 도메인에서 가장 잘 표현하는 형용사를 선택하세요
2. 반드시 제공된 형용사 리스트 중에서만 선택하세요
3. 1-2개의 형용사를 선택하세요 (가장 적합한 1개만 선택해도 됩니다)
4. 선택지의 핵심 의미와 형용사의 키워드가 일치하는 것을 우선 선택하세요

**응답 형식** (JSON):
{
  "tags": ["형용사1", "형용사2"]
}

예시:
- 선택지: "친구들과 외식하기" → {"tags": ["활동가", "협상가"]}
- 선택지: "집에서 넷플릭스 보기" → {"tags": ["느긋한"]}
- 선택지: "최신 플래그십 모델" → {"tags": ["탐험가"]}`;
}

