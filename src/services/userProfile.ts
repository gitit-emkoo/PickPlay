/**
 * 사용자 프로필 관리 서비스
 * 전화번호 인증 및 UID 매칭 로직
 */

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

/**
 * 현재 사용 중인 익명 UID에 전화번호를 안전하게 연결합니다.
 * 
 * 중요:
 * - 기존 포인트/기록은 절대 건드리지 않음
 * - 전화번호 중복 검사 필수
 * - 트랜잭션으로 안전하게 처리
 * 
 * @param phoneNumber E.164 포맷 전화번호 (예: +821012345678)
 * @throws 중복 전화번호, 인증 실패 등
 */
export async function linkPhoneToCurrentUser(phoneNumber: string): Promise<void> {
  const currentUser = auth().currentUser;
  
  if (!currentUser) {
    throw new Error('인증되지 않은 사용자입니다. 다시 로그인 후 시도해주세요.');
  }

  const uid = currentUser.uid;
  
  console.log('[UserProfile] 전화번호 연결 시작:', { uid, phoneNumber });

  try {
    // 1. 전화번호 중복 검사 (트랜잭션 전 사전 체크)
    const duplicateCheck = await firestore()
      .collection('users')
      .where('phoneNumber', '==', phoneNumber)
      .limit(1)
      .get();

    if (!duplicateCheck.empty) {
      const existingUid = duplicateCheck.docs[0].id;
      if (existingUid !== uid) {
        console.error('[UserProfile] 전화번호 중복:', { phoneNumber, existingUid });
        throw new Error('이미 다른 계정에 등록된 전화번호입니다.');
      }
      // 같은 UID라면 이미 연결된 상태 (재인증 시도)
      console.log('[UserProfile] 이미 연결된 전화번호 (재인증):', uid);
    }

    // 2. Firestore 트랜잭션으로 안전하게 업데이트
    await firestore().runTransaction(async (transaction) => {
      const userRef = firestore().collection('users').doc(uid);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error('사용자 데이터를 찾을 수 없습니다.');
      }

      const userData = userDoc.data();
      
      // 트랜잭션 내부에서 다시 한번 중복 검사 (동시성 방어)
      const duplicateCheckInTx = await firestore()
        .collection('users')
        .where('phoneNumber', '==', phoneNumber)
        .limit(1)
        .get();

      if (!duplicateCheckInTx.empty) {
        const existingUid = duplicateCheckInTx.docs[0].id;
        if (existingUid !== uid) {
          throw new Error('이미 다른 계정에 등록된 전화번호입니다.');
        }
      }

      // 기존 포인트/기록은 건드리지 않고, 전화번호 인증 필드만 추가/업데이트
      transaction.update(userRef, {
        phoneNumber,
        phoneVerified: true,
        phoneVerifiedAt: firestore.FieldValue.serverTimestamp(),
      });

      console.log('[UserProfile] 트랜잭션 완료: 전화번호 연결 성공', {
        uid,
        phoneNumber,
        existingPoints: userData?.points,
      });
    });

    console.log('✅ [UserProfile] 전화번호 연결 완료:', { uid, phoneNumber });
  } catch (error: any) {
    console.error('❌ [UserProfile] 전화번호 연결 실패:', error);
    throw error;
  }
}

/**
 * 현재 사용자의 전화번호 인증 여부를 확인합니다.
 * 
 * @returns 인증 완료 여부
 */
export async function isPhoneVerified(): Promise<boolean> {
  const currentUser = auth().currentUser;
  
  if (!currentUser) {
    return false;
  }

  try {
    const userDoc = await firestore()
      .collection('users')
      .doc(currentUser.uid)
      .get();

    if (!userDoc.exists) {
      return false;
    }

    const userData = userDoc.data();
    return userData?.phoneVerified === true && !!userData?.phoneNumber;
  } catch (error) {
    console.error('[UserProfile] 인증 여부 확인 실패:', error);
    return false;
  }
}
