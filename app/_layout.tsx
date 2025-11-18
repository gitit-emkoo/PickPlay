import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { Platform, useColorScheme } from 'react-native';
import * as Tracking from 'expo-tracking-transparency';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import appCheck from '@react-native-firebase/app-check';
import { getApp, initializeApp, getApps } from '@react-native-firebase/app';

import NotificationBootstrap from './components/NotificationBootstrap';
import { initAds } from '../src/services/ads';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Firebase 초기화 (네이티브 모듈이 자동 초기화하지 못하는 경우를 대비)
let firebaseInitialized = false;
const initializeFirebaseIfNeeded = async () => {
  if (firebaseInitialized) return true;
  
  try {
    // 이미 초기화되었는지 확인
    const apps = getApps();
    if (apps.length > 0) {
      console.log('[Firebase Init] ✅ Firebase 앱이 이미 초기화되어 있습니다.');
      firebaseInitialized = true;
      return true;
    }
    
    // GoogleService-Info.plist에서 정보를 읽어서 초기화 시도
    // 하지만 React Native Firebase는 네이티브에서 자동 초기화되므로
    // 여기서는 단순히 대기만 합니다.
    console.log('[Firebase Init] ⏳ Firebase 네이티브 초기화 대기 중...');
    
    // 네이티브 모듈이 초기화될 때까지 대기 (최대 10초)
    for (let i = 0; i < 50; i++) {
      try {
        const apps = getApps();
        if (apps.length > 0) {
          console.log('[Firebase Init] ✅ Firebase 초기화 완료!');
          firebaseInitialized = true;
          return true;
        }
      } catch (e) {
        // 계속 시도
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.warn('[Firebase Init] ⚠️ Firebase 자동 초기화 실패, 네이티브 빌드 확인 필요');
    return false;
  } catch (error) {
    console.error('[Firebase Init] ❌ Firebase 초기화 에러:', error);
    return false;
  }
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    (async () => {
      // 0. Firebase 초기화 확인
      console.log('[RootLayout] Firebase 초기화 확인 시작...');
      await initializeFirebaseIfNeeded();
      
      // 1. App Check 디버그 토큰 출력
      // v23+ 에서는 activate() 호출 없이 자동 초기화됨
      // 디버그 토큰만 가져와서 출력
      // Firebase 네이티브 모듈 초기화를 위해 지연 후 호출
      if (__DEV__) {
        // Firebase 네이티브 모듈이 초기화될 때까지 대기 (최대 3초, 5회 재시도)
        const waitForFirebase = async (maxRetries = 5, delay = 600) => {
          for (let i = 0; i < maxRetries; i++) {
            try {
              await new Promise(resolve => setTimeout(resolve, delay));
              const token = await appCheck().getToken(true);
              return token;
            } catch (error: any) {
              if (error?.message?.includes("No Firebase App '[DEFAULT]'")) {
                if (i < maxRetries - 1) {
                  console.log(`⏳ Firebase 초기화 대기 중... (${i + 1}/${maxRetries})`);
                  continue;
                }
              }
              throw error;
            }
          }
          return null;
        };

        try {
          console.log('🔍 App Check 디버그 토큰 확인 중...');
          const token = await waitForFirebase();
          if (token) {
            console.log('═══════════════════════════════════════');
            console.log('🔑 Firebase App Check Debug Token:');
            console.log(token.token);
            console.log('═══════════════════════════════════════');
            console.log('👆 위 토큰을 Firebase Console → App Check → Debug tokens에 등록하세요');
          } else {
            console.log('⚠️ App Check 디버그 토큰을 가져올 수 없습니다. (앱은 정상 동작합니다)');
          }
        } catch (tokenError) {
          // 개발 환경에서는 디버그 토큰이 없어도 앱이 동작해야 하므로 에러를 무시
          console.log('⚠️ App Check 디버그 토큰을 가져올 수 없습니다. (앱은 정상 동작합니다)');
          console.log('💡 Firebase가 완전히 초기화된 후 다시 시도해보세요.');
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

