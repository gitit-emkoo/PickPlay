import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export interface Notification {
  id: string;
  uid: string; // 수신자 UID
  title: string;
  body: string;
  type: 'daily_question' | 'streak_congrats' | 'streak_milestone' | 'livepick' | 'system' | 'other';
  read: boolean; // 읽음 여부
  createdAt: FirebaseFirestoreTypes.Timestamp | Date;
  data?: Record<string, any>; // 추가 데이터 (예: questionId, link 등)
}




