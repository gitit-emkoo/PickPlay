module.exports = {
  expo: {
    name: 'pickplay',
    slug: 'today-balance',
    scheme: 'pickplay',
    version: '2.1.3',
    runtimeVersion: '2.1.3',
    extra: {
      eas: {
        projectId: '14d1ecb2-a3c0-4425-ac97-0ec33b289905'
      },
      'react-native-google-mobile-ads': {
        ios_app_id: 'ca-app-pub-2555567440328829~5483134579',
        android_app_id: 'ca-app-pub-2555567440328829~4208779024'
      }
    },
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0060CD'
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.pickplay.kwcc',
      // App Store: 마케팅 버전은 app.json/version 과 동일. 빌드 119 (autoIncrement 끔)
      buildNumber: '119',
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        GADApplicationIdentifier: 'ca-app-pub-2555567440328829~5483134579',
        NSUserTrackingUsageDescription: '이 정보를 사용하여 더 관련성 높은 맞춤형 광고를 제공합니다.',
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      package: 'com.pickplay.kwcc',
      versionCode: 119,
      googleServicesFile: './google-services.json',
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff'
      }
    },
    web: {
      favicon: './assets/images/favicon.png'
    },
    plugins: [
      [
        'expo-build-properties',
        {
          ios: {
            // Folly 오류를 해결하기 위한 전역 C++ 및 전처리기 플래그 설정
            newArchEnabled: false,
            flipper: false,
            deploymentTarget: '15.1',
            useFrameworks: 'static',
            podTargetXcconfig: {
              'GCC_PREPROCESSOR_DEFINITIONS': '$(inherited) FOLLY_NO_CONFIG=1 FOLLY_HAS_COROUTINES=0',
              'CLANG_CXX_LANGUAGE_STANDARD': 'gnu++20'
            },
            userTargetXcconfig: {
              'GCC_PREPROCESSOR_DEFINITIONS': '$(inherited) FOLLY_NO_CONFIG=1 FOLLY_HAS_COROUTINES=0',
              'CLANG_CXX_LANGUAGE_STANDARD': 'gnu++20'
            }
          },
          android: {
            targetSdkVersion: 35
          }
        }
      ],
      './plugins/with-google-services-file',
      './plugins/with-admob-test-device',
      './plugins/with-tracking-transparency'
    ]
  },
  'react-native-google-mobile-ads': {
    ios_app_id: 'ca-app-pub-2555567440328829~5483134579',
    android_app_id: 'ca-app-pub-2555567440328829~4208779024'
  }
};
