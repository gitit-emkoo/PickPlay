import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import OpenAI from 'openai';
import { Expo } from 'expo-server-sdk';

// Firebase Admin 초기화
admin.initializeApp();

// Expo 클라이언트 (푸시 발송용)
const expo = new Expo();

/**
 * 단일 사용자(uid)를 대상으로 Expo 푸시 알림을 전송합니다.
 * - Firestore user_push_tokens/{uid}.expo.token 을 사용합니다.
 */
async function sendUserPushNotification(
  uid: string,
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
  try {
    const tokenDoc = await admin.firestore().collection('user_push_tokens').doc(uid).get();
    if (!tokenDoc.exists) {
      console.log('[sendUserPushNotification] user_push_tokens 문서 없음, 푸시 생략:', uid);
      return;
    }
    const tokenData = tokenDoc.data() as any;
    const expoToken: string | undefined = tokenData?.expo?.token;
    if (!expoToken || !Expo.isExpoPushToken(expoToken)) {
      console.log('[sendUserPushNotification] 유효하지 않은 Expo 토큰, 푸시 생략:', { uid, expoToken });
      return;
    }

    const message = {
      to: expoToken,
      title,
      body,
      sound: 'default' as const,
      data,
    };

    await expo.sendPushNotificationsAsync([message]);
    console.log('[sendUserPushNotification] 푸시 전송 완료', { uid });
  } catch (error: any) {
    console.error('[sendUserPushNotification] 푸시 전송 실패:', error?.message || error);
  }
}

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

/**
 * 포인트 적립/소멸 내역을 기록하는 Callable Function
 * 클라이언트와 서버 모두에서 호출 가능
 */
export const recordPointHistory = functions
  .region('asia-northeast3')
  .runWith({
    timeoutSeconds: 10,
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

    const { uid, amount, reason, description } = data;

    // 파라미터 검증
    if (!uid || typeof amount !== 'number' || !reason) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '필수 파라미터가 누락되었거나 형식이 올바르지 않습니다: uid, amount(number), reason'
      );
    }

    // 본인만 기록 가능
    if (context.auth.uid !== uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '본인의 포인트 내역만 기록할 수 있습니다.'
      );
    }

    // reason 검증
    const validReasons = [
      'basic_reward',
      'ladder_reward',
      'creator_reward',
      'top_reward',
      'majority_reward',
      'ad_bonus',
      'livepick_question_creation',
      'tutorial_reward',
      'manual',
      'etc',
    ];
    if (!validReasons.includes(reason)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `유효하지 않은 reason입니다: ${reason}`
      );
    }

    try {
      console.log(`[recordPointHistory] 포인트 내역 기록 시작:`, {
        uid,
        amount,
        reason,
        description,
      });

      // point_history 컬렉션에 문서 생성
      const historyRef = admin.firestore().collection('point_history').doc();
      await historyRef.set({
        uid,
        amount,
        reason,
        description: description || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[recordPointHistory] 포인트 내역 기록 완료: ${historyRef.id}`);
      return { success: true, id: historyRef.id };
    } catch (error: any) {
      console.error(`[recordPointHistory] 포인트 내역 기록 실패:`, error);
      throw new functions.https.HttpsError(
        'internal',
        `포인트 내역 기록 중 오류가 발생했습니다: ${error.message}`
      );
    }
  });

/**
 * LivePick 질문 생성자 보상을 자정 기준으로 집계하고 지급하는 스케줄러 함수
 * 
 * 명령문 기준:
 * - 10명 미만: 10P
 * - 11~20명 미만: 50P
 * - 20명 이상: 100P
 * - 100명 이상: 200P
 * - 300명 이상: 500P
 * - 하루 중 가장 많은 답변을 받은 질문 생성자: 추가 5,000P
 *
 * 추가: 아래 상황에서 사용자 알림(user_notifications)에 기록을 남깁니다.
 * - 특정 LivePick 질문이 일일 참여자 수 20 / 100 / 300명을 처음 돌파했을 때
 * - 어제 기준으로 가장 많은 답변을 받은 LivePick 질문의 질문자에게 "TOP 질문" 알림
 * 
 * 한국시간 자정 (00:00)에 실행
 */
export const dailyLivePickRewardScheduler = functions
  .region('asia-northeast3')
  .pubsub
  .schedule('0 0 * * *') // 매일 자정 (UTC 기준)
  .timeZone('Asia/Seoul') // 한국시간
  .onRun(async (context) => {
    try {
      console.log('[dailyLivePickRewardScheduler] 자정 보상 집계 시작');
      
      // 집계 대상 날짜 계산 (한국시간 기준)
      // 자정에 실행되므로, 실행 시점의 "어제" 날짜를 집계
      const now = new Date();
      // 한국시간으로 변환하여 날짜 계산
      const koreaOffset = 9 * 60; // UTC+9
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      const koreaTime = new Date(utcTime + (koreaOffset * 60000));
      
      const targetDate = new Date(koreaTime);
      targetDate.setDate(targetDate.getDate() - 1); // 어제
      targetDate.setHours(0, 0, 0, 0);
      
      const targetDateStart = admin.firestore.Timestamp.fromDate(targetDate);
      const targetDateEnd = new Date(targetDate);
      targetDateEnd.setHours(23, 59, 59, 999);
      const targetDateEndTimestamp = admin.firestore.Timestamp.fromDate(targetDateEnd);
      
      console.log(`[dailyLivePickRewardScheduler] 집계 기준 날짜: ${targetDate.toISOString().split('T')[0]}`);
      
      // 어제 활성 상태였던 모든 질문 가져오기
      const questionsSnapshot = await admin.firestore()
        .collection('livepick_questions')
        .where('status', '==', 'active')
        .get();
      
      const questionRewards: Array<{
        questionId: string;
        ownerUid: string;
        participantCount: number;
        reward: number;
      }> = [];
      
      let maxParticipantCount = 0;
      let topQuestionId: string | null = null;
      
      // 각 질문의 어제 참여자 수 계산 및 보상 계산
      for (const questionDoc of questionsSnapshot.docs) {
        const questionData = questionDoc.data();
        const questionId = questionDoc.id;
        
        // 집계 대상 날짜의 참여자 수 계산
        const participationsSnapshot = await admin.firestore()
          .collection('livepick_participations')
          .where('questionId', '==', questionId)
          .where('participatedAt', '>=', targetDateStart)
          .where('participatedAt', '<=', targetDateEndTimestamp)
          .get();
        
        const dailyParticipantCount = participationsSnapshot.size;
        
        if (dailyParticipantCount === 0) {
          continue; // 참여자가 없으면 보상 없음
        }
        
        // 최고 참여자 수 추적
        if (dailyParticipantCount > maxParticipantCount) {
          maxParticipantCount = dailyParticipantCount;
          topQuestionId = questionId;
        }
        
        // 보상 계산 (명령문 기준)
        let reward = 0;
        if (dailyParticipantCount < 10) {
          reward = 10;
        } else if (dailyParticipantCount >= 11 && dailyParticipantCount < 20) {
          reward = 50;
        } else if (dailyParticipantCount >= 20 && dailyParticipantCount < 100) {
          reward = 100;
        } else if (dailyParticipantCount >= 100 && dailyParticipantCount < 300) {
          reward = 200;
        } else if (dailyParticipantCount >= 300) {
          reward = 500;
        }
        
        if (reward > 0) {
          questionRewards.push({
            questionId,
            ownerUid: questionData.createdBy,
            participantCount: dailyParticipantCount,
            reward,
          });
        }
      }
      
      // 최고 질문에 추가 보상 5,000P 지급
      // 주의: 유저 수가 충분히 많아질 때까지 비활성화 (소수 독식 방지)
      // 활성화 조건: 최고 질문의 참여자 수가 100명 이상일 때만 지급
      const MIN_PARTICIPANTS_FOR_TOP_REWARD = 100;
      if (topQuestionId && maxParticipantCount >= MIN_PARTICIPANTS_FOR_TOP_REWARD) {
        const topQuestion = questionRewards.find(r => r.questionId === topQuestionId);
        if (topQuestion) {
          topQuestion.reward += 5000; // 추가 보상
          console.log(`[dailyLivePickRewardScheduler] 최고 질문 추가 보상: ${topQuestionId}, 참여자 수: ${maxParticipantCount}`);
        }
      } else if (topQuestionId && maxParticipantCount > 0) {
        console.log(`[dailyLivePickRewardScheduler] 최고 질문 보상 스킵: 참여자 수 부족 (${maxParticipantCount}명 < ${MIN_PARTICIPANTS_FOR_TOP_REWARD}명)`);
      }
      
      // ============================================
      // 라이브픽 보상 체계 비활성화 (유저 수 부족으로 인한 부담 방지)
      // 활성화하려면 ENABLE_LIVEPICK_REWARDS를 true로 변경
      // ============================================
      const ENABLE_LIVEPICK_REWARDS = false;
      
      if (!ENABLE_LIVEPICK_REWARDS) {
        console.log(`[dailyLivePickRewardScheduler] 라이브픽 보상 체계 비활성화됨. 계산된 보상: ${questionRewards.length}개 질문`);
        console.log(`[dailyLivePickRewardScheduler] 보상 상세:`, questionRewards.map(r => ({
          questionId: r.questionId,
          participantCount: r.participantCount,
          reward: r.reward
        })));
        return; // 보상 지급 없이 종료
      }
      
      // 모든 보상 지급 및 알림 기록 (배치 처리)
      let batch = admin.firestore().batch();
      let batchCount = 0;
      const MAX_BATCH_SIZE = 500;
      
      for (const rewardData of questionRewards) {
        // 사용자 포인트 증가
        const ownerRef = admin.firestore().collection('users').doc(rewardData.ownerUid);
        batch.update(ownerRef, {
          points: admin.firestore.FieldValue.increment(rewardData.reward),
        });
        
        // 보상 기록 생성
        const rewardRef = admin.firestore().collection('livepick_rewards').doc();
        batch.set(rewardRef, {
          questionId: rewardData.questionId,
          questionOwner: rewardData.ownerUid,
          participantCount: rewardData.participantCount,
          rewardAmount: rewardData.reward,
          rewardType: `${rewardData.participantCount}p`,
          rewardedAt: admin.firestore.FieldValue.serverTimestamp(),
          rewardDate: targetDate.toISOString().split('T')[0], // YYYY-MM-DD 형식
        });
        
        // 포인트 내역 기록
        const historyRef = admin.firestore().collection('point_history').doc();
        const reason = rewardData.reward >= 5000 ? 'top_reward' : 'creator_reward';
        const description = rewardData.reward >= 5000
          ? `라이브픽 TOP 질문 보상 (${rewardData.participantCount}명 참여)`
          : `라이브픽 질문자 보상 (${rewardData.participantCount}명 참여)`;
        batch.set(historyRef, {
          uid: rewardData.ownerUid,
          amount: rewardData.reward,
          reason,
          description,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        batchCount += 3;
        
        // --- LivePick 참여 마일스톤 알림 (일일 기준 20/100/300명 이상) ---
        // 같은 질문 + 같은 마일스톤에 대해서는 한 번만 알림 전송
        const ownerUid = rewardData.ownerUid;
        const questionId = rewardData.questionId;
        const dailyCount = rewardData.participantCount;

        const milestoneConfigs = [
          { value: 20,  code: 'daily_lp_20',  title: '🎉 라이브픽 20명 돌파!',  body: '당신의 라이브픽에 어제 20명 이상이 참여했어요. 점점 인기가 올라가고 있어요!' },
          { value: 100, code: 'daily_lp_100', title: '🔥 라이브픽 100명 돌파!', body: '당신의 라이브픽이 많은 사람들의 선택을 받고 있어요!' },
          { value: 300, code: 'daily_lp_300', title: '🏆 라이브픽 300명 돌파!', body: '어제 라이브픽에서 레전드급 인기를 얻었어요!' },
        ];

        for (const milestone of milestoneConfigs) {
          if (dailyCount >= milestone.value) {
            const existing = await admin.firestore()
              .collection('user_notifications')
              .where('uid', '==', ownerUid)
              .where('type', '==', 'livepick')
              .where('data.questionId', '==', questionId)
              .where('data.milestone', '==', milestone.code)
              .limit(1)
              .get();

            if (existing.empty) {
              const notifRef = admin.firestore().collection('user_notifications').doc();
              batch.set(notifRef, {
                uid: ownerUid,
                title: milestone.title,
                body: milestone.body,
                type: 'livepick',
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                data: {
                  questionId,
                  milestone: milestone.code,
                  dailyParticipantCount: dailyCount,
                  rewardDate: targetDate.toISOString().split('T')[0],
                },
              });
              batchCount += 1;
            }
          }
        }
        
        // 배치 크기 제한 체크
        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          batch = admin.firestore().batch(); // 새로운 배치 생성
          batchCount = 0;
        }
      }
      
      // 남은 배치 커밋
      if (batchCount > 0) {
        await batch.commit();
      }
      
      console.log(`[dailyLivePickRewardScheduler] 보상 지급 완료: ${questionRewards.length}개 질문, 총 보상 지급`);
      
    } catch (error) {
      console.error(`[dailyLivePickRewardScheduler] 오류 발생:`, error);
      throw error; // 스케줄러는 재시도 메커니즘을 가지고 있음
    }
  });

// (테스트용으로 사용했던 라이브픽 질문 생성 알림 트리거는 운영에서 사용하지 않기 위해 제거되었습니다.)

/**
 * 모든 user_notifications 생성 시, 해당 유저에게 Expo 푸시까지 함께 전송하는 트리거.
 * - title/body/data 필드를 그대로 사용하여 푸시를 보냅니다.
 */
export const onUserNotificationCreated = functions
  .region('asia-northeast3')
  .firestore
  .document('user_notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    try {
      const data = snap.data() as any;
      const uid = data?.uid as string | undefined;
      const title = data?.title as string | undefined;
      const body = data?.body as string | undefined;

      if (!uid || !title || !body) {
        console.warn('[onUserNotificationCreated] 필수 필드(uid/title/body) 누락, 푸시 생략', {
          uid,
          title,
          body,
        });
        return null;
      }

      await sendUserPushNotification(uid, title, body, data?.data || {});
      console.log('[onUserNotificationCreated] 푸시 전송 완료', { uid, notificationId: context.params.notificationId });
      return null;
    } catch (error: any) {
      console.error('[onUserNotificationCreated] 푸시 전송 중 오류:', error?.message || error);
      return null;
    }
  });

/**
 * 메인 질문(오늘의 질문)에 3일 / 5일 / 10일 연속 참여하지 않은 사용자에게
 * 리마인드 알림을 발송하는 스케줄러 함수입니다.
 *
 * 기준:
 * - users 컬렉션의 lastAnswerDate(YYYYMMDD 정수)를 기준으로 KST 날짜 차이를 계산
 * - 3일, 5일, 10일째 되는 날에만 1회 알림 발송
 */
export const sendInactiveUserNotifications = functions
  .region('asia-northeast3')
  .pubsub
  .schedule('0 4 * * *') // 매일 새벽 4시 (KST)
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    try {
      console.log('[sendInactiveUserNotifications] 시작');

      // 한국 시간 기준 오늘 0시
      const now = new Date();
      const koreaOffsetMinutes = 9 * 60;
      const utcMillis = now.getTime() + now.getTimezoneOffset() * 60000;
      const koreaNow = new Date(utcMillis + koreaOffsetMinutes * 60000);
      koreaNow.setHours(0, 0, 0, 0);

      const todayKey = parseInt(
        `${koreaNow.getFullYear()}${String(koreaNow.getMonth() + 1).padStart(2, '0')}${String(
          koreaNow.getDate(),
        ).padStart(2, '0')}`,
        10,
      );

      console.log('[sendInactiveUserNotifications] todayKey(KST):', todayKey);

      const stages = [
        {
          days: 3,
          code: 'inactive_3',
          title: '3일째 쉬고 있어요 😢',
          body: '오늘 질문부터 다시 시작해볼까요? 연속 보상이 끊기기 전에 돌아와 주세요!',
        },
        {
          days: 5,
          code: 'inactive_5',
          title: '5일째 선택이 멈췄어요 💭',
          body: '한 번 끊기면 다시 시작하기 더 어려워져요. 오늘 30초만 투자해볼까요?',
        },
        {
          days: 10,
          code: 'inactive_10',
          title: '10일째 쉬는 중... 이제 다시 시작하기 딱 좋아요 🔄',
          body: '다시 시작해도 괜찮아요. 오늘 질문부터 천천히 이어가봐요.',
        },
      ];

      const usersSnapshot = await admin.firestore().collection('users').get();
      console.log('[sendInactiveUserNotifications] users count:', usersSnapshot.size);

      let batch = admin.firestore().batch();
      let batchCount = 0;
      const MAX_BATCH_SIZE = 400; // 여유 있게 설정

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data() as { uid?: string; lastAnswerDate?: number };
        const uid = userData.uid || userDoc.id;
        const lastAnswerDate = userData.lastAnswerDate;

        if (!lastAnswerDate) {
          // 아직 한 번도 답변하지 않은 유저는 이번 로직에서는 스킵
          continue;
        }

        const lastStr = String(lastAnswerDate);
        if (lastStr.length !== 8) continue;

        const year = parseInt(lastStr.slice(0, 4), 10);
        const month = parseInt(lastStr.slice(4, 6), 10);
        const day = parseInt(lastStr.slice(6, 8), 10);

        const lastDate = new Date(Date.UTC(year, month - 1, day));
        const todayUtcBase = Date.UTC(
          koreaNow.getFullYear(),
          koreaNow.getMonth(),
          koreaNow.getDate(),
        );
        const diffDays = Math.floor((todayUtcBase - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        const stage = stages.find(s => s.days === diffDays);
        if (!stage) continue;

        // 동일 단계 알림 중복 발송 방지
        const existing = await admin
          .firestore()
          .collection('user_notifications')
          .where('uid', '==', uid)
          .where('type', '==', 'daily_question')
          .where('data.stage', '==', stage.code)
          .limit(1)
          .get();

        if (!existing.empty) continue;

        const notifRef = admin.firestore().collection('user_notifications').doc();
        batch.set(notifRef, {
          uid,
          title: stage.title,
          body: stage.body,
          type: 'daily_question',
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          data: {
            stage: stage.code,
            lastAnswerDate,
          },
        });
        batchCount += 1;

        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          batch = admin.firestore().batch();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      console.log('[sendInactiveUserNotifications] 완료');
      return null;
    } catch (error) {
      console.error('[sendInactiveUserNotifications] 오류:', error);
      throw error;
    }
  });

/**
 * 튜토리얼 3개 미션 완료 시 500P를 지급하는 Callable Function
 */
export const completeTutorialReward = functions
  .region('asia-northeast3')
  .https
  .onCall(async (data, context) => {
    // 인증 확인
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '사용자가 인증되지 않았습니다.'
      );
    }

    const { uid } = data;

    // 파라미터 검증
    if (!uid) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '필수 파라미터가 누락되었습니다: uid'
      );
    }

    // 본인만 호출 가능
    if (context.auth.uid !== uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '본인의 튜토리얼 보상만 받을 수 있습니다.'
      );
    }

    try {
      const userRef = admin.firestore().collection('users').doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          '사용자를 찾을 수 없습니다.'
        );
      }

      const userData = userDoc.data() as any;
      const tutorial = userData.tutorial || {
        mainAnswered: false,
        livepickParticipated: false,
        livepickCreated: false,
        rewardGiven500: false,
      };

      // 이미 보상을 받았으면 중복 지급 방지
      if (tutorial.rewardGiven500) {
        console.log('[completeTutorialReward] 이미 보상을 받은 사용자:', uid);
        return { success: true, alreadyGiven: true };
      }

      // 3개 미션이 모두 완료되었는지 확인
      if (
        !tutorial.mainAnswered ||
        !tutorial.livepickParticipated ||
        !tutorial.livepickCreated
      ) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          '아직 모든 미션을 완료하지 않았습니다.'
        );
      }

      // 포인트 지급 및 튜토리얼 상태 업데이트
      await userRef.update({
        points: admin.firestore.FieldValue.increment(500),
        'tutorial.rewardGiven500': true,
      });

      // 포인트 내역 기록
      const historyRef = admin.firestore().collection('point_history').doc();
      await historyRef.set({
        uid,
        amount: 500,
        reason: 'tutorial_reward',
        description: '튜토리얼 완료 보상',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log('[completeTutorialReward] 500P 지급 완료', { uid });
      return { success: true, points: 500 };
    } catch (error: any) {
      console.error('[completeTutorialReward] 보상 지급 실패:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        'internal',
        '보상 지급에 실패했습니다.'
      );
    }
  });

/**
 * 기기 연동 실행 (Cloud Functions)
 * 원본 기기의 데이터를 대상 기기로 이전하고, 원본 기기 데이터를 삭제합니다.
 * 
 * @param sourceUID 원본 기기 UID
 * @param password 연동 비밀번호
 * @param targetUID 대상 기기 UID (현재 사용자)
 * @param targetDeviceUID 대상 기기의 deviceUID
 * @returns 연동 성공 여부
 */
export const executeDeviceTransfer = functions
  .region('asia-northeast3')
  .runWith({
    timeoutSeconds: 540, // 최대 9분 (Firebase Functions 최대 제한)
    memory: '512MB',
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

    const { sourceUID, password, targetUID, targetDeviceUID } = data;

    // 파라미터 검증
    if (!sourceUID || !password || !targetUID || !targetDeviceUID) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '필수 파라미터가 누락되었습니다: sourceUID, password, targetUID, targetDeviceUID'
      );
    }

    // 본인만 연동 실행 가능
    if (context.auth.uid !== targetUID) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '본인의 연동만 실행할 수 있습니다.'
      );
    }

    // 같은 UID로 이전 시도 방지
    if (sourceUID === targetUID) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '같은 기기로는 연동할 수 없습니다.'
      );
    }

    try {
      console.log(`[executeDeviceTransfer] 연동 실행 시작: ${sourceUID} → ${targetUID}`);

      // 1. 연동 정보 확인
      const transferRef = admin.firestore().collection('device_transfers').doc(sourceUID);
      const transferDoc = await transferRef.get();

      if (!transferDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          '연동 준비 정보를 찾을 수 없습니다.'
        );
      }

      const transferData = transferDoc.data();
      if (!transferData) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          '연동 정보가 유효하지 않습니다.'
        );
      }

      // 비밀번호 확인
      if (transferData.password !== password) {
        throw new functions.https.HttpsError(
          'permission-denied',
          '비밀번호가 일치하지 않습니다.'
        );
      }

      // 만료 확인
      if (transferData.expiresAt) {
        const expiresAt = transferData.expiresAt.toDate();
        if (expiresAt < new Date()) {
          throw new functions.https.HttpsError(
            'deadline-exceeded',
            '연동 준비가 만료되었습니다. (24시간 초과)'
          );
        }
      }

      // 사용 여부 확인
      if (transferData.used === true) {
        throw new functions.https.HttpsError(
          'already-exists',
          '이미 사용된 연동 정보입니다.'
        );
      }

      // 2. 원본 사용자 데이터 가져오기
      const sourceUserRef = admin.firestore().collection('users').doc(sourceUID);
      const sourceUserDoc = await sourceUserRef.get();

      if (!sourceUserDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          '원본 사용자 데이터를 찾을 수 없습니다.'
        );
      }

      const sourceUserData = sourceUserDoc.data();
      if (!sourceUserData) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          '원본 사용자 데이터가 유효하지 않습니다.'
        );
      }

      console.log(`[executeDeviceTransfer] 원본 사용자 데이터 확인 완료: ${sourceUID}`);

      // 3. 대상 기기의 기존 데이터 삭제 (B기기의 새 유저 데이터 제거)
      console.log(`[executeDeviceTransfer] 대상 기기(B기기) 기존 데이터 삭제 시작: ${targetUID}`);

      const targetUserRef = admin.firestore().collection('users').doc(targetUID);
      const targetUserDoc = await targetUserRef.get();
      if (targetUserDoc.exists) {
        await targetUserRef.delete();
        console.log(`[executeDeviceTransfer] 대상 기기 users 문서 삭제 완료: ${targetUID}`);
      }

      // 3-2. 대상 기기 answers 삭제
      const targetAnswersQuery = await admin.firestore()
        .collection('answers')
        .where('uid', '==', targetUID)
        .get();

      if (!targetAnswersQuery.empty) {
        const batch = admin.firestore().batch();
        let batchCount = 0;
        const BATCH_LIMIT = 500;

        for (const answerDoc of targetAnswersQuery.docs) {
          batch.delete(answerDoc.ref);
          batchCount++;

          if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            console.log(`[executeDeviceTransfer] 대상 기기 answers 삭제 배치 커밋: ${batchCount}개`);
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit();
          console.log(`[executeDeviceTransfer] 대상 기기 answers 삭제 최종 배치 커밋: ${batchCount}개`);
        }

        console.log(`[executeDeviceTransfer] 대상 기기 answers 삭제 완료: ${targetAnswersQuery.size}개 문서`);
      }

      // 3-3. 대상 기기 point_history 삭제
      const targetPointHistoryQuery = await admin.firestore()
        .collection('point_history')
        .where('uid', '==', targetUID)
        .get();

      if (!targetPointHistoryQuery.empty) {
        const batch = admin.firestore().batch();
        let batchCount = 0;
        const BATCH_LIMIT = 500;

        for (const historyDoc of targetPointHistoryQuery.docs) {
          batch.delete(historyDoc.ref);
          batchCount++;

          if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            console.log(`[executeDeviceTransfer] 대상 기기 point_history 삭제 배치 커밋: ${batchCount}개`);
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit();
          console.log(`[executeDeviceTransfer] 대상 기기 point_history 삭제 최종 배치 커밋: ${batchCount}개`);
        }

        console.log(`[executeDeviceTransfer] 대상 기기 point_history 삭제 완료: ${targetPointHistoryQuery.size}개 문서`);
      }

      // 3-4. 대상 기기 livepick_participations 삭제
      const targetParticipationsQuery = await admin.firestore()
        .collection('livepick_participations')
        .where('uid', '==', targetUID)
        .get();

      if (!targetParticipationsQuery.empty) {
        const batch = admin.firestore().batch();
        let batchCount = 0;
        const BATCH_LIMIT = 500;

        for (const participationDoc of targetParticipationsQuery.docs) {
          batch.delete(participationDoc.ref);
          batchCount++;

          if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            console.log(`[executeDeviceTransfer] 대상 기기 livepick_participations 삭제 배치 커밋: ${batchCount}개`);
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit();
          console.log(`[executeDeviceTransfer] 대상 기기 livepick_participations 삭제 최종 배치 커밋: ${batchCount}개`);
        }

        console.log(`[executeDeviceTransfer] 대상 기기 livepick_participations 삭제 완료: ${targetParticipationsQuery.size}개 문서`);
      }

      // 3-5. 대상 기기 user_push_tokens 삭제
      try {
        const targetPushTokenRef = admin.firestore().collection('user_push_tokens').doc(targetUID);
        const targetPushTokenDoc = await targetPushTokenRef.get();
        if (targetPushTokenDoc.exists) {
          await targetPushTokenRef.delete();
          console.log(`[executeDeviceTransfer] 대상 기기 user_push_tokens 삭제 완료`);
        }
      } catch (pushTokenDeleteError) {
        console.warn('[executeDeviceTransfer] 대상 기기 user_push_tokens 삭제 실패 (무시):', pushTokenDeleteError);
      }

      // 3-6. 대상 기기 user_notifications 삭제
      const targetNotificationsQuery = await admin.firestore()
        .collection('user_notifications')
        .where('uid', '==', targetUID)
        .get();

      if (!targetNotificationsQuery.empty) {
        const batch = admin.firestore().batch();
        let batchCount = 0;
        const BATCH_LIMIT = 500;

        for (const notificationDoc of targetNotificationsQuery.docs) {
          batch.delete(notificationDoc.ref);
          batchCount++;

          if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            console.log(`[executeDeviceTransfer] 대상 기기 user_notifications 삭제 배치 커밋: ${batchCount}개`);
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit();
          console.log(`[executeDeviceTransfer] 대상 기기 user_notifications 삭제 최종 배치 커밋: ${batchCount}개`);
        }

        console.log(`[executeDeviceTransfer] 대상 기기 user_notifications 삭제 완료: ${targetNotificationsQuery.size}개 문서`);
      }

      console.log(`[executeDeviceTransfer] 대상 기기(B기기) 기존 데이터 삭제 완료: ${targetUID}`);

      // 4. 대상 기기에 A기기 데이터 복사
      const targetUserData = {
        ...sourceUserData,
        uid: targetUID,
        deviceUID: targetDeviceUID,
        // createdAt은 유지 (기존 사용자의 시작일 유지)
        // tutorial 필드도 포함되어 마이그레이션됨 (rewardGiven500 포함)
      };

      // createdAt 필드 마이그레이션 확인 로그
      if (sourceUserData.createdAt) {
        const createdAtValue = sourceUserData.createdAt;
        if (createdAtValue.toDate) {
          console.log(`[executeDeviceTransfer] createdAt 마이그레이션:`, {
            timestamp: createdAtValue.toDate().toISOString(),
            source: 'Timestamp',
          });
        } else if (createdAtValue instanceof Date) {
          console.log(`[executeDeviceTransfer] createdAt 마이그레이션:`, {
            date: createdAtValue.toISOString(),
            source: 'Date',
          });
        } else {
          console.log(`[executeDeviceTransfer] createdAt 마이그레이션:`, {
            value: createdAtValue,
            source: 'unknown',
          });
        }
      } else {
        console.warn(`[executeDeviceTransfer] ⚠️ createdAt 필드가 없습니다!`);
      }

      // tutorial 필드 마이그레이션 확인 로그
      if (sourceUserData.tutorial) {
        console.log(`[executeDeviceTransfer] tutorial 필드 마이그레이션:`, {
          mainAnswered: sourceUserData.tutorial.mainAnswered,
          livepickParticipated: sourceUserData.tutorial.livepickParticipated,
          livepickCreated: sourceUserData.tutorial.livepickCreated,
          rewardGiven500: sourceUserData.tutorial.rewardGiven500,
        });
      } else {
        console.log(`[executeDeviceTransfer] tutorial 필드 없음 (새 유저)`);
      }

      await targetUserRef.set(targetUserData);
      console.log(`[executeDeviceTransfer] 대상 기기 데이터 복사 완료: ${targetUID}`);

      // 5. answers 컬렉션 마이그레이션
      console.log(`[executeDeviceTransfer] answers 컬렉션 마이그레이션 시작: sourceUID=${sourceUID}, targetUID=${targetUID}`);
      const sourceAnswersQuery = await admin.firestore()
        .collection('answers')
        .where('uid', '==', sourceUID)
        .get();

      console.log(`[executeDeviceTransfer] answers 쿼리 결과: ${sourceAnswersQuery.size}개 문서 발견`);
      
      // answers 마이그레이션 전 요약 로그
      if (!sourceAnswersQuery.empty) {
        const answerQuestionIds = sourceAnswersQuery.docs
          .map(doc => doc.data().question_id)
          .filter(id => id) // question_id가 있는 것만
          .slice(0, 10); // 최대 10개만 로그
        console.log(`[executeDeviceTransfer] answers 마이그레이션 대상 (샘플):`, answerQuestionIds);
      }
      
      if (!sourceAnswersQuery.empty) {
        let batch = admin.firestore().batch();
        let batchCount = 0;
        const BATCH_LIMIT = 500;

        for (const answerDoc of sourceAnswersQuery.docs) {
          const answerData = answerDoc.data();
          const questionId = answerData.question_id;
          
          if (!questionId) {
            console.warn(`[executeDeviceTransfer] question_id가 없는 답변 문서 건너뜀: ${answerDoc.id}`);
            continue;
          }
          
          const newAnswerDocId = `${targetUID}_${questionId}`;
          const newAnswerRef = admin.firestore().collection('answers').doc(newAnswerDocId);
          
          // set()을 사용하여 기존 문서가 있으면 덮어쓰기 (연동 시 덮어쓰는 것이 정상 동작)
          batch.set(newAnswerRef, {
            ...answerData,
            uid: targetUID,
          });
          batchCount++;

          if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            console.log(`[executeDeviceTransfer] answers 마이그레이션 배치 커밋: ${batchCount}개`);
            batchCount = 0;
            // 새로운 배치 생성
            batch = admin.firestore().batch();
          }
        }

        if (batchCount > 0) {
          await batch.commit();
          console.log(`[executeDeviceTransfer] answers 마이그레이션 최종 배치 커밋: ${batchCount}개`);
        }

        console.log(`[executeDeviceTransfer] answers 컬렉션 마이그레이션 완료: ${sourceAnswersQuery.size}개 문서 복사됨`);
      } else {
        console.log(`[executeDeviceTransfer] answers 컬렉션에 마이그레이션할 문서 없음`);
      }

      // 6. point_history 컬렉션 마이그레이션
      try {
        const sourcePointHistoryQuery = await admin.firestore()
          .collection('point_history')
          .where('uid', '==', sourceUID)
          .get();

        if (!sourcePointHistoryQuery.empty) {
          const batch = admin.firestore().batch();
          let batchCount = 0;
          const BATCH_LIMIT = 500;

          for (const historyDoc of sourcePointHistoryQuery.docs) {
            const historyData = historyDoc.data();
            const newHistoryRef = admin.firestore().collection('point_history').doc();

            batch.set(newHistoryRef, {
              ...historyData,
              uid: targetUID,
            });
            batchCount++;

            if (batchCount >= BATCH_LIMIT) {
              await batch.commit();
              console.log(`[executeDeviceTransfer] point_history 마이그레이션 배치 커밋: ${batchCount}개`);
              batchCount = 0;
            }
          }

          if (batchCount > 0) {
            await batch.commit();
            console.log(`[executeDeviceTransfer] point_history 마이그레이션 최종 배치 커밋: ${batchCount}개`);
          }

          console.log(`[executeDeviceTransfer] point_history 컬렉션 마이그레이션 완료: ${sourcePointHistoryQuery.size}개 문서`);
        }
      } catch (pointHistoryError) {
        console.warn('[executeDeviceTransfer] point_history 마이그레이션 실패 (무시):', pointHistoryError);
      }

      // 7. livepick_participations 컬렉션 마이그레이션
      let sourceParticipationsQuery: admin.firestore.QuerySnapshot | null = null;
      try {
        sourceParticipationsQuery = await admin.firestore()
          .collection('livepick_participations')
          .where('uid', '==', sourceUID)
          .get();

        if (!sourceParticipationsQuery.empty) {
          const batch = admin.firestore().batch();
          let batchCount = 0;
          const BATCH_LIMIT = 500;

          for (const participationDoc of sourceParticipationsQuery.docs) {
            const participationData = participationDoc.data();
            const questionId = participationData.questionId;
            const newParticipationDocId = `${targetUID}_${questionId}`;
            const newParticipationRef = admin.firestore().collection('livepick_participations').doc(newParticipationDocId);

            batch.set(newParticipationRef, {
              ...participationData,
              uid: targetUID,
            });
            batchCount++;

            if (batchCount >= BATCH_LIMIT) {
              await batch.commit();
              console.log(`[executeDeviceTransfer] livepick_participations 마이그레이션 배치 커밋: ${batchCount}개`);
              batchCount = 0;
            }
          }

          if (batchCount > 0) {
            await batch.commit();
            console.log(`[executeDeviceTransfer] livepick_participations 마이그레이션 최종 배치 커밋: ${batchCount}개`);
          }

          console.log(`[executeDeviceTransfer] livepick_participations 컬렉션 마이그레이션 완료: ${sourceParticipationsQuery.size}개 문서`);
        }
      } catch (participationsError) {
        console.warn('[executeDeviceTransfer] livepick_participations 마이그레이션 실패 (무시):', participationsError);
      }

      // 7-1. livepick_questions 컬렉션 마이그레이션 (사용자가 만든 질문의 createdBy 업데이트)
      let sourceQuestionsQuery: admin.firestore.QuerySnapshot | null = null;
      try {
        sourceQuestionsQuery = await admin.firestore()
          .collection('livepick_questions')
          .where('createdBy', '==', sourceUID)
          .get();

        if (!sourceQuestionsQuery.empty) {
          const batch = admin.firestore().batch();
          let batchCount = 0;
          const BATCH_LIMIT = 500;

          for (const questionDoc of sourceQuestionsQuery.docs) {
            batch.update(questionDoc.ref, {
              createdBy: targetUID,
            });
            batchCount++;

            if (batchCount >= BATCH_LIMIT) {
              await batch.commit();
              console.log(`[executeDeviceTransfer] livepick_questions 마이그레이션 배치 커밋: ${batchCount}개`);
              batchCount = 0;
            }
          }

          if (batchCount > 0) {
            await batch.commit();
            console.log(`[executeDeviceTransfer] livepick_questions 마이그레이션 최종 배치 커밋: ${batchCount}개`);
          }

          console.log(`[executeDeviceTransfer] livepick_questions 컬렉션 마이그레이션 완료: ${sourceQuestionsQuery.size}개 문서`);
        }
      } catch (questionsError) {
        console.warn('[executeDeviceTransfer] livepick_questions 마이그레이션 실패 (무시):', questionsError);
      }

      // 8. user_push_tokens 컬렉션 마이그레이션 (선택적 - 새 기기에서 다시 등록할 수 있음)
      try {
        const sourcePushTokenRef = admin.firestore().collection('user_push_tokens').doc(sourceUID);
        const sourcePushTokenDoc = await sourcePushTokenRef.get();

        if (sourcePushTokenDoc.exists) {
          const pushTokenData = sourcePushTokenDoc.data();
          if (pushTokenData) {
            const targetPushTokenRef = admin.firestore().collection('user_push_tokens').doc(targetUID);
            await targetPushTokenRef.set({
              ...pushTokenData,
              uid: targetUID,
            });
            console.log(`[executeDeviceTransfer] user_push_tokens 마이그레이션 완료`);
          }
        }
      } catch (pushTokenError) {
        console.warn('[executeDeviceTransfer] user_push_tokens 마이그레이션 실패 (무시):', pushTokenError);
      }

      // 9. user_notifications 컬렉션 마이그레이션
      try {
        const sourceNotificationsQuery = await admin.firestore()
          .collection('user_notifications')
          .where('uid', '==', sourceUID)
          .get();

        if (!sourceNotificationsQuery.empty) {
          const batch = admin.firestore().batch();
          let batchCount = 0;
          const BATCH_LIMIT = 500;

          for (const notificationDoc of sourceNotificationsQuery.docs) {
            const notificationData = notificationDoc.data();
            const newNotificationRef = admin.firestore().collection('user_notifications').doc();

            batch.set(newNotificationRef, {
              ...notificationData,
              uid: targetUID,
            });
            batchCount++;

            if (batchCount >= BATCH_LIMIT) {
              await batch.commit();
              console.log(`[executeDeviceTransfer] user_notifications 마이그레이션 배치 커밋: ${batchCount}개`);
              batchCount = 0;
            }
          }

          if (batchCount > 0) {
            await batch.commit();
            console.log(`[executeDeviceTransfer] user_notifications 마이그레이션 최종 배치 커밋: ${batchCount}개`);
          }

          console.log(`[executeDeviceTransfer] user_notifications 컬렉션 마이그레이션 완료: ${sourceNotificationsQuery.size}개 문서`);
        }
      } catch (notificationsError) {
        console.warn('[executeDeviceTransfer] user_notifications 마이그레이션 실패 (무시):', notificationsError);
      }

      // 10. 원본 기기(A기기) 데이터 삭제 시작
      console.log(`[executeDeviceTransfer] 원본 기기 데이터 삭제 시작: ${sourceUID}`);

      // 10-1. 원본 users 삭제
      await sourceUserRef.delete();
      console.log(`[executeDeviceTransfer] 원본 사용자 데이터 삭제 완료: ${sourceUID}`);

      // 10-2. 원본 answers 삭제 (다시 쿼리)
      try {
        const sourceAnswersDeleteQuery = await admin.firestore()
          .collection('answers')
          .where('uid', '==', sourceUID)
          .get();

        if (!sourceAnswersDeleteQuery.empty) {
          const batch = admin.firestore().batch();
          let batchCount = 0;
          const BATCH_LIMIT = 500;

          for (const answerDoc of sourceAnswersDeleteQuery.docs) {
            batch.delete(answerDoc.ref);
            batchCount++;

            if (batchCount >= BATCH_LIMIT) {
              await batch.commit();
              console.log(`[executeDeviceTransfer] 원본 answers 삭제 배치 커밋: ${batchCount}개`);
              batchCount = 0;
            }
          }

          if (batchCount > 0) {
            await batch.commit();
            console.log(`[executeDeviceTransfer] 원본 answers 삭제 최종 배치 커밋: ${batchCount}개`);
          }

          console.log(`[executeDeviceTransfer] 원본 answers 삭제 완료: ${sourceAnswersDeleteQuery.size}개 문서`);
        }
      } catch (answersDeleteError) {
        console.warn('[executeDeviceTransfer] 원본 answers 삭제 실패 (무시):', answersDeleteError);
      }

      // 10-3. 원본 point_history 삭제
      try {
        const sourcePointHistoryQuery = await admin.firestore()
          .collection('point_history')
          .where('uid', '==', sourceUID)
          .get();

        if (!sourcePointHistoryQuery.empty) {
          const batch = admin.firestore().batch();
          let batchCount = 0;
          const BATCH_LIMIT = 500;

          for (const historyDoc of sourcePointHistoryQuery.docs) {
            batch.delete(historyDoc.ref);
            batchCount++;

            if (batchCount >= BATCH_LIMIT) {
              await batch.commit();
              console.log(`[executeDeviceTransfer] 원본 point_history 삭제 배치 커밋: ${batchCount}개`);
              batchCount = 0;
            }
          }

          if (batchCount > 0) {
            await batch.commit();
            console.log(`[executeDeviceTransfer] 원본 point_history 삭제 최종 배치 커밋: ${batchCount}개`);
          }

          console.log(`[executeDeviceTransfer] 원본 point_history 삭제 완료: ${sourcePointHistoryQuery.size}개 문서`);
        }
      } catch (pointHistoryDeleteError) {
        console.warn('[executeDeviceTransfer] 원본 point_history 삭제 실패 (무시):', pointHistoryDeleteError);
      }

      // 10-4. 원본 livepick_participations 삭제 (다시 쿼리)
      try {
        const sourceParticipationsDeleteQuery = await admin.firestore()
          .collection('livepick_participations')
          .where('uid', '==', sourceUID)
          .get();

        if (!sourceParticipationsDeleteQuery.empty) {
          const batch = admin.firestore().batch();
          let batchCount = 0;
          const BATCH_LIMIT = 500;

          for (const participationDoc of sourceParticipationsDeleteQuery.docs) {
            batch.delete(participationDoc.ref);
            batchCount++;

            if (batchCount >= BATCH_LIMIT) {
              await batch.commit();
              console.log(`[executeDeviceTransfer] 원본 livepick_participations 삭제 배치 커밋: ${batchCount}개`);
              batchCount = 0;
            }
          }

          if (batchCount > 0) {
            await batch.commit();
            console.log(`[executeDeviceTransfer] 원본 livepick_participations 삭제 최종 배치 커밋: ${batchCount}개`);
          }

          console.log(`[executeDeviceTransfer] 원본 livepick_participations 삭제 완료: ${sourceParticipationsDeleteQuery.size}개 문서`);
        }
      } catch (participationsDeleteError) {
        console.warn('[executeDeviceTransfer] 원본 livepick_participations 삭제 실패 (무시):', participationsDeleteError);
      }

      // 10-4-1. 원본 livepick_questions 삭제는 하지 않음 (createdBy만 업데이트했으므로 질문은 유지)
      // 질문 자체는 삭제하지 않고, createdBy만 targetUID로 업데이트했으므로 질문은 그대로 유지됩니다.

      // 10-5. 원본 user_push_tokens 삭제
      try {
        const sourcePushTokenRef = admin.firestore().collection('user_push_tokens').doc(sourceUID);
        const sourcePushTokenDoc = await sourcePushTokenRef.get();
        if (sourcePushTokenDoc.exists) {
          await sourcePushTokenRef.delete();
          console.log(`[executeDeviceTransfer] 원본 user_push_tokens 삭제 완료`);
        }
      } catch (pushTokenDeleteError) {
        console.warn('[executeDeviceTransfer] 원본 user_push_tokens 삭제 실패 (무시):', pushTokenDeleteError);
      }

      // 10-6. 원본 user_notifications 삭제
      try {
        const sourceNotificationsQuery = await admin.firestore()
          .collection('user_notifications')
          .where('uid', '==', sourceUID)
          .get();

        if (!sourceNotificationsQuery.empty) {
          const batch = admin.firestore().batch();
          let batchCount = 0;
          const BATCH_LIMIT = 500;

          for (const notificationDoc of sourceNotificationsQuery.docs) {
            batch.delete(notificationDoc.ref);
            batchCount++;

            if (batchCount >= BATCH_LIMIT) {
              await batch.commit();
              console.log(`[executeDeviceTransfer] 원본 user_notifications 삭제 배치 커밋: ${batchCount}개`);
              batchCount = 0;
            }
          }

          if (batchCount > 0) {
            await batch.commit();
            console.log(`[executeDeviceTransfer] 원본 user_notifications 삭제 최종 배치 커밋: ${batchCount}개`);
          }

          console.log(`[executeDeviceTransfer] 원본 user_notifications 삭제 완료: ${sourceNotificationsQuery.size}개 문서`);
        }
      } catch (notificationsDeleteError) {
        console.warn('[executeDeviceTransfer] 원본 user_notifications 삭제 실패 (무시):', notificationsDeleteError);
      }

      console.log(`[executeDeviceTransfer] 원본 기기 모든 데이터 삭제 완료: ${sourceUID}`);

      // 11. 연동 정보를 사용됨으로 표시
      await transferRef.update({
        used: true,
        transferredTo: targetUID,
        transferredAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[executeDeviceTransfer] 연동 완료: ${sourceUID} → ${targetUID}`);
      return { success: true };

    } catch (error: any) {
      console.error('[executeDeviceTransfer] 연동 실패:', error);
      
      // HttpsError는 그대로 throw
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      // 기타 에러는 internal로 변환
      throw new functions.https.HttpsError(
        'internal',
        error.message || '연동 중 오류가 발생했습니다.'
      );
    }
  });

/**
 * 사용자 데이터 복구 마이그레이션 Cloud Function
 * 관리자 또는 본인이 호출할 수 있습니다.
 */
export const migrateUserData = functions
  .region('asia-northeast3')
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
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

    const { sourceUID, targetUID } = data;

    // 파라미터 검증
    if (!sourceUID || !targetUID) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '필수 파라미터가 누락되었습니다: sourceUID, targetUID'
      );
    }

<<<<<<< HEAD
    // 관리자 이메일 목록 (Firestore 규칙과 일치)
    const adminEmails: string[] = [
      'admin@pickplay.kr', // 실제 관리자 이메일로 변경 필요
    ];

    // 권한 확인: 관리자이거나 targetUID가 본인인 경우만 허용
    const userEmail = context.auth.token?.email || '';
    const isAdmin = adminEmails.includes(userEmail);
=======
    // 관리자 이메일 목록 (Firestore 규칙과 동일)
    const adminEmails: string[] = [
      'cream83779@gmail.com',
      'kwcc2020@naver.com',
    ];

    // 권한 확인: 관리자이거나 targetUID가 본인인 경우만 허용
    const userEmail = context.auth.token.email as string | undefined;
    const isAdmin = userEmail ? adminEmails.includes(userEmail) : false;
>>>>>>> cb79e61 (愿由ъ옄 泥댄겕瑜??대찓??湲곕컲?쇰줈 ?섏젙 (Firestore 洹쒖튃怨??쇱튂))
    const isSelf = context.auth.uid === targetUID;

    if (!isAdmin && !isSelf) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '관리자 또는 본인만 데이터를 마이그레이션할 수 있습니다.'
      );
    }

    try {
      console.log(`[migrateUserData] 마이그레이션 시작: sourceUID=${sourceUID}, targetUID=${targetUID}, caller=${context.auth.uid}, isAdmin=${isAdmin}`);

      // 1. 소스 사용자 문서 확인
      const sourceUserRef = admin.firestore().collection('users').doc(sourceUID);
      const sourceUserDoc = await sourceUserRef.get();

      if (!sourceUserDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          '소스 사용자 문서를 찾을 수 없습니다.'
        );
      }

      const sourceUserData = sourceUserDoc.data() as any;
      console.log(`[migrateUserData] 소스 사용자 데이터 확인:`, {
        nickname: sourceUserData.nickname,
        points: sourceUserData.points,
        streakCount: sourceUserData.streakCount,
        totalSelections: sourceUserData.totalSelections,
      });

      // 2. 타겟 사용자 문서 확인 (없으면 생성)
      const targetUserRef = admin.firestore().collection('users').doc(targetUID);
      const targetUserDoc = await targetUserRef.get();

      if (!targetUserDoc.exists) {
        // 타겟 사용자 문서가 없으면 생성 (기본 데이터로)
        await targetUserRef.set({
          uid: targetUID,
          deviceUID: sourceUserData.deviceUID || null,
          createdAt: sourceUserData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          totalSelections: 0,
          characterId: null,
          adjective1: null,
          adjective2: null,
          points: 0,
          streakCount: 0,
          lastAnswerDate: 0,
          nickname: sourceUserData.nickname || '복구된 사용자',
          tutorial: sourceUserData.tutorial || {
            mainAnswered: false,
            livepickParticipated: false,
            livepickCreated: false,
            rewardGiven500: false,
          },
        });
        console.log(`[migrateUserData] 타겟 사용자 문서 생성 완료`);
      }

      // 3. 타겟 사용자 데이터 업데이트 (소스 데이터로 덮어쓰기)
      const targetUserData = {
        ...sourceUserData,
        uid: targetUID,
        // deviceUID는 타겟 사용자의 것을 유지 (없으면 소스 것 사용)
        deviceUID: targetUserDoc.exists && targetUserDoc.data()?.deviceUID 
          ? targetUserDoc.data()?.deviceUID 
          : sourceUserData.deviceUID,
        // createdAt은 소스 사용자의 것을 유지 (기존 사용자의 시작일 유지)
        createdAt: sourceUserData.createdAt,
      };

      await targetUserRef.set(targetUserData);
      console.log(`[migrateUserData] 타겟 사용자 데이터 업데이트 완료`);

      // 4. answers 컬렉션 마이그레이션
      console.log(`[migrateUserData] answers 컬렉션 마이그레이션 시작`);
      const sourceAnswersQuery = await admin.firestore()
        .collection('answers')
        .where('uid', '==', sourceUID)
        .get();

      console.log(`[migrateUserData] answers 쿼리 결과: ${sourceAnswersQuery.size}개 문서 발견`);

      if (!sourceAnswersQuery.empty) {
        let batch = admin.firestore().batch();
        let batchCount = 0;
        const BATCH_LIMIT = 500;

        for (const answerDoc of sourceAnswersQuery.docs) {
          const answerData = answerDoc.data();
          const questionId = answerData.question_id;

          if (!questionId) {
            console.warn(`[migrateUserData] question_id가 없는 답변 문서 건너뜀: ${answerDoc.id}`);
            continue;
          }

          const newAnswerDocId = `${targetUID}_${questionId}`;
          const newAnswerRef = admin.firestore().collection('answers').doc(newAnswerDocId);

          // 이미 존재하는지 확인
          const existingDoc = await newAnswerRef.get();
          if (existingDoc.exists) {
            console.log(`[migrateUserData] 이미 존재하는 답변 건너뜀: ${newAnswerDocId}`);
            continue;
          }

          batch.set(newAnswerRef, {
            ...answerData,
            uid: targetUID,
          });
          batchCount++;

          if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            console.log(`[migrateUserData] answers 마이그레이션 배치 커밋: ${batchCount}개`);
            batchCount = 0;
            batch = admin.firestore().batch();
          }
        }

        if (batchCount > 0) {
          await batch.commit();
          console.log(`[migrateUserData] answers 마이그레이션 최종 배치 커밋: ${batchCount}개`);
        }

        console.log(`[migrateUserData] answers 컬렉션 마이그레이션 완료: ${sourceAnswersQuery.size}개 문서 복사됨`);
      } else {
        console.log(`[migrateUserData] answers 컬렉션에 마이그레이션할 문서 없음`);
      }

      // 5. point_history 컬렉션 마이그레이션
      try {
        const sourcePointHistoryQuery = await admin.firestore()
          .collection('point_history')
          .where('uid', '==', sourceUID)
          .get();

        if (!sourcePointHistoryQuery.empty) {
          let batch = admin.firestore().batch();
          let batchCount = 0;
          const BATCH_LIMIT = 500;

          for (const historyDoc of sourcePointHistoryQuery.docs) {
            const historyData = historyDoc.data();
            const newHistoryRef = admin.firestore().collection('point_history').doc();

            batch.set(newHistoryRef, {
              ...historyData,
              uid: targetUID,
            });
            batchCount++;

            if (batchCount >= BATCH_LIMIT) {
              await batch.commit();
              console.log(`[migrateUserData] point_history 마이그레이션 배치 커밋: ${batchCount}개`);
              batchCount = 0;
              batch = admin.firestore().batch();
            }
          }

          if (batchCount > 0) {
            await batch.commit();
            console.log(`[migrateUserData] point_history 마이그레이션 최종 배치 커밋: ${batchCount}개`);
          }

          console.log(`[migrateUserData] point_history 컬렉션 마이그레이션 완료: ${sourcePointHistoryQuery.size}개 문서 복사됨`);
        }
      } catch (pointHistoryError) {
        console.warn('[migrateUserData] point_history 마이그레이션 실패 (무시):', pointHistoryError);
      }

      // 6. livepick_participations 마이그레이션
      try {
        const sourceParticipationsQuery = await admin.firestore()
          .collection('livepick_participations')
          .where('uid', '==', sourceUID)
          .get();

        if (!sourceParticipationsQuery.empty) {
          let batch = admin.firestore().batch();
          let batchCount = 0;
          const BATCH_LIMIT = 500;

          for (const participationDoc of sourceParticipationsQuery.docs) {
            const participationData = participationDoc.data();
            const newParticipationRef = admin.firestore().collection('livepick_participations').doc();

            batch.set(newParticipationRef, {
              ...participationData,
              uid: targetUID,
            });
            batchCount++;

            if (batchCount >= BATCH_LIMIT) {
              await batch.commit();
              console.log(`[migrateUserData] livepick_participations 마이그레이션 배치 커밋: ${batchCount}개`);
              batchCount = 0;
              batch = admin.firestore().batch();
            }
          }

          if (batchCount > 0) {
            await batch.commit();
            console.log(`[migrateUserData] livepick_participations 마이그레이션 최종 배치 커밋: ${batchCount}개`);
          }

          console.log(`[migrateUserData] livepick_participations 컬렉션 마이그레이션 완료: ${sourceParticipationsQuery.size}개 문서 복사됨`);
        }
      } catch (participationsError) {
        console.warn('[migrateUserData] livepick_participations 마이그레이션 실패 (무시):', participationsError);
      }

      // 7. 소스 사용자 문서에 복구 정보 추가
      await sourceUserRef.update({
        recoveredToUID: targetUID,
        recoveredAt: admin.firestore.FieldValue.serverTimestamp(),
        recoveredBy: context.auth.uid,
      } as any);
      console.log(`[migrateUserData] 소스 사용자 문서에 복구 정보 추가 완료`);

      console.log(`[migrateUserData] 마이그레이션 완료: sourceUID=${sourceUID}, targetUID=${targetUID}`);
      return {
        success: true,
        message: '사용자 데이터 마이그레이션이 완료되었습니다.',
      };
    } catch (error: any) {
      console.error('[migrateUserData] 마이그레이션 실패:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        'internal',
        `마이그레이션 중 오류가 발생했습니다: ${error.message}`
      );
    }
  });

