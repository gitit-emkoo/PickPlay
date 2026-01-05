import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { LivePickQuestion, LivePickParticipation, LivePickReward, LivePickReport } from '../types/livepick';
import { ensureUser } from './store';
import { ensureAnonymousAuth } from './firebase';
import { recordPointHistory } from './pointHistory';
import { updateTutorialProgress } from './tutorial';

// 보상 설정 로드
const rewardConfig = require('../../assets/data/reward_livepick.json');

const COLLECTIONS = {
  QUESTIONS: 'livepick_questions',
  PARTICIPATIONS: 'livepick_participations',
  REWARDS: 'livepick_rewards',
  REPORTS: 'livepick_reports',
} as const;

const ensureAuthenticatedUser = async (expectedUid?: string): Promise<string> => {
  const user = await ensureAnonymousAuth();
  const currentUid = user?.uid || auth().currentUser?.uid || null;

  if (!currentUid) {
    throw new Error('인증 정보가 없습니다. 다시 로그인 후 시도해주세요.');
  }

  if (expectedUid && currentUid !== expectedUid) {
    console.warn(`[LivePick] 인증된 UID(${currentUid})와 요청 UID(${expectedUid})가 다릅니다.`);
    throw new Error('인증 정보가 일치하지 않습니다. 앱을 재시작 후 다시 시도해주세요.');
  }

  return currentUid;
};

// ============================================
// 질문 생성 및 조회
// ============================================

/**
 * 새로운 LivePick 질문을 생성합니다.
 * @param uid 작성자 UID
 * @param title 질문 내용
 * @param option1 선택지 1
 * @param option2 선택지 2
 * @param category 카테고리
 * @returns { questionId: 생성된 질문 ID, tutorialCompleted: 튜토리얼 완료 여부 }
 */
export async function createLivePickQuestion(
  uid: string,
  title: string,
  option1: string,
  option2: string,
  category: '일상' | '연애' | '가치관' | '엔터테인먼트' | '상상'
): Promise<{ questionId: string; tutorialCompleted: boolean }> {
  try {
    const authedUid = await ensureAuthenticatedUser(uid);
    console.log('[LivePick][Create] 인증 확인 완료', { uid, authedUid });

    // 1. 사용자 포인트 확인 (10P 차감 필요)
    const userData = await ensureUser(uid);
    console.log('[LivePick][Create] 사용자 포인트 확인', { uid, points: userData.points });
    if (userData.points < 10) {
      throw new Error('포인트가 부족합니다. 10P 이상 필요합니다.');
    }

    // 2. 질문 생성 (명령문: 카테고리는 tags 필드로 저장)
    const questionRef = firestore().collection(COLLECTIONS.QUESTIONS).doc();
    const questionData: Omit<LivePickQuestion, 'id'> = {
      createdBy: uid,
      title: title.trim(),
      option1: option1.trim(),
      option2: option2.trim(),
      category,
      tags: [category], // 추천 알고리즘용 태그 (카테고리 저장)
      participantCount: 0,
      option1Count: 0,
      option2Count: 0,
      pointDeducted: 10,
      rewardGiven: false,
      createdAt: firestore.FieldValue.serverTimestamp() as any,
      status: 'active',
    };

    const app = firestore().app as any;
    const writeContextQuestion = {
      path: questionRef.path,
      projectId: app?.options?.projectId,
      appName: app?.name,
      dataKeys: Object.keys(questionData),
      payload: {
        ...questionData,
        createdAt: 'FieldValue.serverTimestamp()',
      },
    };

    console.log('[LivePick][Create] Firestore write (question) 시작', writeContextQuestion);
    await questionRef.set(questionData);
    console.log('[LivePick][Create] Firestore write (question) 완료', writeContextQuestion);

    // 3. 사용자 포인트 차감
    const userRef = firestore().collection('users').doc(uid);
    const writeContextUser = {
      path: userRef.path,
      projectId: app?.options?.projectId,
      appName: app?.name,
      updateFields: ['points'],
    };

    console.log('[LivePick][Create] Firestore write (user points) 시작', writeContextUser);
    await userRef.update({
        points: firestore.FieldValue.increment(-10),
      });
    console.log('[LivePick][Create] Firestore write (user points) 완료', writeContextUser);

    // 포인트 내역 기록
    try {
      await recordPointHistory(uid, -10, 'livepick_question_creation', '라이브픽 질문 생성');
    } catch (e) {
      console.warn('[LivePick] 포인트 내역 기록 실패(무시 가능):', (e as any)?.message || e);
    }

    // 튜토리얼 상태 업데이트 (라이브픽 질문 생성)
    let tutorialCompleted = false;
    try {
      const result = await updateTutorialProgress(uid, 'livepickCreated');
      // 실제로 업데이트가 수행되었고, 3개 미션 모두 완료되어 방금 보상을 받은 경우에만 tutorialCompleted = true
      // (이미 보상을 받은 상태에서 다시 질문을 생성하는 경우는 제외)
      if (result?.wasUpdated && 
          result?.userData?.tutorial?.mainAnswered && 
          result?.userData?.tutorial?.livepickParticipated && 
          result?.userData?.tutorial?.livepickCreated &&
          result?.userData?.tutorial?.rewardGiven500) {
        // 보상이 방금 지급되었는지 확인 (이전 상태를 확인할 수 없으므로, 
        // updateTutorialProgress 내부에서 보상 지급이 발생했는지 확인)
        // updateTutorialProgress는 보상을 지급하면 wasUpdated = true를 반환하므로
        // wasUpdated가 true이고 rewardGiven500이 true이면 방금 보상을 받은 것
        tutorialCompleted = true;
        console.log('[LivePick] 🎉 튜토리얼 완료! 500P 보상 지급됨');
      } else if (result && !result.wasUpdated) {
        // 이미 완료된 미션이면 tutorialCompleted = false (중복 팝업 방지)
        console.log('[LivePick] 이미 완료된 튜토리얼 미션입니다.');
      }
    } catch (e) {
      console.warn('[LivePick] 튜토리얼 상태 업데이트 실패(무시 가능):', (e as any)?.message || e);
    }

    console.log(`✅ [LivePick] 질문 생성 완료: ${questionRef.id}`);
    return { questionId: questionRef.id, tutorialCompleted };
  } catch (error: any) {
    console.error('❌ [LivePick] 질문 생성 실패(디버그 포함):', {
      code: error?.code || 'N/A',
      message: error?.message || 'N/A',
      stack: error?.stack || 'N/A',
      error,
    });
    throw error;
  }
}

/**
 * 활성 상태의 LivePick 질문 목록을 조회합니다.
 * @param limit 최대 조회 개수 (기본값: 20)
 * @param startAfterDate 이 날짜(createdAt) 이후의 문서부터 조회 (페이지네이션용, 선택사항)
 * @param sortBy 정렬 기준 ('latest' | 'popular') - 기본값: 'latest'
 * @param startAfterValue 페이지네이션용 값 (sortBy에 따라 createdAt 또는 participantCount)
 * @returns 질문 목록
 */
export async function getLivePickQuestions(
  limit: number = 20,
  startAfterDate?: Date,
  sortBy: 'latest' | 'popular' = 'latest',
  startAfterValue?: any
): Promise<LivePickQuestion[]> {
  try {
    let query = firestore()
      .collection(COLLECTIONS.QUESTIONS)
      .where('status', '==', 'active');

    // 정렬 기준에 따라 다른 orderBy 사용
    let snapshot;
    try {
      if (sortBy === 'popular') {
        query = query.orderBy('participantCount', 'desc');
        if (startAfterValue !== undefined) {
          query = query.startAfter(startAfterValue);
        }
      } else {
        // 최신순 (기본값)
        query = query.orderBy('createdAt', 'desc');
        if (startAfterDate) {
          query = query.startAfter(startAfterDate);
        }
      }

      // 서버에서 최신 데이터를 가져오도록 설정 (캐시 무시)
      snapshot = await query.limit(limit).get({ source: 'server' });
    } catch (error: any) {
      // 인덱스가 아직 생성되지 않은 경우 최신순으로 폴백
      if (error?.code === 'failed-precondition' && sortBy === 'popular') {
        console.warn('[LivePick] 인기순 정렬 인덱스가 아직 생성되지 않았습니다. 최신순으로 대체합니다.');
        query = firestore()
          .collection(COLLECTIONS.QUESTIONS)
          .where('status', '==', 'active')
          .orderBy('createdAt', 'desc');
        if (startAfterDate) {
          query = query.startAfter(startAfterDate);
        }
        snapshot = await query.limit(limit).get({ source: 'server' });
      } else {
        throw error;
      }
    }

    const questions: LivePickQuestion[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      questions.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt as any),
      } as LivePickQuestion);
    });

    return questions;
  } catch (error: any) {
    console.error('❌ [LivePick] 질문 목록 조회 실패:', error);
    console.error('❌ 에러 타입:', typeof error);
    console.error('❌ 에러 메시지:', error?.message);
    console.error('❌ 에러 코드:', error?.code);
    console.error('❌ 에러 스택:', error?.stack);
    console.error('❌ 에러 전체:', JSON.stringify(error, null, 2));
    throw error;
  }
}

/**
 * 특정 질문을 조회합니다.
 * @param questionId 질문 ID
 * @returns 질문 데이터 또는 null
 */
export async function getLivePickQuestion(questionId: string): Promise<LivePickQuestion | null> {
  try {
    const doc = await firestore().collection(COLLECTIONS.QUESTIONS).doc(questionId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data()!;
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
    } as LivePickQuestion;
  } catch (error) {
    console.error('❌ [LivePick] 질문 조회 실패:', error);
    throw error;
  }
}

/**
 * 질문의 실시간 업데이트를 구독합니다.
 * @param questionId 질문 ID
 * @param callback 업데이트 시 호출될 콜백 함수
 * @returns 구독 해제 함수
 */
export function subscribeLivePickQuestion(
  questionId: string,
  callback: (question: LivePickQuestion | null) => void
): () => void {
  const unsubscribe = firestore()
    .collection(COLLECTIONS.QUESTIONS)
    .doc(questionId)
    .onSnapshot(
      (doc) => {
        if (!doc.exists) {
          callback(null);
          return;
        }

        const data = doc.data()!;
        const question: LivePickQuestion = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        } as LivePickQuestion;
        callback(question);
      },
      (error) => {
        console.error('❌ [LivePick] 질문 실시간 구독 에러:', error);
        callback(null);
      }
    );

  return unsubscribe;
}

// 실시간 전체 목록 구독은 제거하고, 페이지네이션 기반 조회(getLivePickQuestions)를 사용합니다.

// ============================================
// 참여 및 보상
// ============================================

/**
 * 사용자가 질문에 참여합니다.
 * @param uid 사용자 UID
 * @param questionId 질문 ID
 * @param selectedOption 선택한 선택지 (1 또는 2)
 * @returns 참여 데이터 ID
 */
export async function participateInLivePick(
  uid: string,
  questionId: string,
  selectedOption: 1 | 2
): Promise<string> {
  try {
    await ensureAuthenticatedUser(uid);

    const participationId = `${uid}_${questionId}`;
    const participationRef = firestore()
      .collection(COLLECTIONS.PARTICIPATIONS)
      .doc(participationId);

    // 중복 참여 체크
    const existingDoc = await participationRef.get();
    if (existingDoc.exists) {
      throw new Error('이미 참여한 질문입니다.');
    }

    // 참여 데이터 생성
    const participationData: Omit<LivePickParticipation, 'id'> = {
      uid,
      questionId,
      selectedOption,
      basicRewardReceived: false,
      ladderGamePlayed: false,
      ladderReward: null,
      participatedAt: firestore.FieldValue.serverTimestamp() as any,
    };

    await participationRef.set(participationData);

    // 질문 통계 업데이트 (트랜잭션 사용)
    const questionRef = firestore().collection(COLLECTIONS.QUESTIONS).doc(questionId);
    let newParticipantCount = 0;
    await firestore().runTransaction(async (transaction) => {
      const questionDoc = await transaction.get(questionRef);
      if (!questionDoc.exists) {
        throw new Error('질문을 찾을 수 없습니다.');
      }

      const questionData = questionDoc.data()!;
      newParticipantCount = (questionData.participantCount || 0) + 1;
      const option1Count = questionData.option1Count || 0;
      const option2Count = questionData.option2Count || 0;

      transaction.update(questionRef, {
        participantCount: newParticipantCount,
        option1Count: selectedOption === 1 ? option1Count + 1 : option1Count,
        option2Count: selectedOption === 2 ? option2Count + 1 : option2Count,
      });
    });

    // 참여자 수 업데이트 완료
    // 주의: 질문 생성자 보상은 자정 기준으로 Cloud Function에서 집계 및 지급됨

    console.log(`✅ [LivePick] 참여 완료: ${participationId}`);
    return participationId;
  } catch (error: any) {
    console.error('❌ [LivePick] 참여 실패:', error);
    throw error;
  }
}

/**
 * 기본 보상(10P)을 지급합니다.
 * @param uid 사용자 UID
 * @param questionId 질문 ID
 */
export async function receiveBasicReward(uid: string, questionId: string): Promise<void> {
  try {
    await ensureAuthenticatedUser(uid);

    const participationId = `${uid}_${questionId}`;
    const participationRef = firestore()
      .collection(COLLECTIONS.PARTICIPATIONS)
      .doc(participationId);

    // 트랜잭션으로 보상 지급 및 중복 방지
    await firestore().runTransaction(async (transaction) => {
      const participationDoc = await transaction.get(participationRef);
      if (!participationDoc.exists) {
        throw new Error('참여 기록을 찾을 수 없습니다.');
      }

      const participationData = participationDoc.data()!;
      if (participationData.basicRewardReceived) {
        throw new Error('이미 보상을 받았습니다.');
      }

      // 참여 데이터 업데이트
      transaction.update(participationRef, {
        basicRewardReceived: true,
      });

      // 사용자 포인트 증가 (명령문: 즉시 보상 10P)
      const userRef = firestore().collection('users').doc(uid);
      transaction.update(userRef, {
        points: firestore.FieldValue.increment(10),
      });
    });

    // 포인트 내역 기록
    try {
      await recordPointHistory(uid, 10, 'basic_reward', '라이브픽 기본 보상 (광고 미시청)');
    } catch (e) {
      console.warn('[LivePick] 포인트 내역 기록 실패(무시 가능):', (e as any)?.message || e);
    }

    console.log(`✅ [LivePick] 기본 보상 지급 완료: ${participationId}`);
  } catch (error: any) {
    console.error('❌ [LivePick] 기본 보상 지급 실패:', error);
    throw error;
  }
}

/**
 * 사다리 게임 보상을 지급합니다.
 * @param uid 사용자 UID
 * @param questionId 질문 ID
 * @param rewardPoints 지급할 포인트 (5P ~ 300P)
 */
export async function receiveLadderReward(
  uid: string,
  questionId: string,
  rewardPoints: number
): Promise<void> {
  try {
    await ensureAuthenticatedUser(uid);

    const participationId = `${uid}_${questionId}`;
    const participationRef = firestore()
      .collection(COLLECTIONS.PARTICIPATIONS)
      .doc(participationId);

    // 트랜잭션으로 보상 지급 및 중복 방지
    await firestore().runTransaction(async (transaction) => {
      const participationDoc = await transaction.get(participationRef);
      if (!participationDoc.exists) {
        throw new Error('참여 기록을 찾을 수 없습니다.');
      }

      const participationData = participationDoc.data()!;
      if (participationData.ladderGamePlayed) {
        throw new Error('이미 사다리 게임을 플레이했습니다.');
      }

      // 참여 데이터 업데이트
      transaction.update(participationRef, {
        ladderGamePlayed: true,
        ladderReward: rewardPoints,
      });

      // 사용자 포인트 증가
      const userRef = firestore().collection('users').doc(uid);
      transaction.update(userRef, {
        points: firestore.FieldValue.increment(rewardPoints),
      });
    });

    // 포인트 내역 기록
    try {
      await recordPointHistory(uid, rewardPoints, 'ladder_reward', `라이브픽 사다리 게임 보상 (${rewardPoints}P)`);
    } catch (e) {
      console.warn('[LivePick] 포인트 내역 기록 실패(무시 가능):', (e as any)?.message || e);
    }

    console.log(`✅ [LivePick] 사다리 게임 보상 지급 완료: ${participationId}, ${rewardPoints}P`);
  } catch (error: any) {
    console.error('❌ [LivePick] 사다리 게임 보상 지급 실패:', error);
    throw error;
  }
}

/**
 * 사용자의 참여 기록을 조회합니다.
 * @param uid 사용자 UID
 * @param questionId 질문 ID
 * @returns 참여 데이터 또는 null
 */
export async function getParticipation(
  uid: string,
  questionId: string
): Promise<LivePickParticipation | null> {
  try {
    const participationId = `${uid}_${questionId}`;
    const doc = await firestore()
      .collection(COLLECTIONS.PARTICIPATIONS)
      .doc(participationId)
      .get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data()!;
    return {
      id: doc.id,
      ...data,
      participatedAt: data.participatedAt?.toDate
        ? data.participatedAt.toDate()
        : new Date(data.participatedAt),
    } as LivePickParticipation;
  } catch (error) {
    console.error('❌ [LivePick] 참여 기록 조회 실패:', error);
    throw error;
  }
}

/**
 * 사용자가 해당 질문을 이미 신고했는지 확인합니다.
 * @param uid 사용자 UID
 * @param questionId 질문 ID
 * @returns 이미 신고했다면 true, 아니면 false
 */
export async function hasReportedLivePickQuestion(
  uid: string,
  questionId: string
): Promise<boolean> {
  try {
    const reportId = `${uid}_${questionId}`;
    console.log('[LivePick][Report] 중복 신고 여부 확인 시작', { uid, questionId, reportId });

    const doc = await firestore()
      .collection(COLLECTIONS.REPORTS)
      .doc(reportId)
      .get();

    const exists = doc.exists;
    console.log('[LivePick][Report] 중복 신고 여부 확인 결과', { uid, questionId, reportId, exists });

    return exists;
  } catch (error: any) {
    console.error('❌ [LivePick][Report] 중복 신고 여부 확인 실패:', {
      code: error?.code || 'N/A',
      message: error?.message || 'N/A',
      error,
    });
    // 에러가 나더라도 신고 기능 자체를 막지는 않기 위해 false 반환
    return false;
  }
}

// ============================================
// 질문자 보상 (자동 처리)
// ============================================

/**
 * 참여자 수에 따른 질문 생성자 보상 계산 (명령문 기준)
 * @param participantCount 참여자 수
 * @returns 보상 포인트
 */
function calculateCreatorReward(participantCount: number): number {
  const rewards = rewardConfig.questionCreatorRewards;
  
  for (const rewardRule of rewards) {
    const { minParticipants, maxParticipants, exclusiveMax, reward } = rewardRule;
    
    const meetsMin = participantCount >= minParticipants;
    const meetsMax = maxParticipants === null 
      ? true 
      : exclusiveMax 
        ? participantCount < maxParticipants 
        : participantCount <= maxParticipants;
    
    if (meetsMin && meetsMax) {
      return reward;
    }
  }
  
  // 기본값 (발생하지 않아야 함)
  return 0;
}

/**
 * 질문의 일일 참여자 수를 계산합니다 (자정 기준)
 * @param questionId 질문 ID
 * @param targetDate 기준 날짜 (기본값: 오늘)
 * @returns 일일 참여자 수
 */
export async function getDailyParticipantCount(
  questionId: string,
  targetDate?: Date
): Promise<number> {
  try {
    const date = targetDate || new Date();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const startTimestamp = firestore.Timestamp.fromDate(startOfDay);
    const endTimestamp = firestore.Timestamp.fromDate(endOfDay);
    
    const snapshot = await firestore()
      .collection(COLLECTIONS.PARTICIPATIONS)
      .where('questionId', '==', questionId)
      .where('participatedAt', '>=', startTimestamp)
      .where('participatedAt', '<=', endTimestamp)
      .get();
    
    return snapshot.size;
  } catch (error) {
    console.error('❌ [LivePick] 일일 참여자 수 조회 실패:', error);
    return 0;
  }
}

/**
 * 질문의 참여자 수를 확인하고 필요 시 질문자에게 보상을 지급합니다.
 * 이 함수는 Cloud Function의 자정 스케줄러에서 호출됩니다.
 * 
 * 주의: 명령문에 따라 자정 기준으로 집계되므로, 이 함수는 자정마다 실행되는 Cloud Function에서 호출됩니다.
 * 
 * @param questionId 질문 ID
 * @param dailyParticipantCount 일일 참여자 수 (자정 기준)
 */
export async function rewardQuestionOwnerByDailyCount(
  questionId: string,
  dailyParticipantCount: number
): Promise<number> {
  try {
    const questionDoc = await firestore()
      .collection(COLLECTIONS.QUESTIONS)
      .doc(questionId)
      .get();

    if (!questionDoc.exists) {
      return 0;
    }

    const questionData = questionDoc.data()!;
    const ownerUid = questionData.createdBy;
    
    // 보상 계산 (명령문 기준)
    const rewardAmount = calculateCreatorReward(dailyParticipantCount);
    
    if (rewardAmount === 0) {
      return 0; // 보상 없음
    }

    // 트랜잭션으로 보상 지급
    await firestore().runTransaction(async (transaction) => {
      const questionDocRef = firestore().collection(COLLECTIONS.QUESTIONS).doc(questionId);
      const questionDoc = await transaction.get(questionDocRef);

      if (!questionDoc.exists) {
        return;
      }

      // 질문자 포인트 증가
      const ownerRef = firestore().collection('users').doc(ownerUid);
      transaction.update(ownerRef, {
        points: firestore.FieldValue.increment(rewardAmount),
      });

      // 보상 기록 생성 (날짜별로 저장)
      const rewardRef = firestore().collection(COLLECTIONS.REWARDS).doc();
      transaction.set(rewardRef, {
        questionId,
        questionOwner: ownerUid,
        participantCount: dailyParticipantCount,
        rewardAmount,
        rewardType: `${dailyParticipantCount}p`,
        rewardedAt: firestore.FieldValue.serverTimestamp(),
      });
    });

    console.log(`✅ [LivePick] 질문자 보상 지급 완료: ${questionId}, ${dailyParticipantCount}명 참여 → ${rewardAmount}P`);
    return rewardAmount;
  } catch (error) {
    console.error('❌ [LivePick] 질문자 보상 지급 실패:', error);
    throw error;
  }
}

/**
 * [레거시] 즉시 보상 함수 (제거 예정 - 자정 기준으로 변경)
 * @deprecated 자정 기준 보상 시스템으로 대체됨
 */
export async function checkAndRewardQuestionOwner(questionId: string): Promise<void> {
  // 레거시 함수는 더 이상 사용하지 않음
  // 자정 기준 보상 시스템으로 대체됨
  console.warn('⚠️ [LivePick] checkAndRewardQuestionOwner는 더 이상 사용되지 않습니다. 자정 기준 보상 시스템을 사용하세요.');
}

// ============================================
// 일일 참여 제한 체크
// ============================================

/**
 * 사용자의 오늘 참여 횟수를 조회합니다.
 * @param uid 사용자 UID
 * @returns 오늘 참여 횟수
 */
export async function getTodayParticipationCount(uid: string): Promise<number> {
  try {
    console.log(`🔍 [LivePick] 오늘 참여 횟수 조회 시작`);
    console.log(`   - 요청한 uid: ${uid}`);
    
    // 현재 인증 상태 확인
    const currentUser = auth().currentUser;
    console.log(`   - 현재 인증 사용자: ${currentUser?.uid || 'null'}`);
    console.log(`   - uid 일치 여부: ${currentUser?.uid === uid}`);
    console.log(`   - 인증 상태: ${currentUser ? '인증됨' : '미인증'}`);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = firestore.Timestamp.fromDate(today);
    
    console.log(`   - 오늘 날짜: ${today.toISOString()}`);
    console.log(`   - Timestamp: ${todayTimestamp.toMillis()}`);
    console.log(`   - 컬렉션: ${COLLECTIONS.PARTICIPATIONS}`);
    
    console.log(`🔎 [LivePick] 쿼리 실행 중...`);
    console.log(`   - 조건: uid == '${uid}' AND participatedAt >= ${todayTimestamp.toDate().toISOString()}`);
    
    const snapshot = await firestore()
      .collection(COLLECTIONS.PARTICIPATIONS)
      .where('uid', '==', uid)
      .where('participatedAt', '>=', todayTimestamp)
      .get();

    console.log(`✅ [LivePick] 쿼리 성공!`);
    console.log(`   - 결과 개수: ${snapshot.size}`);
    
    if (snapshot.size > 0) {
      snapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`   - 문서 ${index + 1}: id=${doc.id}, uid=${data.uid}, participatedAt=${data.participatedAt?.toDate?.()?.toISOString() || 'N/A'}`);
      });
    }
    
    return snapshot.size;
  } catch (error: any) {
    console.error('❌ [LivePick] 오늘 참여 횟수 조회 실패');
    console.error(`   - 에러 코드: ${error?.code || 'N/A'}`);
    console.error(`   - 에러 메시지: ${error?.message || 'N/A'}`);
    console.error(`   - 전체 에러:`, error);
    
    // 권한 오류인 경우 추가 정보
    if (error?.code === 'firestore/permission-denied') {
      const currentUser = auth().currentUser;
      console.error(`   ⚠️ 권한 오류 - 현재 인증 사용자: ${currentUser?.uid || 'null'}`);
      console.error(`   ⚠️ 권한 오류 - 요청한 uid: ${uid}`);
      console.error(`   ⚠️ 권한 오류 - uid 일치 여부: ${currentUser?.uid === uid}`);
    }
    
    return 0;
  }
}

// ============================================
// 신고 기능
// ============================================

/**
 * 라이브픽 질문을 신고합니다.
 * @param uid 신고자 UID
 * @param questionId 신고할 질문 ID
 * @param reason 신고 사유
 * @param description 추가 설명 (선택사항)
 * @returns 생성된 신고 ID
 */
export async function reportLivePickQuestion(
  uid: string,
  questionId: string,
  reason: 'spam' | 'inappropriate' | 'violence' | 'harassment' | 'other',
  description?: string
): Promise<string> {
  try {
    const authedUid = await ensureAuthenticatedUser(uid);
    console.log('[LivePick][Report] 인증 확인 완료', { authedUid, uid, questionId, reason });

    // 1. 질문 존재 여부 확인
    const questionDoc = await firestore()
      .collection(COLLECTIONS.QUESTIONS)
      .doc(questionId)
      .get();
    
    if (!questionDoc.exists) {
      throw new Error('존재하지 않는 질문입니다.');
    }

    // 2. 자신이 만든 질문은 신고할 수 없음
    const questionData = questionDoc.data()!;
    if (questionData.createdBy === uid) {
      throw new Error('자신이 만든 질문은 신고할 수 없습니다.');
    }

    // 3. 중복 신고 방지 (이미 신고한 경우)
    const reportId = `${uid}_${questionId}`;
    const existingReport = await firestore()
      .collection(COLLECTIONS.REPORTS)
      .doc(reportId)
      .get();
    
    if (existingReport.exists) {
      throw new Error('이미 신고한 질문입니다.');
    }

    // 4. 신고 데이터 생성
    const reportData: Omit<LivePickReport, 'id'> = {
      uid,
      questionId,
      reason,
      ...(description?.trim()
        ? { description: description.trim() }
        : {}),
      status: 'pending',
      reportedAt: firestore.FieldValue.serverTimestamp() as any,
    };

    console.log('[LivePick][Report] 신고 생성 요청', {
      docId: reportId,
      payloadKeys: Object.keys(reportData),
      payload: {
        ...reportData,
        reportedAt: 'FieldValue.serverTimestamp()',
      },
    });

    const app = firestore().app as any;
    const reportsRef = firestore().collection(COLLECTIONS.REPORTS).doc(reportId);
    const writeContext = {
      path: reportsRef.path,
      projectId: app?.options?.projectId,
      appName: app?.name,
      dataKeys: Object.keys(reportData),
    };
    console.log('[LivePick][Report] Firestore write 시작', writeContext);

    await reportsRef.set(reportData);
    console.log('[LivePick][Report] Firestore write 완료', writeContext);

    console.log(`✅ [LivePick] 신고 완료: ${reportId}`);
    return reportId;
  } catch (error: any) {
    const code = error?.code || error?.message || String(error);
    console.error('❌ [LivePick] 신고 실패:', {
      code,
      message: error?.message,
      stack: error?.stack,
    });
    throw error;
  }
}

