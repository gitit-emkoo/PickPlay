import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { db, forceAnonymousAuth } from '@/src/services/firebase';
import firestore from '@react-native-firebase/firestore';

// 알림 핸들러 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// FCM 토큰 저장 키
const FCM_TOKEN_KEY = 'fcm_token';

// 푸시 알림 권한 요청
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('❌ 푸시 알림 권한이 거부되었습니다');
      return;
    }
    
    // FCM 토큰 가져오기
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: '14d1ecb2-a3c0-4425-ac97-0ec33b289905', // EAS 프로젝트 ID
    })).data;
    
    console.log('✅ FCM 토큰 획득:', token);
  } else {
    console.log('❌ 실제 기기에서만 푸시 알림이 작동합니다');
  }

  return token;
}

// Expo 푸시 토큰 Firestore 저장
type PlatformType = 'ios' | 'android';
export async function saveExpoPushTokenToFirestore(uid: string, token: string, platformType: PlatformType) {
  try {
    const ref = firestore().collection('user_push_tokens').doc(uid);
    await ref.set(
      {
        expo: {
          token,
          platform: platformType,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
    console.log('💾 Expo 푸시 토큰 Firestore 저장 완료');
  } catch (error) {
    console.error('❌ Expo 푸시 토큰 Firestore 저장 실패:', error);
  }
}

// FCM 토큰 저장
export async function saveFCMToken(token: string) {
  try {
    await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
    console.log('💾 FCM 토큰 저장 완료');
  } catch (error) {
    console.error('❌ FCM 토큰 저장 실패:', error);
  }
}

// FCM 토큰 가져오기
export async function getFCMToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(FCM_TOKEN_KEY);
  } catch (error) {
    console.error('❌ FCM 토큰 조회 실패:', error);
    return null;
  }
}

// 일일 질문 알림 스케줄링
// (legacy) scheduleDailyNotification 제거 → ensureDailyNotification만 사용

// 중복 없이 딱 1개만 유지되도록 보장
export async function ensureDailyNotification(hour: number = 20, minute: number = 15) {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const daily = scheduled.filter(n => n.content?.data?.type === 'daily_question');

    // 중복이면 1개만 남기고 모두 제거
    if (daily.length > 1) {
      await Promise.all(
        daily.slice(1).map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
      );
      return; // 하나는 이미 존재
    }

    // 1개 있으면 그대로 유지
    if (daily.length === 1) return;

    // 없으면 새로 스케줄
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "오늘의 질문이 기다리고 있어요! 🎯",
        body: "새로운 밸런스 게임에 참여해보세요!",
        data: { type: 'daily_question' },
      },
      trigger: {
        hour,
        minute,
        repeats: true,
      } as any,
    });
    console.log(`✅ ensureDailyNotification: 스케줄 완료 ${hour}:${minute}`);
  } catch (error) {
    console.error('❌ ensureDailyNotification 실패:', error);
  }
}

// (legacy) resetDailyNotification 제거 → ensureDailyNotification만 사용

// 연속 참여 축하 알림
export async function scheduleStreakNotification(streakCount: number) {
  try {
    if (streakCount === 3) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🎉 3일 연속 참여!",
          body: "정말 대단해요! 내일도 참여해보세요!",
          data: { type: 'streak_congrats' },
        },
        trigger: null, // 즉시 발송
      });
    } else if (streakCount === 10) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🔥 10일 연속 참여 달성!",
          body: "이제 2배 보상을 받을 수 있어요!",
          data: { type: 'streak_milestone' },
        },
        trigger: null, // 즉시 발송
      });
    }
  } catch (error) {
    console.error('❌ 연속 참여 알림 실패:', error);
  }
}

// 알림 리스너 설정
export function setupNotificationListener() {
  const subscription = Notifications.addNotificationReceivedListener(notification => {
    console.log('📱 알림 수신:', notification);
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('👆 알림 클릭:', response);
    // 알림 클릭 시 앱으로 이동하는 로직 추가 가능
  });

  return () => {
    subscription.remove();
    responseSubscription.remove();
  };
}

// 통합 초기화: 권한/토큰/채널/리스너/일일 스케줄을 한 번에 구성
export async function initializeNotifications(hour: number = 20, minute: number = 15) {
  try {
    const isDev = __DEV__;
    if (isDev) {
      console.log('🧪 DEV 모드: 알림 초기화(로컬 스케줄 제외) 진행');
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    // 권한 요청 및 토큰 획득
    await Notifications.requestPermissionsAsync();
    const token = await registerForPushNotificationsAsync();
    if (token) {
      try {
        const user = await forceAnonymousAuth();
        const uid = user?.uid;
        if (uid) {
          await saveExpoPushTokenToFirestore(uid, token, Platform.OS === 'ios' ? 'ios' : 'android');
        }
      } catch (e) {
        console.error('❌ 사용자 UID 확인/저장 중 오류:', e);
      }

      await saveFCMToken(token);
      console.log('🔐 토큰 저장 완료(초기화)');
    }

    const cleanup = setupNotificationListener();

    // 서버(Expo Push + 스케줄러) 전환으로 로컬 일일 스케줄은 비활성화
    // await ensureDailyNotification(hour, minute);
    // console.log(`📅 일일 알림 단일 스케줄 보장(${hour}:${minute})`);

    return cleanup;
  } catch (error) {
    console.error('❌ 알림 초기화 실패:', error);
    return () => {};
  }
}

// 디버그/수동 재등록: 권한 요청 → Expo 토큰 획득 → Firestore 저장을 한 번에 수행
export async function reRegisterPushToken() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return { ok: false, reason: 'permission-denied' as const };
    }

    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: '14d1ecb2-a3c0-4425-ac97-0ec33b289905',
    })).data;

    const user = await forceAnonymousAuth();
    const uid = user?.uid;
    if (!uid) {
      return { ok: false, reason: 'auth-missing' as const };
    }

    await saveExpoPushTokenToFirestore(uid, token, Platform.OS === 'ios' ? 'ios' : 'android');
    await saveFCMToken(token);
    return { ok: true, token };
  } catch (e: any) {
    const message = e?.message || String(e);
    console.error('❌ reRegisterPushToken 실패:', message);
    return { ok: false, reason: 'unknown' as const, error: message };
  }
}
