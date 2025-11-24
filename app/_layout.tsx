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
    console.log('[Firebase Init] 🔍 Firebase 초기화 상태 확인 시작...');
    console.log('[Firebase Init] 📋 React Native Firebase는 네이티브에서 GoogleService-Info.plist를 자동으로 읽어서 초기화합니다.');
    console.log('[Firebase Init] 📋 파일이 앱 번들에 포함되지 않으면 네이티브 초기화가 실패합니다.');
    
    // 이미 초기화되었는지 확인
    try {
      const apps = getApps();
      if (apps.length > 0) {
        console.log('[Firebase Init] ✅ Firebase 앱이 이미 초기화되어 있습니다. (앱 수:', apps.length, ')');
        apps.forEach((app, idx) => {
          console.log(`[Firebase Init]   앱 ${idx + 1}: ${app.name}`);
        });
        firebaseInitialized = true;
        return true;
      } else {
        console.log('[Firebase Init] ⚠️ Firebase 앱이 초기화되지 않음 (앱 수: 0)');
      }
    } catch (getAppsError: any) {
      console.log('[Firebase Init] ⚠️ getApps() 호출 실패:', getAppsError?.message || getAppsError);
      console.log('[Firebase Init] 💡 이것은 네이티브 모듈이 아직 준비되지 않았거나 GoogleService-Info.plist가 번들에 없을 수 있습니다.');
    }
    
    // React Native Firebase는 네이티브에서 자동 초기화되므로
    // 네이티브 모듈이 초기화될 때까지 대기 (최대 10초)
    console.log('[Firebase Init] ⏳ Firebase 네이티브 초기화 대기 중... (최대 10초)');
    
    for (let i = 0; i < 50; i++) {
      try {
        const apps = getApps();
        if (apps.length > 0) {
          console.log('[Firebase Init] ✅ Firebase 네이티브 초기화 완료! (앱 수:', apps.length, ')');
          apps.forEach((app, idx) => {
            console.log(`[Firebase Init]   앱 ${idx + 1}: ${app.name}`);
          });
          firebaseInitialized = true;
          return true;
        }
      } catch (e: any) {
        if (i % 10 === 0) {
          console.log(`[Firebase Init] ⏳ 네이티브 초기화 대기 중... (${i * 200}ms 경과, ${e?.message || '앱 없음'})`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('[Firebase Init] ❌ 네이티브 초기화 실패 (10초 대기 후에도 앱이 등록되지 않음)');
    
    // 네이티브 초기화가 실패한 경우, JavaScript 레벨에서 명시적 초기화 시도
    // React Native Firebase는 네이티브에서 자동으로 GoogleService-Info.plist를 읽어야 하는데,
    // 파일이 앱 번들에 포함되지 않으면 네이티브 초기화가 실패합니다
    // 이 경우 JavaScript 레벨에서 명시적으로 설정 객체를 제공해야 합니다
    console.warn('[Firebase Init] ⚠️ Firebase 네이티브 초기화 실패');
    console.warn('[Firebase Init] 💡 원인: GoogleService-Info.plist가 앱 번들에 포함되지 않았을 가능성이 높습니다');
    console.warn('[Firebase Init] 💡 해결: 빌드 로그에서 파일 포함 여부 확인 필요');
    console.warn('[Firebase Init] 🔧 JavaScript 레벨에서 명시적 초기화 시도...');
    try {
      // 플랫폼별 Firebase 설정으로 명시적 초기화
      // React Native Firebase는 네이티브에서 GoogleService-Info.plist (iOS) 또는 google-services.json (Android)를 자동으로 읽어야 하는데,
      // 파일이 번들에 없으면 실패합니다. 이 경우 명시적으로 설정 객체를 제공해야 합니다.
      const firebaseConfig = Platform.select({
        ios: {
          // iOS용 Firebase 설정 (GoogleService-Info.plist에서 추출)
          apiKey: 'AIzaSyAfKqr2opuHza9hkXFmofPGg4t_HVOmcpk',
          projectId: 'today-balance-fa0a5',
          storageBucket: 'today-balance-fa0a5.firebasestorage.app',
          messagingSenderId: '981215713715',
          appId: '1:981215713715:ios:9c812d5a30fea59b9c53c6',
        },
        android: {
          // Android용 Firebase 설정 (google-services.json에서 추출)
          apiKey: 'AIzaSyDAyQGN1q5K9GhoNdDmNt65PH37dVL-5xA',
          projectId: 'today-balance-fa0a5',
          storageBucket: 'today-balance-fa0a5.firebasestorage.app',
          messagingSenderId: '981215713715',
          appId: '1:981215713715:android:820a3f60db5067369c53c6',
        },
        default: {},
      });
      
      // 이미 초기화된 앱이 있는지 다시 확인
      const existingApps = getApps();
      if (existingApps.length === 0) {
        console.log('[Firebase Init] initializeApp() 호출 중...');
        const app = initializeApp(firebaseConfig);
        
        if (!app) {
          console.error('[Firebase Init] ❌ initializeApp()이 undefined를 반환했습니다.');
          console.error('[Firebase Init] 💡 이것은 네이티브 모듈이 GoogleService-Info.plist를 찾지 못했다는 의미일 수 있습니다.');
          throw new Error('initializeApp()이 undefined를 반환함 - 네이티브 모듈 초기화 실패 가능');
        }
        
        console.log('[Firebase Init] initializeApp() 반환값:', {
          name: app?.name,
          options: app?.options,
          app: app ? '존재함' : 'undefined'
        });
        
        // 앱이 반환되었더라도 네이티브 모듈이 제대로 초기화되었는지 확인
        // React Native Firebase는 네이티브에서 자동으로 초기화되므로,
        // JavaScript 레벨에서 initializeApp()을 호출해도 네이티브 초기화가 필요합니다
        await new Promise(resolve => setTimeout(resolve, 500)); // 네이티브 모듈이 준비될 때까지 대기
      } else {
        console.log('[Firebase Init] ✅ Firebase 앱이 이미 초기화되어 있습니다.', existingApps[0].name);
      }
      
      // 초기화 확인 (여러 번 시도)
      let appsAfterInit = getApps();
      if (appsAfterInit.length === 0) {
        // 네이티브 모듈이 준비될 때까지 최대 2초 대기
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 200));
          appsAfterInit = getApps();
          if (appsAfterInit.length > 0) {
            break;
          }
          console.log(`[Firebase Init] 앱 등록 대기 중... (${i + 1}/10)`);
        }
      }
      
      if (appsAfterInit.length > 0) {
        console.log('[Firebase Init] ✅ Firebase 초기화 완료 확인됨 (앱 수:', appsAfterInit.length, ')');
        appsAfterInit.forEach((app, idx) => {
          console.log(`[Firebase Init]   앱 ${idx + 1}: ${app.name}`);
        });
        firebaseInitialized = true;
        return true;
      } else {
        console.error('[Firebase Init] ❌ Firebase 초기화 후에도 앱이 등록되지 않음');
        console.error('[Firebase Init] 💡 React Native Firebase는 네이티브에서 GoogleService-Info.plist를 자동으로 읽어야 합니다.');
        console.error('[Firebase Init] 💡 파일이 앱 번들에 포함되지 않으면 네이티브 초기화가 실패합니다.');
        console.error('[Firebase Init] 💡 다음을 확인하세요:');
        console.error('[Firebase Init]   1. IPA 파일에 GoogleService-Info.plist가 포함되어 있는지');
        console.error('[Firebase Init]   2. Xcode 프로젝트의 "Copy Bundle Resources"에 파일이 있는지');
        console.error('[Firebase Init]   3. 네이티브 빌드가 최신 버전인지');
        throw new Error('Firebase 초기화 후에도 앱이 등록되지 않음 - GoogleService-Info.plist가 번들에 포함되지 않았을 가능성');
      }
    } catch (initError: any) {
      console.error('[Firebase Init] ❌ JavaScript 레벨 초기화도 실패:', initError?.message || initError);
      console.error('[Firebase Init] 💡 GoogleService-Info.plist가 네이티브 빌드에 포함되었는지 확인하세요.');
      console.error('[Firebase Init] 💡 React Native Firebase 네이티브 모듈이 제대로 링크되었는지 확인하세요.');
      return false;
    }
  } catch (error: any) {
    console.error('[Firebase Init] ❌ Firebase 초기화 에러:', error?.message || error);
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
      // ⚠️ 중요: NSUserTrackingUsageDescription이 Info.plist에 없으면 네이티브 크래시 발생
      // Config Plugin (with-tracking-transparency)이 expo prebuild 시 적용되어야 함
      // 일단 ATT 권한 요청을 지연시켜서 다른 초기화가 완료된 후 호출
      if (Platform.OS === 'ios') {
        // ATT 권한 요청을 비동기로 지연 실행 (앱 초기화 완료 후)
        // 네이티브 모듈이 완전히 로드될 때까지 충분히 대기
        setTimeout(async () => {
          try {
            // 추가 대기 시간 (네이티브 모듈 완전 초기화 대기)
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            console.log('🔍 ATT: 권한 요청 시작...');
            console.log('💡 참고: NSUserTrackingUsageDescription이 Info.plist에 있어야 합니다.');
            console.log('💡 참고: Config Plugin (with-tracking-transparency)이 expo prebuild 시 적용되어야 합니다.');
            
            const { status } = await Tracking.requestTrackingPermissionsAsync();
            if (status === 'granted') {
              console.log('✅ ATT: 광고 추적 허용됨');
            } else {
              console.log('❌ ATT: 광고 추적 거부됨');
            }
          } catch (error: any) {
            console.error('⚠️ ATT 권한 요청 실패:', error?.message || error);
            console.error('⚠️ ATT: 네이티브 크래시가 발생했을 수 있습니다.');
            console.error('⚠️ ATT: Info.plist에 NSUserTrackingUsageDescription이 있는지 확인하세요.');
            // 크래시 방지: 에러 발생 시에도 앱은 계속 실행하려고 하지만,
            // 네이티브 크래시는 이미 발생했을 수 있으므로 여기서는 로그만 남김
          }
        }, 3000); // 3초 후 실행 (앱 초기화 완료 후)
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

