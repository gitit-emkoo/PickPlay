import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
export { watchAuth, ensureAnonymousAuth } from './authGuard';
export { ensureAnonymousAuth as forceAnonymousAuth } from './authGuard';

// 네이티브 SDK 초기화는 google-services.json / GoogleService-Info.plist로 자동 처리됩니다.
// firestore()는 모듈 레벨에서 즉시 호출하지 않고, 함수로 감싸서 지연 초기화합니다.
// 이렇게 하면 Firebase가 완전히 초기화된 후에만 호출됩니다.
// React Native Firebase 공식 문서 권장사항: 모듈 레벨에서 즉시 호출하지 말고 함수로 감싸기
export const getDb = () => firestore();

/**
 * 기기 고유 ID를 가져옵니다.
 * 우선순위:
 * 1. AsyncStorage에 저장된 deviceUID (앱 업데이트 시 유지)
 * 2. 기기 고유 ID (Android ID 또는 iOS Identifier for Vendor)
 * 3. Fallback: 랜덤 ID 생성
 * 
 * 이렇게 하면 앱을 삭제 후 재설치해도 같은 기기에서는 동일한 ID가 생성되어
 * 기존 사용자 데이터를 복구할 수 있습니다.
 */
export async function getDeviceUID(): Promise<string> {
  try {
    // 1. AsyncStorage에서 먼저 확인 (앱 업데이트 시 유지)
    let deviceUID = await AsyncStorage.getItem('deviceUID');
    
    if (deviceUID) {
      console.log('📱 기존 기기 ID 사용 (AsyncStorage):', deviceUID);
      return deviceUID;
    }
    
    // 2. AsyncStorage에 없으면 기기 고유 ID 사용
    let hardwareId: string | null = null;
    
    if (Platform.OS === 'android') {
      // Android: Android ID 사용 (앱 서명이 같으면 동일한 ID)
      // 주의: 기기 초기화 시 변경될 수 있음
      // expo-device v7에서는 androidId가 없을 수 있으므로 타입 체크
      try {
        hardwareId = (Device as any).androidId || null;
        if (hardwareId) {
          console.log('📱 Android ID 사용:', hardwareId);
        }
      } catch (e) {
        console.warn('📱 Android ID 가져오기 실패:', e);
      }
    } else if (Platform.OS === 'ios') {
      // iOS: osInternalBuildId 사용 (앱 재설치 시 유지됨)
      // 주의: 완벽하지 않지만 대부분의 경우 동일한 ID 유지
      try {
        hardwareId = (Device as any).osInternalBuildId || Device.modelId || null;
        if (hardwareId) {
          console.log('📱 iOS 기기 ID 사용:', hardwareId);
        }
      } catch (e) {
        console.warn('📱 iOS 기기 ID 가져오기 실패:', e);
      }
    }
    
    if (hardwareId) {
      // 기기 고유 ID를 deviceUID로 사용하고 AsyncStorage에 저장
      deviceUID = `device_${hardwareId}`;
      await AsyncStorage.setItem('deviceUID', deviceUID);
      console.log('📱 기기 고유 ID를 deviceUID로 저장:', deviceUID);
      return deviceUID;
    }
    
    // 3. Fallback: 기기 고유 ID를 가져올 수 없으면 랜덤 ID 생성
    deviceUID = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await AsyncStorage.setItem('deviceUID', deviceUID);
    console.log('📱 새로운 기기 ID 생성 (Fallback):', deviceUID);
    return deviceUID;
  } catch (error) {
    console.error('기기 ID 생성 실패:', error);
    return `device_fallback_${Date.now()}`;
  }
}


