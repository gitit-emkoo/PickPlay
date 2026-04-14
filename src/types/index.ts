import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

// --- 신규/수정된 타입 정의 ---

// 새로운 질문 데이터 구조 (questions.json)
export interface Question {
  question_id: string; // "Q001" 형식
  text: string;
  domain: '감정' | '가치관' | '습관' | '관계';
  option_1_text: string;
  option_2_text: string;
}

// 캐릭터 데이터 구조 (characters_19.json)
export interface Character {
  character_id: string;
  name: string;
  adjective_2: string;
  description: string;
  image_url: string;
}

// 답변 데이터 구조 (answers 컬렉션)
export interface Answer {
  uid: string;
  question_id: string;
  selected_option_index: 0 | 1;
  selected_option_text: string;
  tags: string[] | null;
  answeredAt: FirebaseFirestoreTypes.FieldValue | FirebaseFirestoreTypes.Timestamp | Date;
  rewarded?: boolean; // 오늘 보상 수령 여부(영상 시청 후 true)
}

// 확장된 사용자 데이터 타입
export interface UserData {
  uid: string;
  createdAt: FirebaseFirestoreTypes.Timestamp | Date; // 앱 최초 실행일 (Day 1 기준)
  totalSelections: number; // 누적 답변 수
  
  characterId: string | null; // 배정된 동물 ID (예: "fox")
  adjective1: string | null; // 현재 [형용사1]
  adjective2: string | null; // 현재 [형용사2]
  /** 직전 형용사 갱신(Logic B) 이전의 조합 — 성향 변화 UI용 */
  previousAdjective1?: string | null;
  previousAdjective2?: string | null;

  // --- 기존 필드 ---
  points: number;
  streakCount: number;
  lastAnswerDate: number; // YYYYMMDD 형식의 숫자
  nickname: string;

  // --- 기기 식별 필드 (앱 재설치 시 복구용) ---
  deviceUID?: string | null; // 기기 고유 ID (선택적, 이전 버전 사용자는 없을 수 있음)

  // --- 전화번호 인증 필드 (보상 교환용) ---
  phoneNumber?: string | null; // E.164 포맷 전화번호 (예: +821012345678)
  phoneVerified?: boolean; // 전화번호 인증 완료 여부
  phoneVerifiedAt?: FirebaseFirestoreTypes.Timestamp | Date; // 인증 완료 시각

  // --- 튜토리얼 필드 ---
  tutorialChoice?: 'pending' | 'opt_in' | 'opt_out';
  tutorial?: {
    mainAnswered: boolean; // 메인 질문에 답변했는지
    livepickParticipated: boolean; // 라이브픽 질문에 참여했는지
    livepickCreated: boolean; // 라이브픽 질문을 생성했는지
    rewardGiven500: boolean; // 500P 보상을 받았는지
  };
}

// 공지사항 타입
export interface Notice {
  title: string;
  content: string;
  imageUrl?: string;
  deepLink?: string;
  showDontShowToday: boolean;
  isActive: boolean; // 게시/비게시
  startDate?: FirebaseFirestoreTypes.Timestamp | Date; // 게시 시작일 (선택적)
  endDate?: FirebaseFirestoreTypes.Timestamp | Date; // 게시 종료일 (선택적)
  createdAt?: FirebaseFirestoreTypes.Timestamp | Date;
  updatedAt?: FirebaseFirestoreTypes.Timestamp | Date;
}

// 포인트 적립/소멸 내역
export type PointHistoryReason =
  | 'basic_reward'
  | 'ladder_reward'
  | 'creator_reward'
  | 'top_reward'
  | 'weekly_top_reward' // 주간 TOP 질문 보상 (관리자 지급)
  | 'majority_reward'
  | 'ad_bonus'
  | 'livepick_question_creation'
  | 'tutorial_reward'
  | 'reward_exchange' // 보상 교환 시 포인트 차감
  | 'manual'
  | 'etc';

export interface PointHistory {
  id: string;
  uid: string;
  amount: number; // 적립은 양수, 소멸/차감은 음수
  reason: PointHistoryReason;
  description?: string;
  createdAt: FirebaseFirestoreTypes.Timestamp | Date;
}

// 교환 가능한 보상 상품
export interface RewardItem {
  id: string;
  title: string;
  description: string;
  requiredPoints: number;
  isActive: boolean;
  sortOrder: number;
  imageUrl?: string;
  type?: 'giftcard' | 'coupon' | 'etc';
}

// 교환 신청 내역
export type ExchangeRequestStatus = 'requested' | 'pending' | 'completed' | 'cancelled';

export interface ExchangeRequest {
  id: string;
  uid: string;
  rewardItemId: string;
  rewardTitle: string; // 당시 상품명 스냅샷
  usedPoints: number;
  status: ExchangeRequestStatus;
  createdAt: FirebaseFirestoreTypes.Timestamp | Date;
  updatedAt?: FirebaseFirestoreTypes.Timestamp | Date;
  completedAt?: FirebaseFirestoreTypes.Timestamp | Date;
  cancelledAt?: FirebaseFirestoreTypes.Timestamp | Date;
  adminMemo?: string;
}


// --- 기존 타입 정의 (유지) ---

// Firebase Auth 타입
export interface FirebaseUser {
  uid: string;
  email?: string | null;
  isAnonymous: boolean;
}

// 집계 결과 타입
export interface Aggregation {
  total: number;
  c0: number;
  c1: number;
  p0: number;
  p1: number;
}

// 광고 콜백 타입
export interface AdCallbacks {
  onLoaded: () => void;
  onEarned: () => void;
  onClosed: () => void;
}
