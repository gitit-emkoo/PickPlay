import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { attachBannerAd, createBannerAd } from '../services/banner-ads';
import colors from '../styles/colors';

interface BannerAdComponentProps {
  style?: any;
}

export default function BannerAdComponent({ style }: BannerAdComponentProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [bannerAd, setBannerAd] = useState<any>(null);

  useEffect(() => {
    const ad = createBannerAd();
    setBannerAd(ad);

    const cleanup = attachBannerAd(ad, {
      onLoaded: () => {
        console.log('🎯 배너 광고 로드 완료');
        setIsLoaded(true);
        setHasError(false);
      },
      onError: () => {
        console.log('❌ 배너 광고 로드 실패');
        setHasError(true);
        setIsLoaded(false);
        
        // 재시도 로직 (최대 3회)
        if (retryCount < 3) {
          setTimeout(() => {
            console.log(`🔄 배너 광고 재시도 ${retryCount + 1}/3`);
            setRetryCount(prev => prev + 1);
            if ('load' in ad) {
              ad.load();
            }
          }, 2000);
        }
      }
    });

    return cleanup;
  }, [retryCount]);

  // 로딩 중
  if (!isLoaded && !hasError) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>광고 로딩 중...</Text>
      </View>
    );
  }

  // 에러 상태 (재시도 횟수 초과)
  if (hasError && retryCount >= 3) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <Text style={styles.errorText}>광고를 불러올 수 없습니다</Text>
      </View>
    );
  }

  // 실제 배너 광고 (React Native Google Mobile Ads)
  if (isLoaded && bannerAd && bannerAd.adUnitId) {
    try {
      const { BannerAd } = require('react-native-google-mobile-ads');
      return (
        <View style={[styles.container, style]}>
          <BannerAd
            unitId={bannerAd.adUnitId}
            size="BANNER"
            requestOptions={{
              requestNonPersonalizedAdsOnly: true,
            }}
          />
        </View>
      );
    } catch (error) {
      console.error('❌ 배너 광고 렌더링 실패:', error);
      return (
        <View style={[styles.container, styles.errorContainer, style]}>
          <Text style={styles.errorText}>광고를 표시할 수 없습니다</Text>
        </View>
      );
    }
  }

  // Expo Go용 더미 배너
  return (
    <View style={[styles.container, styles.dummyContainer, style]}>
      <Text style={styles.dummyText}>📱 Expo Go: 배너 광고 영역</Text>
      <Text style={styles.dummySubText}>실제 빌드에서는 광고가 표시됩니다</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  
  },
  loadingContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: colors.primary,
  },
  errorContainer: {
    backgroundColor: '#fff3cd',
    borderTopColor: '#ffeaa7',
  },
  errorText: {
    fontSize: 12,
    color: '#856404',
  },
  dummyContainer: {
    backgroundColor: '#e3f2fd',
    borderTopColor: '#bbdefb',
  },
  dummyText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: 'bold',
  },
  dummySubText: {
    fontSize: 10,
    color: colors.primary,
    opacity: 0.7,
  },
});
