import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
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
      // Android: expo-application의 installationId 사용 (앱 재설치 시에도 유지됨)
      // 주의: 같은 앱 서명으로 재설치하는 경우에만 동일한 ID가 생성됨
      try {
        // 방법 1: expo-application의 installationId 사용 (우선순위 1)
        try {
          const installationId = await Application.getInstallationIdAsync();
          if (installationId && installationId.length > 0) {
            hardwareId = installationId;
            hardwareIdSource = 'installationId';
            console.log('📱 Android Installation ID 가져오기 성공 (expo-application):', hardwareId);
          }
        } catch (installError) {
          console.warn('⚠️ [getDeviceUID] expo-application에서 Installation ID 가져오기 실패:', installError);
        }
        
        // 방법 2: React Native NativeModules를 통한 직접 접근 (최후의 수단)
        // 주의: NativeModules.PlatformConstants.AndroidID는 React Native에서 직접 제공하지 않음
        // 실제로는 네이티브 모듈을 만들어야 하지만, 여기서는 시도만 함
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
          console.error('❌ [getDeviceUID] expo-application, NativeModules 모두 실패');
        }
      } catch (e) {
        console.error('❌ [getDeviceUID] Android ID 가져오기 전체 프로세스 실패:', e);
      }
    } else if (Platform.OS === 'ios') {
      // iOS: Identifier for Vendor (IDFV) 또는 installationId 사용
      // 주의: 앱 삭제 후 재설치 시 변경될 수 있음
      try {
        // 방법 1: expo-application의 installationId 사용 (앱 재설치 시에도 유지됨)
        try {
          const installationId = await Application.getInstallationIdAsync();
          if (installationId && installationId.length > 0) {
            hardwareId = installationId;
            hardwareIdSource = 'installationId';
            console.log('📱 iOS Installation ID 가져오기 성공 (expo-application):', hardwareId);
          }
        } catch (installError) {
          console.warn('⚠️ [getDeviceUID] expo-application에서 Installation ID 가져오기 실패:', installError);
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
    // (이전에 하드웨어 기반으로 생성된 경우)
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const deviceUIDKey = allKeys.find(key => key === 'deviceUID');
      
      if (deviceUIDKey) {
        const existingUID = await AsyncStorage.getItem('deviceUID');
        if (existingUID && existingUID.startsWith('device_')) {
          // 하드웨어 기반인지 확인 (랜덤 기반이 아닌 경우)
          const isHardwareBased = !existingUID.includes('_') || existingUID.match(/^device_[a-f0-9]{16,}$/i);
          if (isHardwareBased) {
            console.warn('⚠️ [getDeviceUID] 기존 deviceUID 사용 (하드웨어 기반으로 추정):', existingUID);
            return existingUID;
          }
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


