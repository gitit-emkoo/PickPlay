import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { UserData } from '../types';
import { getDeviceUID } from './firebase';

/**
 * 기기 이전을 위한 임시 비밀번호 생성
 * @param uid 사용자 UID
 * @returns 생성된 임시 비밀번호 (8~10자 영문+숫자 조합)
 */
export async function prepareDeviceTransfer(uid: string): Promise<string> {
  console.log(`[DeviceTransfer] 연동 준비 시작: ${uid}`);
  
  // 8~10자 영문+숫자 조합 비밀번호 생성
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동하기 쉬운 문자 제외 (I, O, 0, 1)
  const length = 8 + Math.floor(Math.random() * 3); // 8~10자
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Firestore에 연동 정보 저장 (24시간 유효)
  const transferRef = firestore().collection('device_transfers').doc(uid);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24시간 후 만료
  
  await transferRef.set({
    uid,
    password,
    createdAt: firestore.FieldValue.serverTimestamp(),
    expiresAt: firestore.Timestamp.fromDate(expiresAt),
    used: false,
  });
  
  console.log(`[DeviceTransfer] 연동 준비 완료: ${uid}, 비밀번호: ${password}`);
  return password;
}

/**
 * 기기 이전 실행
 * @param sourceUID 원본 기기 UID
 * @param password 임시 비밀번호
 * @param targetUID 대상 기기 UID
 * @returns 이전 성공 여부
 */
export async function executeDeviceTransfer(
  sourceUID: string,
  password: string,
  targetUID: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[DeviceTransfer] 연동 실행 시작: ${sourceUID} → ${targetUID}`);
  
  try {
    // 1. 연동 정보 확인
    const transferRef = firestore().collection('device_transfers').doc(sourceUID);
    const transferDoc = await transferRef.get();
    
    if (!transferDoc.exists) {
      return { success: false, error: '연동 준비 정보를 찾을 수 없습니다.' };
    }
    
    const transferData = transferDoc.data();
    if (!transferData) {
      return { success: false, error: '연동 정보가 유효하지 않습니다.' };
    }
    
    // 비밀번호 확인
    if (transferData.password !== password) {
      return { success: false, error: '비밀번호가 일치하지 않습니다.' };
    }
    
    // 만료 확인
    if (transferData.expiresAt) {
      const expiresAt = (transferData.expiresAt as FirebaseFirestoreTypes.Timestamp).toDate();
      if (expiresAt < new Date()) {
        return { success: false, error: '연동 준비가 만료되었습니다. (24시간 초과)' };
      }
    }
    
    // 사용 여부 확인
    if (transferData.used === true) {
      return { success: false, error: '이미 사용된 연동 정보입니다.' };
    }
    
    // 같은 UID로 이전 시도 방지
    if (sourceUID === targetUID) {
      return { success: false, error: '같은 기기로는 연동할 수 없습니다.' };
    }
    
    // 2. 원본 사용자 데이터 가져오기
    const sourceUserRef = firestore().collection('users').doc(sourceUID);
    const sourceUserDoc = await sourceUserRef.get();
    
    if (!sourceUserDoc.exists) {
      return { success: false, error: '원본 사용자 데이터를 찾을 수 없습니다.' };
    }
    
    const sourceUserData = sourceUserDoc.data() as UserData;
    
    // 3. 대상 기기 deviceUID 가져오기
    const targetDeviceUID = await getDeviceUID();
    
    // 4. 대상 기기의 기존 데이터 삭제 (B기기의 새 유저 데이터 제거)
    console.log(`[DeviceTransfer] 대상 기기(B기기) 기존 데이터 삭제 시작: ${targetUID}`);
    
    // 4-1. 대상 기기 users 문서 삭제 (나중에 A기기 데이터로 교체)
    const targetUserRef = firestore().collection('users').doc(targetUID);
    const targetUserDoc = await targetUserRef.get();
    if (targetUserDoc.exists) {
      await targetUserRef.delete();
      console.log(`[DeviceTransfer] 대상 기기 users 문서 삭제 완료: ${targetUID}`);
    }
    
    // 4-2. 대상 기기 answers 삭제
    const targetAnswersQuery = await firestore()
      .collection('answers')
      .where('uid', '==', targetUID)
      .get();
    
    if (!targetAnswersQuery.empty) {
      const batch = firestore().batch();
      let batchCount = 0;
      const BATCH_LIMIT = 500;
      
      for (const answerDoc of targetAnswersQuery.docs) {
        batch.delete(answerDoc.ref);
        batchCount++;
        
        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          console.log(`[DeviceTransfer] 대상 기기 answers 삭제 배치 커밋: ${batchCount}개`);
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`[DeviceTransfer] 대상 기기 answers 삭제 최종 배치 커밋: ${batchCount}개`);
      }
      
      console.log(`[DeviceTransfer] 대상 기기 answers 삭제 완료: ${targetAnswersQuery.size}개 문서`);
    }
    
    // 4-3. 대상 기기 point_history 삭제
    const targetPointHistoryQuery = await firestore()
      .collection('point_history')
      .where('uid', '==', targetUID)
      .get();
    
    if (!targetPointHistoryQuery.empty) {
      const batch = firestore().batch();
      let batchCount = 0;
      const BATCH_LIMIT = 500;
      
      for (const historyDoc of targetPointHistoryQuery.docs) {
        batch.delete(historyDoc.ref);
        batchCount++;
        
        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          console.log(`[DeviceTransfer] 대상 기기 point_history 삭제 배치 커밋: ${batchCount}개`);
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`[DeviceTransfer] 대상 기기 point_history 삭제 최종 배치 커밋: ${batchCount}개`);
      }
      
      console.log(`[DeviceTransfer] 대상 기기 point_history 삭제 완료: ${targetPointHistoryQuery.size}개 문서`);
    }
    
    // 4-4. 대상 기기 livepick_participations 삭제
    const targetParticipationsQuery = await firestore()
      .collection('livepick_participations')
      .where('uid', '==', targetUID)
      .get();
    
    if (!targetParticipationsQuery.empty) {
      const batch = firestore().batch();
      let batchCount = 0;
      const BATCH_LIMIT = 500;
      
      for (const participationDoc of targetParticipationsQuery.docs) {
        batch.delete(participationDoc.ref);
        batchCount++;
        
        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          console.log(`[DeviceTransfer] 대상 기기 livepick_participations 삭제 배치 커밋: ${batchCount}개`);
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`[DeviceTransfer] 대상 기기 livepick_participations 삭제 최종 배치 커밋: ${batchCount}개`);
      }
      
      console.log(`[DeviceTransfer] 대상 기기 livepick_participations 삭제 완료: ${targetParticipationsQuery.size}개 문서`);
    }
    
    // 4-5. 대상 기기 user_push_tokens 삭제
    try {
      const targetPushTokenRef = firestore().collection('user_push_tokens').doc(targetUID);
      const targetPushTokenDoc = await targetPushTokenRef.get();
      if (targetPushTokenDoc.exists) {
        await targetPushTokenRef.delete();
        console.log(`[DeviceTransfer] 대상 기기 user_push_tokens 삭제 완료`);
      }
    } catch (pushTokenDeleteError) {
      console.warn('[DeviceTransfer] 대상 기기 user_push_tokens 삭제 실패 (무시):', pushTokenDeleteError);
    }
    
    // 4-6. 대상 기기 user_notifications 삭제
    const targetNotificationsQuery = await firestore()
      .collection('user_notifications')
      .where('uid', '==', targetUID)
      .get();
    
    if (!targetNotificationsQuery.empty) {
      const batch = firestore().batch();
      let batchCount = 0;
      const BATCH_LIMIT = 500;
      
      for (const notificationDoc of targetNotificationsQuery.docs) {
        batch.delete(notificationDoc.ref);
        batchCount++;
        
        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          console.log(`[DeviceTransfer] 대상 기기 user_notifications 삭제 배치 커밋: ${batchCount}개`);
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`[DeviceTransfer] 대상 기기 user_notifications 삭제 최종 배치 커밋: ${batchCount}개`);
      }
      
      console.log(`[DeviceTransfer] 대상 기기 user_notifications 삭제 완료: ${targetNotificationsQuery.size}개 문서`);
    }
    
    console.log(`[DeviceTransfer] 대상 기기(B기기) 기존 데이터 삭제 완료: ${targetUID}`);
    
    // 5. 대상 기기에 A기기 데이터 복사
    const targetUserData: UserData = {
      ...sourceUserData,
      uid: targetUID,
      deviceUID: targetDeviceUID,
      // createdAt은 유지 (기존 사용자의 시작일 유지)
    };
    
    await targetUserRef.set(targetUserData);
    console.log(`[DeviceTransfer] 대상 기기 데이터 복사 완료: ${targetUID}`);
    
    // 6. answers 컬렉션 마이그레이션
    let sourceAnswersQuery: FirebaseFirestoreTypes.QuerySnapshot | null = null;
    sourceAnswersQuery = await firestore()
      .collection('answers')
      .where('uid', '==', sourceUID)
      .get();
    
    if (sourceAnswersQuery && !sourceAnswersQuery.empty) {
      const batch = firestore().batch();
      let batchCount = 0;
      const BATCH_LIMIT = 500;
      
      for (const answerDoc of sourceAnswersQuery.docs) {
        const answerData = answerDoc.data();
        const questionId = answerData.question_id;
        const newAnswerDocId = `${targetUID}_${questionId}`;
        const newAnswerRef = firestore().collection('answers').doc(newAnswerDocId);
        
        // B기기 기존 데이터는 이미 삭제했으므로 바로 추가
        batch.set(newAnswerRef, {
          ...answerData,
          uid: targetUID,
        });
        batchCount++;
        
        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          console.log(`[DeviceTransfer] answers 마이그레이션 배치 커밋: ${batchCount}개`);
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`[DeviceTransfer] answers 마이그레이션 최종 배치 커밋: ${batchCount}개`);
      }
      
      console.log(`[DeviceTransfer] answers 컬렉션 마이그레이션 완료: ${sourceAnswersQuery.size}개 문서`);
    }
    
    // 7. point_history 컬렉션 마이그레이션
    let sourcePointHistoryQuery: FirebaseFirestoreTypes.QuerySnapshot | null = null;
    try {
      sourcePointHistoryQuery = await firestore()
        .collection('point_history')
        .where('uid', '==', sourceUID)
        .get();
      
      if (!sourcePointHistoryQuery.empty) {
        const batch = firestore().batch();
        let batchCount = 0;
        const BATCH_LIMIT = 500;
        
        for (const historyDoc of sourcePointHistoryQuery.docs) {
          const historyData = historyDoc.data();
          const newHistoryRef = firestore().collection('point_history').doc();
          
          batch.set(newHistoryRef, {
            ...historyData,
            uid: targetUID,
          });
          batchCount++;
          
          if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            console.log(`[DeviceTransfer] point_history 마이그레이션 배치 커밋: ${batchCount}개`);
            batchCount = 0;
          }
        }
        
        if (batchCount > 0) {
          await batch.commit();
          console.log(`[DeviceTransfer] point_history 마이그레이션 최종 배치 커밋: ${batchCount}개`);
        }
        
        console.log(`[DeviceTransfer] point_history 컬렉션 마이그레이션 완료: ${sourcePointHistoryQuery.size}개 문서`);
      }
    } catch (pointHistoryError) {
      console.warn('[DeviceTransfer] point_history 마이그레이션 실패 (무시):', pointHistoryError);
    }
    
    // 8. livepick_participations 컬렉션 마이그레이션
    let sourceParticipationsQuery: FirebaseFirestoreTypes.QuerySnapshot | null = null;
    try {
      sourceParticipationsQuery = await firestore()
        .collection('livepick_participations')
        .where('uid', '==', sourceUID)
        .get();
      
      if (!sourceParticipationsQuery.empty) {
        const batch = firestore().batch();
        let batchCount = 0;
        const BATCH_LIMIT = 500;
        
        for (const participationDoc of sourceParticipationsQuery.docs) {
          const participationData = participationDoc.data();
          const questionId = participationData.questionId;
          const newParticipationDocId = `${targetUID}_${questionId}`;
          const newParticipationRef = firestore().collection('livepick_participations').doc(newParticipationDocId);
          
          // B기기 기존 데이터는 이미 삭제했으므로 바로 추가
          batch.set(newParticipationRef, {
            ...participationData,
            uid: targetUID,
          });
          batchCount++;
          
          if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            console.log(`[DeviceTransfer] livepick_participations 마이그레이션 배치 커밋: ${batchCount}개`);
            batchCount = 0;
          }
        }
        
        if (batchCount > 0) {
          await batch.commit();
          console.log(`[DeviceTransfer] livepick_participations 마이그레이션 최종 배치 커밋: ${batchCount}개`);
        }
        
        console.log(`[DeviceTransfer] livepick_participations 컬렉션 마이그레이션 완료: ${sourceParticipationsQuery.size}개 문서`);
      }
    } catch (participationsError) {
      console.warn('[DeviceTransfer] livepick_participations 마이그레이션 실패 (무시):', participationsError);
    }
    
    // 9. user_push_tokens 컬렉션 마이그레이션 (선택적 - 새 기기에서 다시 등록할 수 있음)
    try {
      const sourcePushTokenRef = firestore().collection('user_push_tokens').doc(sourceUID);
      const sourcePushTokenDoc = await sourcePushTokenRef.get();
      
      if (sourcePushTokenDoc.exists) {
        const pushTokenData = sourcePushTokenDoc.data();
        if (pushTokenData) {
          const targetPushTokenRef = firestore().collection('user_push_tokens').doc(targetUID);
          await targetPushTokenRef.set({
            ...pushTokenData,
            uid: targetUID,
          });
          console.log(`[DeviceTransfer] user_push_tokens 마이그레이션 완료`);
        }
      }
    } catch (pushTokenError) {
      console.warn('[DeviceTransfer] user_push_tokens 마이그레이션 실패 (무시):', pushTokenError);
    }
    
    // 10. user_notifications 컬렉션 마이그레이션
    let sourceNotificationsQuery: FirebaseFirestoreTypes.QuerySnapshot | null = null;
    try {
      sourceNotificationsQuery = await firestore()
        .collection('user_notifications')
        .where('uid', '==', sourceUID)
        .get();
      
      if (!sourceNotificationsQuery.empty) {
        const batch = firestore().batch();
        let batchCount = 0;
        const BATCH_LIMIT = 500;
        
        for (const notificationDoc of sourceNotificationsQuery.docs) {
          const notificationData = notificationDoc.data();
          const newNotificationRef = firestore().collection('user_notifications').doc();
          
          batch.set(newNotificationRef, {
            ...notificationData,
            uid: targetUID,
          });
          batchCount++;
          
          if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            console.log(`[DeviceTransfer] user_notifications 마이그레이션 배치 커밋: ${batchCount}개`);
            batchCount = 0;
          }
        }
        
        if (batchCount > 0) {
          await batch.commit();
          console.log(`[DeviceTransfer] user_notifications 마이그레이션 최종 배치 커밋: ${batchCount}개`);
        }
        
        console.log(`[DeviceTransfer] user_notifications 컬렉션 마이그레이션 완료: ${sourceNotificationsQuery.size}개 문서`);
      }
    } catch (notificationsError) {
      console.warn('[DeviceTransfer] user_notifications 마이그레이션 실패 (무시):', notificationsError);
    }
    
    // 11. 원본 기기(A기기) 데이터 삭제 시작
    console.log(`[DeviceTransfer] 원본 기기 데이터 삭제 시작: ${sourceUID}`);
    
    // 11-1. 원본 users 삭제
    await sourceUserRef.delete();
    console.log(`[DeviceTransfer] 원본 사용자 데이터 삭제 완료: ${sourceUID}`);
    
    // 11-2. 원본 answers 삭제
    if (sourceAnswersQuery && !sourceAnswersQuery.empty) {
      const batch = firestore().batch();
      let batchCount = 0;
      const BATCH_LIMIT = 500;
      
      for (const answerDoc of sourceAnswersQuery.docs) {
        batch.delete(answerDoc.ref);
        batchCount++;
        
        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          console.log(`[DeviceTransfer] 원본 answers 삭제 배치 커밋: ${batchCount}개`);
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`[DeviceTransfer] 원본 answers 삭제 최종 배치 커밋: ${batchCount}개`);
      }
      
      console.log(`[DeviceTransfer] 원본 answers 삭제 완료: ${sourceAnswersQuery.size}개 문서`);
    }
    
    // 11-3. 원본 point_history 삭제
    if (sourcePointHistoryQuery && !sourcePointHistoryQuery.empty) {
      const batch = firestore().batch();
      let batchCount = 0;
      const BATCH_LIMIT = 500;
      
      for (const historyDoc of sourcePointHistoryQuery.docs) {
        batch.delete(historyDoc.ref);
        batchCount++;
        
        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          console.log(`[DeviceTransfer] 원본 point_history 삭제 배치 커밋: ${batchCount}개`);
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`[DeviceTransfer] 원본 point_history 삭제 최종 배치 커밋: ${batchCount}개`);
      }
      
      console.log(`[DeviceTransfer] 원본 point_history 삭제 완료: ${sourcePointHistoryQuery.size}개 문서`);
    }
    
    // 11-4. 원본 livepick_participations 삭제
    if (sourceParticipationsQuery && !sourceParticipationsQuery.empty) {
      const batch = firestore().batch();
      let batchCount = 0;
      const BATCH_LIMIT = 500;
      
      for (const participationDoc of sourceParticipationsQuery.docs) {
        batch.delete(participationDoc.ref);
        batchCount++;
        
        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          console.log(`[DeviceTransfer] 원본 livepick_participations 삭제 배치 커밋: ${batchCount}개`);
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`[DeviceTransfer] 원본 livepick_participations 삭제 최종 배치 커밋: ${batchCount}개`);
      }
      
      console.log(`[DeviceTransfer] 원본 livepick_participations 삭제 완료: ${sourceParticipationsQuery.size}개 문서`);
    }
    
    // 11-5. 원본 user_push_tokens 삭제
    try {
      const sourcePushTokenRef = firestore().collection('user_push_tokens').doc(sourceUID);
      const sourcePushTokenDoc = await sourcePushTokenRef.get();
      if (sourcePushTokenDoc.exists) {
        await sourcePushTokenRef.delete();
        console.log(`[DeviceTransfer] 원본 user_push_tokens 삭제 완료`);
      }
    } catch (pushTokenDeleteError) {
      console.warn('[DeviceTransfer] 원본 user_push_tokens 삭제 실패 (무시):', pushTokenDeleteError);
    }
    
    // 11-6. 원본 user_notifications 삭제
    if (sourceNotificationsQuery && !sourceNotificationsQuery.empty) {
      const batch = firestore().batch();
      let batchCount = 0;
      const BATCH_LIMIT = 500;
      
      for (const notificationDoc of sourceNotificationsQuery.docs) {
        batch.delete(notificationDoc.ref);
        batchCount++;
        
        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          console.log(`[DeviceTransfer] 원본 user_notifications 삭제 배치 커밋: ${batchCount}개`);
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`[DeviceTransfer] 원본 user_notifications 삭제 최종 배치 커밋: ${batchCount}개`);
      }
      
      console.log(`[DeviceTransfer] 원본 user_notifications 삭제 완료: ${sourceNotificationsQuery.size}개 문서`);
    }
    
    console.log(`[DeviceTransfer] 원본 기기 모든 데이터 삭제 완료: ${sourceUID}`);
    
    // 12. 연동 정보를 사용됨으로 표시
    await transferRef.update({
      used: true,
      transferredTo: targetUID,
      transferredAt: firestore.FieldValue.serverTimestamp(),
    });
    
    console.log(`[DeviceTransfer] 연동 완료: ${sourceUID} → ${targetUID}`);
    return { success: true };
  } catch (error: any) {
    console.error('[DeviceTransfer] 연동 실패:', error);
    return { success: false, error: error.message || '연동 중 오류가 발생했습니다.' };
  }
}

/**
 * 연동 준비 정보 확인 (UID로)
 */
export async function getTransferInfo(uid: string): Promise<{
  exists: boolean;
  password?: string;
  expiresAt?: Date;
  used?: boolean;
}> {
  try {
    const transferRef = firestore().collection('device_transfers').doc(uid);
    const transferDoc = await transferRef.get();
    
    if (!transferDoc.exists) {
      return { exists: false };
    }
    
    const data = transferDoc.data();
    if (!data) {
      return { exists: false };
    }
    
    return {
      exists: true,
      password: data.password,
      expiresAt: data.expiresAt ? (data.expiresAt as FirebaseFirestoreTypes.Timestamp).toDate() : undefined,
      used: data.used || false,
    };
  } catch (error) {
    console.error('[DeviceTransfer] 연동 정보 확인 실패:', error);
    return { exists: false };
  }
}

/**
 * A기기에서 연동 완료를 실시간으로 감지하는 리스너를 등록합니다.
 * B기기에서 연동을 완료하면 device_transfers 문서의 used 필드가 true로 변경되고,
 * A기기에서 이를 감지하여 콜백을 호출합니다.
 * @param uid 현재 기기의 UID (연동 준비한 기기)
 * @param onTransferCompleted 연동 완료 시 호출될 콜백 (사용자 데이터가 삭제되었는지 확인 후 호출)
 * @returns 리스너 해제 함수
 */
export function watchDeviceTransferCompletion(
  uid: string,
  onTransferCompleted: () => void
): () => void {
  console.log(`[DeviceTransfer] 연동 완료 감시 시작: ${uid}`);
  
  const transferRef = firestore().collection('device_transfers').doc(uid);
  
  const unsubscribe = transferRef.onSnapshot(
    async (snapshot) => {
      if (!snapshot.exists) {
        console.log('[DeviceTransfer] 연동 정보 문서가 존재하지 않음');
        return;
      }
      
      const data = snapshot.data();
      if (!data) {
        return;
      }
      
      const isUsed = data.used === true;
      console.log(`[DeviceTransfer] 연동 상태 확인: used=${isUsed}`);
      
      if (isUsed) {
        console.log('[DeviceTransfer] ✅ 연동 완료 감지! 사용자 데이터 삭제 확인 중...');
        
        // 사용자 데이터가 실제로 삭제되었는지 확인
        const userRef = firestore().collection('users').doc(uid);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
          console.log('[DeviceTransfer] ✅ 사용자 데이터 삭제 확인됨. 콜백 호출');
          // 리스너 해제 (한 번만 실행되도록)
          unsubscribe();
          onTransferCompleted();
        } else {
          console.log('[DeviceTransfer] ⏳ 사용자 데이터가 아직 존재함. 삭제 대기 중...');
        }
      }
    },
    (error) => {
      console.error('[DeviceTransfer] 연동 완료 감시 중 오류:', error);
    }
  );
  
  return unsubscribe;
}

