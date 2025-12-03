/**
 * OpenAI 연동 테스트 스크립트
 * 
 * 사용법:
 * 1. OpenAI API 키 설정: OPENAI_API_KEY 환경 변수 설정
 * 2. 실행: node test-ai.js
 */

const OpenAI = require('openai');

// OpenAI API 키 확인
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
  console.log('');
  console.log('💡 사용법:');
  console.log('   Windows PowerShell: $env:OPENAI_API_KEY="your-api-key"; node test-ai.js');
  console.log('   또는 .env 파일에 OPENAI_API_KEY 설정 후 실행');
  process.exit(1);
}

console.log('✅ OpenAI API 키 확인 완료');
console.log('');

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: apiKey,
});

// 테스트 데이터
const testCases = [
  {
    selectedText: '친구들과 외식하기',
    questionDomain: '관계',
    expectedTags: ['활동가', '협상가', '봉사가'],
  },
  {
    selectedText: '집에서 넷플릭스 보기',
    questionDomain: '감정',
    expectedTags: ['느긋한', '차가운'],
  },
  {
    selectedText: '최신 플래그십 모델',
    questionDomain: '습관',
    expectedTags: ['탐험가', '창조자'],
  },
];

// 유효한 형용사 리스트 (간단 버전)
function getValidAdjectivesByDomain(domain) {
  const allAdjectives = {
    '감정': ['뜨거운', '차가운', '유연한', '예민한', '느긋한', '충동적인', '냉정한', '감성적인'],
    '가치관': ['유연한', '뜨거운', '차가운', '충동적인', '냉정한', '예민한'],
    '습관': ['전략가', '탐험가', '중재자', '창조자', '분석가', '수호자', '설득가', '통찰자'],
    '관계': ['협상가', '봉사가', '연구가', '추진가', '활동가', '행동가', '인내가', '관찰자', '통솔가', '보호자'],
  };
  return allAdjectives[domain] || [];
}

// 프롬프트 생성
function generatePrompt(selectedText, questionDomain, validAdjectives) {
  const adjectiveList = validAdjectives.join(', ');

  return `사용자가 선택한 선택지를 분석하여 가장 적절한 형용사 태그를 생성해주세요.

**선택지**: "${selectedText}"
**도메인**: ${questionDomain}

**사용 가능한 형용사 리스트**: ${adjectiveList}

**지시사항**:
1. 선택지의 의미를 분석하여 해당 도메인에서 가장 잘 표현하는 형용사를 선택하세요
2. 반드시 제공된 형용사 리스트 중에서만 선택하세요
3. 1-2개의 형용사를 선택하세요

**응답 형식** (JSON):
{
  "tags": ["형용사1", "형용사2"]
}`;
}

// 테스트 실행
async function runTest(testCase) {
  console.log(`\n🧪 테스트 케이스: "${testCase.selectedText}" (도메인: ${testCase.questionDomain})`);
  console.log('─'.repeat(60));

  try {
    const validAdjectives = getValidAdjectivesByDomain(testCase.questionDomain);
    const prompt = generatePrompt(testCase.selectedText, testCase.questionDomain, validAdjectives);

    console.log('📤 OpenAI API 호출 중...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 사용자의 선택지를 분석하여 적절한 형용사 태그를 생성하는 전문가입니다. 반드시 제공된 형용사 리스트 내의 형용사만 사용해야 합니다.',
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

    console.log('📥 OpenAI 응답:', responseContent);

    // JSON 파싱
    const parsedResponse = JSON.parse(responseContent);
    const tags = parsedResponse.tags || [];

    console.log('✅ 생성된 태그:', tags);

    // 유효성 검증
    const validTags = tags.filter(tag => validAdjectives.includes(tag));
    if (validTags.length === 0) {
      console.warn('⚠️  생성된 태그가 유효한 형용사 리스트에 없습니다.');
      console.log('   생성된 태그:', tags);
      console.log('   유효한 형용사:', validAdjectives);
    } else {
      console.log('✅ 유효한 태그 확인:', validTags);
    }

    return { success: true, tags: validTags.length > 0 ? validTags : tags };

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    if (error.response) {
      console.error('   OpenAI API 오류:', error.response.status, error.response.statusText);
      console.error('   상세:', JSON.stringify(error.response.data, null, 2));
    }
    return { success: false, error: error.message };
  }
}

// 모든 테스트 실행
async function runAllTests() {
  console.log('🚀 OpenAI 연동 테스트 시작');
  console.log('='.repeat(60));

  const results = [];
  for (const testCase of testCases) {
    const result = await runTest(testCase);
    results.push(result);
    
    // API 호출 간 딜레이 (Rate Limit 방지)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('📊 테스트 결과 요약');
  console.log('='.repeat(60));
  
  const successCount = results.filter(r => r.success).length;
  console.log(`✅ 성공: ${successCount}/${testCases.length}`);
  console.log(`❌ 실패: ${testCases.length - successCount}/${testCases.length}`);

  if (successCount === testCases.length) {
    console.log('\n🎉 모든 테스트 통과! OpenAI 연동이 정상적으로 작동합니다.');
  } else {
    console.log('\n⚠️  일부 테스트가 실패했습니다. OpenAI API 키와 설정을 확인해주세요.');
  }
}

// 실행
runAllTests().catch(console.error);

