import { Platform } from 'react-native';
import * as TrackingTransparency from 'expo-tracking-transparency';

// Expo Go 환경 감지 (더 안정적인 방법)
const isExpoGo = () => {
  try {
    return typeof (global as any).Expo !== 'undefined' && 
           (global as any).Expo.Constants?.appOwnership === 'expo';
  } catch {
    return false;
  }
};

// 광고 추적 권한 상태 확인
export async function checkTrackingPermission(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    // Android는 광고 추적 권한이 항상 허용된 것으로 간주
    return true;
  }
  
  try {
    const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.warn('[Ads] 광고 추적 권한 확인 실패:', error);
    return false;
  }
}

// 플랫폼별 광고 단위 ID (실서비스용)
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
  
  try {
    console.log('🎯 AdMob 초기화 시도 중...');
    const mobileAdsModule = require('react-native-google-mobile-ads');
    
    // 방법 1: MobileAds 클래스 사용 (v13에서 권장)
    if (mobileAdsModule.MobileAds) {
      try {
        const MobileAds = mobileAdsModule.MobileAds;
        // getInstance() 또는 직접 initialize()
        if (typeof MobileAds.getInstance === 'function') {
          const instance = MobileAds.getInstance();
          if (instance && typeof instance.initialize === 'function') {
            await instance.initialize();
            console.log('✅ AdMob 초기화 완료 (방법 1: MobileAds.getInstance)');
            return;
          }
        }
        // 또는 MobileAds.initialize()가 static 메서드일 수 있음
        if (typeof MobileAds.initialize === 'function') {
          await MobileAds.initialize();
          console.log('✅ AdMob 초기화 완료 (방법 2: MobileAds.initialize)');
          return;
        }
      } catch (e) {
        console.warn('[AdMob] MobileAds 방법 실패:', e);
      }
    }
    
    // 방법 2: default 함수 호출 (mobileAds()와 동일할 수 있음)
    if (mobileAdsModule.default && typeof mobileAdsModule.default === 'function') {
      try {
        const mobileAds = mobileAdsModule.default();
        if (mobileAds && typeof mobileAds.initialize === 'function') {
          await mobileAds.initialize();
          console.log('✅ AdMob 초기화 완료 (방법 3: default())');
          return;
        }
      } catch (e) {
        console.warn('[AdMob] default() 방법 실패:', e);
      }
    }
    
    // 방법 3: mobileAds() 함수로 초기화 (구버전 호환)
    if (mobileAdsModule.mobileAds && typeof mobileAdsModule.mobileAds === 'function') {
      try {
        const mobileAds = mobileAdsModule.mobileAds();
        if (mobileAds && typeof mobileAds.initialize === 'function') {
          await mobileAds.initialize();
          console.log('✅ AdMob 초기화 완료 (방법 4: mobileAds())');
          return;
        }
      } catch (e) {
        console.warn('[AdMob] mobileAds() 방법 실패:', e);
      }
    }
    
    // 초기화 방법을 찾지 못한 경우 - 자동 초기화에 의존
    console.log('ℹ️ AdMob 자동 초기화됨 (명시적 초기화 불필요)');
    console.log('ℹ️ AndroidManifest.xml과 app.json의 APPLICATION_ID 설정으로 자동 초기화됩니다');
  } catch (error: any) {
    // 초기화 실패해도 광고는 작동할 수 있음 (자동 초기화)
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes('already initialized')) {
      console.log('ℹ️ AdMob 이미 초기화됨');
    } else {
      console.warn('⚠️ AdMob 명시적 초기화 실패 (자동 초기화 의존):', errorMsg);
      console.warn('⚠️ AndroidManifest.xml과 app.json 설정으로 자동 초기화됩니다');
    }
  }
}

export async function createRewardedInterstitial() {
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
    const adUnitId = platformAdUnitId;
    
    // 광고 추적 권한 상태 확인
    const hasTrackingPermission = await checkTrackingPermission();
    const requestNonPersonalizedAdsOnly = !hasTrackingPermission;
      
    console.log(`🎯 보상형 전면 광고 생성: ${adUnitId}`);
    console.log(`🔧 모드: 실서비스`);
    console.log(`📱 플랫폼: ${Platform.OS}`);
    console.log(`🔐 광고 추적 권한: ${hasTrackingPermission ? '허용' : '거부'}`);
    console.log(`📊 비개인화 광고만 요청: ${requestNonPersonalizedAdsOnly}`);
    
    const rewarded = RewardedInterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly,
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
  onClosed,
  onFailedToLoad
}: {
  onLoaded: () => void;
  onEarned: () => void;
  onClosed: () => void;
  onFailedToLoad?: (error: any) => void;
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
  
    const unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      console.log('✅ 보상형 광고 로드 완료');
      onLoaded();
    });
    
    const unsubscribeEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, onEarned);
    const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, onClosed);
    
    // 광고 로드 실패 이벤트 리스너 추가
    const unsubscribeFailed = ad.addAdEventListener(AdEventType.ERROR, (error: any) => {
      console.error('❌ 보상형 광고 로드 실패:', error?.code || error?.message || error);
      if (onFailedToLoad) {
        onFailedToLoad(error);
      }
    });

    // 광고 로드 시작
    console.log('🔄 보상형 광고 로드 시작...');
    ad.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeClosed();
      unsubscribeFailed();
    };
  } catch (error) {
    console.error('❌ 네이티브 모듈 로드 실패:', error);
    console.log('📱 더미 리스너로 대체');
    return createExpoGoDummyListener();
  }
}
