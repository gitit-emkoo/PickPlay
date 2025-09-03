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

// 웹용 더미 리스너
function createWebDummyListener() {
  return () => console.log('🌐 웹: 더미 리스너 해제');
}

// 모바일용 실제 광고 모듈 (웹이 아닐 때만 로드)
let MobileAds: any;
let RewardedAdEventType: any;
let RewardedInterstitialAd: any;
let TestIds: any;
let AdEventType: any;

if (Platform.OS !== 'web') {
  try {
    const adsModule = require('react-native-google-mobile-ads');
    MobileAds = adsModule.MobileAds;
    RewardedAdEventType = adsModule.RewardedAdEventType;
    RewardedInterstitialAd = adsModule.RewardedInterstitialAd;
    TestIds = adsModule.TestIds;
    AdEventType = adsModule.AdEventType;
  } catch (error) {
    console.error('광고 모듈 로드 실패:', error);
  }
}

// 플랫폼별 광고 단위 ID
const AD_UNITS = {
  android: 'ca-app-pub-2555567440328829/7893158578',
  ios: 'ca-app-pub-2555567440328829/9198215970'
};

export async function initAds() { 
  if (Platform.OS === 'web') {
    console.log('🌐 웹 환경: 광고 초기화 건너뛰기');
    return;
  }
  
  if (!MobileAds) {
    console.log('📱 광고 모듈이 로드되지 않음');
    return;
  }
  
  try {
    console.log('🚀 Google AdMob 초기화 시작...');
    await MobileAds().initialize();
    console.log('✅ Google AdMob 초기화 완료');
  } catch (error) {
    console.error('❌ Google AdMob 초기화 실패:', error);
  }
}

export function createRewardedInterstitial() {
  if (Platform.OS === 'web') {
    console.log('🌐 웹 환경: 더미 광고 객체 생성');
    return createWebDummyAd();
  }
  
  if (!RewardedInterstitialAd) {
    console.log('📱 광고 모듈이 로드되지 않음');
    return createWebDummyAd();
  }
  
  const adUnitId = Platform.select(AD_UNITS) || TestIds.REWARDED_INTERSTITIAL;
  console.log('📱 광고 단위 ID:', adUnitId);
  console.log('📱 플랫폼:', Platform.OS);
  const ad = RewardedInterstitialAd.createForAdRequest(adUnitId);
  console.log('🎯 보상형 전면광고 객체 생성 완료');
  return ad;
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
  
  if (!RewardedAdEventType || !AdEventType) {
    console.log('📱 광고 모듈이 로드되지 않음');
    return createWebDummyListener();
  }
  
  console.log('🔗 실제 광고 이벤트 리스너 연결 중...');
  
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
}
