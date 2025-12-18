import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import colors from '../src/styles/colors';

const { width } = Dimensions.get('window');

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [loadingText, setLoadingText] = useState('로딩 중');
  const textOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0)).current;
  
  const fullText = "매일 30초, PickPlay는\n선택 기반 성향 분류와 캐릭터 진화를 결합한\n 심리 기반 루틴 보상 플랫폼입니다.";

  useEffect(() => {
    // 로고 팝 효과
    Animated.sequence([
      Animated.timing(logoScale, {
        toValue: 1.2,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // 전체 텍스트 천천히 페이드인 효과
    setTimeout(() => {
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 2000, // 2초 동안 천천히 페이드인
        useNativeDriver: true,
      }).start();
    }, 500); // 0.5초 후에 페이드인 시작

    // 로딩 애니메이션
    let dots = 0;
    const loadingInterval = setInterval(() => {
      dots = (dots + 1) % 4;
      setLoadingText('조금만 기다려주세요' + '🎄'.repeat(dots));
    }, 500);

    // 3초 후 메인 화면으로 이동
    const timer = setTimeout(() => {
      clearInterval(loadingInterval);
      onFinish();
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearInterval(loadingInterval);
    };
  }, [onFinish, fullText, logoScale]);

  return (
    <View style={styles.container}>
      {/* 앱 로고 */}
      <View style={styles.logoContainer}>
        <Animated.Image 
          source={require('../assets/images/logo_pickplay.png')}
          style={[
            styles.logo,
            {
              transform: [
                { scale: logoScale },
              ],
            },
          ]}
        />
      </View>

      {/* 전체 텍스트 페이드인 */}
      <View style={styles.tipContainer}>
        <Animated.Text style={[styles.tipText, { opacity: textOpacity }]}>
          {fullText}
        </Animated.Text>
      </View>

      {/* 로딩 인디케이터 */}
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{loadingText}</Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
    // 네비게이션 바를 포함한 하단 컴포넌트를 모두 가리도록 전체 화면 오버레이
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  logo: {
    width: 200,
    height: 80,
    resizeMode: 'contain',
  },
  tipContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    maxWidth: width * 0.95,
  },
  tipIcon: {
    fontSize: 48,
    marginBottom: 20,
  },
  tipText: {
    fontSize: 30,
    color: colors.primary,
    textAlign: 'center',
    lineHeight: 48,
    fontWeight: '600',
  },
  cursor: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
  },
});
