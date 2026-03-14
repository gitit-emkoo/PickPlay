/**
 * 보상 교환 서비스
 * - 교환 가능한 상품 조회
 * - 교환 신청 생성 (포인트 차감 + 신청 내역 저장)
 * - 교환 내역 조회
 */

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { RewardItem, ExchangeRequest, UserData } from '../types';
import { recordPointHistory } from './pointHistory';

const COLLECTIONS = {
  REWARD_ITEMS: 'reward_items',
  EXCHANGE_REQUESTS: 'exchange_requests',
  USERS: 'users',
} as const;

/**
 * 활성화된 교환 가능한 상품 목록을 조회합니다.
 * 
 * @returns 활성 상품 목록 (sortOrder 오름차순)
 */
export async function getActiveRewardItems(): Promise<RewardItem[]> {
  try {
    const snapshot = await firestore()
      .collection(COLLECTIONS.REWARD_ITEMS)
      .where('isActive', '==', true)
      .orderBy('sortOrder', 'asc')
      .get();

    const items: RewardItem[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      items.push({
        id: doc.id,
        title: data.title,
        description: data.description,
        requiredPoints: data.requiredPoints,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        imageUrl: data.imageUrl,
        type: data.type,
      } as RewardItem);
    });

    console.log(`[RewardStore] 활성 상품 ${items.length}개 조회 완료`);
    return items;
  } catch (error: any) {
    console.error('[RewardStore] 상품 목록 조회 실패:', error);
    throw error;
  }
}

/**
 * 교환 신청을 생성합니다.
 * 
 * 중요:
 * - 포인트 차감과 신청 내역 생성을 하나의 트랜잭션으로 처리
 * - 포인트 부족 시 실패
 * - 중복 클릭 방지는 클라이언트에서 처리 (isProcessing 플래그)
 * 
 * @param rewardItem 교환할 상품
 * @throws 포인트 부족, 트랜잭션 실패 등
 */
export async function createExchangeRequest(rewardItem: RewardItem): Promise<string> {
  const currentUser = auth().currentUser;
  
  if (!currentUser) {
    throw new Error('인증되지 않은 사용자입니다.');
  }

  const uid = currentUser.uid;
  
  console.log('[RewardStore] 교환 신청 시작:', {
    uid,
    rewardItemId: rewardItem.id,
    requiredPoints: rewardItem.requiredPoints,
  });

  let requestId: string | null = null;

  try {
    // Firestore 트랜잭션으로 포인트 차감 + 신청 생성을 원자적으로 처리
    await firestore().runTransaction(async (transaction) => {
      const userRef = firestore().collection(COLLECTIONS.USERS).doc(uid);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error('사용자 데이터를 찾을 수 없습니다.');
      }

      const userData = userDoc.data() as UserData;
      const currentPoints = userData.points || 0;

      // 포인트 부족 확인
      if (currentPoints < rewardItem.requiredPoints) {
        throw new Error(`포인트가 부족합니다. (보유: ${currentPoints}P, 필요: ${rewardItem.requiredPoints}P)`);
      }

      // 1. 포인트 차감
      transaction.update(userRef, {
        points: firestore.FieldValue.increment(-rewardItem.requiredPoints),
      });

      // 2. 교환 신청 내역 생성
      const requestRef = firestore().collection(COLLECTIONS.EXCHANGE_REQUESTS).doc();
      requestId = requestRef.id;

      transaction.set(requestRef, {
        uid,
        rewardItemId: rewardItem.id,
        rewardTitle: rewardItem.title,
        usedPoints: rewardItem.requiredPoints,
        status: 'requested',
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      console.log('[RewardStore] 트랜잭션 완료:', {
        uid,
        requestId,
        pointsDeducted: rewardItem.requiredPoints,
        remainingPoints: currentPoints - rewardItem.requiredPoints,
      });
    });

    // 3. 포인트 내역 기록 (트랜잭션 성공 후 보조 기록)
    try {
      await recordPointHistory(
        uid,
        -rewardItem.requiredPoints,
        'reward_exchange',
        `${rewardItem.title} 교환`
      );
    } catch (historyError) {
      console.warn('[RewardStore] 포인트 내역 기록 실패 (무시 가능):', historyError);
    }

    console.log('✅ [RewardStore] 교환 신청 완료:', requestId);
    return requestId!;
  } catch (error: any) {
    console.error('❌ [RewardStore] 교환 신청 실패:', error);
    throw error;
  }
}

/**
 * 현재 사용자의 교환 신청 내역을 조회합니다.
 * 
 * @param limit 최대 조회 개수 (기본 50개)
 * @returns 교환 신청 내역 (최신순)
 */
export async function getExchangeHistory(limit: number = 50): Promise<ExchangeRequest[]> {
  const currentUser = auth().currentUser;
  
  if (!currentUser) {
    throw new Error('인증되지 않은 사용자입니다.');
  }

  const uid = currentUser.uid;

  try {
    const snapshot = await firestore()
      .collection(COLLECTIONS.EXCHANGE_REQUESTS)
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const requests: ExchangeRequest[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      requests.push({
        id: doc.id,
        uid: data.uid,
        rewardItemId: data.rewardItemId,
        rewardTitle: data.rewardTitle,
        usedPoints: data.usedPoints,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        completedAt: data.completedAt,
        cancelledAt: data.cancelledAt,
        adminMemo: data.adminMemo,
      } as ExchangeRequest);
    });

    console.log(`[RewardStore] 교환 내역 ${requests.length}개 조회 완료`);
    return requests;
  } catch (error: any) {
    console.error('[RewardStore] 교환 내역 조회 실패:', error);
    throw error;
  }
}
