import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { Platform, Settings, useColorScheme } from 'react-native';
import * as Tracking from 'expo-tracking-transparency';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import appCheck from '@react-native-firebase/app-check';
import { getApp, initializeApp, getApps } from '@react-native-firebase/app';

import NotificationBootstrap from './components/NotificationBootstrap';
import LoadingScreen from './components/LoadingScreen';
import ErrorScreen from './components/ErrorScreen';
import IDFADebugOverlay from './components/IDFADebugOverlay';
import { initAds } from '../src/services/ads';
import { ensureAnonymousAuth } from '../src/services/firebase';

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
    
    // 이미 초기화되었는지 확인 (빠른 체크)
    try {
      const apps = getApps();
      if (apps.length > 0) {
        console.log('[Firebase Init] ✅ Firebase 앱이 이미 초기화되어 있습니다.');
        firebaseInitialized = true;
        return true;
      }
    } catch (getAppsError: any) {
      // 네이티브 모듈이 아직 준비되지 않았을 수 있음
    }
    
    // React Native Firebase는 네이티브에서 자동 초기화되므로
    // 짧은 시간만 대기 (최대 500ms)
    console.log('[Firebase Init] ⏳ Firebase 네이티브 초기화 확인 중...');
    
    // 최대 5번 시도 (총 500ms)
    for (let i = 0; i < 5; i++) {
      try {
        const apps = getApps();
        if (apps.length > 0) {
          console.log('[Firebase Init] ✅ Firebase 네이티브 초기화 완료!');
          firebaseInitialized = true;
          return true;
        }
      } catch (e: any) {
        // 에러 무시하고 계속 시도
      }
      await new Promise(resolve => setTimeout(resolve, 100));
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
          databaseURL: 'https://today-balance-fa0a5-default-rtdb.asia-southeast1.firebasedatabase.app',
        },
        android: {
          // Android용 Firebase 설정 (google-services.json에서 추출)
          apiKey: 'AIzaSyDAyQGN1q5K9GhoNdDmNt65PH37dVL-5xA',
          projectId: 'today-balance-fa0a5',
          storageBucket: 'today-balance-fa0a5.firebasestorage.app',
          messagingSenderId: '981215713715',
          appId: '1:981215713715:android:820a3f60db5067369c53c6',
          databaseURL: 'https://today-balance-fa0a5-default-rtdb.asia-southeast1.firebasedatabase.app',
        },
      });
      
      // 플랫폼이 iOS나 Android가 아니면 에러
      if (!firebaseConfig || !firebaseConfig.appId) {
        throw new Error('지원되지 않는 플랫폼입니다. iOS 또는 Android에서만 실행할 수 있습니다.');
      }
      
      // 이미 초기화된 앱이 있는지 다시 확인
      const existingApps = getApps();
      if (existingApps.length === 0) {
        console.log('[Firebase Init] initializeApp() 호출 중...');
        // React Native Firebase의 initializeApp은 동기 함수이지만, 타입 정의상 Promise로 추론될 수 있음
        // 실제로는 동기이므로 결과를 바로 사용
        const appResult = initializeApp(firebaseConfig);
        // Promise인지 확인하고 처리
        const app = appResult instanceof Promise ? await appResult : appResult;
        
        if (!app) {
          console.error('[Firebase Init] ❌ initializeApp()이 undefined를 반환했습니다.');
          console.error('[Firebase Init] 💡 이것은 네이티브 모듈이 GoogleService-Info.plist를 찾지 못했다는 의미일 수 있습니다.');
          throw new Error('initializeApp()이 undefined를 반환함 - 네이티브 모듈 초기화 실패 가능');
        }
        
        console.log('[Firebase Init] initializeApp() 반환값:', {
          name: app.name || 'unknown',
          options: app.options ? '있음' : '없음',
          app: '존재함'
        });
        
        // 앱이 반환되었더라도 네이티브 모듈이 제대로 초기화되었는지 확인
        // React Native Firebase는 네이티브에서 자동으로 초기화되므로,
        // JavaScript 레벨에서 initializeApp()을 호출해도 네이티브 초기화가 필요합니다
        await new Promise(resolve => setTimeout(resolve, 500)); // 네이티브 모듈이 준비될 때까지 대기
      } else {
        console.log('[Firebase Init] ✅ Firebase 앱이 이미 초기화되어 있습니다.', existingApps[0].name);
      }
      
      // 초기화 확인 (빠른 체크)
      let appsAfterInit = getApps();
      if (appsAfterInit.length === 0) {
        // 네이티브 모듈이 준비될 때까지 최대 500ms 대기
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          appsAfterInit = getApps();
          if (appsAfterInit.length > 0) {
            break;
          }
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
        console.error('[Firebase Init] ⚠️ Firebase 초기화 실패했지만 앱은 계속 실행합니다.');
        // 크래시 방지: 에러를 throw하지 않고 false 반환 (앱은 계속 실행)
        // Firebase 초기화 실패 시에도 앱은 동작해야 함 (네트워크 문제 등으로 일시적일 수 있음)
        return false;
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
  const [firebaseStatus, setFirebaseStatus] = useState<'pending' | 'ready' | 'error'>('pending');
  const [firebaseErrorMessage, setFirebaseErrorMessage] = useState<string>('서비스에 연결하는 중입니다...');
  const [initToken, setInitToken] = useState(0);

  // Firebase 초기화 상태를 즉시 확인 (이미 초기화되어 있을 수 있음)
  useEffect(() => {
    const checkFirebaseImmediately = async () => {
      try {
        const apps = getApps();
        if (apps.length > 0) {
          // 이미 초기화되어 있으면 바로 ready 상태로
          setFirebaseStatus('ready');
        }
      } catch {
        // 에러 무시 - 정상적인 초기화 프로세스 진행
      }
    };
    checkFirebaseImmediately();
  }, []);

  useEffect(() => {
    (async () => {
      // 0. Firebase 초기화 확인 (빠른 체크)
      const initResult = await initializeFirebaseIfNeeded();
      if (!initResult) {
        // 초기화 실패 시에도 앱은 계속 진행 (백그라운드에서 재시도)
        console.warn('[RootLayout] Firebase 초기화 확인 실패 - 백그라운드에서 재시도');
        setFirebaseStatus('ready'); // 에러 화면 대신 메인 화면으로 진행
        return;
      }

      // 익명 인증은 백그라운드에서 처리 (블로킹하지 않음)
      ensureAnonymousAuth().catch((authError: any) => {
        console.warn('[RootLayout] 익명 인증 실패 - 백그라운드에서 재시도:', authError?.message);
      });
      
      setFirebaseStatus('ready');
      
      // 1. App Check 디버그 토큰, ATT 권한, 광고 초기화는 모두 백그라운드에서 처리
      // (앱 시작을 블로킹하지 않음)
      setTimeout(() => {
        // App Check 디버그 토큰 (개발 환경만)
        if (__DEV__) {
          appCheck().getToken(true).then((token) => {
            console.log('═══════════════════════════════════════');
            console.log('🔑 Firebase App Check Debug Token:');
            console.log(token.token);
            console.log('═══════════════════════════════════════');
            console.log('👆 위 토큰을 Firebase Console → App Check → Debug tokens에 등록하세요');
          }).catch(() => {
            // 에러 무시
          });
        }

        // ATT 권한 요청 및 IDFA 가져오기 (iOS)
        if (Platform.OS === 'ios') {
          Tracking.requestTrackingPermissionsAsync().then(async ({ status }) => {
            if (status === 'granted') {
              console.log('✅ ATT: 광고 추적 허용됨');
              
              // IDFA 읽기 재시도 로직 (최대 10회, 500ms 간격)
              let retryCount = 0;
              const maxRetries = 10;
              const retryDelay = 500;
              
              const tryGetIDFA = async (): Promise<void> => {
                try {
                  const idfaFromNative = Settings.get?.('PickPlayIDFA');
                  if (typeof idfaFromNative === 'string' && idfaFromNative.length > 0) {
                    if (idfaFromNative === 'LIMITED_AD_TRACKING') {
                      console.log('📵 IDFA가 0으로 고정되어 있습니다. (제한된 광고 추적 설정)');
                    } else {
                      console.log('═══════════════════════════════════════');
                      console.log('📱 IDFA (AdMob Test Device):');
                      console.log(idfaFromNative);
                      console.log('═══════════════════════════════════════');
                      console.log('👆 AdMob 콘솔 > 테스트 기기 등록 시 위 ID를 입력하세요.');
                    }
                    return; // 성공 시 종료
                  } else {
                    // IDFA가 아직 저장되지 않음 - 재시도
                    retryCount++;
                    if (retryCount < maxRetries) {
                      await new Promise(resolve => setTimeout(resolve, retryDelay));
                      return tryGetIDFA();
                    } else {
                      console.log('⌛ IDFA가 아직 준비되지 않았습니다. 앱을 재시작하거나 네이티브 빌드를 확인하세요.');
                    }
                  }
                } catch (error: any) {
                  console.warn('⚠️ IDFA 확인 실패:', error?.message);
                }
              };
              
              // 첫 시도 시작
              await tryGetIDFA();
            } else {
              console.log('❌ ATT: 광고 추적 거부됨 - IDFA를 가져올 수 없습니다.');
            }
          }).catch((error: any) => {
            console.warn('⚠️ ATT 권한 요청 실패:', error?.message);
          });
        }

        // 광고 초기화
        initAds().catch((error) => {
          console.warn('⚠️ 광고 모듈 초기화 실패:', error);
        });
      }, 100);
    })();
  }, [initToken]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  if (firebaseStatus === 'pending') {
    return <LoadingScreen message="잠시만 기다려주세요..." />;
  }

  if (firebaseStatus === 'error') {
    return (
      <ErrorScreen
        title="연결 실패"
        subtitle="서비스에 연결하지 못했습니다."
        message={firebaseErrorMessage}
        onRetry={() => {
          setFirebaseStatus('pending');
          setFirebaseErrorMessage('잠시 후 다시 시도해주세요.');
          setInitToken((prev) => prev + 1);
        }}
      />
    );
  }

  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top','bottom']}>
        <StatusBar style="dark" />
        <NotificationBootstrap />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
        </Stack>
        <IDFADebugOverlay />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
