module.exports = {
  expo: {
    name: 'pickplay',
    slug: 'pickplay',
    version: '1.2.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.pickplay.kwcc'
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff'
      }
    },
    web: {
      favicon: './assets/favicon.png'
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
      ]
    ]
  }
};
