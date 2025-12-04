import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { getBannerAdUnitId, isExpoGo, getBannerAdRequestOptions } from '../../src/services/banner-ads';
import colors from '../../src/styles/colors';
import PickPlayBanner from './PickPlayBanner';

interface BannerAdComponentProps {
  style?: any;
}

export default function BannerAdComponent({ style }: BannerAdComponentProps) {
  const [isAdLoaded, setAdLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showCustomBanner, setShowCustomBanner] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [requestOptions, setRequestOptions] = useState<{ requestNonPersonalizedAdsOnly: boolean }>({
    requestNonPersonalizedAdsOnly: true,
  });

  const retryTimerRef = useRef<any>(null);
  const retryAttemptRef = useRef(0);

  const adUnitId = useMemo(() => getBannerAdUnitId(), []);

  // 광고 추적 권한 상태 확인
  useEffect(() => {
    const loadRequestOptions = async () => {
      try {
        const options = await getBannerAdRequestOptions();
        setRequestOptions(options);
      } catch (error) {
        console.error('[BannerAd] 권한 확인 실패:', error);
      }
    };
    loadRequestOptions();
  }, []);

  // Expo Go 또는 네이티브 모듈 로드 실패 시 더미 UI 렌더링
  if (isExpoGo() || !adUnitId) {
    return (
      <View style={[styles.container, styles.dummyContainer, style]}>
        <Text style={styles.dummyText}>📱 Expo Go: 배너 광고 영역</Text>
        <Text style={styles.dummySubText}>실제 빌드에서는 광고가 표시됩니다</Text>
      </View>
    );
  }

  // AppState 복귀 시 재로드
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // 포그라운드 복귀 시 즉시 재시도
        retryAttemptRef.current = 0;
        setHasError(false);
        setShowCustomBanner(false); // 재시도 시 커스텀 배너 숨김
        setReloadKey((v) => v + 1);
      }
    });
    return () => {
      sub.remove();
    };
  }, []);

  // 재시도 스케줄링
  const scheduleRetry = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    const delay = Math.min(60000, 5000 * Math.pow(2, retryAttemptRef.current)); // 5s → 10s → 20s ... 최대 60s
    retryAttemptRef.current += 1;
    retryTimerRef.current = setTimeout(() => {
      setHasError(false);
      setReloadKey((v) => v + 1); // Banner 리마운트
    }, delay);
  };

  // 실제 광고 렌더링
  try {
    const { BannerAd, BannerAdSize } = require('react-native-google-mobile-ads');

    return (
      <View style={[styles.container, style]}>
        {/* 로딩 인디케이터: 광고가 로드되지 않았고 에러가 없을 때만 표시 */}
        {!isAdLoaded && !hasError && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>광고 로딩 중...</Text>
          </View>
        )}

        {/* 배너 광고는 항상 마운트하여 자동 재시도가 가능하도록 유지 */}
        <BannerAd
          key={reloadKey}
          unitId={adUnitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={requestOptions}
          onAdLoaded={() => {
            console.log('🎯 배너 광고 로드 완료');
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            retryAttemptRef.current = 0;
            setAdLoaded(true);
            setHasError(false);
            setShowCustomBanner(false); // 광고 로드 시 커스텀 배너 숨김
          }}
          onAdFailedToLoad={(error: any) => {
            console.error('❌ 배너 광고 로드 실패:', error?.code || error);
            setHasError(true);
            setAdLoaded(false);
            
            // no-fill 오류인 경우 커스텀 배너 표시
            const errorCode = String(error?.code || error?.message || '');
            const errorMessage = String(error?.message || '');
            const isNoFillError = 
              errorCode.toLowerCase().includes('no-fill') || 
              errorCode.toLowerCase().includes('no_fill') ||
              errorMessage.toLowerCase().includes('no-fill') ||
              errorMessage.toLowerCase().includes('no_fill') ||
              errorCode === '3' || // AdMob ERROR_CODE_NO_FILL = 3
              error?.code === '3';
            
            if (isNoFillError) {
              console.log('🎨 광고 재고 부족 - PickPlay 커스텀 배너 표시');
              setShowCustomBanner(true);
              // 커스텀 배너 표시 시 재시도 중단
              if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            } else {
              // 다른 오류인 경우 재시도 계속
              scheduleRetry();
            }
          }}
        />

        {/* no-fill 오류 시 커스텀 배너 표시 */}
        {showCustomBanner && (
          <View style={styles.customBannerContainer}>
            <PickPlayBanner />
          </View>
        )}
        
        {/* 에러 오버레이(공간 유지 + 사용자 안내). 재시도는 백그라운드에서 진행 */}
        {hasError && !showCustomBanner && (
          <View style={styles.errorOverlay} pointerEvents="none">
            <Text style={styles.errorText}>광고를 불러오지 못했습니다. 잠시 후 다시 시도합니다…</Text>
          </View>
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
  errorOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  errorText: {
    fontSize: 12,
    color: colors.textLight,
  },
  customBannerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dummyContainer: {
    width: '100%',
    height: 50,
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
