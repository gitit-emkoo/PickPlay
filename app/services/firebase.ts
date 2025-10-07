import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
export { watchAuth, ensureAnonymousAuth } from '@/src/services/authGuard';
import firestore from '@react-native-firebase/firestore';

// 네이티브 SDK 초기화는 google-services.json / GoogleService-Info.plist로 자동 처리됩니다.
// Firestore 인스턴스 (네이티브)
export const db = firestore();

// 기기별 고유 ID 생성 (기기마다 고정)
export async function getDeviceUID(): Promise<string> {
  try {
    let deviceUID = await AsyncStorage.getItem('deviceUID');
    
    if (!deviceUID) {
      // 기기별 고유 ID가 없으면 생성
      deviceUID = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('deviceUID', deviceUID);
      console.log('📱 새로운 기기 ID 생성:', deviceUID);
    } else {
      console.log('📱 기존 기기 ID 사용:', deviceUID);
    }
    
    return deviceUID;
  } catch (error) {
    console.error('기기 ID 생성 실패:', error);
    return `device_fallback_${Date.now()}`;
  }
}

// 저장된 UID 확인
async function getSavedUID(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem('userUID');
  } catch (error) {
    return null;
  }
}

// UID 저장
async function saveUID(uid: string): Promise<void> {
  try {
    await AsyncStorage.setItem('userUID', uid);
  } catch (error) {
    // 에러 무시
  }
}

// 저장된 사용자 데이터 확인
async function getSavedUserData(): Promise<{ points: number; streakCount: number; lastAnswerDate: string } | null> {
  try {
    const data = await AsyncStorage.getItem('userData');
    return data ? JSON.parse(data) : null;
  } catch (error) {
    return null;
  }
}

// 사용자 데이터 저장
async function saveUserData(data: { points: number; streakCount: number; lastAnswerDate: string }): Promise<void> {
  try {
    await AsyncStorage.setItem('userData', JSON.stringify(data));
  } catch (error) {
    // 에러 무시
  }
}

// Firebase 익명 로그인 감시 (실제 Firebase UID 사용 보장)
// watchAuth는 authGuard에서 제공하는 구현을 사용합니다.

// 앱 시작/중요 동작 전 익명 인증 강제 실행 (항상 실제 사용자 확보)
// forceAnonymousAuth는 ensureAnonymousAuth 별칭으로 사용합니다.
export { ensureAnonymousAuth as forceAnonymousAuth } from './authGuard';
