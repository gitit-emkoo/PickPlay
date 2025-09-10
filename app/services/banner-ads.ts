import { Platform } from 'react-native';

const BANNER_AD_UNIT_IDS = {
  android: 'ca-app-pub-3940256099942544/6300978111', // 테스트 광고
  // android: 'ca-app-pub-2555567440328829/6607319419', // 실제 광고 (한달 후 복구)
  ios: 'ca-app-pub-2555567440328829/7449627792'
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
    const { TestIds } = require('react-native-google-mobile-ads');
    const platformAdUnitId = Platform.OS === 'ios' ? BANNER_AD_UNIT_IDS.ios : BANNER_AD_UNIT_IDS.android;
    const adUnitId = __DEV__ ? TestIds.BANNER : platformAdUnitId;
    
    console.log(`🎯 배너 광고 ID 가져오기: ${adUnitId}`);
    console.log(`🔧 모드: ${__DEV__ ? '개발 (테스트 광고)' : '프로덕션 (실제 광고)'}`);
    console.log(`📱 플랫폼: ${Platform.OS}`);

    return adUnitId;
  } catch (error) {
    console.error('❌ react-native-google-mobile-ads 모듈을 찾을 수 없습니다.');
    return null; // 네이티브 모듈이 없는 경우 null 반환
  }
}
