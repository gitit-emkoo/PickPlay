
// 웹용 더미 광고 서비스
// react-native-google-mobile-ads 모듈을 전혀 import하지 않음

export async function initAds() {
  console.log('🌐 웹 환경: 광고 초기화 건너뛰기');
}

export function createRewardedInterstitial() {
  console.log('🌐 웹 환경: 더미 광고 객체 생성');
  return {
    load: () => console.log('🌐 웹: 더미 광고 로드'),
    show: () => console.log('🌐 웹: 더미 광고 표시'),
    addAdEventListener: () => () => console.log('🌐 웹: 더미 이벤트 리스너'),
    isLoaded: () => false
  };
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
  console.log('🌐 웹 환경: 더미 광고 리스너 설정');
  return () => console.log('�� 웹: 더미 리스너 해제');
}
