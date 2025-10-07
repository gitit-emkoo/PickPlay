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
  answeredAt: FirebaseFirestoreTypes.FieldValue;
  rewarded?: boolean; // 오늘 보상 수령 여부(광고 시청 후 true)
}

// 확장된 사용자 데이터 타입
export interface UserData {
  uid: string;
  createdAt: FirebaseFirestoreTypes.Timestamp | Date; // 앱 최초 실행일 (Day 1 기준)
  totalSelections: number; // 누적 답변 수
  
  characterId: string | null; // 배정된 동물 ID (예: "fox")
  adjective1: string | null; // 현재 [형용사1]
  adjective2: string | null; // 현재 [형용사2]

  // --- 기존 필드 ---
  points: number;
  streakCount: number;
  lastAnswerDate: number; // YYYYMMDD 형식의 숫자
  nickname: string;
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
