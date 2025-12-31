import firestore from '@react-native-firebase/firestore';
import { Question, UserData } from '../../types';
import { ensureAnonymousAuth, getFunctions } from '../firebase';
import { currentDateKey } from '../../utils/date';
import { scheduleStreakNotification } from '../notifications';
import { isLegacyUser, assignCharacter_LogicA, updateAdjectives_LogicB } from './character';

/**
 * [V2] Firebase Cloud Function을 호출하여 AI 태그를 생성합니다.
 * @param question 질문 객체
 * @param selectedOptionText 사용자가 선택한 선택지 텍스트
 * @returns 생성된 태그 배열 (string[])
 */
const generateTagsWithAI = async (question: Question, selectedOptionText: string): Promise<string[]> => {
  console.log(`[AI] Cloud Function 'generateTags' 호출 시작...`);
  try {
    // 보장: 인증 토큰 포함되어 호출되도록 익명 인증 확보
    const user = await ensureAnonymousAuth();
    
    if (!user) {
      console.warn('[AI] 사용자 인증 실패 - 빈 태그 반환');
      return [];
    }
    
    console.log(`[AI] 인증된 사용자: ${user.uid}`);
    
    // 약간의 딜레이를 주어 토큰이 전파되도록 함
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Cloud Functions 호출 (asia-northeast3 리전에 배포된 함수)
    // React Native Firebase는 region() 메서드를 지원하지 않으므로 URL로 직접 호출
    const functions = getFunctions();
    const generateTags = functions.httpsCallableFromUrl(
      'https://asia-northeast3-today-balance-fa0a5.cloudfunctions.net/generateTags'
    );
    const result = await generateTags({
      questionId: question.question_id,
      selectedText: selectedOptionText,
      questionDomain: question.domain,
    });
    const tags = (result.data as any).tags;
    if (!Array.isArray(tags)) {
      throw new Error("Cloud Function 응답 형식이 올바르지 않습니다.");
    }

    console.log(`[AI] 태그 생성 완료: [${tags.join(', ')}]`);
    return tags;
  } catch (error) {
    console.error("❌ Cloud Function 호출 실패:", error);
    
    // AI 실패 시 폴백 태그 제공 (도메인별)
    let tags: string[] = [];
    
    if (question.domain === '감정' || question.domain === '가치관') {
      // 감정/가치관 도메인 폴백
      const emotionFallbackTags = ['뜨거운', '차가운', '유연한', '예민한', '느긋한', '충동적인', '냉정한', '감성적인'];
      const randomIndex = selectedOptionText.length % emotionFallbackTags.length;
      tags = [emotionFallbackTags[randomIndex]];
    } else if (question.domain === '습관' || question.domain === '관계') {
      // 습관/관계 도메인 폴백
      const habitFallbackTags = ['전략가', '탐험가', '중재자', '창조자', '분석가', '수호자', '설득가', '통찰자', '협상가', '봉사가', '연구가', '추진가', '활동가', '행동가', '인내가', '관찰자', '통솔가', '보호자'];
      const randomIndex = selectedOptionText.length % habitFallbackTags.length;
      tags = [habitFallbackTags[randomIndex]];
    }
    
    console.warn("🔄 AI 실패로 인한 폴백 태그 사용:", tags);
    return tags;
  }
};

/**
 * [V2] 사용자의 답변을 빠르게 저장합니다 (AI 태그 없이, 백그라운드에서 업데이트).
 * 보상받기 버튼을 즉시 표시하기 위해 사용됩니다.
 * @throws "오늘 이미 답변했습니다." - 중복 답변 시 에러 발생
 */
export const saveAnswerQuick = async (userData: UserData, question: Question, selectedOptionIndex: 0 | 1): Promise<void> => {
  const todayKey = currentDateKey();
  
  // 테스트 유저는 하루 한 번 제한 없음
  const TEST_UIDS = ['vUlyeAhYmneB5Ii6oPNR8OFCQZg1', 'C1iSsR85GoTnvVRSY2nIn9y6ZFz1'];
  if (!TEST_UIDS.includes(userData.uid) && userData.lastAnswerDate === todayKey) {
    console.warn(`[Vote] User ${userData.uid} has already voted today. Aborting.`);
    throw new Error("오늘 이미 답변했습니다.");
  }

  const { uid } = userData;
  const selectedOptionText = selectedOptionIndex === 0 ? question.option_1_text : question.option_2_text;

  // 문서 ID: '{uid}_{questionId}' 고정
  const docId = `${uid}_${question.question_id}`;
  const answerRef = firestore().collection('answers').doc(docId);
  
  // AI 태그 없이 먼저 저장 (빈 배열로 저장, 나중에 백그라운드에서 업데이트)
  const answerData = {
    uid,
    question_id: question.question_id,
    selected_option_index: selectedOptionIndex,
    selected_option_text: selectedOptionText,
    tags: [], // AI 태그는 백그라운드에서 업데이트
    rewarded: false,
    answeredAt: firestore.FieldValue.serverTimestamp(),
  };
  
  await answerRef.set(answerData);
  console.log(`[QuickSave] 답변 빠르게 저장 완료: Doc ID = ${uid}_${question.question_id}`);
  
  // 백그라운드에서 AI 태그 생성 및 업데이트 (비동기, 에러 무시)
  generateTagsWithAI(question, selectedOptionText)
    .then((generatedTags) => {
      console.log(`[QuickSave] AI 태그 생성 완료, answers 문서 업데이트: [${generatedTags.join(', ')}]`);
      return answerRef.update({ tags: generatedTags });
    })
    .catch((error) => {
      console.warn('[QuickSave] AI 태그 생성 또는 업데이트 실패 (무시 가능):', error);
    });
};

/**
 * [V2] 사용자의 답변을 저장하고, 연속 참여일수 업데이트 및 캐릭터 로직을 처리합니다.
 * @throws "오늘 이미 답변했습니다." - 중복 답변 시 에러 발생
 */
export const saveAnswerAndProcessLogic = async (userData: UserData, question: Question, selectedOptionIndex: 0 | 1): Promise<UserData> => {
  const todayKey = currentDateKey();
  
  // 테스트 유저는 하루 한 번 제한 없음
  const TEST_UIDS = ['vUlyeAhYmneB5Ii6oPNR8OFCQZg1', 'C1iSsR85GoTnvVRSY2nIn9y6ZFz1'];
  if (!TEST_UIDS.includes(userData.uid) && userData.lastAnswerDate === todayKey) {
    console.warn(`[Vote] User ${userData.uid} has already voted today. Aborting.`);
    throw new Error("오늘 이미 답변했습니다.");
  }

  const { uid } = userData;
  const userRef = firestore().collection('users').doc(uid);
  const selectedOptionText = selectedOptionIndex === 0 ? question.option_1_text : question.option_2_text;

  // 문서 ID: '{uid}_{questionId}' 고정
  const docId = `${uid}_${question.question_id}`;
  const answerRef = firestore().collection('answers').doc(docId);
  
  // 기존 답변이 이미 저장되어 있는지 확인 (saveAnswerQuick에서 저장했을 수 있음)
  const existingAnswer = await answerRef.get();
  if (existingAnswer.exists) {
    console.log(`[Logic] 답변 문서가 이미 존재함 (saveAnswerQuick에서 저장됨). AI 태그는 백그라운드에서 처리됨: Doc ID = ${uid}_${question.question_id}`);
    // saveAnswerQuick에서 이미 백그라운드로 AI 태그 업데이트를 시작했으므로,
    // 여기서는 추가 처리가 필요 없음 (중복 방지)
  } else {
    // 기존 답변이 없으면 전체 저장 (AI 태그 포함)
    const generatedTags = await generateTagsWithAI(question, selectedOptionText);
    const answerData = {
      uid,
      question_id: question.question_id,
      selected_option_index: selectedOptionIndex,
      selected_option_text: selectedOptionText,
      tags: generatedTags,
      rewarded: false,
      answeredAt: firestore.FieldValue.serverTimestamp(),
    };
    
    await answerRef.set(answerData);
    console.log(`[Logic] 답변 저장 완료: Doc ID = ${uid}_${question.question_id}`);
  }
  
  console.log(`[Debug] 현재 사용자 상태:`, {
    uid: userData.uid,
    totalSelections: userData.totalSelections,
    characterId: userData.characterId,
    adjective1: userData.adjective1,
    adjective2: userData.adjective2
  });

  // 공개 집계용 votes 기록은 더 이상 사용하지 않습니다(경고 제거 및 단일 집계 경로 유지)

  // --- 2. 연속 참여일수, 누적 답변 수 업데이트 (Transaction) ---
  let updatedTotalSelections: number = (userData.totalSelections || 0) + 1;
  let updatedUserData: UserData = { ...userData };

  try {
    await firestore().runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw "User does not exist!";
      }
      const currentUserData = userDoc.data() as UserData;

      // 테스트 유저는 연속 참여일수 계산 단순화
      let newStreakCount = 1;
      if (TEST_UIDS.includes(uid)) {
        // 테스트 유저는 항상 연속 참여로 처리
        newStreakCount = (currentUserData.streakCount || 0) + 1;
        console.log(`[Streak] 테스트 유저 연속 참여: ${currentUserData.streakCount} → ${newStreakCount}`);
      } else {
        // 일반 유저는 기존 로직 유지
        const kstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
        const yesterdayKST = new Date(kstNow.getTime());
        yesterdayKST.setUTCDate(kstNow.getUTCDate() - 1);
        const year = yesterdayKST.getUTCFullYear();
        const month = String(yesterdayKST.getUTCMonth() + 1).padStart(2, '0');
        const day = String(yesterdayKST.getUTCDate()).padStart(2, '0');
        const yesterdayKey = parseInt(`${year}${month}${day}`, 10);

        // lastAnswerDate를 숫자로 변환 (문자열일 수 있음)
        const lastAnswerDateRaw: unknown = currentUserData.lastAnswerDate;
        let lastAnswerDateNum = 0;
        if (typeof lastAnswerDateRaw === 'string') {
          lastAnswerDateNum = parseInt(lastAnswerDateRaw.replace(/-/g, ''), 10);
        } else if (typeof lastAnswerDateRaw === 'number') {
          lastAnswerDateNum = lastAnswerDateRaw;
        }

        console.log(`[Streak] 연속 참여일수 계산:`, {
          todayKey: todayKey,
          yesterdayKey: yesterdayKey,
          lastAnswerDate: currentUserData.lastAnswerDate,
          lastAnswerDateNum: lastAnswerDateNum,
          currentStreakCount: currentUserData.streakCount,
          isYesterdayAnswered: lastAnswerDateNum === yesterdayKey,
          isTodayAnswered: lastAnswerDateNum === todayKey
        });

        // 오늘 이미 투표했는지 확인 (중복 방지)
        if (lastAnswerDateNum === todayKey) {
          // 오늘 이미 투표했으면 현재 streakCount 유지
          newStreakCount = currentUserData.streakCount || 1;
          console.log(`[Streak] 오늘 이미 투표함. 현재 streakCount 유지: ${newStreakCount}`);
        } else if (lastAnswerDateNum === yesterdayKey) {
          // 어제 투표했으면 연속 참여
          newStreakCount = (currentUserData.streakCount || 0) + 1;
          console.log(`[Streak] 연속 참여 감지: ${currentUserData.streakCount} → ${newStreakCount}`);
        } else if (lastAnswerDateNum === 0 || !currentUserData.lastAnswerDate) {
          // 첫 투표이거나 lastAnswerDate가 없으면 1일
          newStreakCount = 1;
          console.log(`[Streak] 첫 투표 또는 lastAnswerDate 없음: 1일로 설정`);
        } else {
          // 하루라도 건너뛰었으면 1일로 리셋
          newStreakCount = 1;
          console.log(`[Streak] 연속 참여 끊김: 1로 리셋 (lastAnswerDate: ${lastAnswerDateNum}, 어제: ${yesterdayKey})`);
        }
      }
      
      // 트랜잭션 업데이트
      transaction.update(userRef, {
        totalSelections: firestore.FieldValue.increment(1),
        streakCount: newStreakCount,
        lastAnswerDate: todayKey,
      });

      updatedTotalSelections = (currentUserData.totalSelections || 0) + 1;
      updatedUserData = { 
        ...currentUserData, 
        totalSelections: updatedTotalSelections,
        streakCount: newStreakCount,
        lastAnswerDate: todayKey
      };
    });
    console.log(`[Streak] 연속 참여일수 업데이트 완료. New streak: ${updatedUserData!.streakCount}`);
    
    console.log(`[Debug] 업데이트된 사용자 상태:`, {
      uid: updatedUserData!.uid,
      totalSelections: updatedUserData!.totalSelections,
      characterId: updatedUserData!.characterId,
      adjective1: updatedUserData!.adjective1,
      adjective2: updatedUserData!.adjective2,
      streakCount: updatedUserData!.streakCount
    });
    
    // 연속 참여 마일스톤 달성 시 푸시 알림 발송
    await scheduleStreakNotification(updatedUserData!.streakCount);
  } catch (error) {
    console.error("❌ 사용자 정보 업데이트 트랜잭션 실패:", error);
    throw error;
  }

  // --- 3. 포인트 보상은 광고 시청 후 별도로 지급 ---
  // (포인트 지급을 지연하여 광고 시청 완료 후 rewardWithMajority를 호출하도록 변경)
  console.log('[Points] 포인트 지급은 광고 시청 후 진행됩니다.');

  // --- 4. 누적 답변 수에 따라 로직 분기 ---
  console.log(`[Debug] 로직 분기 체크: totalSelections = ${updatedTotalSelections!}`);
  console.log(`[Debug] 현재 캐릭터 상태:`, {
    characterId: updatedUserData!.characterId,
    adjective1: updatedUserData!.adjective1,
    adjective2: updatedUserData!.adjective2,
    isLegacy: isLegacyUser(updatedUserData!)
  });
  
  if (updatedTotalSelections! >= 30 && !updatedUserData!.characterId) {
    console.log(`[Logic A] 🎯 누적 답변 ${updatedTotalSelections!}회 도달! 캐릭터 배정 로직을 실행합니다.`);
    console.log(`[Debug] Logic A 실행 전 사용자 상태:`, {
      characterId: updatedUserData!.characterId,
      adjective1: updatedUserData!.adjective1,
      adjective2: updatedUserData!.adjective2
    });
    
    try {
      updatedUserData = await assignCharacter_LogicA(updatedUserData!);
      console.log(`[Debug] Logic A 실행 후 사용자 상태:`, {
        characterId: updatedUserData.characterId,
        adjective1: updatedUserData.adjective1,
        adjective2: updatedUserData.adjective2
      });
    } catch (error) {
      console.error(`[Logic A] 실행 실패:`, error);
    }
  } else if (updatedTotalSelections! >= 60 && updatedTotalSelections! % 30 === 0) {
    console.log(`[Logic B] 🔄 누적 답변 ${updatedTotalSelections!}회 도달! 형용사 갱신 로직을 실행합니다.`);
    console.log(`[Debug] Logic B 실행 전 사용자 상태:`, {
      characterId: updatedUserData!.characterId,
      adjective1: updatedUserData!.adjective1,
      adjective2: updatedUserData!.adjective2
    });
    
    try {
      updatedUserData = await updateAdjectives_LogicB(updatedUserData!);
      console.log(`[Debug] Logic B 실행 후 사용자 상태:`, {
        characterId: updatedUserData.characterId,
        adjective1: updatedUserData.adjective1,
        adjective2: updatedUserData.adjective2
      });
    } catch (error) {
      console.error(`[Logic B] 실행 실패:`, error);
    }
  } else {
    console.log(`[Debug] 로직 실행 조건 미충족: totalSelections = ${updatedTotalSelections!}`);
  }

  return updatedUserData!;
};

