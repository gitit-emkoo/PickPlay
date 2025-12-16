import { Platform } from 'react-native';
import * as TrackingTransparency from 'expo-tracking-transparency';

// 배너 광고 단위 ID (실서비스용) - 테스트 기간 동안 주석 처리
// const BANNER_AD_UNIT_IDS = {
//   android: 'ca-app-pub-2555567440328829/6607319419',
//   ios: 'ca-app-pub-2555567440328829/7449627792'
// };

// 테스트 배너 광고 ID (AdMob 공식 테스트 ID)
const TEST_BANNER_AD_UNIT_IDS = {
  android: 'ca-app-pub-3940256099942544/6300978111', // Banner Android
  ios: 'ca-app-pub-3940256099942544/2934735716' // Banner iOS
};

// 테스트 기간 동안 테스트 ID 사용
const BANNER_AD_UNIT_IDS = TEST_BANNER_AD_UNIT_IDS;

// Expo Go 환경 감지
export const isExpoGo = () => {
  try {
    return typeof (global as any).Expo !== 'undefined' && 
           (global as any).Expo.Constants?.appOwnership === 'expo';
  } catch {
    return false;
  }
};

export const getBannerAdUnitId = () => {
  try {
    const platformAdUnitId = Platform.OS === 'ios' ? BANNER_AD_UNIT_IDS.ios : BANNER_AD_UNIT_IDS.android;
    const adUnitId = platformAdUnitId;
    
    console.log(`🎯 배너 광고 ID 가져오기: ${adUnitId}`);
    console.log(`🔧 모드: 테스트 (테스트 기간)`);
    console.log(`📱 플랫폼: ${Platform.OS}`);
    console.log(`🆔 테스트 광고 ID 사용 중`);

    return adUnitId;
  } catch (error) {
    console.error('❌ react-native-google-mobile-ads 모듈을 찾을 수 없습니다.');
    return null; // 네이티브 모듈이 없는 경우 null 반환
  }
}

// 광고 추적 권한 상태 확인
export async function getBannerAdRequestOptions(): Promise<{ requestNonPersonalizedAdsOnly: boolean }> {
  if (Platform.OS !== 'ios') {
    // Android는 광고 추적 권한이 항상 허용된 것으로 간주
    return { requestNonPersonalizedAdsOnly: false };
  }
  
  try {
    const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
    const hasTrackingPermission = status === 'granted';
    console.log(`🔐 배너 광고 추적 권한: ${hasTrackingPermission ? '허용' : '거부'}`);
    return { requestNonPersonalizedAdsOnly: !hasTrackingPermission };
  } catch (error) {
    console.warn('[BannerAds] 광고 추적 권한 확인 실패:', error);
    return { requestNonPersonalizedAdsOnly: true };
  }
}
