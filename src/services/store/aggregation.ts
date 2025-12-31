import firestore from '@react-native-firebase/firestore';
import { recordPointHistory } from '../pointHistory';

/**
 * Firestore 집계를 수행합니다. (기존 aggregate 함수 단순화)
 * @param questionId 질문 ID
 */
export const aggregate = async (questionId: string) => {
  const snapshot = await firestore().collection('answers').where('question_id', '==', questionId).get();
  let c0 = 0, c1 = 0;
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.selected_option_index === 0) c0++;
    else if (data.selected_option_index === 1) c1++;
  });
  const total = c0 + c1;
  const p0 = total ? Math.round((c0 / total) * 100) : 50;
  const p1 = 100 - p0;
  return { total, c0, c1, p0, p1 };
};

/**
 * [V2] 승패 보상 및 연속 참여 배수를 적용하여 포인트를 계산하고 지급합니다.
 * @param uid 사용자 ID
 * @param questionId 질문 ID
 * @param myOptionIndex 사용자의 선택
 * @param streakCount 현재 연속 참여일수
 * @returns 지급된 포인트 정보 { base, multiplier, totalPoints, myIsMajority, agg }
 */
export async function rewardWithMajority(
  uid: string, 
  questionId: string, 
  myOptionIndex: number,
  streakCount: number
) {
  const agg = await aggregate(questionId);
  const myIsMajority = (() => {
    if (agg.c0 === agg.c1) return true;
    const majorityIndex = agg.c0 >= agg.c1 ? 0 : 1;
    return myOptionIndex === majorityIndex;
  })();
  
  const base = myIsMajority ? 5 : 10; // 다수: 5P, 소수: 10P
  
  // 연속 참여 배수 적용 (11일 이상: 2배, 31일 이상: 3배)
  const multiplier = streakCount >= 31 ? 3 : streakCount >= 11 ? 2 : 1;
  const totalPoints = base * multiplier;
  
  const majorityText = myIsMajority ? '다수' : '소수';
  const multiplierText = multiplier > 1 ? ` (${multiplier}배 적용)` : '';
  
  const userRef = firestore().collection('users').doc(uid);
  await userRef.update({
    points: firestore.FieldValue.increment(totalPoints)
  });

  // 포인트 내역 기록
  try {
    const description = `${majorityText} 선택 ${base}P${multiplierText}`;
    await recordPointHistory(uid, totalPoints, 'majority_reward', description);
  } catch (e) {
    console.warn('[Points] 포인트 내역 기록 실패(무시 가능):', (e as any)?.message || e);
  }

  // 오늘 보상 수령 완료 표시
  try {
    await firestore().collection('answers').doc(`${uid}_${questionId}`).update({ rewarded: true });
  } catch (e) {
    console.warn('[Answer] rewarded 플래그 업데이트 실패(무시 가능):', (e as any)?.message || e);
  }
  
  console.log(`[Points] 포인트 지급 완료: ${majorityText} ${base}P${multiplierText} = 총 ${totalPoints}P`);

  return { base, multiplier, totalPoints, myIsMajority, agg };
}

/**
 * 실시간 집계 구독
 * @param questionId 질문 ID
 * @param onChange 콜백 함수
 */
export function watchAggregation(
  questionId: string,
  onChange: (result: { total: number; c0: number; c1: number; p0: number; p1: number }) => void
) {
  const qRef = firestore().collection('answers').where('question_id', '==', questionId);
  
  const unsubscribe = qRef.onSnapshot((snapshot) => {
    let c0 = 0, c1 = 0;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.selected_option_index === 0) c0++;
      else if (data.selected_option_index === 1) c1++;
    });
    const total = c0 + c1;
    const p0 = total ? Math.round((c0 / total) * 100) : 50;
    const p1 = 100 - p0;
    onChange({ total, c0, c1, p0, p1 });
  });

  return unsubscribe;
}

