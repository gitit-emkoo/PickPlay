import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import functionsModule from '@react-native-firebase/functions';
import { PointHistory, PointHistoryReason } from '../types';

const COLLECTION = 'point_history' as const;

/**
 * 포인트 적립/소멸 내역을 기록하는 함수
 * Cloud Functions의 recordPointHistory를 호출합니다.
 */
export async function recordPointHistory(
  uid: string,
  amount: number,
  reason: PointHistoryReason,
  description?: string
): Promise<void> {
  try {
    console.log(`[PointHistory] 내역 기록 시작:`, { uid, amount, reason, description });

    // 인증 토큰이 포함되도록 보장
    const currentUser = auth().currentUser;
    if (!currentUser) {
      console.warn('[PointHistory] 인증되지 않은 사용자, 내역 기록 생략');
      return;
    }

    // 약간의 딜레이를 주어 토큰이 전파되도록 함
    await new Promise(resolve => setTimeout(resolve, 100));

    const functions = functionsModule();
    const recordPointHistoryFn = functions.httpsCallableFromUrl(
      'https://asia-northeast3-today-balance-fa0a5.cloudfunctions.net/recordPointHistory'
    );

    const result = await recordPointHistoryFn({
      uid,
      amount,
      reason,
      description: description || null,
    });

    console.log(`[PointHistory] 내역 기록 완료:`, result.data);
  } catch (error: any) {
    console.error(`[PointHistory] 내역 기록 실패:`, error);
    console.error(`[PointHistory] 에러 상세:`, {
      code: error?.code,
      message: error?.message,
      details: error?.details,
    });
    // 내역 기록 실패는 포인트 변경 자체를 막지 않도록 에러를 무시
    // (포인트는 이미 변경되었을 수 있으므로)
  }
}

// 포인트 적립/소멸 내역 조회
export async function getPointHistory(uid: string, limit: number = 30): Promise<PointHistory[]> {
  console.log(`[PointHistory] 조회 시작: uid=${uid}, limit=${limit}`);
  
  // 현재 인증 상태 확인
  const currentUser = auth().currentUser;
  console.log(`[PointHistory] 현재 인증 사용자:`, currentUser?.uid || 'null');
  console.log(`[PointHistory] 요청한 uid와 일치:`, currentUser?.uid === uid);
  
  if (!currentUser) {
    throw new Error('인증되지 않은 사용자입니다.');
  }
  
  if (currentUser.uid !== uid) {
    throw new Error('본인의 포인트 내역만 조회할 수 있습니다.');
  }
  
  try {
    console.log(`[PointHistory] Firestore 쿼리 시작: collection=${COLLECTION}, uid=${uid}`);
    
    // 먼저 컬렉션 존재 여부 확인 (에러 디버깅용)
    const snapshot = await firestore()
      .collection(COLLECTION)
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    
    console.log(`[PointHistory] 조회 성공: ${snapshot.size}개 문서`);

    const items: PointHistory[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`[PointHistory] 문서 파싱:`, {
        id: doc.id,
        amount: data.amount,
        reason: data.reason,
        description: data.description,
        createdAt: data.createdAt ? '있음' : '없음',
      });
      items.push({
        id: doc.id,
        uid: data.uid,
        amount: data.amount,
        reason: data.reason,
        description: data.description,
        createdAt: data.createdAt,
      });
    });

    console.log(`[PointHistory] 파싱 완료: ${items.length}개 항목`);
    console.log(`[PointHistory] 항목 상세:`, items.map(item => ({
      id: item.id,
      amount: item.amount,
      reason: item.reason,
      description: item.description,
    })));
    return items;
  } catch (error: any) {
    console.error(`[PointHistory] 조회 실패:`, error);
    console.error(`[PointHistory] 에러 코드:`, error.code);
    console.error(`[PointHistory] 에러 메시지:`, error.message);
    throw error;
  }
}


