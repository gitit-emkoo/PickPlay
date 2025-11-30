const { withAppDelegate } = require('@expo/config-plugins');

/**
 * AppDelegate.mm에 AdMob 테스트 기기 ID 로깅 코드 추가
 * IDFA를 가져와서 로그로 출력하고, AdMob 테스트 기기로 등록
 */
const withAdMobTestDevice = (config) => {
  console.log('[PickPlay Plugin] withAdMobTestDevice 플러그인 시작');
  return withAppDelegate(config, (config) => {
    const appDelegate = config.modResults;

    console.log('[PickPlay Plugin] AppDelegate 파일 확인 중...');
    console.log('[PickPlay Plugin] AppDelegate 내용 길이:', appDelegate.contents?.length || 0);

    // 이미 추가된 경우 건너뛰기
    if (appDelegate.contents.includes('[PickPlay][AdMob] Test Device Identifier')) {
      console.log('[PickPlay Plugin] ✅ 이미 IDFA 코드가 추가되어 있습니다. 건너뜁니다.');
      return config;
    }

    console.log('[PickPlay Plugin] 🚀 IDFA 코드 추가 시작...');

    // 필요한 import 추가 (파일 상단에)
    const importsToAdd = `#import <AdSupport/AdSupport.h>
#import <AppTrackingTransparency/AppTrackingTransparency.h>
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
  // ATT 권한 상태 확인
  ATTrackingManagerAuthorizationStatus status = [ATTrackingManager trackingAuthorizationStatus];
  
  // ATT 권한이 허용되지 않은 경우, IDFA를 가져올 수 없음
  if (status != ATTrackingManagerAuthorizationStatusAuthorized) {
    NSString *statusString = @"unknown";
    switch (status) {
      case ATTrackingManagerAuthorizationStatusNotDetermined:
        statusString = @"not_determined";
        break;
      case ATTrackingManagerAuthorizationStatusRestricted:
        statusString = @"restricted";
        break;
      case ATTrackingManagerAuthorizationStatusDenied:
        statusString = @"denied";
        break;
      default:
        break;
    }
    RCTLogWarn(@"[PickPlay][AdMob] ATT 권한이 허용되지 않음: %@", statusString);
    // NSUserDefaults에 저장하지 않고 nil 반환
    return nil;
  }
  
  ASIdentifierManager *identifierManager = [ASIdentifierManager sharedManager];
  
  // IDFA 가져오기
  NSUUID *advertisingIdentifier = identifierManager.advertisingIdentifier;
  NSString *idfaString = [advertisingIdentifier UUIDString];
  
  // 기본 저장소에 기록해 JS에서 Settings.get으로 읽을 수 있게 함
  NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];

  if ([idfaString isEqualToString:@"00000000-0000-0000-0000-000000000000"]) {
    RCTLogWarn(@"[PickPlay][AdMob] IDFA is zero - User has limited ad tracking enabled");
    [defaults setObject:@"LIMITED_AD_TRACKING" forKey:@"PickPlayIDFA"];
    [defaults synchronize];
    return @"LIMITED_AD_TRACKING";
  }

  [defaults setObject:idfaString forKey:@"PickPlayIDFA"];
  [defaults synchronize];

  RCTLogInfo(@"[PickPlay][AdMob] ========================================");
  RCTLogInfo(@"[PickPlay][AdMob] Test Device Identifier: %@", idfaString);
  RCTLogInfo(@"[PickPlay][AdMob] To register this device in AdMob console:");
  RCTLogInfo(@"[PickPlay][AdMob] 1. Go to AdMob Console > App settings > Test devices");
  RCTLogInfo(@"[PickPlay][AdMob] 2. Add device with ID: %@", idfaString);
  RCTLogInfo(@"[PickPlay][AdMob] ========================================");

  return idfaString;
}

// ATT 권한이 변경될 때 IDFA를 다시 가져오는 메서드
- (void)refreshIDFAIfAuthorized {
  ATTrackingManagerAuthorizationStatus status = [ATTrackingManager trackingAuthorizationStatus];
  if (status == ATTrackingManagerAuthorizationStatusAuthorized) {
    NSString *idfa = [self getAdMobTestDeviceIdentifier];
    if (idfa && ![idfa isEqualToString:@"LIMITED_AD_TRACKING"]) {
      RCTLogInfo(@"[PickPlay][AdMob] IDFA refreshed after ATT authorization: %@", idfa);
    }
  }
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
  // ATT 권한이 이미 허용된 경우에만 IDFA 가져오기
  ATTrackingManagerAuthorizationStatus attStatus = [ATTrackingManager trackingAuthorizationStatus];
  if (attStatus == ATTrackingManagerAuthorizationStatusAuthorized) {
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
  } else {
    RCTLogInfo(@"[PickPlay][AdMob] ATT 권한이 아직 허용되지 않음 (status: %ld). JavaScript에서 권한 요청 후 IDFA를 가져올 수 있습니다.", (long)attStatus);
  }
  
  // ATT 권한 상태 변경 감지를 위한 알림 등록
  // 앱이 포그라운드로 돌아올 때마다 IDFA 갱신 시도
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(refreshIDFAIfAuthorized)
                                               name:UIApplicationDidBecomeActiveNotification
                                             object:nil];
  
  // 초기 실행 시 한 번만 IDFA 갱신 시도 (ATT 권한이 이미 허용된 경우)
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    [self refreshIDFAIfAuthorized];
  });
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
      console.log('[PickPlay Plugin] ⚠️ 패턴 매칭 실패, 수동 추가 시도...');
      appDelegate.contents = appDelegate.contents.replace(
        /(  return YES;\s*\n\s*\})/,
        `${didFinishLaunchingCode}$1`
      );
      added = true;
    }

    if (added) {
      console.log('[PickPlay Plugin] ✅ IDFA 코드가 AppDelegate에 성공적으로 추가되었습니다!');
      console.log('[PickPlay Plugin] AppDelegate 최종 길이:', appDelegate.contents.length);
      // 추가 확인: 실제로 코드가 포함되었는지 확인
      if (appDelegate.contents.includes('[PickPlay][AdMob] Test Device Setup')) {
        console.log('[PickPlay Plugin] ✅ 검증: didFinishLaunchingWithOptions 코드 확인됨');
      } else {
        console.log('[PickPlay Plugin] ❌ 경고: didFinishLaunchingWithOptions 코드가 없습니다!');
      }
      if (appDelegate.contents.includes('getAdMobTestDeviceIdentifier')) {
        console.log('[PickPlay Plugin] ✅ 검증: getAdMobTestDeviceIdentifier 함수 확인됨');
      } else {
        console.log('[PickPlay Plugin] ❌ 경고: getAdMobTestDeviceIdentifier 함수가 없습니다!');
      }
    } else {
      console.log('[PickPlay Plugin] ❌ 에러: IDFA 코드를 추가하지 못했습니다!');
      console.log('[PickPlay Plugin] AppDelegate에 didFinishLaunchingWithOptions가 있는지 확인:', appDelegate.contents.includes('didFinishLaunchingWithOptions'));
    }

    return config;
  });
};

module.exports = withAdMobTestDevice;
