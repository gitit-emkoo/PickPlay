import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import firestore from '@react-native-firebase/firestore';
import { generateRandomNickname } from '../utils/nickname';
import { Answer, Character, Question, UserData } from '../types';
import { db } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceUID } from './firebase';
import { currentDateKey } from '../utils/date';
import { getFunctions, httpsCallable } from 'firebase/functions';
// AsyncStorage는 더 이상 직접 사용하지 않으므로 제거 (필요 시 UI단에서만 사용)

// --- 데이터 로더 (앱 시작 시 호출) ---
let questions: Question[] = [];
let characters: Character[] = [];

export const loadData = () => {
  try {
    // require를 사용하여 JSON 파일을 동기적으로 로드합니다.
    questions = require('../../assets/data/questions_final.json');
    characters = require('../../assets/data/characters_19.json');
    console.log(`✅ [Data] ${questions.length}개의 질문과 ${characters.length}개의 캐릭터 데이터를 로드했습니다.`);
  } catch (error) {
    console.error("❌ [Data] 데이터 파일 로딩에 실패했습니다:", error);
  }
};


// --- 핵심 로직 (신규) ---

/**
 * [V2] Firestore를 기준으로 사용자를 확인하고, 없으면 AsyncStorage에서 마이그레이션을 시도하며,
 * 최종적으로 없으면 신규 사용자를 생성합니다.
 * @param uid 사용자 Firebase UID
 * @returns 사용자 데이터
 */
export const ensureUser = async (uid: string): Promise<UserData> => {
  const userRef = firestore().collection('users').doc(uid);
  const doc = await userRef.get();

  // 1. Firestore에 이미 데이터가 있는 경우 (정상)
  if (doc.exists()) { // .exists -> .exists()
    console.log('✅ [V2] Firestore에서 사용자 데이터 확인:', uid);
    const data = doc.data() as UserData;
    // Firestore Timestamp를 JS Date 객체로 변환
    if (data.createdAt && (data.createdAt as FirebaseFirestoreTypes.Timestamp).toDate) {
      return { ...data, createdAt: (data.createdAt as FirebaseFirestoreTypes.Timestamp).toDate() };
    }
    return data;
  }

  // 2. Firestore에 데이터가 없는 경우: AsyncStorage에서 마이그레이션 시도
  try {
    const deviceUID = await getDeviceUID();
    const legacyDataKey = `userData_${deviceUID}`;
    const legacyDataJSON = await AsyncStorage.getItem(legacyDataKey);

    if (legacyDataJSON) {
      console.log('🔄 [V1->V2] AsyncStorage에서 기존 데이터 발견. Firestore로 마이그레이션 시작:', uid);
      const legacyData = JSON.parse(legacyDataJSON);

      // V2 데이터 구조에 맞게 변환
      const migratedUserData = { // UserData 타입 명시 제거
        uid,
        points: legacyData.points || 0,
        streakCount: legacyData.streakCount || 0,
        lastAnswerDate: typeof legacyData.lastAnswerDate === 'string' && legacyData.lastAnswerDate.includes('-') ? 
                          parseInt(legacyData.lastAnswerDate.replace(/-/g, ''), 10) : 0,
        nickname: legacyData.nickname || generateRandomNickname(),
        totalSelections: legacyData.totalSelections || 0,
        createdAt: legacyData.createdAt ? new Date(legacyData.createdAt) : firestore.FieldValue.serverTimestamp(),
        characterId: null,
        adjective1: null,
        adjective2: null,
      };

      await userRef.set(migratedUserData as any); // as any로 타입 검사 우회
      console.log('✅ [V1->V2] 마이그레이션 완료:', uid);
      return { ...migratedUserData, createdAt: new Date(migratedUserData.createdAt as Date) } as UserData;
    }
  } catch (error) {
    console.error("❌ AsyncStorage에서 데이터 마이그레이션 실패:", error);
  }

  // 3. 마이그레이션할 데이터도 없는 경우: 신규 사용자 생성
  console.log('🆕 [V2] 신규 사용자, Firestore에 문서 생성:', uid);
  const newUserData = {
    uid,
    createdAt: firestore.FieldValue.serverTimestamp(),
    totalSelections: 0,
    characterId: null,
    adjective1: null,
    adjective2: null,
    points: 0,
    streakCount: 0,
    lastAnswerDate: 0,
    nickname: generateRandomNickname(),
  };

  await userRef.set(newUserData);
  
  return {
    ...newUserData,
    createdAt: new Date(), // JS Date 객체로 변환하여 반환
  } as UserData;
};

/**
 * [신규] 사용자의 앱 최초 실행일(createdAt)을 기준으로 오늘에 해당하는 순차 질문을 반환합니다.
 * @param userData 사용자 데이터 객체
 * @returns 오늘의 질문 객체 또는 null
 */
export const getTodayQuestionForUser = (userData: UserData): Question | null => {
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

  if (doc.exists()) { // .exists -> .exists()
    console.log(`[Check] 오늘 답변 기록을 찾았습니다: ${answerDocId}`);
    return doc.data() as Answer;
  } else {
    console.log(`[Check] 오늘 답변 기록이 없습니다.`);
    return null;
  }
};


// --- Helper Functions ---

/**
 * [V2] Firebase Cloud Function을 호출하여 AI 태그를 생성합니다.
 * @param question 질문 객체
 * @param selectedOptionText 사용자가 선택한 선택지 텍스트
 * @returns 생성된 태그 배열 (string[])
 */
const generateTagsWithAI = async (question: Question, selectedOptionText: string): Promise<string[]> => {
  console.log(`[AI] Cloud Function 'generateTags' 호출 시작...`);
  try {
    const functions = getFunctions();
    const generateTags = httpsCallable(functions, 'generateTags');
    
    const result = await generateTags({ 
      questionId: question.question_id, 
      selectedText: selectedOptionText,
    });
    
    // Cloud Function의 응답 형식은 { data: { tags: [...] } } 입니다.
    const tags = (result.data as any).tags; 
    if (!Array.isArray(tags)) {
      throw new Error("Cloud Function 응답 형식이 올바르지 않습니다.");
    }

    console.log(`[AI] 태그 생성 완료: [${tags.join(', ')}]`);
    return tags;
  } catch (error) {
    console.error("❌ Cloud Function 호출 실패:", error);
    // 실패 시 사용자 경험을 해치지 않도록 빈 배열을 반환합니다.
    return []; 
  }
};


/**
 * [V2] 사용자의 답변을 저장하고, 연속 참여일수 업데이트 및 캐릭터 로직을 처리합니다.
 * @throws "오늘 이미 답변했습니다." - 중복 답변 시 에러 발생
 */
export const saveAnswerAndProcessLogic = async (userData: UserData, question: Question, selectedOptionIndex: 0 | 1): Promise<UserData> => {
  const todayKey = currentDateKey();
  if (userData.lastAnswerDate === todayKey) {
    console.warn(`[Vote] User ${userData.uid} has already voted today. Aborting.`);
    throw new Error("오늘 이미 답변했습니다.");
  }

  const { uid } = userData;
  const userRef = firestore().collection('users').doc(uid);
  const selectedOptionText = selectedOptionIndex === 0 ? question.option_1_text : question.option_2_text;

  // --- 1. AI 태그 생성 & 답변 저장 (고유 ID 사용) ---
  const generatedTags = await generateTagsWithAI(question, selectedOptionText);
  
  // 문서 ID를 '{uid}_{questionId}' 형식으로 지정하여 중복 방지
  const answerRef = firestore().collection('answers').doc(`${uid}_${question.question_id}`);
  
  const answerData: Omit<Answer, 'answeredAt'> = {
    uid,
    question_id: question.question_id,
    selected_option_index: selectedOptionIndex,
    selected_option_text: selectedOptionText,
    tags: generatedTags,
  };
  await answerRef.set({
    ...answerData,
    answeredAt: firestore.FieldValue.serverTimestamp(),
  });
  console.log(`[Logic] 답변 저장 완료: Doc ID = ${uid}_${question.question_id}`);

  // --- 2. 연속 참여일수, 누적 답변 수 업데이트 (Transaction) ---
  let updatedTotalSelections: number;
  let updatedUserData: UserData;

  try {
    await firestore().runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw "User does not exist!";
      }
      const currentUserData = userDoc.data() as UserData;

      // 연속 참여일수 계산
      const kstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
      const yesterdayKST = new Date(kstNow.getTime());
      yesterdayKST.setUTCDate(kstNow.getUTCDate() - 1);
      const year = yesterdayKST.getUTCFullYear();
      const month = String(yesterdayKST.getUTCMonth() + 1).padStart(2, '0');
      const day = String(yesterdayKST.getUTCDate()).padStart(2, '0');
      const yesterdayKey = parseInt(`${year}${month}${day}`, 10);

      let newStreakCount = 1;
      if (currentUserData.lastAnswerDate === yesterdayKey) {
        newStreakCount = (currentUserData.streakCount || 0) + 1;
      }
      
      // 트랜잭션 업데이트
      transaction.update(userRef, {
        totalSelections: firestore.FieldValue.increment(1),
        streakCount: newStreakCount,
        lastAnswerDate: todayKey,
      });

      updatedTotalSelections = (currentUserData.totalSelections || 0) + 1;
      updatedUserData = { 
        ...currentUserData, 
        totalSelections: updatedTotalSelections,
        streakCount: newStreakCount,
        lastAnswerDate: todayKey
      };
    });
    console.log(`[Streak] 연속 참여일수 업데이트 완료. New streak: ${updatedUserData!.streakCount}`);
  } catch (error) {
    console.error("❌ 사용자 정보 업데이트 트랜잭션 실패:", error);
    throw error;
  }

  // --- 3. 포인트 보상 지급 ---
  await rewardWithMajority(uid, question.question_id, selectedOptionIndex, updatedUserData!.streakCount);
  const finalUserData = { // 포인트가 업데이트된 최신 데이터를 반영
    ...updatedUserData!,
    points: (updatedUserData!.points || 0) + (await rewardWithMajority(uid, question.question_id, selectedOptionIndex, updatedUserData!.streakCount)).base + (await rewardWithMajority(uid, question.question_id, selectedOptionIndex, updatedUserData!.streakCount)).bonus
  };

  // --- 4. 누적 답변 수에 따라 로직 분기 ---
  if (updatedTotalSelections! === 30) {
    console.log(`[Logic A] 누적 답변 30회 도달! 캐릭터 배정 로직을 실행합니다.`);
    updatedUserData = await assignCharacter_LogicA(finalUserData);
  } else if (updatedTotalSelections! >= 60 && updatedTotalSelections! % 30 === 0) {
    console.log(`[Logic B] 누적 답변 ${updatedTotalSelections!}회 도달! 형용사 갱신 로직을 실행합니다.`);
    updatedUserData = await updateAdjectives_LogicB(finalUserData);
  }

  return updatedUserData!;
};

// --- 로직 A/B 구현 ---

/** [Helper] 사용자가 레-거시 사용자인지 판별 */
const isLegacyUser = (userData: UserData): boolean => {
  // TODO: 정확한 레거시 사용자 판별 기준 필요 (예: 특정 날짜 이전 가입자)
  // 현재는 임시로 createdAt이 하루 이상 지난 사용자들을 레거시로 간주
  const oneDay = 1000 * 60 * 60 * 24;
  const createdAt = (userData.createdAt as FirebaseFirestoreTypes.Timestamp).toDate ? 
                    (userData.createdAt as FirebaseFirestoreTypes.Timestamp).toDate() : 
                    userData.createdAt as Date;
  return (new Date().getTime() - createdAt.getTime()) > oneDay;
};

/** [Logic B] 특정 구간의 답변을 분석하여 최빈값 형용사1, 2를 추출 */
const analyzeAnswersForAdjectives = async (
  uid: string, 
  start: number, 
  end: number
): Promise<{ adj1: string | null, adj2: string | null }> => {
  const answersSnapshot = await firestore()
    .collection('answers')
    .where('uid', '==', uid)
    .orderBy('answeredAt', 'desc')
    .limit(end)
    .get();

  const answersInRange = answersSnapshot.docs.slice(start - 1, end).map(doc => doc.data() as Answer);

  const tagFrequency: { [domain: string]: { [tag: string]: number } } = {
    '감정': {}, '가치관': {}, '습관': {}, '관계': {}
  };

  // 태그 빈도수 계산 (실제 question.domain 정보와 연동)
  answersInRange.forEach(answer => {
    const question = questions.find(q => q.question_id === answer.question_id);
    if (question && answer.tags) {
      answer.tags.forEach(tag => {
        const domain = question.domain;
        tagFrequency[domain][tag] = (tagFrequency[domain][tag] || 0) + 1;
      });
    }
  });

  // 최빈값 형용사 추출 로직 (감정/가치관 -> adj1, 습관/관계 -> adj2)
  const findMostFrequent = (domain1: string, domain2: string) => {
    const combined = { ...tagFrequency[domain1], ...tagFrequency[domain2] };
    if (Object.keys(combined).length === 0) return null;
    return Object.keys(combined).reduce((a, b) => combined[a] > combined[b] ? a : b);
  };

  const adj1 = findMostFrequent('감정', '가치관');
  const adj2 = findMostFrequent('습관', '관계');

  console.log(`[Analyze] 답변 ${start}-${end} 구간 분석 완료: adj1=${adj1}, adj2=${adj2}`);
  return { adj1, adj2 };
};

/** 감사/디버깅을 위한 로그를 Firestore 'logs' 컬렉션에 추가합니다. */
const addLog = async (uid: string, action: string, details: object) => {
  try {
    await firestore().collection('logs').add({
      uid,
      action,
      details,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error(" Firestore 로깅 실패:", error);
  }
};

/** [Logic B] 분석된 형용사로 사용자 데이터를 업데이트 */
const updateAdjectives_LogicB = async (userData: UserData): Promise<UserData> => {
  const { uid, totalSelections } = userData;
  const userRef = firestore().collection('users').doc(uid);

  const start = totalSelections - 29;
  const end = totalSelections;

  const { adj1, adj2 } = await analyzeAnswersForAdjectives(uid, start, end);

  if (adj1 && adj2) {
    const before = { adj1: userData.adjective1, adj2: userData.adjective2 };
    const after = { adj1, adj2 };
    await userRef.update({ adjective1: adj1, adjective2: adj2 });
    await addLog(uid, 'UPDATE_ADJECTIVES_LOGIC_B', { before, after, totalSelections });
    console.log(`[Logic B] 사용자 형용사 업데이트 완료: ${adj1} ${adj2}`);
    return { ...userData, adjective1: adj1, adjective2: adj2 };
  }
  return userData;
};

/** [Logic A] 최초 30회 답변을 기준으로 캐릭터를 배정 */
const assignCharacter_LogicA = async (userData: UserData): Promise<UserData> => {
  const { uid } = userData;
  const userRef = firestore().collection('users').doc(uid);

  if (isLegacyUser(userData)) {
    // --- 레거시 사용자: 랜덤 캐릭터 배정 ---
    const randomIndex = Math.floor(Math.random() * characters.length);
    const randomCharacter = characters[randomIndex];
    
    await userRef.update({
      characterId: randomCharacter.character_id,
      adjective1: '랜덤', // 레거시 사용자는 형용사 분석 없음
      adjective2: randomCharacter.adjective_2,
    });
    await addLog(uid, 'ASSIGN_CHARACTER_LOGIC_A_LEGACY', { characterId: randomCharacter.character_id });
    console.log(`[Logic A] 레거시 사용자에게 랜덤 캐릭터 '${randomCharacter.name}' 배정 완료.`);
    return { ...userData, characterId: randomCharacter.character_id, adjective1: '랜덤', adjective2: randomCharacter.adjective_2 };

  } else {
    // --- 신규 사용자: 답변 분석 기반 캐릭터 배정 ---
    const { adj1, adj2 } = await analyzeAnswersForAdjectives(uid, 1, 30);
    
    if (adj2) {
      const matchedCharacter = characters.find(c => c.adjective_2 === adj2);
      if (matchedCharacter) {
        await userRef.update({
          characterId: matchedCharacter.character_id,
          adjective1: adj1,
          adjective2: matchedCharacter.adjective_2, // 매핑 테이블의 고정값 사용
        });
        await addLog(uid, 'ASSIGN_CHARACTER_LOGIC_A', { characterId: matchedCharacter.character_id, adj1, adj2 });
        console.log(`[Logic A] 신규 사용자에게 분석 기반 캐릭터 '${matchedCharacter.name}' 배정 완료.`);
        return { ...userData, characterId: matchedCharacter.character_id, adjective1: adj1, adjective2: matchedCharacter.adjective_2 };
      }
    }
    // 매칭 실패 시 폴백 (랜덤 배정)
    console.warn(`[Logic A] 분석된 형용사 '${adj2}'와 일치하는 캐릭터를 찾지 못해 랜덤 배정합니다.`);
    const randomIndex = Math.floor(Math.random() * characters.length);
    const randomCharacter = characters[randomIndex];
    await userRef.update({ characterId: randomCharacter.character_id });
    await addLog(uid, 'ASSIGN_CHARACTER_LOGIC_A_FALLBACK', { characterId: randomCharacter.character_id });
    return { ...userData, characterId: randomCharacter.character_id };
  }
};

// --- V1에서 가져와 V2에 맞게 수정/사용될 함수 ---

/**
 * Firestore 집계를 수행합니다. (기존 aggregate 함수 단순화)
 * @param questionId 질문 ID
 */
export const aggregate = async (questionId: string) => {
  const votesSnapshot = await firestore().collection('votes').where('question_id', '==', questionId).get();
  let c0 = 0, c1 = 0;
  votesSnapshot.forEach(doc => {
    const vote = doc.data();
    if (vote.selected_option_index === 0) c0++;
    else if (vote.selected_option_index === 1) c1++;
  });
  const total = c0 + c1;
  const p0 = total ? Math.round((c0 / total) * 100) : 50;
  const p1 = 100 - p0;
  return { total, c0, c1, p0, p1 };
};

/**
 * [V2] 승패 보상 및 연속 참여 보너스 포인트를 계산하고 지급합니다.
 * @param uid 사용자 ID
 * @param questionId 질문 ID
 * @param myOptionIndex 사용자의 선택
 * @param streakCount 현재 연속 참여일수
 */
export async function rewardWithMajority(
  uid: string, 
  questionId: string, 
  myOptionIndex: number,
  streakCount: number
) {
  const agg = await aggregate(questionId);
  const myIsMajority = (() => {
    if (agg.c0 === agg.c1) return true;
    const majorityIndex = agg.c0 >= agg.c1 ? 0 : 1;
    return myOptionIndex === majorityIndex;
  })();
  
  const base = myIsMajority ? 5 : 10;
  const bonus = streakCount > 1 ? streakCount : 0; // 연속 참여 2일차부터 보너스
  const totalPoints = base + bonus;
  
  const userRef = firestore().collection('users').doc(uid);
  await userRef.update({
    points: firestore.FieldValue.increment(totalPoints)
  });
  console.log(`[Points] 포인트 지급 완료: 기본 ${base}P + 보너스 ${bonus}P = 총 ${totalPoints}P`);

  return { base, bonus, myIsMajority, agg };
}

/**
 * 실시간 집계 구독
 * @param questionId 질문 ID
 * @param onChange 콜백 함수
 */
export function watchAggregation(
  questionId: string,
  onChange: (result: { total: number; c0: number; c1: number; p0: number; p1: number }) => void
) {
  const qRef = firestore().collection('votes').where('question_id', '==', questionId);
  
  const unsubscribe = qRef.onSnapshot((snapshot) => {
    let c0 = 0, c1 = 0;
    snapshot.forEach(doc => {
      const vote = doc.data();
      if (vote.selected_option_index === 0) c0++;
      else if (vote.selected_option_index === 1) c1++;
    });
    const total = c0 + c1;
    const p0 = total ? Math.round((c0 / total) * 100) : 50;
    const p1 = 100 - p0;
    onChange({ total, c0, c1, p0, p1 });
  });

  return unsubscribe;
}
