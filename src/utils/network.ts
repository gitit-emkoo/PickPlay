import firestore from '@react-native-firebase/firestore';

/**
 * 네트워크 연결 상태를 확인합니다 (Firestore 연결 시도).
 * @returns 인터넷 연결 여부
 */
export const checkNetworkConnection = async (): Promise<boolean> => {
  try {
    // Firestore 연결을 시도하여 네트워크 상태 확인
    // 간단한 쿼리를 타임아웃과 함께 실행
    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), 3000); // 3초 타임아웃
    });

    const connectionPromise = firestore()
      .collection('_network_check')
      .limit(1)
      .get()
      .then(() => true)
      .catch(() => false);

    return await Promise.race([connectionPromise, timeoutPromise]);
  } catch (error) {
    console.error('[Network] 네트워크 상태 확인 실패:', error);
    return false;
  }
};

