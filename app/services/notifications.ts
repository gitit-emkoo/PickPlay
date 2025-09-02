import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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
export async function scheduleDailyNotification() {
  try {
    // 이미 스케줄링된 알림이 있는지 확인
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const hasDailyNotification = scheduledNotifications.some(notification => 
      notification.content.data?.type === 'daily_question'
    );
    
    if (hasDailyNotification) {
      console.log('✅ 이미 일일 알림이 스케줄링되어 있음');
      return;
    }
    
    // 매일 저녁 8시 15분에 알림 스케줄링 (최적 시간대)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "오늘의 질문이 기다리고 있어요! 🎯",
        body: "새로운 밸런스 게임에 참여해보세요!",
        data: { type: 'daily_question' },
      },
      trigger: {
        hour: 20,
        minute: 15,
        repeats: true,
      } as any,
    });
    
    console.log('✅ 일일 알림 스케줄링 완료');
  } catch (error) {
    console.error('❌ 일일 알림 스케줄링 실패:', error);
  }
}

// 일일 알림을 한 번만 유지하도록 초기화 후 재스케줄
export async function resetDailyNotification(hour: number = 20, minute: number = 15) {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    // 기존 daily_question 모두 제거 (중복/잘못된 트리거 방지)
    await Promise.all(
      scheduled
        .filter(n => n.content?.data?.type === 'daily_question')
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );

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
    console.log(`✅ 일일 알림 재스케줄 완료: ${hour}:${minute}`);
  } catch (error) {
    console.error('❌ 일일 알림 재스케줄 실패:', error);
  }
}

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
