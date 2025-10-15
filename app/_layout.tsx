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

import NotificationBootstrap from './components/NotificationBootstrap';
import { initAds } from './services/ads';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    (async () => {
      // 1. App Check 디버그 토큰 출력
      // v23+ 에서는 activate() 호출 없이 자동 초기화됨
      // 디버그 토큰만 가져와서 출력
      if (__DEV__) {
        try {
          console.log('🔍 App Check 디버그 토큰 확인 중...');
          const token = await appCheck().getToken(true);
          if (token) {
            console.log('═══════════════════════════════════════');
            console.log('🔑 Firebase App Check Debug Token:');
            console.log(token.token);
            console.log('═══════════════════════════════════════');
            console.log('👆 위 토큰을 Firebase Console → App Check → Debug tokens에 등록하세요');
          }
        } catch (tokenError) {
          console.error('❌ 디버그 토큰 가져오기 실패:', tokenError);
          console.log('💡 App Check가 아직 초기화되지 않았을 수 있습니다.');
        }
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

