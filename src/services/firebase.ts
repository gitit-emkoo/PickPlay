import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
export { watchAuth, ensureAnonymousAuth } from './authGuard';
export { ensureAnonymousAuth as forceAnonymousAuth } from './authGuard';

// 네이티브 SDK 초기화는 google-services.json / GoogleService-Info.plist로 자동 처리됩니다.
// firestore()는 모듈 레벨에서 즉시 호출하지 않고, 함수로 감싸서 지연 초기화합니다.
// 이렇게 하면 Firebase가 완전히 초기화된 후에만 호출됩니다.
// React Native Firebase 공식 문서 권장사항: 모듈 레벨에서 즉시 호출하지 말고 함수로 감싸기
export const getDb = () => firestore();

export async function getDeviceUID(): Promise<string> {
  try {
    let deviceUID = await AsyncStorage.getItem('deviceUID');
    if (!deviceUID) {
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


