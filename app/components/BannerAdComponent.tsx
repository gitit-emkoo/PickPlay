import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getBannerAdUnitId, isExpoGo } from '../services/banner-ads';
import colors from '../styles/colors';

interface BannerAdComponentProps {
  style?: any;
}

export default function BannerAdComponent({ style }: BannerAdComponentProps) {
  const [isAdLoaded, setAdLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const adUnitId = useMemo(() => getBannerAdUnitId(), []);

  // Expo Go 또는 네이티브 모듈 로드 실패 시 더미 UI 렌더링
  if (isExpoGo() || !adUnitId) {
    return (
      <View style={[styles.container, styles.dummyContainer, style]}>
        <Text style={styles.dummyText}>📱 Expo Go: 배너 광고 영역</Text>
        <Text style={styles.dummySubText}>실제 빌드에서는 광고가 표시됩니다</Text>
      </View>
    );
  }

  // 실제 광고 렌더링
  try {
    const { BannerAd } = require('react-native-google-mobile-ads');
    
    return (
      <View style={[styles.container, style]}>
        {/* 로딩 인디케이터: 광고가 로드되지 않았고 에러가 없을 때만 표시 */}
        {!isAdLoaded && !hasError && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>광고 로딩 중...</Text>
          </View>
        )}

        {/* 에러 메시지 */}
        {hasError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>광고를 불러올 수 없습니다</Text>
          </View>
        )}

        {/* 
          배너 광고 컴포넌트
          - 에러가 없을 때만 렌더링합니다.
          - 에러가 있으면 렌더링하지 않아서 중복 표시를 방지합니다.
        */}
        {!hasError && (
          <BannerAd
            unitId={adUnitId}
            size="BANNER"
            requestOptions={{
              requestNonPersonalizedAdsOnly: true,
            }}
            onAdLoaded={() => {
              console.log('🎯 배너 광고 로드 완료');
              setAdLoaded(true);
              setHasError(false);
            }}
            onAdFailedToLoad={(error:Error) => {
              console.error('❌ 배너 광고 로드 실패:', error);
              setHasError(true);
              setAdLoaded(false);
            }}
          />
        )}
      </View>
    );
  } catch (error) {
    console.error('❌ 배너 광고 컴포넌트 렌더링 실패:', error);
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <Text style={styles.errorText}>광고를 표시할 수 없습니다</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: colors.primary,
  },
  errorContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  errorText: {
    fontSize: 12,
    color: colors.textLight,
  },
  dummyContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderTopWidth: 1,
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
