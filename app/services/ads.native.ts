import { Platform } from 'react-native';

// 웹용 더미 함수들
function createWebDummyAd() {
  return {
    load: () => console.log('🌐 웹: 더미 광고 로드'),
    show: () => console.log('🌐 웹: 더미 광고 표시'),
    addAdEventListener: () => () => console.log('🌐 웹: 더미 이벤트 리스너'),
    isLoaded: () => false
  };
}

// 네이티브 모듈 로드 실패 시 사용할 더미 광고
function createNativeDummyAd() {
  return {
    load: () => console.log('📱 네이티브 모듈 실패: 더미 광고 로드'),
    show: () => console.log('📱 네이티브 모듈 실패: 더미 광고 표시'),
    addAdEventListener: () => () => console.log('📱 네이티브 모듈 실패: 더미 이벤트 리스너'),
    isLoaded: () => false
  };
}

// 웹용 더미 리스너
function createWebDummyListener() {
  return () => console.log('🌐 웹: 더미 리스너 해제');
}

// 네이티브 모듈 실패 시 더미 리스너
function createNativeDummyListener() {
  return () => console.log('📱 네이티브 모듈 실패: 더미 리스너 해제');
}

// 모바일용 실제 광고 모듈 (웹이 아닐 때만 로드)
let MobileAds: any;
let RewardedAdEventType: any;
let RewardedInterstitialAd: any;
let TestIds: any;
let AdEventType: any;
let moduleLoaded = false;

if (Platform.OS !== 'web') {
  try {
    const adsModule = require('react-native-google-mobile-ads');
    MobileAds = adsModule.MobileAds;
    RewardedAdEventType = adsModule.RewardedAdEventType;
    RewardedInterstitialAd = adsModule.RewardedInterstitialAd;
    TestIds = adsModule.TestIds;
    AdEventType = adsModule.AdEventType;
    moduleLoaded = true;
    console.log('✅ 광고 모듈 로드 성공');
  } catch (error) {
    console.error('❌ 광고 모듈 로드 실패:', error);
    console.log('📱 네이티브 모듈 실패로 더미 광고 사용');
    moduleLoaded = false;
  }
}

// 플랫폼별 광고 단위 ID
const AD_UNITS = {
  // android: 'ca-app-pub-3940256099942544/5354046379', // 테스트 광고
  android: 'ca-app-pub-2555567440328829/7893158578', // 실제 광고
  ios: 'ca-app-pub-2555567440328829/9198215970' // 실제 광고
  // ios: 'ca-app-pub-3940256099942544/6978759866' // 보상형 전면광고 테스트 ID
};

export async function initAds() { 
  if (Platform.OS === 'web') {
    console.log('🌐 웹 환경: 광고 초기화 건너뛰기');
    return;
  }
  
  if (!moduleLoaded || !MobileAds) {
    console.log('📱 광고 모듈이 로드되지 않음 - 더미 모드로 실행');
    return;
  }
  
  try {
    console.log('🚀 Google AdMob 초기화 시작...');
    await MobileAds().initialize();
    console.log('✅ Google AdMob 초기화 완료');
  } catch (error) {
    console.error('❌ Google AdMob 초기화 실패:', error);
    console.log('📱 초기화 실패로 더미 모드로 실행');
  }
}

export function createRewardedInterstitial() {
  if (Platform.OS === 'web') {
    console.log('🌐 웹 환경: 더미 광고 객체 생성');
    return createWebDummyAd();
  }
  
  if (!moduleLoaded || !RewardedInterstitialAd) {
    console.log('📱 광고 모듈이 로드되지 않음 - 더미 광고 사용');
    return createNativeDummyAd();
  }
  
  const adUnitId = Platform.select(AD_UNITS);
  console.log('📱 광고 단위 ID:', adUnitId);
  console.log('📱 플랫폼:', Platform.OS);
  
  try {
    const ad = RewardedInterstitialAd.createForAdRequest(adUnitId);
    console.log('🎯 보상형 전면광고 객체 생성 완료');
    return ad;
  } catch (error) {
    console.error('❌ 광고 객체 생성 실패:', error);
    console.log('📱 더미 광고로 대체');
    return createNativeDummyAd();
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
  if (Platform.OS === 'web') {
    console.log('🌐 웹 환경: 더미 광고 리스너 설정');
    return createWebDummyListener();
  }
  
  if (!moduleLoaded || !RewardedAdEventType || !AdEventType) {
    console.log('📱 광고 모듈이 로드되지 않음 - 더미 리스너 사용');
    // 더미 광고에서는 로드만 완료하고 자동 보상 지급하지 않음
    setTimeout(() => {
      console.log('📱 더미 광고: 로드 완료 (수동 광고 시청 필요)');
      onLoaded();
    }, 500);
    return createNativeDummyListener();
  }
  
  console.log('🔗 실제 광고 이벤트 리스너 연결 중...');
  
  try {
    const unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, onLoaded);
    const unsubscribeEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, onEarned);
    const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, onClosed);

    // 광고 로드 시작
    ad.load();
    console.log('📦 광고 로드 시작...');

    return () => {
      console.log('🔗 광고 이벤트 리스너 해제');
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeClosed();
    };
  } catch (error) {
    console.error('❌ 광고 리스너 설정 실패:', error);
    console.log('📱 더미 리스너로 대체');
    return createNativeDummyListener();
  }
}
