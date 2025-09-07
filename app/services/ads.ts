import { Platform } from 'react-native';

// Expo Go 환경 감지 (더 안정적인 방법)
const isExpoGo = () => {
  try {
    return typeof (global as any).Expo !== 'undefined' && 
           (global as any).Expo.Constants?.appOwnership === 'expo';
  } catch {
    return false;
  }
};

// 플랫폼별 실제 광고 단위 ID
const AD_UNITS = {
  android: 'ca-app-pub-2555567440328829/7893158578',
  ios: 'ca-app-pub-2555567440328829/9198215970'
};

// 더미 광고 객체 (Expo Go용)
function createExpoGoDummyAd() {
  let isLoaded = false;
  let isShowing = false;
  let earnedCallback: (() => void) | null = null;
  let closedCallback: (() => void) | null = null;
  let loadedCallback: (() => void) | null = null;
  
  return {
    load: () => {
      console.log('📱 Expo Go: 더미 광고 로드 시작');
      setTimeout(() => {
        isLoaded = true;
        console.log('📱 Expo Go: 더미 광고 로드 완료');
        if (loadedCallback) {
          loadedCallback();
        }
      }, 1000);
    },
    show: () => {
      console.log('📱 Expo Go: 더미 광고 표시 시작');
      if (!isLoaded) {
        console.log('📱 Expo Go: 광고가 아직 로드되지 않음');
        return;
      }
      
      isShowing = true;
      console.log('📱 Expo Go: 더미 광고 표시 중...');
      
      // 실제 광고 플로우 시뮬레이션 (3초 후 보상 지급)
      setTimeout(() => {
        console.log('📱 Expo Go: 더미 광고 시청 완료, 보상 지급');
        isShowing = false;
        // 보상 이벤트 트리거
        if (earnedCallback) {
          earnedCallback();
        }
        
        // 광고 종료 이벤트 트리거 (0.5초 후)
        setTimeout(() => {
          console.log('📱 Expo Go: 더미 광고 종료');
          if (closedCallback) {
            closedCallback();
          }
        }, 500);
      }, 3000);
    },
    addAdEventListener: (eventType: string, callback: () => void) => {
      console.log(`📱 Expo Go: 이벤트 리스너 등록 - ${eventType}`);
      
      // loaded 이벤트 콜백 저장
      if (eventType === 'loaded') {
        loadedCallback = callback;
      }
      
      // earned_reward 이벤트 콜백 저장
      if (eventType === 'earned_reward') {
        earnedCallback = callback;
      }
      
      // closed 이벤트 콜백 저장
      if (eventType === 'closed') {
        closedCallback = callback;
      }
      
      return () => console.log(`📱 Expo Go: 이벤트 리스너 해제 - ${eventType}`);
    },
    isLoaded: () => isLoaded
  };
}

// 더미 리스너 (Expo Go용)
function createExpoGoDummyListener() {
  return () => console.log('📱 Expo Go: 더미 리스너 해제');
}

export async function initAds() { 
  if (isExpoGo()) {
    console.log('📱 Expo Go 환경: 광고 초기화 건너뛰기');
    return;
  }
  console.log('🎯 AdMob 초기화 시작');
}

export function createRewardedInterstitial() {
  // Expo Go에서는 더미 광고 사용
  if (isExpoGo()) {
    console.log('📱 Expo Go 환경: 더미 광고 객체 생성');
    return createExpoGoDummyAd();
  }

  // 실제 빌드에서만 네이티브 모듈 사용
  try {
    const { RewardedInterstitialAd, TestIds } = require('react-native-google-mobile-ads');
    
    // 플랫폼별 광고 단위 ID 선택
    const platformAdUnitId = Platform.OS === 'ios' ? AD_UNITS.ios : AD_UNITS.android;
    const adUnitId = __DEV__ ? TestIds.REWARDED_INTERSTITIAL : platformAdUnitId;
      
    console.log(`🎯 보상형 전면 광고 생성: ${adUnitId}`);
    console.log(`🔧 모드: ${__DEV__ ? '개발 (테스트 광고)' : '프로덕션 (실제 광고)'}`);
    console.log(`📱 플랫폼: ${Platform.OS}`);
    
    const rewarded = RewardedInterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
      keywords: ['game', 'reward', 'daily'],
    });

    return rewarded;
  } catch (error) {
    console.error('❌ 네이티브 모듈 로드 실패:', error);
    console.log('📱 더미 광고로 대체');
    return createExpoGoDummyAd();
  }
}

export function attachRewardedInterstitial(ad: any, { 
  onLoaded, 
  onEarned, 
  onClosed 
}: {
  onLoaded: () => void;
  onEarned: () => void;
  onClosed: () => void;
}) {
  // Expo Go에서는 더미 리스너 사용
  if (isExpoGo()) {
    console.log('📱 Expo Go 환경: 더미 광고 리스너 설정');
    
    // 실제 광고 플로우를 시뮬레이션
    const unsubscribeLoaded = ad.addAdEventListener('loaded', () => {
      console.log('📱 Expo Go: 광고 로드 완료');
      onLoaded();
    });
    
    const unsubscribeEarned = ad.addAdEventListener('earned_reward', () => {
      console.log('📱 Expo Go: 보상 획득');
      onEarned();
    });
    
    const unsubscribeClosed = ad.addAdEventListener('closed', () => {
      console.log('📱 Expo Go: 광고 종료');
      onClosed();
    });
    
    // 광고 로드 시작 (자동 로드 제거)
    // ad.load(); // ← 이 줄을 제거하여 자동 로드 방지
    
    return () => {
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeClosed();
    };
  }

  // 실제 빌드에서만 네이티브 모듈 사용
  try {
    const { RewardedAdEventType, AdEventType } = require('react-native-google-mobile-ads');
    
    console.log('🎯 광고 이벤트 리스너 설정');
  
  const unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, onLoaded);
  const unsubscribeEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, onEarned);
  const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, onClosed);

  // 광고 로드 시작
  ad.load();

  return () => {
    unsubscribeLoaded();
    unsubscribeEarned();
    unsubscribeClosed();
  };
  } catch (error) {
    console.error('❌ 네이티브 모듈 로드 실패:', error);
    console.log('📱 더미 리스너로 대체');
    return createExpoGoDummyListener();
  }
}
