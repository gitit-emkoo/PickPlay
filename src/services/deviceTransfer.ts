import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserData } from '../types';
import { getDeviceUID, getFunctions } from './firebase';

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
  
  // 문서 존재 여부 확인
  const existingDoc = await transferRef.get();
  
  if (!existingDoc.exists) {
    // 문서가 없으면 create
    await transferRef.set({
      uid,
      password,
      createdAt: firestore.FieldValue.serverTimestamp(),
      expiresAt: firestore.Timestamp.fromDate(expiresAt),
      used: false,
    });
  } else {
    // 문서가 있으면 update
    // used: true인 경우에도 재생성 허용 (새로운 연동 준비)
    const existingData = existingDoc.data();
    
    // used: false인 경우 또는 used: true인 경우 모두 재생성 가능
    await transferRef.update({
      uid,
      password,
      createdAt: firestore.FieldValue.serverTimestamp(),
      expiresAt: firestore.Timestamp.fromDate(expiresAt),
      used: false, // 재생성 시 used를 false로 리셋
      transferredTo: firestore.FieldValue.delete(), // 이전 연동 정보 삭제
      transferredAt: firestore.FieldValue.delete(), // 이전 연동 시간 삭제
    });
  }
  
  // 문서 생성 확인
  const verifyDoc = await transferRef.get();
  if (!verifyDoc.exists) {
    throw new Error('연동 준비 정보 저장에 실패했습니다. 다시 시도해주세요.');
  }
  
  console.log(`[DeviceTransfer] 연동 준비 완료: ${uid}, 비밀번호: ${password}`);
  console.log(`[DeviceTransfer] 문서 확인: 존재=${verifyDoc.exists}, 데이터=${JSON.stringify(verifyDoc.data())}`);
  return password;
}

/**
 * 기기 이전 실행 (Cloud Functions 호출)
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
    // 대상 기기 deviceUID 가져오기
    const targetDeviceUID = await getDeviceUID();
    
    // Cloud Functions 호출 (asia-northeast3 리전에 배포된 함수)
    // React Native Firebase는 region() 메서드를 지원하지 않으므로 URL로 직접 호출
    const functions = getFunctions();
    const executeTransfer = functions.httpsCallableFromUrl(
      'https://asia-northeast3-today-balance-fa0a5.cloudfunctions.net/executeDeviceTransfer'
    );
    
    const result = await executeTransfer({
      sourceUID,
      password,
      targetUID,
      targetDeviceUID,
    });
    
    const resultData = result.data as { success?: boolean; error?: string };
    
    if (resultData.success) {
      console.log(`[DeviceTransfer] 연동 완료: ${sourceUID} → ${targetUID}`);
      return { success: true };
    } else {
      console.error(`[DeviceTransfer] 연동 실패:`, resultData.error);
      return { success: false, error: resultData.error || '연동에 실패했습니다.' };
    }
  } catch (error: any) {
    console.error('[DeviceTransfer] 연동 실패:', error);
    console.error('[DeviceTransfer] 에러 상세:', {
      code: error.code,
      message: error.message,
      details: error.details,
      stack: error.stack,
    });
    
    // React Native Firebase Functions 에러 코드 형식: 'functions/not-found', 'functions/permission-denied' 등
    let errorCode = error.code;
    if (typeof errorCode === 'string') {
      // 'functions/not-found' -> 'not-found'로 변환
      if (errorCode.startsWith('functions/')) {
        errorCode = errorCode.replace('functions/', '');
      }
      // 'NOT_FOUND' -> 'not-found'로 변환 (대문자 언더스코어 형식)
      if (errorCode.includes('_')) {
        errorCode = errorCode.toLowerCase().replace(/_/g, '-');
      }
    }
    
    // 에러 메시지에서도 코드 추출 시도
    if (!errorCode && error.message) {
      const message = error.message.toUpperCase();
      if (message.includes('NOT_FOUND') || message.includes('NOT FOUND')) {
        errorCode = 'not-found';
      } else if (message.includes('PERMISSION_DENIED') || message.includes('PERMISSION DENIED')) {
        errorCode = 'permission-denied';
      } else if (message.includes('INVALID_ARGUMENT') || message.includes('INVALID ARGUMENT')) {
        errorCode = 'invalid-argument';
      } else if (message.includes('DEADLINE_EXCEEDED') || message.includes('DEADLINE EXCEEDED')) {
        errorCode = 'deadline-exceeded';
      } else if (message.includes('ALREADY_EXISTS') || message.includes('ALREADY EXISTS')) {
        errorCode = 'already-exists';
      } else if (message.includes('UNAUTHENTICATED') || message.includes('UNAUTHENTICATED')) {
        errorCode = 'unauthenticated';
      }
    }
    
    const errorMessages: Record<string, string> = {
      'not-found': '연동 준비 정보를 찾을 수 없습니다. A기기에서 연동 준비를 다시 해주세요.',
      'invalid-argument': '유효하지 않은 연동 정보입니다.',
      'permission-denied': '비밀번호가 일치하지 않거나 권한이 없습니다.',
      'deadline-exceeded': '연동 준비가 만료되었습니다. (24시간 초과)',
      'already-exists': '이미 사용된 연동 정보입니다.',
      'unauthenticated': '인증에 실패했습니다. 다시 로그인해주세요.',
      'internal': error.message || '연동 중 오류가 발생했습니다.',
    };
    
    return { 
      success: false, 
      error: errorMessages[errorCode || ''] || error.message || '연동 중 오류가 발생했습니다.' 
    };
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
  
  let hasCalledCallback = false; // 중복 호출 방지
  let checkInterval: ReturnType<typeof setInterval> | null = null; // interval 추적
  
  const unsubscribe = transferRef.onSnapshot(
    async (snapshot) => {
      if (hasCalledCallback) {
        console.log('[DeviceTransfer] 이미 콜백이 호출되었으므로 무시');
        return;
      }
      
      if (!snapshot.exists) {
        console.log('[DeviceTransfer] 연동 정보 문서가 존재하지 않음');
        return;
      }
      
      const data = snapshot.data();
      if (!data) {
        return;
      }
      
      // 연동 완료 확인: used가 true일 때만 연동 완료로 간주
      // transferredTo만으로는 판단하지 않음 (이전 연동의 잔여 데이터일 수 있음)
      const isUsed = data.used === true;
      
      console.log(`[DeviceTransfer] 연동 상태 확인: used=${isUsed}, transferredTo=${data.transferredTo || '없음'}`);
      
      if (isUsed) {
        console.log('[DeviceTransfer] ✅ 연동 완료 감지! 사용자 데이터 삭제 확인 중...');
        
        // 기존 interval이 있다면 먼저 정리
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
        
        // 사용자 데이터가 실제로 삭제되었는지 확인
        const userRef = firestore().collection('users').doc(uid);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
          console.log('[DeviceTransfer] ✅ 사용자 데이터 삭제 확인됨. 콜백 호출');
          hasCalledCallback = true;
          unsubscribe();
          onTransferCompleted();
        } else {
          console.log('[DeviceTransfer] ⏳ 사용자 데이터가 아직 존재함. 삭제 대기 중...');
          // 주기적으로 재확인 (최대 30초)
          let checkCount = 0;
          const maxChecks = 15; // 2초 * 15 = 30초
          
          checkInterval = setInterval(async () => {
            if (hasCalledCallback) {
              if (checkInterval) clearInterval(checkInterval);
              return;
            }
            
            checkCount++;
            const retryUserDoc = await userRef.get();
            
            if (!retryUserDoc.exists) {
              console.log(`[DeviceTransfer] ✅ 재확인 (${checkCount}/${maxChecks}): 사용자 데이터 삭제 확인됨. 콜백 호출`);
              hasCalledCallback = true;
              if (checkInterval) clearInterval(checkInterval);
              unsubscribe();
              onTransferCompleted();
            } else if (checkCount >= maxChecks) {
              console.log('[DeviceTransfer] ⚠️ 타임아웃: 사용자 데이터 삭제 확인 실패. 강제로 콜백 호출');
              hasCalledCallback = true;
              if (checkInterval) clearInterval(checkInterval);
              unsubscribe();
              onTransferCompleted();
            } else {
              console.log(`[DeviceTransfer] ⏳ 사용자 데이터가 아직 존재함. 계속 대기 중... (${checkCount}/${maxChecks})`);
            }
          }, 2000); // 2초마다 재확인
        }
      }
    },
    (error: any) => {
      console.error('[DeviceTransfer] 연동 완료 감시 중 오류:', error);
      console.error('[DeviceTransfer] 에러 상세:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
      });
      // 에러 발생 시에도 interval 정리
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    }
  );
  
  // cleanup 함수 반환 (언마운트 시 호출)
  return () => {
    console.log('[DeviceTransfer] 연동 감시 취소 - 리스너 해제');
    hasCalledCallback = true; // 취소 시 콜백 호출 방지
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    unsubscribe();
  };
}

/**
 * A기기에서 연동 완료 후 AsyncStorage를 정리합니다.
 * 기존 유저 데이터와 previousUID를 삭제하여 새 유저 생성 시 복구 로직이 실행되지 않도록 합니다.
 * @param oldUID 연동된 기존 UID (삭제할 유저 데이터의 deviceUID를 찾기 위해 사용)
 */
export async function cleanupAfterDeviceTransfer(oldUID: string): Promise<void> {
  console.log(`[DeviceTransfer] 연동 완료 후 AsyncStorage 정리 시작: ${oldUID}`);
  
  try {
    // 1. previousUID 삭제 (복구 로직이 실행되지 않도록)
    await AsyncStorage.removeItem('previousFirebaseUID');
    console.log('[DeviceTransfer] previousFirebaseUID 삭제 완료');
    
    // 2. 기존 deviceUID로 저장된 유저 데이터 삭제
    // deviceUID는 하드웨어 기반이므로 유지하되, 해당 deviceUID로 저장된 유저 데이터는 삭제
    const deviceUID = await getDeviceUID();
    const userDataKey = `userData_${deviceUID}`;
    await AsyncStorage.removeItem(userDataKey);
    console.log(`[DeviceTransfer] 기존 유저 데이터 삭제 완료: ${userDataKey}`);
    
    // 3. 추가로 oldUID로 저장된 데이터가 있을 수 있으므로 확인 및 삭제
    // (V2 사용자의 경우 oldUID로 저장된 데이터가 있을 수 있음)
    const oldUserDataKey = `userData_${oldUID}`;
    const oldUserData = await AsyncStorage.getItem(oldUserDataKey);
    if (oldUserData) {
      await AsyncStorage.removeItem(oldUserDataKey);
      console.log(`[DeviceTransfer] oldUID 기반 유저 데이터 삭제 완료: ${oldUserDataKey}`);
    }
    
    console.log('[DeviceTransfer] ✅ AsyncStorage 정리 완료');
  } catch (error) {
    console.error('[DeviceTransfer] ❌ AsyncStorage 정리 실패:', error);
    // 에러가 발생해도 계속 진행 (새 유저 생성은 가능)
  }
}

