import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

// Firebase 콘솔 설정 (플랫폼 분기)
const iosConfig = {
  apiKey: "AIzaSyAfKqr2opuHza9hkXFmofPGg4t_HVOmcpk",
  authDomain: "today-balance-fa0a5.firebaseapp.com",
  projectId: "today-balance-fa0a5",
  storageBucket: "today-balance-fa0a5.firebasestorage.app",
  messagingSenderId: "981215713715",
  appId: "1:981215713715:ios:9c812d5a30fea59b9c53c6",
  measurementId: "G-HY604P5WG3",
};

const androidConfig = {
  apiKey: "AIzaSyDAyQGN1q5K9GhoNdDmNt65PH37dVL-5xA",
  authDomain: "today-balance-fa0a5.firebaseapp.com",
  projectId: "today-balance-fa0a5",
  storageBucket: "today-balance-fa0a5.firebasestorage.app",
  messagingSenderId: "981215713715",
  appId: "1:981215713715:android:820a3f60db5067369c53c6",
};

const firebaseConfig = Platform.OS === 'ios' ? iosConfig : androidConfig;

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

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
export function watchAuth(callback: (user: { uid: string } | null) => void) {
  const unsub = auth.onAuthStateChanged(async (u: any) => {
    try {
      if (u) {
        await saveUID(u.uid);
        callback({ uid: u.uid });
        return;
      }
      // 로그인 사용자가 없으면 반드시 익명 로그인 실행
      const result = await signInAnonymously(auth);
      const uid = result.user.uid;
      await saveUID(uid);
      callback({ uid });
    } catch (error) {
      console.error('익명 로그인 실패:', error);
      callback(null);
    }
  });
  return unsub;
}

// 앱 시작/중요 동작 전 익명 인증 강제 실행 (항상 실제 사용자 확보)
export async function forceAnonymousAuth() {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      return currentUser;
    }
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error('강제 익명 인증 실패:', error);
    return null;
  }
}
