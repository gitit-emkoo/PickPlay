import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

// 라이브픽 질문 데이터 타입
export interface LivePickQuestion {
  id: string;
  createdBy: string;
  title: string;
  option1: string;
  option2: string;
  category: '일상' | '연애' | '가치관' | '엔터테인먼트' | '상상';
  tags: string[]; // 추천 알고리즘용 태그 (카테고리 저장)
  participantCount: number;
  option1Count: number;
  option2Count: number;
  pointDeducted: number;
  rewardGiven: boolean;
  createdAt: FirebaseFirestoreTypes.Timestamp | Date;
  // 한국시간(KST) 기준 해당 질문이 속한 주의 월요일 날짜 (예: '2026-03-09')
  // 기존 레거시 질문은 weekKey가 없을 수 있음
  weekKey?: string;
  status: 'active' | 'closed';
}

// 라이브픽 참여 데이터 타입
export interface LivePickParticipation {
  id: string; // `${uid}_${questionId}`
  uid: string;
  questionId: string;
  selectedOption: 1 | 2;
  basicRewardReceived: boolean;
  ladderGamePlayed: boolean;
  ladderReward: number | null;
  participatedAt: FirebaseFirestoreTypes.Timestamp | Date;
}

// 라이브픽 질문자 보상 타입
export interface LivePickReward {
  id: string;
  questionId: string;
  questionOwner: string;
  participantCount: number;
  rewardAmount: number;
  rewardType: '20p' | '100p';
  rewardedAt: FirebaseFirestoreTypes.Timestamp | Date;
}

// 라이브픽 신고 타입
export interface LivePickReport {
  id: string; // `${uid}_${questionId}` 형식으로 중복 신고 방지
  uid: string; // 신고자 UID
  questionId: string; // 신고된 질문 ID
  reason: 'spam' | 'inappropriate' | 'violence' | 'harassment' | 'other'; // 신고 사유
  description?: string; // 추가 설명 (선택사항)
  status: 'pending' | 'reviewed' | 'dismissed'; // 신고 처리 상태
  reportedAt: FirebaseFirestoreTypes.Timestamp | Date; // 신고 일시
  reviewedAt?: FirebaseFirestoreTypes.Timestamp | Date; // 처리 일시
  reviewedBy?: string; // 처리한 관리자 UID
}

