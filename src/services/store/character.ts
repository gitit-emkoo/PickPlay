import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import firestore from '@react-native-firebase/firestore';
import { Answer, UserData } from '../../types';
import { getQuestions, getCharacters } from './dataLoader';

/** [Helper] 사용자가 레거시 사용자인지 판별 */
export const isLegacyUser = (userData: UserData): boolean => {
  // TODO: 정확한 레거시 사용자 판별 기준 필요 (예: 특정 날짜 이전 가입자)
  // 현재는 임시로 createdAt이 하루 이상 지난 사용자들을 레거시로 간주
  const oneDay = 1000 * 60 * 60 * 24;
  const createdAt = (userData.createdAt as FirebaseFirestoreTypes.Timestamp).toDate ? 
                    (userData.createdAt as FirebaseFirestoreTypes.Timestamp).toDate() : 
                    userData.createdAt as Date;
  return (new Date().getTime() - createdAt.getTime()) > oneDay;
};

/** [Logic B] 특정 구간의 답변을 분석하여 최빈값 형용사1, 2를 추출 - 개선된 버전 */
export const analyzeAnswersForAdjectives = async (
  uid: string, 
  start: number, 
  end: number
): Promise<{ adj1: string | null, adj2: string | null }> => {
  console.log(`[Analyze] 분석 시작: uid=${uid}, start=${start}, end=${end}`);
  
  const questions = getQuestions();
  const answersSnapshot = await firestore()
    .collection('answers')
    .where('uid', '==', uid)
    .orderBy('answeredAt', 'desc')
    .limit(end)
    .get();

  console.log(`[Analyze] 총 답변 수: ${answersSnapshot.docs.length}`);
  
  // Firestore는 최신순 정렬이므로, 구간을 올바르게 계산
  // start=31, end=60이면: 전체 60개 중에서 31-60번째 (과거 30개)를 가져와야 함
  const totalAnswers = answersSnapshot.docs.length;
  const rangeStart = Math.max(0, totalAnswers - end); // 60개 중 31-60번째 = 0-29 인덱스
  const rangeEnd = totalAnswers - start + 1; // 60개 중 31-60번째 = 0-30 인덱스
  const answersInRange = answersSnapshot.docs.slice(rangeStart, rangeEnd).map(doc => doc.data() as Answer);
  
  console.log(`[Analyze] 분석 대상 답변 수: ${answersInRange.length}`);

  const tagFrequency: { [domain: string]: { [tag: string]: number } } = {
    '감정': {}, '가치관': {}, '습관': {}, '관계': {}
  };

  let validAnswersCount = 0; // 유효한 태그가 있는 답변 수

  // 유효한 형용사 풀 정의 (Logic B 독립성 확보)
  // adjective1용: 감정/가치관 형용사 (adjectives_total.json에서 동적으로 추출)
  const adjectivesData = require('../../../assets/data/adjectives_total.json');
  const validEmotionAdjectives = adjectivesData
    .filter((adj: any) => adj.domain === '감정' || adj.domain === '가치관')
    .map((adj: any) => adj.adjective);
  
  // adjective2용: 습관/관계 형용사 (adjectives_total2.json에서 동적으로 추출)
  // Logic B에서는 characters_19.json 절대 참조 금지
  const adjectivesData2 = require('../../../assets/data/adjectives_total2.json');
  const validHabitAdjectives = adjectivesData2
    .filter((adj: any) => adj.domain === '습관' || adj.domain === '관계')
    .map((adj: any) => adj.adjective);

  // 태그 빈도수 계산 (모든 태그 분석 - 도메인 필터링 제거)
  answersInRange.forEach(answer => {
    const question = questions.find(q => q.question_id === answer.question_id);
    if (question && answer.tags && answer.tags.length > 0) {
      const domain = question.domain;
      
      // 모든 태그를 분석 (도메인별 필터링 제거)
      const allTags = answer.tags;
      
      if (allTags.length > 0) {
        validAnswersCount++;
        allTags.forEach(tag => {
          console.log(`[Analyze] 태그 분석: "${tag}" - 감정형용사: ${validEmotionAdjectives.includes(tag)}, 습관형용사: ${validHabitAdjectives.includes(tag)}`);
          // 태그가 감정/가치관 형용사인지 확인
          if (validEmotionAdjectives.includes(tag)) {
            tagFrequency['감정'][tag] = (tagFrequency['감정'][tag] || 0) + 1;
            console.log(`[Analyze] 감정 태그 추가: "${tag}"`);
          }
          // 태그가 습관/관계 형용사인지 확인 (Logic B 독립성)
          if (validHabitAdjectives.includes(tag)) {
            tagFrequency['관계'][tag] = (tagFrequency['관계'][tag] || 0) + 1;
            console.log(`[Analyze] 관계 태그 추가: "${tag}"`);
          }
        });
      }
    }
  });

  console.log(`[Analyze] 구간 ${start}-${end}: 총 ${answersInRange.length}개 답변 중 ${validAnswersCount}개에 유효한 태그 있음`);
  console.log(`[Analyze] 태그 빈도수:`, tagFrequency);

  // 최빈값 형용사 추출 로직 (감정/가치관 -> adj1, 습관/관계 -> adj2)
  const findMostFrequent = (domain1: string, domain2: string) => {
    const combined = { ...tagFrequency[domain1], ...tagFrequency[domain2] };
    console.log(`[Analyze] ${domain1}+${domain2} 조합 결과:`, combined);
    if (Object.keys(combined).length === 0) return null;
    const result = Object.keys(combined).reduce((a, b) => combined[a] > combined[b] ? a : b);
    console.log(`[Analyze] ${domain1}+${domain2} 최빈값:`, result);
    return result;
  };

  let adj1 = findMostFrequent('감정', '가치관');
  let adj2 = findMostFrequent('습관', '관계');

  console.log(`[Analyze] 분석 결과: adj1="${adj1}", adj2="${adj2}"`);

  // 유효한 태그가 부족한 경우 기본값 제공 (사용자 경험 보호)
  // adjective1용 기본값 (감정/가치관 형용사 - 전체 풀에서 추출)
  const defaultEmotionAdjectives = validEmotionAdjectives;
  // adjective2용 기본값 (습관/관계 형용사 - Logic B 독립성)
  const defaultHabitAdjectives = validHabitAdjectives;

  // 분석 결과가 없거나 부족한 경우 기본값 사용
  if (!adj1) {
    adj1 = defaultEmotionAdjectives[Math.floor(Math.random() * defaultEmotionAdjectives.length)];
    console.log(`[Analyze] adjective1 기본값 사용: "${adj1}"`);
  }
  if (!adj2) {
    adj2 = defaultHabitAdjectives[Math.floor(Math.random() * defaultHabitAdjectives.length)];
    console.log(`[Analyze] adjective2 기본값 사용: "${adj2}"`);
  }

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
    console.error("❌ Firestore 로깅 실패:", error);
  }
};

/** [Logic B] 분석된 형용사로 사용자 데이터를 업데이트 */
export const updateAdjectives_LogicB = async (userData: UserData): Promise<UserData> => {
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
export const assignCharacter_LogicA = async (userData: UserData): Promise<UserData> => {
  const { uid } = userData;
  const userRef = firestore().collection('users').doc(uid);
  const characters = getCharacters();

  console.log(`[Logic A] 🎯 캐릭터 배정 시작:`, {
    uid: uid,
    totalSelections: userData.totalSelections,
    isLegacy: isLegacyUser(userData),
    currentCharacterId: userData.characterId,
    currentAdjective1: userData.adjective1,
    currentAdjective2: userData.adjective2
  });

  if (isLegacyUser(userData)) {
    // --- 레거시 사용자: AI 분석 기반 캐릭터 배정 ---
    console.log(`[Logic A] 📜 레거시 사용자 감지 - AI 분석 기반 캐릭터 배정`);
    const { adj1, adj2 } = await analyzeAnswersForAdjectives(uid, 1, 30);
    
    console.log(`[Logic A] 📊 레거시 사용자 분석 결과:`, {
      adj1: adj1,
      adj2: adj2
    });
    
    // adj2가 있으면 해당 캐릭터 찾기, 없으면 랜덤 배정
    if (adj2) {
      console.log(`[Logic A] 🔍 레거시 사용자 캐릭터 매칭 시도: adj2 = "${adj2}"`);
      const matchedCharacter = characters.find(c => c.adjective_2 === adj2);
      if (matchedCharacter) {
        console.log(`[Logic A] ✅ 레거시 사용자 캐릭터 매칭 성공:`, {
          characterId: matchedCharacter.character_id,
          name: matchedCharacter.name,
          adjective2: matchedCharacter.adjective_2
        });
        
        // 레거시 사용자용 랜덤 형용사1 생성 (adjectives_total.json에서 동적 추출)
        const adjectivesData = require('../../../assets/data/adjectives_total.json');
        const randomEmotionAdjectives = adjectivesData
          .filter((adj: any) => adj.domain === '감정' || adj.domain === '가치관')
          .map((adj: any) => adj.adjective);
        const randomAdj1 = adj1 || randomEmotionAdjectives[Math.floor(Math.random() * randomEmotionAdjectives.length)];
        
        await userRef.update({
          characterId: matchedCharacter.character_id,
          adjective1: randomAdj1,
          adjective2: matchedCharacter.adjective_2,
        });
        await addLog(uid, 'ASSIGN_CHARACTER_LOGIC_A_LEGACY', { characterId: matchedCharacter.character_id, adj1: randomAdj1, adj2 });
        console.log(`[Logic A] 레거시 사용자에게 분석 기반 캐릭터 '${matchedCharacter.name}' 배정 완료.`);
        return { ...userData, characterId: matchedCharacter.character_id, adjective1: randomAdj1, adjective2: matchedCharacter.adjective_2 };
      } else {
        console.warn(`[Logic A] ❌ 레거시 사용자: 분석된 형용사 '${adj2}'와 일치하는 캐릭터를 찾지 못했습니다. 랜덤 배정으로 전환.`);
      }
    } else {
      console.warn(`[Logic A] ❌ 레거시 사용자: 분석 결과가 없어 랜덤 배정을 진행합니다.`);
    }
    
    // 매칭 실패 또는 분석 결과 없음 시 랜덤 배정
    console.log(`[Logic A] 🎲 레거시 사용자 폴백 랜덤 배정 시작`);
    const randomIndex = Math.floor(Math.random() * characters.length);
    const randomCharacter = characters[randomIndex];
    
    console.log(`[Logic A] 🎲 레거시 사용자 랜덤 캐릭터 선택:`, {
      index: randomIndex,
      characterId: randomCharacter.character_id,
      name: randomCharacter.name,
      adjective2: randomCharacter.adjective_2
    });
    
    // 레거시 사용자용 랜덤 형용사1 생성 (adjectives_total.json에서 동적 추출)
    const adjectivesData = require('../../../assets/data/adjectives_total.json');
    const randomEmotionAdjectives = adjectivesData
      .filter((adj: any) => adj.domain === '감정' || adj.domain === '가치관')
      .map((adj: any) => adj.adjective);
    const randomAdj1 = adj1 || randomEmotionAdjectives[Math.floor(Math.random() * randomEmotionAdjectives.length)];
    
    await userRef.update({
      characterId: randomCharacter.character_id,
      adjective1: randomAdj1,
      adjective2: randomCharacter.adjective_2,
    });
    await addLog(uid, 'ASSIGN_CHARACTER_LOGIC_A_LEGACY_FALLBACK', { characterId: randomCharacter.character_id, adj1: randomAdj1, adj2 });
    console.log(`[Logic A] 레거시 사용자에게 랜덤 캐릭터 '${randomCharacter.name}' 배정 완료.`);
    return { ...userData, characterId: randomCharacter.character_id, adjective1: randomAdj1, adjective2: randomCharacter.adjective_2 };

  } else {
    // --- 신규 사용자: 답변 분석 기반 캐릭터 배정 (개선된 버전) ---
    console.log(`[Logic A] 🆕 신규 사용자 감지 - 답변 분석 기반 캐릭터 배정`);
    const { adj1, adj2 } = await analyzeAnswersForAdjectives(uid, 1, 30);
    
    console.log(`[Logic A] 📊 분석 결과:`, {
      adj1: adj1,
      adj2: adj2
    });
    
    // adj2가 있으면 해당 캐릭터 찾기, 없으면 랜덤 배정
    if (adj2) {
      console.log(`[Logic A] 🔍 캐릭터 매칭 시도: adj2 = "${adj2}"`);
      const matchedCharacter = characters.find(c => c.adjective_2 === adj2);
      if (matchedCharacter) {
        console.log(`[Logic A] ✅ 캐릭터 매칭 성공:`, {
          characterId: matchedCharacter.character_id,
          name: matchedCharacter.name,
          adjective2: matchedCharacter.adjective_2
        });
        
        await userRef.update({
          characterId: matchedCharacter.character_id,
          adjective1: adj1,
          adjective2: matchedCharacter.adjective_2, // 매핑 테이블의 고정값 사용
        });
        await addLog(uid, 'ASSIGN_CHARACTER_LOGIC_A', { characterId: matchedCharacter.character_id, adj1, adj2 });
        console.log(`[Logic A] 신규 사용자에게 분석 기반 캐릭터 '${matchedCharacter.name}' 배정 완료.`);
        return { ...userData, characterId: matchedCharacter.character_id, adjective1: adj1, adjective2: matchedCharacter.adjective_2 };
      } else {
        console.warn(`[Logic A] ❌ 분석된 형용사 '${adj2}'와 일치하는 캐릭터를 찾지 못했습니다. 랜덤 배정으로 전환.`);
      }
    } else {
      console.warn(`[Logic A] ❌ 분석 결과가 없어 랜덤 배정을 진행합니다.`);
    }
    
    // 매칭 실패 또는 분석 결과 없음 시 랜덤 배정 (사용자 경험 보호)
    console.log(`[Logic A] 🎲 폴백 랜덤 배정 시작`);
    const randomIndex = Math.floor(Math.random() * characters.length);
    const randomCharacter = characters[randomIndex];
    
    console.log(`[Logic A] 🎲 랜덤 캐릭터 선택:`, {
      index: randomIndex,
      characterId: randomCharacter.character_id,
      name: randomCharacter.name,
      adjective2: randomCharacter.adjective_2,
      reason: adj2 ? 'no_matching_character' : 'no_analysis_result'
    });
    
    // 신규 사용자용 랜덤 형용사1 생성 (adjectives_total.json에서 동적 추출)
    const adjectivesData = require('../../../assets/data/adjectives_total.json');
    const randomEmotionAdjectives = adjectivesData
      .filter((adj: any) => adj.domain === '감정' || adj.domain === '가치관')
      .map((adj: any) => adj.adjective);
    const randomAdj1 = adj1 || randomEmotionAdjectives[Math.floor(Math.random() * randomEmotionAdjectives.length)];
    
    await userRef.update({ 
      characterId: randomCharacter.character_id,
      adjective1: randomAdj1,
      adjective2: randomCharacter.adjective_2
    });
    await addLog(uid, 'ASSIGN_CHARACTER_LOGIC_A_FALLBACK', { 
      characterId: randomCharacter.character_id, 
      reason: adj2 ? 'no_matching_character' : 'no_analysis_result',
      adj1: randomAdj1, 
      adj2 
    });
    console.log(`[Logic A] ✅ 랜덤 캐릭터 '${randomCharacter.name}' 배정 완료.`);
    return { 
      ...userData, 
      characterId: randomCharacter.character_id, 
      adjective1: randomAdj1,
      adjective2: randomCharacter.adjective_2
    };
  }
};

