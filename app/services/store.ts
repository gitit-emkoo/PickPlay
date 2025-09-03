import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { generateRandomNickname } from '../utils/nickname';
import { db } from './firebase';


export async function ensureUser(uid: string) {
  try {
    // 로컬 사용자 데이터 사용
    const userDataKey = `userData_${uid}`;
    const savedData = await AsyncStorage.getItem(userDataKey);
    
    if (savedData) {
      const userData = JSON.parse(savedData);
      
      // 닉네임이 없으면 추가
      if (!userData.nickname) {
        const autoNickname = generateRandomNickname();
        userData.nickname = autoNickname;
        await AsyncStorage.setItem(userDataKey, JSON.stringify(userData));
      }
      
      return userData;
    } else {
      // 새 사용자 데이터 생성 (자동 랜덤닉네임 할당)
      try {
        const autoNickname = generateRandomNickname();
        const newUserData = { points: 0, streakCount: 0, lastAnswerDate: '', nickname: autoNickname };
        await AsyncStorage.setItem(userDataKey, JSON.stringify(newUserData));
        return newUserData;
      } catch (nicknameError) {
        console.error('닉네임 생성 실패:', nicknameError);
        const fallbackNickname = '익명사용자😊';
        const newUserData = { points: 0, streakCount: 0, lastAnswerDate: '', nickname: fallbackNickname };
        await AsyncStorage.setItem(userDataKey, JSON.stringify(newUserData));
        return newUserData;
      }
    }
  } catch (error) {
    console.error('사용자 데이터 로드 실패:', error);
    const defaultData = { points: 0, streakCount: 0, lastAnswerDate: '', nickname: '익명사용자😊' };
    return defaultData;
  }
}

// 사용자가 이미 해당 질문에 투표했는지 확인
export async function hasUserVoted(uid: string, questionId: string): Promise<boolean> {
  try {
    console.log('🔍 투표 확인 시작:', { uid, questionId });
    
    // 먼저 AsyncStorage에서 확인
    const savedVote = await AsyncStorage.getItem(`vote_${questionId}`);
    if (savedVote) {
      const voteData = JSON.parse(savedVote);
      if (voteData.uid === uid) {
        console.log('🔍 AsyncStorage에서 투표 기록 발견:', voteData);
        return true;
      }
    }
    
    // Firestore에서 확인
    const snap = await getDocs(
      query(
        collection(db, 'votes'), 
        where('uid', '==', uid), 
        where('questionId', '==', questionId)
      )
    );
    const hasVoted = !snap.empty;
    console.log('🔍 Firestore 투표 확인 결과:', { uid, questionId, hasVoted, count: snap.size });
    return hasVoted;
  } catch (error) {
    console.error('투표 확인 에러:', error);
    return false;
  }
}

// 오늘 투표한 질문 ID를 저장
export async function saveTodayQuestion(uid: string, questionId: string) {
  try {
    // 요일 기반으로 저장 (AsyncStorage와 Firestore 일치)
    const dIndex = dayIndex();
    const todayQuestionKey = `today_question_${uid}_${dIndex}`;
    await AsyncStorage.setItem(todayQuestionKey, questionId);
  } catch (error) {
    console.error('오늘 질문 저장 에러:', error);
  }
}

// 오늘 투표한 질문 ID를 가져오기
export async function getTodayQuestion(uid: string): Promise<string | null> {
  try {
    // 요일 기반으로 조회 (AsyncStorage와 Firestore 일치)
    const dIndex = dayIndex();
    const todayQuestionKey = `today_question_${uid}_${dIndex}`;
    return await AsyncStorage.getItem(todayQuestionKey);
  } catch (error) {
    console.error('오늘 질문 조회 에러:', error);
    return null;
  }
}

// UID 변경 시 기존 데이터를 새 UID로 복사
// 사용하지 않는 마이그레이션 유틸 제거

import { Question } from '../types';
import { pickSlot } from '../utils/abtest';
import { dayIndex } from '../utils/date';

export async function getQuestionBy(dayIndex: number, slot: string): Promise<Question | null> {
  try {
  const ref = collection(db,'questions');

    
  const snap = await getDocs(
    query(ref, where('dayIndex','==',dayIndex), where('slot','==',slot), where('active','==',true))
  );

    
    if (!snap.empty) { 
      const d = snap.docs[0]; 
      const result = { id:d.id, ...d.data() } as Question;
      return result;
    }
    
  const any = await getDocs(ref);

    
    if (!any.empty) { 
      const d = any.docs[0]; 
      const result = { id:d.id, ...d.data() } as Question;
      return result; 
    }
    
    return null;
  } catch (error: any) {
    console.error('getQuestionBy 에러:', error);
    throw error;
  }
}

// 특정 ID로 질문 가져오기
export async function getQuestionById(questionId: string): Promise<Question | null> {
  try {
    const ref = doc(db, 'questions', questionId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const result = { id: snap.id, ...snap.data() } as Question;
      return result;
    }
    return null;
  } catch (error) {
    console.error('getQuestionById 에러:', error);
    return null;
  }
}

// 오늘 날짜의 A/B 질문 모두 조회
async function getDailyABQuestions(dIndex: number): Promise<{ A: Question | null; B: Question | null }> {
  const [qa, qb] = await Promise.all([
    getQuestionBy(dIndex, 'A'),
    getQuestionBy(dIndex, 'B')
  ]);
  return { A: qa, B: qb };
}

// 오늘 라우팅 설정 문서 가져오기
async function getDailyConfig(dIndex: number): Promise<any | null> {
  try {
    const ref = doc(db, 'daily_config', String(dIndex));
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error('getDailyConfig 에러:', error);
    return null;
  }
}

// 오늘 라우팅 설정 저장
async function setDailyConfig(dIndex: number, data: any): Promise<void> {
  try {
    const ref = doc(db, 'daily_config', String(dIndex));
    await setDoc(ref, data, { merge: true });
  } catch (error) {
    console.error('setDailyConfig 에러:', error);
  }
}

// A/B 질문의 투표 수 집계
async function getVoteCountsFor(questionIds: string[]): Promise<Record<string, number>> {
  try {
    if (questionIds.length === 0) return {};
    const snap = await getDocs(
      query(
        collection(db, 'votes'),
        where('questionId', 'in', questionIds)
      )
    );
    const counts: Record<string, number> = {};
    for (const id of questionIds) counts[id] = 0;
    snap.forEach(d => {
      const v: any = d.data();
      const qid = v.questionId as string;
      if (qid && counts[qid] !== undefined) counts[qid] += 1;
    });
    return counts;
  } catch (error) {
    console.error('getVoteCountsFor 에러:', error);
    return {};
  }
}

// 임계치/격차 기반 승자 계산 및 설정
async function computeAndMaybeSetWinner(dIndex: number, qa: Question | null, qb: Question | null): Promise<{ winnerId: string | null; loserId: string | null; weight: number } | null> {
  if (!qa || !qb) return null;
  const ids = [qa.id, qb.id];
  const counts = await getVoteCountsFor(ids);
  const cA = counts[qa.id] || 0;
  const cB = counts[qb.id] || 0;
  const total = cA + cB;
  if (total < 100) return null; // 샘플 부족 시 승자 미설정
  const diff = Math.abs(cA - cB);
  const ratioDiff = total > 0 ? diff / total : 0;
  if (diff >= 15 || ratioDiff >= 0.15) {
    const winnerId = cA >= cB ? qa.id : qb.id;
    const loserId = winnerId === qa.id ? qb.id : qa.id;
    const weight = 0.9;
    await setDailyConfig(dIndex, {
      dayIndex: dIndex,
      winnerQuestionId: winnerId,
      loserQuestionId: loserId,
      winnerWeight: weight,
      counts: { [qa.id]: cA, [qb.id]: cB },
      sample: total,
      computedAt: new Date().toISOString()
    });
    return { winnerId, loserId, weight };
  }
  return null;
}


// 오늘 질문 배정(이미 배정된 경우 복원). 신규 유저는 승자 가중치 반영
export async function getOrAssignTodayQuestion(uid: string): Promise<Question | null> {
  try {
    const dIndex = dayIndex();
    // 이미 배정된 질문이 있으면 복원
    const existingId = await getTodayQuestion(uid);
    if (existingId) {
      const existing = await getQuestionById(existingId);
      if (existing) return existing;
    }

    // A/B 질문 조회
    const { A, B } = await getDailyABQuestions(dIndex);
    if (!A && !B) return null;
    if (A && !B) { await saveTodayQuestion(uid, A.id); return A; }
    if (B && !A) { await saveTodayQuestion(uid, B.id); return B; }
    if (!A || !B) return null;

    // 기존 일일 라우팅 설정 확인
    const cfg = await getDailyConfig(dIndex);
    let chosen: Question | null = null;
    if (cfg && cfg.winnerQuestionId && cfg.loserQuestionId && cfg.winnerWeight) {
      const winnerId = cfg.winnerQuestionId as string;
      const loserId = cfg.loserQuestionId as string;
      const weight = typeof cfg.winnerWeight === 'number' ? cfg.winnerWeight : 0.9;
      const r = Math.random();
      const pickId = r < weight ? winnerId : loserId;
      chosen = pickId === A.id ? A : B;
    } else {
      // 원래 로직 복원: 사용자 고정 A/B 분기
      const slot = pickSlot(uid);
      chosen = slot === 'A' ? A : B;
      await computeAndMaybeSetWinner(dIndex, A, B);
    }

    if (chosen) {
      await saveTodayQuestion(uid, chosen.id);
    }
    return chosen;
  } catch (error) {
    console.error('getOrAssignTodayQuestion 에러:', error);
    return null;
  }
}

export async function saveVote(uid: string, questionId: string, optionIndex: number) {
  try {
    // 중복 투표 확인
    if (await hasUserVoted(uid, questionId)) {
      throw new Error('이미 투표한 질문입니다.');
    }
    
    // 투표 기록 저장 (Firestore + 로컬)
    const voteRecord = { uid, questionId, optionIndex, timestamp: new Date().toISOString() };

    // Firestore 저장
    try {
      await addDoc(collection(db, 'votes'), voteRecord);
      console.log('✅ Firestore 투표 기록 저장:', voteRecord);
    } catch (fireError) {
      console.error('❌ Firestore 투표 저장 실패, 로컬로만 저장합니다:', fireError);
    }

    // 로컬 백업 저장
    await AsyncStorage.setItem(`vote_${questionId}`, JSON.stringify(voteRecord));
    console.log('✅ AsyncStorage 투표 기록 저장:', voteRecord);
    
    // 오늘 질문으로 저장 (하루 종일 이 질문을 보여주기 위해)
    await saveTodayQuestion(uid, questionId);
    
    // 로컬 투표 집계 업데이트
    await updateLocalVoteCount(questionId, optionIndex);
  } catch (error) {
    console.error('❌ 투표 저장 실패:', error);
    throw error;
  }
}

// 로컬 투표 집계 업데이트
async function updateLocalVoteCount(questionId: string, optionIndex: number) {
  try {
    const voteCountKey = `vote_count_${questionId}`;
    const existingCount = await AsyncStorage.getItem(voteCountKey);
    let voteCount = existingCount ? JSON.parse(existingCount) : { c0: 0, c1: 0 };
    
    if (optionIndex === 0) voteCount.c0++;
    if (optionIndex === 1) voteCount.c1++;
    
    await AsyncStorage.setItem(voteCountKey, JSON.stringify(voteCount));
    console.log('📊 로컬 투표 집계 업데이트:', voteCount);
  } catch (error) {
    console.error('로컬 투표 집계 업데이트 실패:', error);
  }
}

export async function aggregate(questionId: string) {
  try {
    // 1) Firestore 집계 우선 (실시간 전국 결과)
    const snap = await getDocs(
      query(
        collection(db, 'votes'),
        where('questionId', '==', questionId)
      )
    );

    let c0 = 0, c1 = 0;
    snap.forEach(doc => {
      const d: any = doc.data();
      if (d.optionIndex === 0) c0 += 1;
      if (d.optionIndex === 1) c1 += 1;
    });

  const total = c0 + c1;
    const pct = (n: number) => total ? Math.round((n / total) * 100) : 0;
    const result = { total, c0, c1, p0: pct(c0), p1: pct(c1) };
    console.log('📊 Firestore 집계 결과(우선):', { questionId, ...result, count: snap.size });
    
    // 2) 로컬 집계도 업데이트 (백업용)
    try {
      const voteCountKey = `vote_count_${questionId}`;
      await AsyncStorage.setItem(voteCountKey, JSON.stringify({ c0, c1 }));
    } catch (localError) {
      console.error('로컬 집계 업데이트 실패:', localError);
    }
    
    return result;
  } catch (error) {
    console.error('❌ 집계 실패:', error);
    return { total: 0, c0: 0, c1: 0, p0: 0, p1: 0 };
  }
}

/** 승패 보상형: 다수 5P / 소수 10P + 연속 참여 배수 보상(10일 2배, 20일 3배) */
export async function rewardWithMajority(uid: string, questionId: string, myOptionIndex: number) {
  // 로컬 집계로 다수/소수 판단
  const agg = await aggregate(questionId);
  const myIsMajority = (() => {
    const a0 = agg.c0, a1 = agg.c1;
    if (a0 === a1) return true; // 동률이면 다수로 간주
    const majorityIndex = a0 >= a1 ? 0 : 1;
    return myOptionIndex === majorityIndex;
  })();


  // 기본 보상(소수 10 / 다수 5) - 소수가 더 많이 받도록 변경
  let base = myIsMajority ? 5 : 10;


  // 연속 참여 배수 보상 계산
  const today = new Date().toISOString().slice(0,10);

  
  // 로컬 사용자 데이터 업데이트
  const userDataKey = `userData_${uid}`;
  const existingUserData = await AsyncStorage.getItem(userDataKey);
  let userData = existingUserData ? JSON.parse(existingUserData) : { points: 0, streakCount: 0, lastAnswerDate: '', nickname: '익명사용자😊' };

  let next = 1;

  if (userData.lastAnswerDate) {
    const diffDays = Math.floor((new Date(today).getTime() - new Date(userData.lastAnswerDate).getTime())/(1000*60*60*24));
    console.log('📅 출석 계산:', { 
      lastAnswerDate: userData.lastAnswerDate, 
      today, 
      diffDays, 
      currentStreak: userData.streakCount 
    });
    
    if (diffDays === 0) {
      // 오늘 이미 투표했으면 현재 streak 유지
      next = userData.streakCount || 1;
    } else if (diffDays === 1) {
      // 어제 투표했으면 연속 참여
      next = (userData.streakCount || 0) + 1;
    } else {
      // 하루라도 건너뛰었으면 1일차로 리셋
      next = 1;
    }
    
    console.log('📅 계산된 next:', next);
  }

  // 연속 참여 배수 보상 적용
  let multiplier = 1;
  if (next >= 21) {
    multiplier = 3; // 20일 이상: 3배
    console.log('🎉 20일 연속 참여! 3배 보상 적용');
  } else if (next >= 11) {
    multiplier = 2; // 10일 이상: 2배
    console.log('🎉 10일 연속 참여! 2배 보상 적용');
  }
  
  // 최종 보상 계산 (기본 보상 × 배수)
  base = base * multiplier;

  const updatedData = {
    points: ((userData.points as number)||0) + base,
    streakCount: next,
    lastAnswerDate: today,

    nickname: userData.nickname, // 닉네임 유지
  };

  // 로컬에 사용자 데이터 저장
  await AsyncStorage.setItem(userDataKey, JSON.stringify(updatedData));
  console.log('✅ 로컬 사용자 데이터 업데이트:', updatedData);

  return { base, myIsMajority, next, agg };
}


// 현재 사용자 데이터 확인 및 수정 함수
// (삭제됨) 테스트용 출석 보정 유틸 제거

// 닉네임 설정 함수
// 사용하지 않는 닉네임 설정 유틸 제거

// 실시간 집계 구독
export function watchAggregation(
  questionId: string,
  onChange: (result: { total: number; c0: number; c1: number; p0: number; p1: number }) => void
) {
  try {
    const qRef = query(
      collection(db, 'votes'),
      where('questionId', '==', questionId)
    );
    const unsubscribe = onSnapshot(qRef, (snapshot) => {
      let c0 = 0, c1 = 0;
      snapshot.forEach(doc => {
        const d: any = doc.data();
        if (d.optionIndex === 0) c0 += 1;
        if (d.optionIndex === 1) c1 += 1;
      });

      const total = c0 + c1;
      const pct = (n: number) => total ? Math.round((n / total) * 100) : 0;
      const result = { total, c0, c1, p0: pct(c0), p1: pct(c1) };
      console.log('📡 실시간 집계 업데이트:', { questionId, ...result, size: snapshot.size });
      onChange(result);
    });
    return unsubscribe;
  } catch (error) {
    console.error('❌ 실시간 집계 구독 실패:', error);
    return () => {};
  }
}
