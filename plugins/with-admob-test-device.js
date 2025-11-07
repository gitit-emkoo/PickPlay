const { withAppDelegate } = require('@expo/config-plugins');

/**
 * AppDelegate.mm에 AdMob 테스트 기기 ID 로깅 코드 추가
 * IDFA를 가져와서 로그로 출력하고, AdMob 테스트 기기로 등록
 */
const withAdMobTestDevice = (config) => {
  return withAppDelegate(config, (config) => {
    const appDelegate = config.modResults;

    // 이미 추가된 경우 건너뛰기
    if (appDelegate.contents.includes('[PickPlay][AdMob] Test Device Identifier')) {
      return config;
    }

    // 필요한 import 추가 (파일 상단에)
    const importsToAdd = `#import <AdSupport/AdSupport.h>
#import <React/RCTLog.h>
#import <GoogleMobileAds/GoogleMobileAds.h>
`;

    // import 섹션 찾기 (AppDelegate.h import 다음에 추가)
    if (!appDelegate.contents.includes('#import <AdSupport/AdSupport.h>')) {
      // AppDelegate.h import를 찾아서 그 다음 줄에 추가
      appDelegate.contents = appDelegate.contents.replace(
        /(#import "AppDelegate\.h")/,
        `$1\n${importsToAdd}`
      );
    }

    // IDFA 헬퍼 함수 추가 (클래스 구현부 끝부분, @end 바로 전)
    const idfaHelperFunction = `
// MARK: - AdMob Test Device Identifier Helper
- (NSString *)getAdMobTestDeviceIdentifier {
  ASIdentifierManager *identifierManager = [ASIdentifierManager sharedManager];
  
  // IDFA 가져오기
  NSUUID *advertisingIdentifier = identifierManager.advertisingIdentifier;
  NSString *idfaString = [advertisingIdentifier UUIDString];
  
  // IDFA가 "00000000-0000-0000-0000-000000000000"인 경우 (제한된 광고 추적)
  if ([idfaString isEqualToString:@"00000000-0000-0000-0000-000000000000"]) {
    RCTLogWarn(@"[PickPlay][AdMob] IDFA is zero - User has limited ad tracking enabled");
    return @"LIMITED_AD_TRACKING";
  }
  
  RCTLogInfo(@"[PickPlay][AdMob] ========================================");
  RCTLogInfo(@"[PickPlay][AdMob] Test Device Identifier: %@", idfaString);
  RCTLogInfo(@"[PickPlay][AdMob] To register this device in AdMob console:");
  RCTLogInfo(@"[PickPlay][AdMob] 1. Go to AdMob Console > App settings > Test devices");
  RCTLogInfo(@"[PickPlay][AdMob] 2. Add device with ID: %@", idfaString);
  RCTLogInfo(@"[PickPlay][AdMob] ========================================");
  
  return idfaString;
}
`;

    // 헬퍼 함수를 @end 바로 전에 추가
    if (appDelegate.contents.includes('@end')) {
      appDelegate.contents = appDelegate.contents.replace(
        /(\n@end\s*$)/,
        `${idfaHelperFunction}$1`
      );
    }

    // didFinishLaunchingWithOptions 메서드 내부에 IDFA 로깅 코드 추가
    const didFinishLaunchingCode = `
  // MARK: - AdMob Test Device Setup
  NSString *testDeviceId = [self getAdMobTestDeviceIdentifier];
  if (testDeviceId && ![testDeviceId isEqualToString:@"LIMITED_AD_TRACKING"]) {
    GADMobileAds *mobileAds = [GADMobileAds sharedInstance];
    NSMutableArray<NSString *> *testDevices = [NSMutableArray arrayWithArray:mobileAds.requestConfiguration.testDeviceIdentifiers ?: @[]];
    if (![testDevices containsObject:testDeviceId]) {
      [testDevices addObject:testDeviceId];
      mobileAds.requestConfiguration.testDeviceIdentifiers = testDevices;
      RCTLogInfo(@"[PickPlay][AdMob] Test device automatically added to AdMob configuration: %@", testDeviceId);
    }
  }
`;

    // didFinishLaunchingWithOptions 메서드 찾기 (다양한 패턴 지원)
    const patterns = [
      /(- \(BOOL\)application:\(UIApplication \*\)application\s+didFinishLaunchingWithOptions:\(NSDictionary \*\)launchOptions\s*\{[^}]*)(  return YES;)/,
      /(- \(BOOL\)application:\(UIApplication \*\)application\s+didFinishLaunchingWithOptions:\([^)]+\)\s*\{[^}]*)(  return YES;)/,
    ];

    let added = false;
    for (const pattern of patterns) {
      if (pattern.test(appDelegate.contents)) {
        appDelegate.contents = appDelegate.contents.replace(
          pattern,
          (match, beforeReturn, returnStatement) => {
            // 이미 추가된 경우 건너뛰기
            if (beforeReturn.includes('[PickPlay][AdMob] Test Device Setup')) {
              return match;
            }
            added = true;
            return `${beforeReturn}${didFinishLaunchingCode}${returnStatement}`;
          }
        );
        if (added) break;
      }
    }

    // 패턴 매칭이 실패한 경우, return YES 앞에 수동으로 추가 시도
    if (!added && appDelegate.contents.includes('didFinishLaunchingWithOptions')) {
      appDelegate.contents = appDelegate.contents.replace(
        /(  return YES;\s*\n\s*\})/,
        `${didFinishLaunchingCode}$1`
      );
    }

    return config;
  });
};

module.exports = withAdMobTestDevice;
