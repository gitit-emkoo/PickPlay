import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import functionsModule from '@react-native-firebase/functions';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform, NativeModules } from 'react-native';
export { watchAuth, ensureAnonymousAuth, getPreviousUID } from './authGuard';
export { ensureAnonymousAuth as forceAnonymousAuth } from './authGuard';

// 네이티브 SDK 초기화는 google-services.json / GoogleService-Info.plist로 자동 처리됩니다.
// firestore()는 모듈 레벨에서 즉시 호출하지 않고, 함수로 감싸서 지연 초기화합니다.
// 이렇게 하면 Firebase가 완전히 초기화된 후에만 호출됩니다.
// React Native Firebase 공식 문서 권장사항: 모듈 레벨에서 즉시 호출하지 말고 함수로 감싸기
export const getDb = () => firestore();

// Firebase Functions 초기화
// React Native Firebase는 region() 메서드를 지원하지 않으므로, httpsCallableFromUrl을 사용해야 합니다.
export const getFunctions = () => functionsModule();

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
  let deviceUID: string; // deviceUID 변수 선언
  
  try {
    // 0. V2 사용자 복구를 위해 기존 AsyncStorage의 deviceUID를 먼저 확인
    // (V2에서 랜덤 기반으로 저장했을 수 있지만, V2 사용자 데이터 복구를 위해 필요)
    try {
      const existingUID = await AsyncStorage.getItem('deviceUID');
      if (existingUID && existingUID.startsWith('device_')) {
        // V2 사용자 복구를 위해 기존 deviceUID가 있으면 먼저 확인
        // (하드웨어 기반이 아니어도 V2 데이터 복구를 위해 사용)
        console.log('📦 [getDeviceUID] 기존 deviceUID 발견 (V2 복구 가능성):', existingUID);
        
        // 기존 deviceUID로 AsyncStorage에 사용자 데이터가 있는지 확인
        const userDataKey = `userData_${existingUID}`;
        const existingUserData = await AsyncStorage.getItem(userDataKey);
        if (existingUserData) {
          console.log('✅ [getDeviceUID] V2 사용자 데이터 발견! 기존 deviceUID 유지:', existingUID);
          // V2 사용자 데이터가 있으면 기존 deviceUID를 유지하여 복구 가능하게 함
          return existingUID;
        }
      }
    } catch (storageError) {
      console.warn('⚠️ [getDeviceUID] 기존 deviceUID 확인 실패:', storageError);
    }
    
    // 1. 하드웨어 ID를 가져와서 사용 (신규 사용자 또는 V2 데이터가 없는 경우)
    
    // 2. 기기 고유 ID 사용 (우선순위: expo-application installationId)
    let hardwareId: string | null = null;
    let hardwareIdSource: string = 'unknown';
    
    if (Platform.OS === 'android') {
      // Android: expo-application의 getAndroidId() 사용
      // 주의: 같은 앱 서명으로 재설치하는 경우에만 동일한 ID가 생성됨
      try {
        // 방법 1: expo-application의 getAndroidId() 사용 (공식 API)
        try {
          const androidId = Application.getAndroidId();
          if (androidId && androidId.length > 0) {
            hardwareId = androidId;
            hardwareIdSource = 'androidId';
            console.log('📱 Android ID 가져오기 성공 (expo-application.getAndroidId):', hardwareId);
          }
        } catch (androidIdError) {
          console.warn('⚠️ [getDeviceUID] expo-application.getAndroidId() 실패:', androidIdError);
        }
        
        // 방법 2: React Native NativeModules를 통한 직접 접근 (최후의 수단)
        // 주의: NativeModules.PlatformConstants.AndroidID는 React Native에서 직접 제공하지 않음
        if (!hardwareId) {
          try {
            const { PlatformConstants } = NativeModules;
            if (PlatformConstants && PlatformConstants.AndroidID) {
              hardwareId = PlatformConstants.AndroidID;
              hardwareIdSource = 'androidId_native';
              console.log('📱 Android ID 가져오기 성공 (NativeModules):', hardwareId);
            }
          } catch (nativeError) {
            console.warn('⚠️ [getDeviceUID] NativeModules에서 Android ID 가져오기 실패:', nativeError);
          }
        }
        
        if (!hardwareId) {
          console.error('❌ [getDeviceUID] 모든 방법으로 Android ID를 가져올 수 없습니다.');
          console.error('❌ [getDeviceUID] expo-application.getAndroidId(), NativeModules 모두 실패');
        }
      } catch (e) {
        console.error('❌ [getDeviceUID] Android ID 가져오기 전체 프로세스 실패:', e);
      }
    } else if (Platform.OS === 'ios') {
      // iOS: Identifier for Vendor (IDFV) 사용
      // 주의: 앱 삭제 후 재설치 시 변경될 수 있음
      try {
        // 방법 1: expo-application의 getIosIdForVendorAsync() 사용 (공식 API)
        try {
          const iosId = await Application.getIosIdForVendorAsync();
          if (iosId && iosId.length > 0) {
            hardwareId = iosId;
            hardwareIdSource = 'iosIdForVendor';
            console.log('📱 iOS ID for Vendor 가져오기 성공 (expo-application.getIosIdForVendorAsync):', hardwareId);
          }
        } catch (iosIdError) {
          console.warn('⚠️ [getDeviceUID] expo-application.getIosIdForVendorAsync() 실패:', iosIdError);
        }
        
        // 방법 2: expo-device의 osInternalBuildId 사용
        if (!hardwareId) {
          if ('osInternalBuildId' in Device && (Device as any).osInternalBuildId) {
            hardwareId = (Device as any).osInternalBuildId;
            hardwareIdSource = 'osInternalBuildId';
            console.log('📱 iOS 기기 ID 가져오기 성공 (osInternalBuildId):', hardwareId);
          } else if (Device.modelId) {
            hardwareId = Device.modelId;
            hardwareIdSource = 'modelId';
            console.log('📱 iOS 기기 ID 가져오기 성공 (modelId):', hardwareId);
          }
        }
        
        if (!hardwareId) {
          console.error('❌ [getDeviceUID] 모든 방법으로 iOS 기기 ID를 가져올 수 없습니다.');
        }
      } catch (e) {
        console.error('❌ [getDeviceUID] iOS 기기 ID 가져오기 전체 프로세스 실패:', e);
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
    
    // 3. Fallback: 기기 고유 ID를 가져올 수 없으면 심각한 경고
    // 랜덤 ID 생성은 최후의 수단으로만 사용 (앱 크래시 방지)
    console.error('❌ [getDeviceUID] ⚠️⚠️⚠️ 심각한 문제: 하드웨어 ID를 가져올 수 없습니다! ⚠️⚠️⚠️');
    console.error('❌ [getDeviceUID] 이 경우 앱 재설치 시 기존 사용자 데이터 복구가 불가능합니다.');
    console.error('❌ [getDeviceUID] expo-device와 expo-application 패키지 설치 및 권한을 확인하세요.');
    console.error('❌ [getDeviceUID] Platform:', Platform.OS, 'Version:', Platform.Version);
    
    // 최후의 수단: 기존 AsyncStorage에 저장된 deviceUID가 있다면 사용
    // (이전에 하드웨어 기반으로 생성된 경우만)
    try {
      const existingUID = await AsyncStorage.getItem('deviceUID');
      if (existingUID && existingUID.startsWith('device_')) {
        // 랜덤 기반인지 확인 (타임스탬프나 랜덤 문자열 포함 여부)
        const isRandomBased = existingUID.match(/device_\d{13}_/); // device_타임스탬프_형식
        if (!isRandomBased) {
          // 하드웨어 기반으로 추정되는 경우만 사용
          console.warn('⚠️ [getDeviceUID] 기존 deviceUID 사용 (하드웨어 기반으로 추정):', existingUID);
          return existingUID;
        } else {
          console.warn('⚠️ [getDeviceUID] 기존 deviceUID가 랜덤 기반입니다. 무시하고 새로 생성합니다.');
        }
      }
    } catch (storageError) {
      console.error('❌ [getDeviceUID] AsyncStorage 확인 실패:', storageError);
    }
    
    // 정말 마지막 수단: 랜덤 ID 생성 (앱 크래시 방지)
    // 하지만 이 경우는 매우 드물어야 하며, 로그에 명확히 기록
    console.error('❌ [getDeviceUID] ⚠️ 최후의 수단: 랜덤 ID 생성 (이것은 정상적이지 않습니다!)');
    deviceUID = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await AsyncStorage.setItem('deviceUID', deviceUID);
    console.error('❌ [getDeviceUID] 생성된 랜덤 deviceUID:', deviceUID);
    console.error('❌ [getDeviceUID] 이 deviceUID는 앱 재설치 시 복구가 불가능합니다!');
    return deviceUID;
  } catch (error) {
    console.error('❌ [getDeviceUID] 기기 ID 생성 실패:', error);
    const fallbackUID = `device_fallback_${Date.now()}`;
    console.error('❌ [getDeviceUID] Fallback ID 사용:', fallbackUID);
    return fallbackUID;
  }
}


