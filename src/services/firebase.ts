import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
export { watchAuth, ensureAnonymousAuth, getPreviousUID } from './authGuard';
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
 * 
 * @returns deviceUID와 함께 하드웨어 ID 기반인지 여부를 반환
 */
export async function getDeviceUID(): Promise<string> {
  try {
    // 1. AsyncStorage에서 먼저 확인 (앱 업데이트 시 유지)
    let deviceUID = await AsyncStorage.getItem('deviceUID');
    
    if (deviceUID) {
      // 기존 deviceUID가 하드웨어 ID 기반인지 확인
      const isHardwareBased = deviceUID.startsWith('device_') && !deviceUID.includes('_') || deviceUID.match(/^device_[a-f0-9]{16}$/i);
      if (isHardwareBased) {
        console.log('📱 기존 기기 ID 사용 (AsyncStorage, 하드웨어 기반):', deviceUID);
      } else {
        console.log('📱 기존 기기 ID 사용 (AsyncStorage, 랜덤 기반):', deviceUID);
        console.warn('⚠️ [getDeviceUID] 랜덤 기반 deviceUID 사용 중. 앱 재설치 시 기존 사용자 데이터 복구가 어려울 수 있습니다.');
      }
      return deviceUID;
    }
    
    // 2. AsyncStorage에 없으면 기기 고유 ID 사용
    let hardwareId: string | null = null;
    let hardwareIdSource: string = 'unknown';
    
    if (Platform.OS === 'android') {
      // Android: expo-application의 getAndroidIdAsync() 사용
      // 앱 서명이 같으면 동일한 ID 유지 (앱 업데이트 시에도 동일)
      // 주의: 기기 초기화 시 변경될 수 있음
      try {
        hardwareId = await Application.getAndroidIdAsync();
        if (hardwareId) {
          hardwareIdSource = 'Android ID (expo-application)';
          console.log('📱 Android ID 가져오기 성공:', hardwareId);
        } else {
          console.warn('⚠️ [getDeviceUID] Android ID를 가져올 수 없습니다.');
        }
      } catch (e) {
        console.error('❌ [getDeviceUID] Android ID 가져오기 실패:', e);
      }
    } else if (Platform.OS === 'ios') {
      // iOS: expo-application의 getIosIdForVendorAsync() 사용
      // 같은 벤더의 앱들 간 동일한 ID 제공
      // 앱 업데이트 시 동일한 ID 유지, 하지만 앱 삭제 후 재설치 시 변경될 수 있음
      try {
        hardwareId = await Application.getIosIdForVendorAsync();
        if (hardwareId) {
          hardwareIdSource = 'iOS ID for Vendor (expo-application)';
          console.log('📱 iOS ID for Vendor 가져오기 성공:', hardwareId);
        } else {
          console.warn('⚠️ [getDeviceUID] iOS ID for Vendor를 가져올 수 없습니다.');
        }
      } catch (e) {
        console.error('❌ [getDeviceUID] iOS ID for Vendor 가져오기 실패:', e);
      }
    }
    
    if (hardwareId) {
      // 기기 고유 ID를 deviceUID로 사용하고 AsyncStorage에 저장
      deviceUID = `device_${hardwareId}`;
      await AsyncStorage.setItem('deviceUID', deviceUID);
      console.log(`✅ [getDeviceUID] 기기 고유 ID를 deviceUID로 저장 (${hardwareIdSource}):`, deviceUID);
      console.log('✅ [getDeviceUID] 앱 재설치 후에도 동일한 deviceUID가 생성되어 기존 사용자 데이터를 복구할 수 있습니다.');
      return deviceUID;
    }
    
    // 3. Fallback: 기기 고유 ID를 가져올 수 없으면 랜덤 ID 생성
    console.error('❌ [getDeviceUID] 하드웨어 ID를 가져올 수 없어 랜덤 ID를 생성합니다.');
    console.error('❌ [getDeviceUID] 이 경우 앱 재설치 시 기존 사용자 데이터 복구가 불가능할 수 있습니다.');
    console.error('❌ [getDeviceUID] AsyncStorage에서 기존 userData_ 키를 찾아 복구를 시도합니다.');
    deviceUID = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await AsyncStorage.setItem('deviceUID', deviceUID);
    console.log('📱 새로운 기기 ID 생성 (Fallback, 랜덤):', deviceUID);
    return deviceUID;
  } catch (error) {
    console.error('❌ [getDeviceUID] 기기 ID 생성 실패:', error);
    const fallbackUID = `device_fallback_${Date.now()}`;
    console.error('❌ [getDeviceUID] Fallback ID 사용:', fallbackUID);
    return fallbackUID;
  }
}


