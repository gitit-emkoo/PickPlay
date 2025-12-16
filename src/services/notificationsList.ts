import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Notification } from '../types/notification';

const COLLECTION = 'user_notifications' as const;

/**
 * 사용자의 알림 목록을 실시간으로 구독합니다.
 * @param uid 사용자 UID
 * @param callback 업데이트 시 호출될 콜백 함수
 * @param limit 최대 조회 개수 (기본값: 50)
 * @returns 구독 해제 함수
 */
export function subscribeUserNotifications(
  uid: string,
  callback: (notifications: Notification[]) => void,
  limit: number = 50
): () => void {
  const unsubscribe = firestore()
    .collection(COLLECTION)
    .where('uid', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .onSnapshot(
      (snapshot) => {
        const notifications: Notification[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          notifications.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          } as Notification);
        });
        callback(notifications);
      },
      (error) => {
        console.error('❌ [Notifications] 알림 목록 실시간 구독 실패:', error);
        callback([]);
      }
    );
  
  return unsubscribe;
}

/**
 * 사용자의 읽지 않은 알림 개수를 실시간으로 구독합니다.
 * @param uid 사용자 UID
 * @param callback 업데이트 시 호출될 콜백 함수
 * @returns 구독 해제 함수
 */
export function subscribeUnreadCount(
  uid: string,
  callback: (count: number) => void
): () => void {
  const unsubscribe = firestore()
    .collection(COLLECTION)
    .where('uid', '==', uid)
    .where('read', '==', false)
    .onSnapshot(
      (snapshot) => {
        callback(snapshot.size);
      },
      (error) => {
        console.error('❌ [Notifications] 읽지 않은 알림 개수 구독 실패:', error);
        callback(0);
      }
    );
  
  return unsubscribe;
}

/**
 * 알림을 읽음 처리합니다.
 * @param notificationId 알림 ID
 * @param uid 사용자 UID (보안 확인용)
 */
export async function markNotificationAsRead(notificationId: string, uid: string): Promise<void> {
  try {
    const currentUser = auth().currentUser;
    if (!currentUser || currentUser.uid !== uid) {
      throw new Error('인증된 사용자만 알림을 읽음 처리할 수 있습니다.');
    }

    const notificationRef = firestore().collection(COLLECTION).doc(notificationId);
    const notificationDoc = await notificationRef.get();
    
    if (!notificationDoc.exists) {
      throw new Error('알림을 찾을 수 없습니다.');
    }

    const notificationData = notificationDoc.data();
    if (notificationData?.uid !== uid) {
      throw new Error('본인의 알림만 읽음 처리할 수 있습니다.');
    }

    await notificationRef.update({
      read: true,
    });

    console.log(`✅ [Notifications] 알림 읽음 처리 완료: ${notificationId}`);
  } catch (error: any) {
    console.error('❌ [Notifications] 알림 읽음 처리 실패:', error);
    throw error;
  }
}

/**
 * 모든 알림을 읽음 처리합니다.
 * @param uid 사용자 UID
 */
export async function markAllNotificationsAsRead(uid: string): Promise<void> {
  try {
    const currentUser = auth().currentUser;
    if (!currentUser || currentUser.uid !== uid) {
      throw new Error('인증된 사용자만 알림을 읽음 처리할 수 있습니다.');
    }

    const snapshot = await firestore()
      .collection(COLLECTION)
      .where('uid', '==', uid)
      .where('read', '==', false)
      .get();

    if (snapshot.empty) {
      return;
    }

    const batch = firestore().batch();
    snapshot.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });

    await batch.commit();
    console.log(`✅ [Notifications] 모든 알림 읽음 처리 완료: ${snapshot.size}개`);
  } catch (error: any) {
    console.error('❌ [Notifications] 모든 알림 읽음 처리 실패:', error);
    throw error;
  }
}




