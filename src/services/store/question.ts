import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { Answer, Question, UserData } from '../../types';
import firestore from '@react-native-firebase/firestore';
import { getQuestions } from './dataLoader';
import { TEST_UIDS } from '../../constants/testUids';

/**
 * [신규] 사용자의 앱 최초 실행일(createdAt)을 기준으로 오늘에 해당하는 순차 질문을 반환합니다.
 * @param userData 사용자 데이터 객체
 * @returns 오늘의 질문 객체 또는 null
 */
export const getTodayQuestionForUser = (userData: UserData): Question | null => {
  const questions = getQuestions();
  // 테스트 유저는 totalSelections 기반으로 연속 질문 배정
  if (TEST_UIDS.includes(userData.uid)) {
    const totalSelections = userData.totalSelections || 0;
    // 테스트 유저도 신규 유저라면 1번 질문부터 시작
    const questionIndex = totalSelections % questions.length;
    
    if (questions && questions[questionIndex]) {
      console.log(`🧪 [Test] 테스트 유저 - 총 ${totalSelections}번 답변 완료, 다음 질문 #${questionIndex + 1}을(를) 반환합니다.`);
      return questions[questionIndex];
    } else {
      console.warn(`[Test] 테스트 유저 - Question #${questionIndex + 1}을 찾을 수 없습니다.`);
      return null;
    }
  }

  if (!userData.createdAt) {
    console.error("❌ [Question] 사용자의 createdAt 정보가 없어 질문을 가져올 수 없습니다.");
    return null;
  }

  // createdAt이 Timestamp 객체인지 Date 객체인지 확인하여 안전하게 Date 객체로 변환
  const startDate = userData.createdAt && typeof (userData.createdAt as any).toDate === 'function' 
    ? (userData.createdAt as FirebaseFirestoreTypes.Timestamp).toDate() 
    : userData.createdAt as Date;

  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    console.error("❌ [Question] 유효하지 않은 createdAt 값입니다:", userData.createdAt);
    return null;
  }
  
  // KST 기준으로 날짜 차이 계산
  const now = new Date();
  const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const kstStart = new Date(startDate.getTime() + (9 * 60 * 60 * 1000));

  // 시간, 분, 초를 0으로 설정하여 날짜만 비교
  kstNow.setUTCHours(0, 0, 0, 0);
  kstStart.setUTCHours(0, 0, 0, 0);

  const diffTime = Math.abs(kstNow.getTime() - kstStart.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // 320일이 지나면 질문이 순환하도록 나머지 연산자(%) 사용
  const questionIndex = diffDays % questions.length;

  if (questions && questions[questionIndex]) {
    console.log(`✅ [Question] Day ${diffDays + 1}, Question #${questionIndex + 1}을(를) 반환합니다.`);
    return questions[questionIndex];
  } else {
    console.warn(`[Question] Day ${diffDays + 1}에 해당하는 질문(인덱스: ${questionIndex})을 찾을 수 없습니다.`);
    return null;
  }
};

/**
 * [V2] 사용자가 오늘 질문에 답변했는지 확인하고, 했다면 어떤 선택을 했는지 반환합니다.
 * @param uid 사용자 ID
 * @param questionId 질문 ID
 * @returns Answer 객체 또는 null
 */
export const getTodayAnswer = async (uid: string, questionId: string): Promise<Answer | null> => {
  const answerDocId = `${uid}_${questionId}`;
  const answerRef = firestore().collection('answers').doc(answerDocId);
  const doc = await answerRef.get();
  const answerExists = typeof (doc as any).exists === 'function' ? (doc as any).exists() : ((doc as any).exists as boolean);

  if (answerExists) {
    console.log(`[Check] 오늘 답변 기록을 찾았습니다: ${answerDocId}`);
    const data = doc.data();
    // Firestore Timestamp를 JS Date 객체로 변환
    if (data && data.answeredAt && (data.answeredAt as FirebaseFirestoreTypes.Timestamp).toDate) {
      return {
        ...data,
        answeredAt: (data.answeredAt as FirebaseFirestoreTypes.Timestamp).toDate()
      } as Answer;
    }
    return data as Answer;
  } else {
    console.log(`[Check] 오늘 답변 기록이 없습니다.`);
    return null;
  }
};

