module.exports = {
  expo: {
    name: 'pickplay',
    slug: 'pickplay',
    scheme: 'pickplay',
    version: '1.2.0',
    extra: {
      eas: {
        projectId: 'f0389889-654e-4120-8839-8b795ff4b641'
      },
      'react-native-google-mobile-ads': {
        ios_app_id: 'ca-app-pub-3940256099942544~1458002511'
      }
    },
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.pickplay.kwcc',
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        // TODO: 실배포 시 실제 AdMob 앱 ID(아래 주석)로 교체하세요.
        // 'ca-app-pub-2555567440328829~5483134579'
        GADApplicationIdentifier: 'ca-app-pub-3940256099942544~1458002511'
      }
    },
    android: {
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
          }
        }
      ],
      './plugins/with-google-services-file',
      './plugins/with-admob-test-device'
    ]
  },
  'react-native-google-mobile-ads': {
    ios_app_id: 'ca-app-pub-3940256099942544~1458002511'
  }
};
