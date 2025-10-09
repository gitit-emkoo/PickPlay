import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { Platform, useColorScheme } from 'react-native';
import * as Tracking from 'expo-tracking-transparency';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import appCheck from '@react-native-firebase/app-check';

import NotificationBootstrap from '@/app/components/NotificationBootstrap';
import { initAds } from '@/src/services/ads';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    (async () => {
      // 1. App Check 활성화
      // 개발: 디버그 프로바이더(디버그 토큰 등록 필요)
      // 배포: 기본 프로바이더(Play Integrity / App Attest)
      try {
        if (__DEV__) {
          await appCheck().activate('debug', true);
          console.log('✅ App Check: debug provider 활성화');
        } else {
          await appCheck().activate('default', true);
          console.log('✅ App Check: production provider 활성화');
        }
      } catch (e) {
        console.log('⚠️ App Check activate 실패:', (e as Error).message);
      }

      // 2. ATT 권한 요청 (iOS)
      if (Platform.OS === 'ios') {
        const { status } = await Tracking.requestTrackingPermissionsAsync();
        if (status === 'granted') {
          console.log('✅ ATT: 광고 추적 허용됨');
        } else {
          console.log('❌ ATT: 광고 추적 거부됨');
        }
      }
      
      // 3. 광고 초기화
      console.log('🚀 광고 모듈 초기화를 시작합니다...');
      await initAds();
    })();
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }} edges={['top','bottom']}>
        <StatusBar style="dark" />
        <NotificationBootstrap />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
        </Stack>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

