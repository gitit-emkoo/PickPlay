import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateRandomNickname } from '../../utils/nickname';
import { UserData } from '../../types';
import { getDeviceUID, getPreviousUID } from '../firebase';

/**
 * Firestore에서 사용자를 확인하고, 없으면 복구를 시도하며, 최종적으로 없으면 신규 사용자를 생성합니다.
 * @param uid 사용자 Firebase UID
 * @returns 사용자 데이터
 */
export const ensureUser = async (uid: string): Promise<UserData> => {
  console.log('🔵 [ensureUser] 시작 - Firebase UID:', uid);
  const userRef = firestore().collection('users').doc(uid);
  
  try {
    const deviceUID = await getDeviceUID();

    // 온라인 전용: 항상 Firestore에서 직접 로드 (캐시 사용 안 함)
    // 1. 현재 UID로 Firestore 조회 (서버에서 직접 가져오기)
    const doc = await userRef.get({ source: 'server' });
    const userDocExists = typeof (doc as any).exists === 'function' ? (doc as any).exists() : ((doc as any).exists as boolean);

    if (userDocExists) {
      const data = doc.data() as UserData;

      // 온라인 전용: AsyncStorage 캐시 저장하지 않음 (항상 Firestore에서 직접 로드)
      
      // 신규 사용자처럼 보이는 경우 (모든 값이 0) 복구 로직 실행
      const isNewUserLike = (data.points === 0 && data.streakCount === 0 && data.totalSelections === 0);
      
      if (!isNewUserLike) {
        // 유효한 데이터가 있으면 정상 반환
        if (!data.deviceUID) {
          await userRef.update({ deviceUID } as any);
          return { ...data, deviceUID, createdAt: convertTimestamp(data.createdAt) };
        }
        return { ...data, createdAt: convertTimestamp(data.createdAt) };
      }
    }

    // 2. 복구 시도: 기존 사용자 찾기 (온라인 전용)
    let recoveryData = null;
    try {
      recoveryData = await findExistingUser(uid, deviceUID);
    } catch (recoveryError: any) {
      // 온라인 전용: 네트워크 에러는 throw
      console.error('❌ [ensureUser] 복구 시도 실패:', recoveryError);
      // 네트워크 에러인 경우 throw하여 상위에서 처리
      const errorCode = recoveryError?.code || '';
      const errorMessage = recoveryError?.message || '';
      if (errorCode === 'unavailable' || errorMessage.includes('network') || errorMessage.includes('offline')) {
        throw recoveryError; // 온라인 전용이므로 오프라인 에러는 throw
      }
    }
    
    if (recoveryData) {
      // 3. 복구된 데이터로 사용자 생성
      const recoveredUserData = {
        uid,
        deviceUID,
        points: recoveryData.points ?? 0,
        streakCount: recoveryData.streakCount ?? 0,
        lastAnswerDate: normalizeLastAnswerDate(recoveryData.lastAnswerDate),
        nickname: recoveryData.nickname || generateRandomNickname(),
        totalSelections: recoveryData.totalSelections ?? 0,
        createdAt: computeCreatedAt(recoveryData) ?? firestore.FieldValue.serverTimestamp(),
        characterId: recoveryData.characterId || null,
        adjective1: recoveryData.adjective1 || null,
        adjective2: recoveryData.adjective2 || null,
        tutorial: recoveryData.tutorial || {
          mainAnswered: false,
          livepickParticipated: false,
          livepickCreated: false,
          rewardGiven500: false,
        },
      };

      // 온라인 전용: 쓰기 작업 실패 시 throw
      await userRef.set(recoveredUserData as any);
      
      // 기존 Firestore 문서가 있으면 참조 추가 및 answers 마이그레이션
      if (recoveryData.existingUID && recoveryData.existingUID !== uid) {
        try {
          await migrateAnswers(recoveryData.existingUID, uid);
          await firestore().collection('users').doc(recoveryData.existingUID).update({
            recoveredToUID: uid,
            recoveredAt: firestore.FieldValue.serverTimestamp(),
          } as any);
        } catch (migrateError: any) {
          // 마이그레이션 실패는 경고만 (복구 데이터는 이미 저장됨)
          console.warn('⚠️ [ensureUser] 마이그레이션 실패:', migrateError);
        }
      } else if (!recoveryData.existingUID && recoveryData.deviceUID) {
        // V2 사용자의 경우: existingUID가 null이지만 deviceUID가 있으면
        // 현재 UID로 votes 컬렉션을 확인하여 V2 사용자의 votes를 answers로 변환
        // (V2 사용자는 Firestore에 deviceUID를 저장하지 않았으므로
        //  현재 UID로 votes를 조회하면 V2의 기존 UID를 찾을 수 없음)
        // 하지만 migrateAnswers에서 현재 UID로 votes를 확인하여 변환할 수 있음
        // 주의: V2 사용자가 이전에 다른 UID로 votes를 저장했다면 복구 불가능
        // 하지만 V2 사용자가 현재 UID로 votes를 저장했다면 복구 가능
        try {
          console.log('🔍 [ensureUser] V2 사용자 votes 마이그레이션 시도 (현재 UID로)');
          // migrateAnswers는 oldUID와 newUID가 같아도 votes 컬렉션을 확인함
          await migrateAnswers(uid, uid); // 현재 UID로 votes를 확인하여 answers로 변환
        } catch (migrateError: any) {
          // 마이그레이션 실패는 경고만 (복구 데이터는 이미 저장됨)
          console.warn('⚠️ [ensureUser] V2 votes 마이그레이션 실패:', migrateError);
        }
      }
      
      // 온라인 전용: AsyncStorage 캐시 저장하지 않음
      const userDataToReturn = {
        ...recoveredUserData,
        createdAt: computeCreatedAt(recoveryData) ?? new Date(),
      } as UserData;
      
      console.log('✅ [Recovery] 사용자 데이터 복구 완료');
      return userDataToReturn;
    }

    // 4. 복구 실패: 신규 사용자 생성
    console.log('❌ [ensureUser] 복구 실패 - 신규 사용자 생성');
    
    const newUserData = {
      uid,
      deviceUID,
      createdAt: firestore.FieldValue.serverTimestamp(),
      totalSelections: 0,
      characterId: null,
      adjective1: null,
      adjective2: null,
      points: 0,
      streakCount: 0,
      lastAnswerDate: 0,
      nickname: generateRandomNickname(),
      tutorial: {
        mainAnswered: false,
        livepickParticipated: false,
        livepickCreated: false,
        rewardGiven500: false,
      },
    };

    // 트랜잭션을 사용하여 원자적으로 문서 생성 (이미 존재하면 읽기)
    try {
      const result = await firestore().runTransaction(async (transaction) => {
        const doc = await transaction.get(userRef);
        
        if (doc.exists) {
          // 문서가 이미 존재하면 기존 데이터 반환
          const existingData = doc.data() as UserData;
          console.log('✅ [ensureUser] 트랜잭션: 기존 문서 발견, 데이터 반환');
          return { exists: true, data: existingData };
        } else {
          // 문서가 없으면 생성
          transaction.set(userRef, newUserData);
          console.log('✅ [ensureUser] 트랜잭션: 새 문서 생성 예약');
          return { exists: false, data: newUserData };
        }
      });
      
      if (result.exists && result.data) {
        // 기존 문서 데이터 반환
        const convertedCreatedAt = convertTimestamp(result.data.createdAt);
        const userData = { ...result.data, createdAt: convertedCreatedAt } as UserData;
        // 온라인 전용: AsyncStorage 캐시 저장하지 않음
        return userData;
      } else {
        // 새로 생성된 문서 데이터 반환
        console.log('✅ [ensureUser] 신규 사용자 생성 완료');
        const userData = { ...newUserData, createdAt: new Date() } as UserData;
        // 온라인 전용: AsyncStorage 캐시 저장하지 않음
        return userData;
      }
    } catch (transactionError: any) {
      console.error('❌ [ensureUser] 트랜잭션 실패:', transactionError);
      console.error('❌ [ensureUser] 에러 코드:', transactionError?.code);
      console.error('❌ [ensureUser] 에러 메시지:', transactionError?.message);
      
      // 트랜잭션 실패 시 문서 존재 여부 재확인 (서버에서 직접)
      const fallbackDoc = await userRef.get({ source: 'server' });
      if (fallbackDoc.exists) {
        console.log('✅ [ensureUser] 폴백: 기존 문서 데이터 반환');
        const existingData = fallbackDoc.data() as UserData;
        const convertedCreatedAt = convertTimestamp(existingData.createdAt);
        const userData = { ...existingData, createdAt: convertedCreatedAt };
        // 온라인 전용: AsyncStorage 캐시 저장하지 않음
        return userData;
      }
      
      // 문서가 없고 트랜잭션도 실패한 경우, 직접 set() 시도 (최후의 수단)
      try {
        await userRef.set(newUserData);
        console.log('✅ [ensureUser] 폴백: set()으로 신규 사용자 생성 완료');
        const userData = { ...newUserData, createdAt: new Date() } as UserData;
        // 온라인 전용: AsyncStorage 캐시 저장하지 않음
        return userData;
      } catch (setError: any) {
        // 온라인 전용: 오프라인 에러는 throw
        console.error('❌ [ensureUser] set()도 실패:', setError);
        throw setError;
      }
    }
  } catch (error: any) {
    console.error('❌ [ensureUser] 전체 프로세스 실패:', error);
    // 에러 발생 시에도 최소한의 사용자 데이터 반환
    const fallbackDeviceUID = await getDeviceUID();
    return createFallbackUserData(uid, fallbackDeviceUID);
  }
};

/**
 * 기존 사용자를 찾습니다 (우선순위: previousUID > deviceUID > AsyncStorage)
 */
async function findExistingUser(uid: string, deviceUID: string): Promise<any | null> {
  console.log('🔍 [Recovery] 기존 사용자 찾기 시작 - 현재 UID:', uid, 'deviceUID:', deviceUID);
  
  // 1. previousUID로 찾기 (가장 확실한 방법)
  const previousUID = await getPreviousUID();
  console.log('🔍 [Recovery] previousUID 확인:', previousUID ? `발견됨 (${previousUID})` : '없음');
  
  if (previousUID) {
    if (previousUID !== uid) {
      console.log('🔍 [Recovery] previousUID가 현재 UID와 다름. Firestore에서 조회 시도...');
      try {
        const previousUserDoc = await firestore().collection('users').doc(previousUID).get();
        if (previousUserDoc.exists) {
          const data = previousUserDoc.data() as UserData;
          console.log('✅ [Recovery] previousUID로 기존 사용자 발견:', previousUID);
          console.log('📊 [Recovery] 발견된 데이터:', {
            nickname: data.nickname,
            points: data.points,
            streakCount: data.streakCount,
            totalSelections: data.totalSelections,
          });
          return { ...data, existingUID: previousUID };
        } else {
          console.log('⚠️ [Recovery] previousUID로 Firestore 문서를 찾지 못함:', previousUID);
        }
      } catch (error: any) {
        console.error('❌ [Recovery] previousUID 조회 실패:', error?.code || error?.message);
      }
    } else {
      console.log('ℹ️ [Recovery] previousUID가 현재 UID와 같음. 이전 UID로 복구 불가 (이미 확인됨)');
    }
  } else {
    console.log('⚠️ [Recovery] previousUID가 없음. 다른 방법으로 복구 시도');
  }

  // 2. deviceUID로 찾기
  console.log('🔍 [Recovery] deviceUID로 Firestore 검색 시도:', deviceUID);
  try {
    const deviceUIDQuery = await firestore()
      .collection('users')
      .where('deviceUID', '==', deviceUID)
      .get();
    
    if (!deviceUIDQuery.empty) {
      console.log(`🔍 [Recovery] deviceUID로 ${deviceUIDQuery.size}개의 문서 발견`);
      // 가장 최근 문서 선택
      const latestDoc = deviceUIDQuery.docs.reduce((latest, doc) => {
        const latestTime = getTimestamp(latest.data().createdAt);
        const docTime = getTimestamp(doc.data().createdAt);
        return docTime > latestTime ? doc : latest;
      });
      
      const existingUID = latestDoc.id;
      if (existingUID !== uid) {
        const data = latestDoc.data() as UserData;
        console.log('✅ [Recovery] deviceUID로 기존 사용자 발견:', existingUID);
        console.log('📊 [Recovery] 발견된 데이터:', {
          nickname: data.nickname,
          points: data.points,
          streakCount: data.streakCount,
          totalSelections: data.totalSelections,
        });
        return { ...data, existingUID };
      } else {
        console.log('ℹ️ [Recovery] deviceUID로 찾은 문서가 현재 UID와 같음');
      }
    } else {
      console.log('ℹ️ [Recovery] deviceUID로 Firestore 문서를 찾지 못함');
    }
  } catch (error: any) {
    console.error('❌ [Recovery] deviceUID 조회 실패:', error?.code || error?.message);
  }

  // 3. V2 사용자 복구: AsyncStorage에서 기존 deviceUID와 사용자 데이터 확인
  console.log('🔍 [Recovery] V2 사용자 복구 시도: AsyncStorage 확인');
  try {
    // 기존 deviceUID 확인 (V2에서 저장된 랜덤 기반일 수 있음)
    const existingDeviceUID = await AsyncStorage.getItem('deviceUID');
    if (existingDeviceUID && existingDeviceUID.startsWith('device_')) {
      console.log('🔍 [Recovery] V2 deviceUID 발견:', existingDeviceUID);
      
      // V2에서 저장된 사용자 데이터 확인
      const userDataKey = `userData_${existingDeviceUID}`;
      const savedUserData = await AsyncStorage.getItem(userDataKey);
      
      if (savedUserData) {
        try {
          const parsedData = JSON.parse(savedUserData);
          console.log('✅ [Recovery] V2 사용자 데이터 발견 (AsyncStorage):', {
            nickname: parsedData.nickname,
            points: parsedData.points,
            streakCount: parsedData.streakCount,
            totalSelections: parsedData.totalSelections,
          });
          
          // V2 사용자의 기존 Firebase UID 찾기
          // V2는 Firestore에 사용자 데이터를 저장했지만 deviceUID 필드는 없음
          // 따라서 votes 컬렉션에서 사용자의 기존 UID를 찾을 수 있음
          let v2ExistingUID: string | null = null;
          try {
            // V2 사용자가 Firestore에 저장한 데이터가 있다면
            // votes 컬렉션에서 사용자의 기존 UID를 찾을 수 있음
            // 하지만 현재 UID로 votes를 조회하면 V2의 기존 UID를 찾을 수 없음
            // 대신, AsyncStorage에 저장된 사용자 데이터에 uid 필드가 있을 수 있음
            // (V2는 AsyncStorage에 uid를 저장하지 않았지만, 확인해봄)
            
            // V2 사용자의 기존 Firebase UID를 찾기 위해
            // 현재 UID와 다른 모든 사용자 문서를 확인하는 것은 비효율적이므로
            // V2 사용자의 기존 UID를 찾지 못하면 null로 설정
            // (V2 사용자가 Firestore에 데이터를 저장하지 않았을 수 있음)
            
            // 하지만 V2 사용자가 Firestore에 저장한 데이터가 있다면
            // 그 데이터를 찾기 위해 다른 방법을 사용해야 함
            // 예: votes 컬렉션에서 사용자의 기존 UID를 찾을 수 있음
            // 하지만 현재 UID로 votes를 조회하면 V2의 기존 UID를 찾을 수 없음
            
            // 실제로는 V2 사용자의 기존 Firebase UID를 찾는 것이 어려움
            // 따라서 null로 설정하고, migrateAnswers에서 votes 컬렉션을 확인하여
            // V2 사용자의 votes를 answers로 변환함
            v2ExistingUID = null;
            
            console.log('ℹ️ [Recovery] V2 사용자의 기존 Firebase UID 찾기 시도 (votes 컬렉션은 migrateAnswers에서 처리)');
          } catch (v2UIDError: any) {
            console.warn('⚠️ [Recovery] V2 사용자의 기존 Firebase UID 찾기 실패:', v2UIDError?.message);
          }
          
          // V2 사용자 데이터를 반환
          return {
            ...parsedData,
            existingUID: v2ExistingUID, // V2 사용자의 기존 Firebase UID (찾지 못하면 null)
            deviceUID: existingDeviceUID, // V2의 deviceUID 유지
          };
        } catch (parseError) {
          console.error('❌ [Recovery] V2 사용자 데이터 파싱 실패:', parseError);
        }
      } else {
        console.log('ℹ️ [Recovery] V2 deviceUID는 있지만 사용자 데이터가 없음');
      }
    } else {
      console.log('ℹ️ [Recovery] V2 deviceUID를 찾지 못함');
    }
  } catch (asyncStorageError: any) {
    console.error('❌ [Recovery] AsyncStorage 확인 실패:', asyncStorageError?.message);
  }

  console.log('❌ [Recovery] 모든 방법으로 기존 사용자를 찾지 못함');
  return null;
}

/**
 * answers 컬렉션을 마이그레이션합니다
 * V2 사용자의 경우 votes 컬렉션도 answers로 변환합니다
 */
async function migrateAnswers(oldUID: string, newUID: string): Promise<void> {
  try {
    // 1. answers 컬렉션 마이그레이션 (V3 사용자)
    const oldAnswersQuery = await firestore()
      .collection('answers')
      .where('uid', '==', oldUID)
      .get();
    
    let migratedCount = 0;
    const batch = firestore().batch();
    let batchCount = 0;
    const BATCH_LIMIT = 500;

    // answers 마이그레이션
    if (!oldAnswersQuery.empty) {
      for (const oldAnswerDoc of oldAnswersQuery.docs) {
        const oldAnswerData = oldAnswerDoc.data();
        const questionId = oldAnswerData.question_id;
        if (!questionId) continue;
        
        const newAnswerDocId = `${newUID}_${questionId}`;
        const newAnswerRef = firestore().collection('answers').doc(newAnswerDocId);

        // 이미 존재하면 건너뛰기
        const newAnswerDoc = await newAnswerRef.get();
        if (newAnswerDoc.exists) continue;

        batch.set(newAnswerRef, { ...oldAnswerData, uid: newUID });
        batchCount++;
        migratedCount++;

        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          batchCount = 0;
        }
      }
    }

    // 2. V2 사용자의 votes 컬렉션을 answers로 변환
    try {
      const oldVotesQuery = await firestore()
        .collection('votes')
        .where('uid', '==', oldUID)
        .get();
      
      if (!oldVotesQuery.empty) {
        console.log(`🔍 [Recovery] V2 votes 컬렉션 발견: ${oldVotesQuery.size}개`);
        
        for (const oldVoteDoc of oldVotesQuery.docs) {
          const oldVoteData = oldVoteDoc.data();
          const questionId = oldVoteData.questionId;
          const optionIndex = oldVoteData.optionIndex;
          
          if (!questionId || optionIndex === undefined) continue;
          
          const newAnswerDocId = `${newUID}_${questionId}`;
          const newAnswerRef = firestore().collection('answers').doc(newAnswerDocId);

          // 이미 존재하면 건너뛰기
          const newAnswerDoc = await newAnswerRef.get();
          if (newAnswerDoc.exists) continue;

          // V2 votes를 V3 answers 형식으로 변환
          const questionRef = firestore().collection('questions').doc(questionId);
          const questionDoc = await questionRef.get();
          
          if (!questionDoc.exists) {
            console.warn(`⚠️ [Recovery] 질문을 찾을 수 없음: ${questionId}`);
            continue;
          }
          
          const questionData = questionDoc.data();
          const selectedOptionText = optionIndex === 0 
            ? questionData?.option_1_text 
            : questionData?.option_2_text;
          
          if (!selectedOptionText) {
            console.warn(`⚠️ [Recovery] 선택 옵션 텍스트를 찾을 수 없음: ${questionId}, optionIndex: ${optionIndex}`);
            continue;
          }

          // V2 votes의 timestamp를 answeredAt으로 변환
          let answeredAt = firestore.FieldValue.serverTimestamp();
          if (oldVoteData.timestamp) {
            try {
              answeredAt = typeof oldVoteData.timestamp === 'string' 
                ? firestore.Timestamp.fromDate(new Date(oldVoteData.timestamp))
                : oldVoteData.timestamp;
            } catch (e) {
              console.warn(`⚠️ [Recovery] timestamp 변환 실패: ${oldVoteData.timestamp}`);
            }
          }

          const answerData = {
            uid: newUID,
            question_id: questionId,
            selected_option_index: optionIndex,
            selected_option_text: selectedOptionText,
            tags: [], // V2에는 AI 태그가 없었으므로 빈 배열
            rewarded: false,
            answeredAt: answeredAt,
          };

          batch.set(newAnswerRef, answerData);
          batchCount++;
          migratedCount++;

          if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            batchCount = 0;
          }
        }
        
        console.log(`✅ [Recovery] V2 votes를 answers로 변환 완료: ${oldVotesQuery.size}개`);
      }
    } catch (votesError: any) {
      console.warn('⚠️ [Recovery] V2 votes 마이그레이션 실패 (무시):', votesError?.message);
      // votes 마이그레이션 실패는 무시 (answers만 마이그레이션해도 됨)
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    if (migratedCount > 0) {
      console.log(`✅ [Recovery] answers 마이그레이션 완료: 총 ${migratedCount}개`);
    } else {
      console.log('ℹ️ [Recovery] 마이그레이션할 answers가 없음');
    }
  } catch (error: any) {
    console.error('❌ [Recovery] answers 마이그레이션 실패:', error);
  }
}

/**
 * Firestore Timestamp를 Date로 변환
 * AsyncStorage에서 가져온 문자열도 처리
 */
function convertTimestamp(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (typeof (timestamp as any).toDate === 'function') {
    return (timestamp as FirebaseFirestoreTypes.Timestamp).toDate();
  }
  // 문자열인 경우 (AsyncStorage에서 JSON.parse 후)
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  // 숫자 타임스탬프인 경우
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  return new Date(timestamp);
}

/**
 * Timestamp를 숫자로 변환 (비교용)
 */
function getTimestamp(timestamp: any): number {
  if (!timestamp) return 0;
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof (timestamp as any).toDate === 'function') {
    return (timestamp as FirebaseFirestoreTypes.Timestamp).toDate().getTime();
  }
  return new Date(timestamp).getTime();
}

/**
 * lastAnswerDate를 정규화합니다
 */
function normalizeLastAnswerDate(lastAnswerDate: any): number {
  if (!lastAnswerDate) return 0;
  if (typeof lastAnswerDate === 'number') return lastAnswerDate;
  if (typeof lastAnswerDate === 'string' && lastAnswerDate.includes('-')) {
    return parseInt(lastAnswerDate.replace(/-/g, ''), 10);
  }
  return 0;
}

/**
 * createdAt을 계산합니다 (백필 알고리즘)
 */
function computeCreatedAt(data: any): Date | null {
  if (data.createdAt) {
    if (data.createdAt instanceof Date) return data.createdAt;
    if (typeof (data.createdAt as any).toDate === 'function') {
      return (data.createdAt as FirebaseFirestoreTypes.Timestamp).toDate();
    }
    return parseDateKeyToDate(data.createdAt);
  }

  // totalSelections와 lastAnswerDate로 계산
  const totalSelections = Number(data.totalSelections || 0);
  const lastDate = parseDateKeyToDate(data.lastAnswerDate);
  if (!lastDate || totalSelections < 1) return null;

  const base = new Date(lastDate.getTime());
  base.setUTCHours(0, 0, 0, 0);
  return new Date(base.getTime() - (totalSelections - 1) * 24 * 60 * 60 * 1000);
}

/**
 * 날짜 키를 Date로 파싱
 */
function parseDateKeyToDate(val: any): Date | null {
  try {
    if (!val) return null;
    if (typeof val === 'number') {
      const s = String(val);
      const y = parseInt(s.slice(0, 4), 10);
      const m = parseInt(s.slice(4, 6), 10) - 1;
      const d = parseInt(s.slice(6, 8), 10);
      const dt = new Date(Date.UTC(y, m, d));
      return isNaN(dt.getTime()) ? null : dt;
    }
    if (typeof val === 'string' && /\d{4}-\d{2}-\d{2}/.test(val)) {
      const [y, m, d] = val.split('-').map(x => parseInt(x, 10));
      const dt = new Date(Date.UTC(y, m - 1, d));
      return isNaN(dt.getTime()) ? null : dt;
    }
    if (typeof val === 'string') {
      const dt = new Date(val);
      return isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fallback 사용자 데이터 생성
 */
function createFallbackUserData(uid: string, deviceUID: string): UserData {
  return {
    uid,
    deviceUID,
    createdAt: new Date(),
    totalSelections: 0,
    characterId: null,
    adjective1: null,
    adjective2: null,
    points: 0,
    streakCount: 0,
    lastAnswerDate: 0,
    nickname: generateRandomNickname(),
    tutorial: {
      mainAnswered: false,
      livepickParticipated: false,
      livepickCreated: false,
      rewardGiven500: false,
    },
  };
}
