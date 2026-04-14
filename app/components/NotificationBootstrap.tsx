import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { initializeNotifications } from '../../src/services/notifications';

export default function NotificationBootstrap(){
  const router = useRouter();

  useEffect(()=>{
    let mounted = true;
    let cleanup: (()=>void)|undefined;
    let clickSub: Notifications.Subscription | undefined;
    (async()=>{
      const fn = await initializeNotifications(20, 15);
      if(mounted){
        cleanup = fn;
        // 알림 클릭 시 오늘의 메인 질문 화면으로 이동
        clickSub = Notifications.addNotificationResponseReceivedListener((response) => {
          try {
            const data = (response.notification.request.content.data || {}) as any;
            // daily_question 타입(매일 알림 + 3/5/10일 리마인드)은 모두 메인 질문 화면으로 이동
            if (data.type === 'daily_question') {
              router.push('/(tabs)');
            }
          } catch (e) {
            console.warn('[NotificationBootstrap] 알림 클릭 처리 중 오류:', (e as any)?.message || e);
          }
        });
      } else if (typeof fn === 'function') {
        fn();
      }
    })();
    return ()=>{
      mounted = false;
      if(typeof cleanup === 'function') cleanup();
      if (clickSub) {
        clickSub.remove();
      }
    };
  },[]);
  return null;
}


