import { Platform } from 'react-native';

// Expo Go 환경 감지
const isExpoGo = () => {
  try {
    return typeof (global as any).Expo !== 'undefined' && 
           (global as any).Expo.Constants?.appOwnership === 'expo';
  } catch {
    return false;
  }
};

// 배너 광고 단위 ID (플랫폼별)
const BANNER_AD_UNIT_IDS = {
  android: 'ca-app-pub-2555567440328829/6607319419',
  ios: 'ca-app-pub-2555567440328829/7449627792'
};

// 더미 배너 광고 객체 (Expo Go용)
function createExpoGoDummyBanner() {
  let isLoaded = false;
  
  return {
    load: () => {
      console.log('📱 Expo Go: 더미 배너 광고 로드 시작');
      setTimeout(() => {
        isLoaded = true;
        console.log('📱 Expo Go: 더미 배너 광고 로드 완료');
      }, 1000);
    },
    addAdEventListener: (eventType: string, callback: () => void) => {
      console.log(`📱 Expo Go: 배너 이벤트 리스너 등록 - ${eventType}`);
      return () => console.log(`📱 Expo Go: 배너 이벤트 리스너 해제 - ${eventType}`);
    },
    isLoaded: () => isLoaded
  };
}

export async function initBannerAds() {
  if (isExpoGo()) {
    console.log('📱 Expo Go 환경: 배너 광고 초기화 건너뛰기');
    return;
  }
  console.log('🎯 배너 AdMob 초기화 시작');
}

export function createBannerAd() {
  // Expo Go에서는 더미 배너 사용
  if (isExpoGo()) {
    console.log('📱 Expo Go 환경: 더미 배너 광고 객체 생성');
    return createExpoGoDummyBanner();
  }

  // 실제 빌드에서만 네이티브 모듈 사용
  try {
    const { BannerAd, TestIds } = require('react-native-google-mobile-ads');
    
    // 플랫폼별 광고 단위 ID 선택
    const platformAdUnitId = Platform.OS === 'ios' ? BANNER_AD_UNIT_IDS.ios : BANNER_AD_UNIT_IDS.android;
    const adUnitId = __DEV__ ? TestIds.BANNER : platformAdUnitId;
      
    console.log(`🎯 배너 광고 생성: ${adUnitId}`);
    console.log(`🔧 모드: ${__DEV__ ? '개발 (테스트 광고)' : '프로덕션 (실제 광고)'}`);
    console.log(`📱 플랫폼: ${Platform.OS}`);
    
    return {
      adUnitId,
      size: 'BANNER', // 320x50
      requestNonPersonalizedAdsOnly: true,
    };
  } catch (error) {
    console.error('❌ 배너 네이티브 모듈 로드 실패:', error);
    console.log('📱 더미 배너로 대체');
    return createExpoGoDummyBanner();
  }
}

export function attachBannerAd(ad: any, { 
  onLoaded, 
  onError 
}: {
  onLoaded: () => void;
  onError: () => void;
}) {
  // Expo Go에서는 더미 리스너 사용
  if (isExpoGo()) {
    console.log('📱 Expo Go 환경: 더미 배너 광고 리스너 설정');
    
    const unsubscribeLoaded = ad.addAdEventListener('loaded', () => {
      console.log('📱 Expo Go: 배너 광고 로드 완료');
      onLoaded();
    });
    
    const unsubscribeError = ad.addAdEventListener('error', () => {
      console.log('📱 Expo Go: 배너 광고 로드 실패');
      onError();
    });
    
    // 배너 광고 로드 시작
    ad.load();
    
    return () => {
      unsubscribeLoaded();
      unsubscribeError();
    };
  }

  // 실제 빌드에서만 네이티브 모듈 사용
  try {
    const { BannerAdEventType } = require('react-native-google-mobile-ads');
    
    console.log('🎯 배너 광고 이벤트 리스너 설정');
    
    const unsubscribeLoaded = ad.addAdEventListener(BannerAdEventType.LOADED, onLoaded);
    const unsubscribeError = ad.addAdEventListener(BannerAdEventType.ERROR, onError);

    // 배너 광고 로드 시작
    ad.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeError();
    };
  } catch (error) {
    console.error('❌ 배너 네이티브 모듈 로드 실패:', error);
    console.log('📱 더미 리스너로 대체');
    return () => console.log('📱 Expo Go: 더미 배너 리스너 해제');
  }
}
