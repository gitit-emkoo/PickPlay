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

// 테스트 광고 ID (AdMob 공식 테스트 ID) - 개발/디버깅용
// Rewarded Interstitial 테스트 ID (2024 최신)
const TEST_AD_UNITS = {
  android: 'ca-app-pub-3940256099942544/5354046379', // Rewarded Interstitial Android
  ios: 'ca-app-pub-3940256099942544/6978759866' // Rewarded Interstitial iOS
};

// 대체 테스트 ID (위 ID가 작동하지 않을 경우)
const TEST_AD_UNITS_ALT = {
  android: 'ca-app-pub-3940256099942544/1033173712', // Rewarded Interstitial Android (대체)
  ios: 'ca-app-pub-3940256099942544/1712485313' // Rewarded Interstitial iOS (대체)
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
    
    // 실제 광고 ID 사용 (프로덕션)
    const platformAdUnitId = Platform.OS === 'ios' ? AD_UNITS.ios : AD_UNITS.android;
    const adUnitId = platformAdUnitId;
    console.log('🆔 실제 광고 ID 사용:', adUnitId);
    
    // 광고 추적 권한 상태 확인
    const hasTrackingPermission = await checkTrackingPermission();
    const requestNonPersonalizedAdsOnly = !hasTrackingPermission;
      
    console.log(`🎯 보상형 전면 광고 생성: ${adUnitId}`);
    console.log(`🔧 모드: 프로덕션`);
    console.log(`📱 플랫폼: ${Platform.OS}`);
    console.log(`🆔 실제 광고 ID 사용 중`);
    console.log(`🔐 광고 추적 권한: ${hasTrackingPermission ? '허용' : '거부'}`);
    console.log(`📊 비개인화 광고만 요청: ${requestNonPersonalizedAdsOnly}`);
    
    const rewarded = RewardedInterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly,
      keywords: ['game', 'reward', 'daily'],
    });

    console.log(`✅ 광고 객체 생성 완료: ${adUnitId}`);
    console.log(`📝 광고 객체 타입: ${typeof rewarded}`);
    console.log(`📝 광고 객체 메서드: load=${typeof rewarded.load}, show=${typeof rewarded.show}, isLoaded=${typeof rewarded.isLoaded}`);
    
    return rewarded;
  } catch (error) {
    console.error('❌ 네이티브 모듈 로드 실패:', error);
    console.log('📱 더미 광고로 대체');
    return createExpoGoDummyAd();
  }
}

// 라이브픽 전용 테스트 광고 생성 함수
export async function createRewardedInterstitialForLivePick() {
  // Expo Go에서는 더미 광고 사용
  if (isExpoGo()) {
    console.log('📱 [LivePick] Expo Go 환경: 더미 광고 객체 생성');
    const dummyAd = createExpoGoDummyAd();
    // 더미 광고는 바로 로드
    dummyAd.load();
    return dummyAd;
  }

  // 실제 빌드에서만 네이티브 모듈 사용
  try {
    const { RewardedInterstitialAd, TestIds } = require('react-native-google-mobile-ads');
    
    // 메인 화면과 완전히 동일한 로직 사용 (실제 광고 ID)
    const platformAdUnitId = Platform.OS === 'ios' ? AD_UNITS.ios : AD_UNITS.android;
    const adUnitId = platformAdUnitId;
    console.log('🆔 [LivePick] 실제 광고 ID 사용:', adUnitId);
    
    // 광고 추적 권한 상태 확인
    const hasTrackingPermission = await checkTrackingPermission();
    const requestNonPersonalizedAdsOnly = !hasTrackingPermission;
    
    const rewarded = RewardedInterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly,
      keywords: ['game', 'reward', 'daily'],
    });

    return rewarded;
  } catch (error: any) {
    console.error('❌ [LivePick] 네이티브 모듈 로드 실패:', error);
    console.log('📱 [LivePick] 더미 광고로 대체 (테스트 가능)');
    const dummyAd = createExpoGoDummyAd();
    // 더미 광고는 바로 로드
    dummyAd.load();
    return dummyAd;
  }
}

export function attachRewardedInterstitial(ad: any, { 
  onLoaded, 
  onEarned, 
  onClosed,
  onFailedToLoad,
  onFailedToShow
}: {
  onLoaded: () => void;
  onEarned: () => void;
  onClosed: () => void;
  onFailedToLoad?: (error: any) => void;
  onFailedToShow?: (error: any) => void;
}) {
  // Expo Go에서는 더미 리스너 사용
  if (isExpoGo()) {
    // 실제 광고 플로우를 시뮬레이션
    const unsubscribeLoaded = ad.addAdEventListener('loaded', () => {
      onLoaded();
    });
    
    const unsubscribeEarned = ad.addAdEventListener('earned_reward', () => {
      onEarned();
    });
    
    const unsubscribeClosed = ad.addAdEventListener('closed', () => {
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
  
    // 각 이벤트 리스너를 개별적으로 try-catch로 감싸서 어떤 이벤트가 실패하는지 확인
    let unsubscribeLoaded: (() => void) | null = null;
    let unsubscribeEarned: (() => void) | null = null;
    let unsubscribeOpened: (() => void) | null = null;
    let unsubscribeClosed: (() => void) | null = null;
    let unsubscribeFailed: (() => void) | null = null;
    // unsubscribeFailedToShow는 RewardedInterstitialAd에서 지원하지 않음
    
    try {
      // RewardedInterstitialAd는 RewardedAdEventType.LOADED를 사용해야 함!
      unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        onLoaded();
      });
    } catch (e: any) {
      // 문자열로 시도
      try {
        unsubscribeLoaded = ad.addAdEventListener('rewarded_loaded', () => {
          onLoaded();
        });
      } catch (e2: any) {
        console.error('❌ [광고] LOADED 이벤트 리스너 등록 실패:', e2?.message);
      }
    }
    
    try {
      // 보상 이벤트는 RewardedAdEventType 사용
      unsubscribeEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, onEarned);
    } catch (e: any) {
      // 문자열로 시도
      try {
        unsubscribeEarned = ad.addAdEventListener('rewarded_earned_reward', onEarned);
      } catch (e2: any) {
        console.error('❌ [광고] EARNED_REWARD 이벤트 리스너 등록 실패:', e2?.message);
      }
    }
    
    try {
      // OPENED 이벤트 리스너 추가 (광고가 실제로 열렸는지 확인)
      unsubscribeOpened = ad.addAdEventListener(AdEventType.OPENED, () => {
        // 광고 열림 이벤트 (필요시 로깅)
      });
    } catch (e: any) {
      // OPENED 이벤트는 선택사항이므로 실패해도 계속 진행
    }
    
    // CLICKED 이벤트 리스너 추가 (광고 클릭 확인)
    try {
      ad.addAdEventListener(AdEventType.CLICKED, () => {
        // 광고 클릭 이벤트 (필요시 로깅)
      });
    } catch (e: any) {
      // CLICKED 이벤트는 선택사항이므로 실패해도 계속 진행
    }
    
    try {
      unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        onClosed();
      });
    } catch (e: any) {
      // 문자열로 시도
      try {
        unsubscribeClosed = ad.addAdEventListener('closed', () => {
          onClosed();
        });
      } catch (e2: any) {
        console.error('❌ [광고] CLOSED 이벤트 리스너 등록 실패:', e2?.message);
      }
    }
    
    try {
      // 광고 로드/표시 실패 이벤트 리스너 추가
      // ERROR 이벤트는 로드 실패와 표시 실패 모두를 처리함
      // internal-error가 발생할 수 있으므로 더 안전하게 처리
      try {
        unsubscribeFailed = ad.addAdEventListener(AdEventType.ERROR, (error: any) => {
          try {
            // 에러 코드로 로드 실패인지 표시 실패인지 판단
            const errorCode = String(error?.code || error?.message || '');
            const isLoadError = errorCode.includes('load') || errorCode.includes('LOAD');
            const isShowError = errorCode.includes('show') || errorCode.includes('SHOW') || errorCode.includes('present');
            
            // internal-error는 로드 실패로 처리하여 재시도 가능하도록 함
            const isInternalError = errorCode.includes('internal-error') || errorCode.includes('Internal error');
            
            if (isShowError && onFailedToShow) {
              onFailedToShow(error);
              // 표시 실패 시에는 onClosed를 호출하지 않음 (CLOSED 이벤트가 별도로 발생할 수 있음)
            } else if (onFailedToLoad) {
              // internal-error도 로드 실패로 처리하여 재시도 가능하도록 함
              if (isInternalError) {
                console.warn('⚠️ [광고] internal-error 발생 (로드 실패로 처리하여 재시도):', errorCode);
              }
              onFailedToLoad(error);
            } else {
              onClosed();
            }
          } catch (handlerError: any) {
            console.error('❌ [광고] ERROR 이벤트 핸들러 실행 중 오류:', handlerError?.message);
          }
        });
      } catch (addListenerError: any) {
        // ERROR 이벤트 리스너 등록 실패 시 경고만 출력하고 계속 진행
        // internal-error가 발생할 수 있으므로 실패해도 다른 이벤트 리스너는 계속 등록
        console.warn('⚠️ [광고] ERROR 이벤트 리스너 등록 실패 (계속 진행):', addListenerError?.message);
        unsubscribeFailed = null;
      }
    } catch (e: any) {
      console.error('❌ [광고] ERROR 이벤트 리스너 등록 실패:', e?.message);
    }

    // 광고 로드 시작
    try {
      ad.load();
    } catch (loadError: any) {
      console.error('❌ [광고] 로드 호출 실패:', loadError?.message);
    }

    return () => {
      if (unsubscribeLoaded) unsubscribeLoaded();
      if (unsubscribeEarned) unsubscribeEarned();
      if (unsubscribeOpened) unsubscribeOpened();
      if (unsubscribeClosed) unsubscribeClosed();
      if (unsubscribeFailed) unsubscribeFailed();
      // unsubscribeFailedToShow는 RewardedInterstitialAd에서 지원하지 않아 처리 불필요
    };
  } catch (error) {
    console.error('❌ [광고] 네이티브 모듈 로드 실패:', error);
    return createExpoGoDummyListener();
  }
}
