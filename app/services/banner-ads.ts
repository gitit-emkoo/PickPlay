import { Platform } from 'react-native';

const BANNER_AD_UNIT_IDS = {
  android: 'ca-app-pub-3940256099942544/6300978111', // 테스트 광고
  ios: 'ca-app-pub-3940256099942544/2934735716', // 테스트 광고
  // 실제 광고 ID (AdMob 계정 복구 시 사용)
  // android: 'ca-app-pub-2555567440328829/6607319419', // 실제 광고
  // ios: 'ca-app-pub-2555567440328829/7449627792' // 실제 광고
};

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
    console.log(`🔧 모드: 테스트 (AdMob 계정 일시정지)`);
    console.log(`📱 플랫폼: ${Platform.OS}`);

    return adUnitId;
  } catch (error) {
    console.error('❌ react-native-google-mobile-ads 모듈을 찾을 수 없습니다.');
    return null; // 네이티브 모듈이 없는 경우 null 반환
  }
}
