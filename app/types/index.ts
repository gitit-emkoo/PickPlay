// Firebase Auth 타입
export interface FirebaseUser {
  uid: string;
  email?: string | null;
  isAnonymous: boolean;
}

// 질문 타입
export interface Question {
  id: string;
  title: string;
  options: [string, string];
  dayIndex: number;
  slot: 'A' | 'B';
  active: boolean;
}

// 집계 결과 타입
export interface Aggregation {
  total: number;
  c0: number;
  c1: number;
  p0: number;
  p1: number;
}

// 사용자 데이터 타입
export interface UserData {
  points: number;
  streakCount: number;
  lastAnswerDate: string;
}

// 보상 결과 타입
export interface RewardResult {
  base: number;
  myIsMajority: boolean;
  next: number;
  agg: Aggregation;
}

// 보상 대기 타입
export interface PendingReward {
  questionId: string;
  myOptionIndex: number;
}

// 광고 콜백 타입
export interface AdCallbacks {
  onLoaded: () => void;
  onEarned: () => void;
  onClosed: () => void;
}
