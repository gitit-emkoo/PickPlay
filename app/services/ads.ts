import { Platform } from 'react-native';
import {
    AdEventType,
    MobileAds,
    RewardedAdEventType,
    RewardedInterstitialAd,
    TestIds
} from 'react-native-google-mobile-ads';

// 플랫폼별 광고 단위 ID
const AD_UNITS = {
  android: 'ca-app-pub-2555567440328829/7893158578',
  ios: 'ca-app-pub-2555567440328829/9198215970'
};

export async function initAds() { 
  try {
    console.log('🚀 Google AdMob 초기화 시작...');
    await MobileAds().initialize();
    console.log('✅ Google AdMob 초기화 완료');
  } catch (error) {
    console.error('❌ Google AdMob 초기화 실패:', error);
  }
}

export function createRewardedInterstitial() {
  const adUnitId = Platform.select(AD_UNITS) || TestIds.REWARDED_INTERSTITIAL;
  console.log('📱 광고 단위 ID:', adUnitId);
  console.log('📱 플랫폼:', Platform.OS);
  const ad = RewardedInterstitialAd.createForAdRequest(adUnitId);
  console.log('🎯 보상형 전면광고 객체 생성 완료');
  return ad;
}

export function attachRewardedInterstitial(ad: RewardedInterstitialAd, { 
  onLoaded, 
  onEarned, 
  onClosed 
}: {
  onLoaded: () => void;
  onEarned: () => void;
  onClosed: () => void;
}) {
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
