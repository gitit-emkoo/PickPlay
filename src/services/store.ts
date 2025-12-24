import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import firestore from '@react-native-firebase/firestore';
import { generateRandomNickname } from '../utils/nickname';
import { Answer, Character, Question, UserData } from '../types';
import { ensureAnonymousAuth } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceUID, getPreviousUID } from './firebase';
import { currentDateKey } from '../utils/date';
import functionsModule from '@react-native-firebase/functions';
import { scheduleStreakNotification } from './notifications';
import { recordPointHistory } from './pointHistory';
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
  console.log('🔵 [ensureUser] 시작 - Firebase UID:', uid);
  const userRef = firestore().collection('users').doc(uid);
  
  try {
    const deviceUID = await getDeviceUID();
    console.log('🔵 [ensureUser] 현재 deviceUID:', deviceUID);

    // V2 버전과 동일하게: 먼저 현재 UID로 Firestore 조회 (가장 빠르고 확실한 방법)
    const doc = await userRef.get();
    const userDocExists = typeof (doc as any).exists === 'function' ? (doc as any).exists() : ((doc as any).exists as boolean);
    console.log('🔵 [ensureUser] Firestore 문서 존재 여부:', userDocExists);
    
    // 현재 UID로 문서가 있으면 데이터 확인
    let currentUserData: UserData | null = null;
    if (userDocExists) {
      currentUserData = doc.data() as UserData;
      console.log('✅ [V2] Firestore에서 사용자 데이터 확인:', uid);
      console.log('📊 [V2] Firestore 데이터 내용:', {
        nickname: currentUserData.nickname,
        points: currentUserData.points,
        streakCount: currentUserData.streakCount,
        totalSelections: currentUserData.totalSelections,
        deviceUID: currentUserData.deviceUID || '없음',
      });
      
      // 새 유저 데이터인지 확인 (모든 값이 0이고 활동이 없는 경우)
      const isNewUserData = (currentUserData.points === 0 || !currentUserData.points) && 
                            (currentUserData.streakCount === 0 || !currentUserData.streakCount) && 
                            (currentUserData.totalSelections === 0 || !currentUserData.totalSelections);
      
      if (isNewUserData) {
        console.log('⚠️ [ensureUser] 현재 문서가 새 유저 데이터로 보입니다 (모든 값이 0). 복구 로직 실행...');
        // 아래 복구 로직으로 진행
      } else {
        // 기존 유저 데이터가 확실한 경우만 바로 반환
        console.log('✅ [ensureUser] 기존 유저 데이터 확인. 바로 반환합니다.');
        
        // deviceUID가 없으면 추가 (향후 복구용)
        if (!currentUserData.deviceUID) {
          console.log('🔄 [Migration] 기존 사용자 문서에 deviceUID가 없음. 추가 중...');
          try {
            await userRef.update({
              deviceUID: deviceUID,
            } as any);
            console.log('✅ [Migration] deviceUID 추가 완료:', deviceUID);
            const updatedData = { ...currentUserData, deviceUID };
            if (currentUserData.createdAt && (currentUserData.createdAt as FirebaseFirestoreTypes.Timestamp).toDate) {
              return { ...updatedData, createdAt: (currentUserData.createdAt as FirebaseFirestoreTypes.Timestamp).toDate() };
            }
            return updatedData;
          } catch (updateError: any) {
            console.error('❌ [Migration] deviceUID 추가 실패:', updateError);
          }
        }
        
        // Firestore Timestamp를 JS Date 객체로 변환
        if (currentUserData.createdAt && (currentUserData.createdAt as FirebaseFirestoreTypes.Timestamp).toDate) {
          return { ...currentUserData, createdAt: (currentUserData.createdAt as FirebaseFirestoreTypes.Timestamp).toDate() };
        }
        return currentUserData;
      }
    }

    // Firestore에 데이터가 없거나 새 유저 데이터인 경우 복구 시도
    // 0-0. AsyncStorage를 가장 먼저 확인 (같은 기기라면 업데이트 후에도 유지됨)
    console.log('🔍 [ensureUser] AsyncStorage에서 기존 데이터 우선 확인 중...');
    let asyncStorageData: any = null;
    let asyncStorageKey: string | null = null;
    try {
      // 먼저 현재 deviceUID로 시도
      const currentDeviceKey = `userData_${deviceUID}`;
      let asyncDataJSON = await AsyncStorage.getItem(currentDeviceKey);
      
      // 현재 deviceUID로 찾지 못하면 모든 userData_ 키 검색 (중요: deviceUID가 변경되었을 수 있음)
      if (!asyncDataJSON) {
        console.log('🔍 [ensureUser] 현재 deviceUID로 데이터를 찾지 못함, 모든 userData_ 키 검색 중...');
        const allKeys = await AsyncStorage.getAllKeys();
        const userDataKeys = allKeys.filter(key => key.startsWith('userData_'));
        console.log(`🔍 [ensureUser] 발견된 userData_ 키: ${userDataKeys.length}개`);
        
        if (userDataKeys.length > 0) {
          console.log(`🔍 [ensureUser] 검색할 키 목록:`, userDataKeys);
        }
        
        // 가장 최신 데이터 찾기 (totalSelections가 가장 큰 것 선택)
        for (const key of userDataKeys) {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            try {
              const parsed = JSON.parse(data);
              console.log(`🔍 [ensureUser] ${key} 파싱 결과:`, {
                nickname: parsed.nickname,
                points: parsed.points,
                streakCount: parsed.streakCount,
                totalSelections: parsed.totalSelections,
              });
              
              // 유효한 데이터인지 확인 (points, nickname 등이 있고, totalSelections가 0이 아닌 경우 우선)
              if (parsed && (parsed.points !== undefined || parsed.nickname || parsed.totalSelections !== undefined)) {
                // totalSelections가 있는 데이터를 우선 선택 (더 많은 활동 = 더 최신)
                // 단, 모든 값이 0인 경우는 제외 (새 유저 데이터)
                const hasActivity = (parsed.totalSelections || 0) > 0 || (parsed.points || 0) > 0 || (parsed.streakCount || 0) > 0;
                if (hasActivity && (!asyncStorageData || (parsed.totalSelections || 0) > (asyncStorageData.totalSelections || 0))) {
                  asyncStorageKey = key;
                  asyncStorageData = parsed;
                  console.log(`✅ [ensureUser] 더 유효한 데이터 발견: ${key} (totalSelections: ${parsed.totalSelections})`);
                }
              }
            } catch (e) {
              console.warn(`⚠️ [ensureUser] ${key} 파싱 실패:`, e);
            }
          }
        }
        
        if (asyncStorageData) {
          console.log(`✅ [ensureUser] AsyncStorage에서 유효한 데이터 발견: ${asyncStorageKey}`);
          console.log(`📊 [ensureUser] AsyncStorage 데이터:`, {
            nickname: asyncStorageData.nickname,
            points: asyncStorageData.points,
            streakCount: asyncStorageData.streakCount,
            totalSelections: asyncStorageData.totalSelections,
          });
        } else {
          console.log(`⚠️ [ensureUser] AsyncStorage에서 유효한 데이터를 찾지 못했습니다. (${userDataKeys.length}개 키 검색 완료)`);
        }
      } else {
        asyncStorageData = JSON.parse(asyncDataJSON);
        asyncStorageKey = currentDeviceKey;
        console.log(`✅ [ensureUser] AsyncStorage에서 데이터 발견 (현재 deviceUID): ${asyncStorageKey}`);
        console.log(`📊 [ensureUser] AsyncStorage 데이터:`, {
          nickname: asyncStorageData.nickname,
          points: asyncStorageData.points,
          streakCount: asyncStorageData.streakCount,
          totalSelections: asyncStorageData.totalSelections,
        });
      }
    } catch (error) {
      console.error('❌ [ensureUser] AsyncStorage 검색 실패:', error);
    }

    // 0-1. 이전 Firebase UID로 기존 사용자 찾기 (앱 업데이트 시 가장 확실한 방법)
    const previousUID = await getPreviousUID();
    let existingUserByPreviousUID: { doc: any; data: UserData; uid: string } | null = null;
    
    console.log(`🔍 [ensureUser] previousFirebaseUID 확인:`, previousUID ? `발견됨 (${previousUID})` : '없음');
    console.log(`🔍 [ensureUser] 현재 Firebase UID:`, uid);
    
    if (previousUID) {
      if (previousUID !== uid) {
        console.log(`🔍 [ensureUser] 이전 Firebase UID 발견: ${previousUID}, 현재 UID: ${uid} (다름 - 복구 필요)`);
        try {
          const previousUserDoc = await firestore().collection('users').doc(previousUID).get();
          if (previousUserDoc.exists) {
            const previousUserData = previousUserDoc.data() as UserData;
            console.log(`✅ [ensureUser] 이전 UID로 기존 사용자 발견: ${previousUID}`);
            console.log(`📊 [ensureUser] 이전 사용자 데이터:`, {
              nickname: previousUserData.nickname,
              points: previousUserData.points,
              streakCount: previousUserData.streakCount,
              totalSelections: previousUserData.totalSelections,
            });
            existingUserByPreviousUID = {
              doc: previousUserDoc,
              data: previousUserData,
              uid: previousUID,
            };
          } else {
            console.log(`ℹ️ [ensureUser] 이전 UID로 문서를 찾지 못했습니다: ${previousUID}`);
          }
        } catch (error: any) {
          console.error('❌ [ensureUser] 이전 UID 쿼리 실패:', error?.code || error?.message);
        }
      } else {
        console.log(`ℹ️ [ensureUser] 이전 UID와 현재 UID가 동일함 (${previousUID}). 복구 불필요.`);
        
        // 이전 UID와 현재 UID가 같지만, Firestore에 문서가 없으면 다른 방법으로 검색 시도
        // (V2 버전에서 previousFirebaseUID를 저장하지 않았을 수 있음)
        if (!userDocExists) {
          console.log(`🔍 [ensureUser] 현재 UID로 문서가 없지만 previousFirebaseUID와 같음. 다른 방법으로 검색 시도...`);
          // 아래 복구 로직에서 처리
        }
      }
    } else {
      console.log(`⚠️ [ensureUser] previousFirebaseUID가 없습니다. 이전 버전 앱에서 저장되지 않았을 수 있습니다.`);
    }

    // 0-1. deviceUID로 기존 사용자 찾기 (앱 업데이트 시 UID가 변경되었을 수 있음)
    let existingUserByDeviceUID: { doc: any; data: UserData; uid: string } | null = null;
    try {
      const existingUsersQuery = await firestore()
        .collection('users')
        .where('deviceUID', '==', deviceUID)
        .get();
      
      if (!existingUsersQuery.empty) {
        // 여러 문서가 있으면 가장 최근 문서 선택 (createdAt 기준)
        let latestDoc = existingUsersQuery.docs[0];
        let latestCreatedAt = latestDoc.data().createdAt;
        
        if (existingUsersQuery.size > 1) {
          console.log(`⚠️ [ensureUser] 같은 deviceUID로 ${existingUsersQuery.size}개의 문서가 발견됨. 가장 최근 문서를 선택합니다.`);
          
          for (const docItem of existingUsersQuery.docs) {
            const docData = docItem.data();
            const docCreatedAt = docData.createdAt;
            
            // createdAt 비교 (Timestamp 또는 Date)
            const docTime = docCreatedAt && typeof (docCreatedAt as any).toDate === 'function' 
              ? (docCreatedAt as FirebaseFirestoreTypes.Timestamp).toDate().getTime()
              : docCreatedAt instanceof Date 
                ? docCreatedAt.getTime()
                : new Date(docCreatedAt).getTime();
            
            const latestTime = latestCreatedAt && typeof (latestCreatedAt as any).toDate === 'function'
              ? (latestCreatedAt as FirebaseFirestoreTypes.Timestamp).toDate().getTime()
              : latestCreatedAt instanceof Date
                ? latestCreatedAt.getTime()
                : new Date(latestCreatedAt).getTime();
            
            if (docTime > latestTime) {
              latestDoc = docItem;
              latestCreatedAt = docCreatedAt;
            }
          }
        }
        
        const existingUID = latestDoc.id;
        // 현재 UID와 다를 때만 복구 대상으로 간주
        if (existingUID !== uid) {
          existingUserByDeviceUID = {
            doc: latestDoc,
            data: latestDoc.data() as UserData,
            uid: existingUID,
          };
          console.log(`🔍 [ensureUser] deviceUID로 기존 사용자 발견 (${existingUID}), 현재 UID(${uid})와 다름. 복구 필요.`);
        }
      }
    } catch (queryError: any) {
      console.error('❌ [ensureUser] deviceUID 쿼리 실패 (무시하고 계속):', queryError?.code || queryError?.message);
    }

    // Firestore에 데이터가 없거나 새 유저 데이터인 경우 복구 시도
    // 1. AsyncStorage에 유효한 데이터가 있으면 → 최우선 복구 (같은 기기라면 업데이트 후에도 유지됨)
    // SDK 53 → SDK 52 다운그레이드로 인해 Firebase Anonymous Auth가 새로운 UID를 생성했을 수 있음
    // 하지만 AsyncStorage는 유지되므로 복구 가능
    if (asyncStorageData && (asyncStorageData.totalSelections > 0 || asyncStorageData.points > 0 || asyncStorageData.streakCount > 0)) {
      console.log('🔄 [Recovery] AsyncStorage에서 기존 사용자 데이터 발견. 무조건 복구 실행.');
      console.log(`📊 [Recovery] AsyncStorage 키: ${asyncStorageKey}`);
      console.log(`📊 [Recovery] 복구할 데이터:`, {
        nickname: asyncStorageData.nickname,
        points: asyncStorageData.points,
        streakCount: asyncStorageData.streakCount,
        totalSelections: asyncStorageData.totalSelections,
      });
      // 복구 로직으로 진행 (아래 2번으로)
    } else if (asyncStorageData) {
      console.log('⚠️ [Recovery] AsyncStorage에 데이터가 있지만 모든 값이 0입니다. 새 유저 데이터로 간주합니다.');
    } else if (existingUserByPreviousUID) {
      // 1-1. 이전 UID로 찾은 기존 사용자가 있으면 → 복구 (가장 확실한 방법)
      console.log('🔄 [Recovery] 이전 Firebase UID로 기존 사용자 발견. 복구 실행.');
      console.log(`📊 [Recovery] 이전 사용자 UID: ${existingUserByPreviousUID.uid}, 현재 UID: ${uid}`);
      // 복구 로직으로 진행 (아래 2번으로)
    } else if (existingUserByDeviceUID) {
      // 1-2. deviceUID로 찾은 기존 사용자가 있고, 현재 UID와 다르면 → 복구
      console.log('🔄 [Recovery] deviceUID로 기존 사용자 발견. 복구 실행.');
      console.log(`📊 [Recovery] 기존 사용자 UID: ${existingUserByDeviceUID.uid}, 현재 UID: ${uid}`);
      // 복구 로직으로 진행 (아래 2번으로)
    } else {
      console.log('⚠️ [Recovery] AsyncStorage에서 유효한 데이터를 찾지 못했습니다.');
      console.log('⚠️ [Recovery] SDK 53 → SDK 52 다운그레이드로 인해 Firebase Anonymous Auth가 새로운 UID를 생성했을 수 있습니다.');
      console.log('⚠️ [Recovery] AsyncStorage에 기존 데이터가 없다면 복구가 불가능할 수 있습니다.');
    }
    // 1-3. Firestore에 이미 데이터가 있고, deviceUID로 기존 사용자를 찾지 못한 경우 (이미 위에서 처리됨)
    else if (false) {
      const data = doc.data() as UserData;
      console.log('✅ [V2] Firestore에서 사용자 데이터 확인:', uid);
      console.log('📊 [V2] Firestore 데이터 내용:', {
        nickname: data.nickname,
        points: data.points,
        streakCount: data.streakCount,
        totalSelections: data.totalSelections,
        deviceUID: data.deviceUID || '없음',
      });
      
      // V2 마이그레이션 사용자 확인: deviceUID가 없고, 데이터가 신규 사용자처럼 보이면 AsyncStorage 확인
      if (!data.deviceUID && (data.points === 0 && data.streakCount === 0 && data.totalSelections === 0)) {
        console.log('⚠️ [V2] deviceUID가 없고 데이터가 신규 사용자처럼 보임. AsyncStorage 확인 중...');
        try {
          const allKeys = await AsyncStorage.getAllKeys();
          const userDataKeys = allKeys.filter(key => key.startsWith('userData_'));
          if (userDataKeys.length > 0) {
            console.log(`⚠️ [V2] AsyncStorage에 ${userDataKeys.length}개의 userData_ 키 발견. 복구 로직으로 진행...`);
            // 복구 로직으로 진행 (아래 2번으로)
          } else {
            // AsyncStorage에도 없으면 정상적인 신규 사용자
            console.log('✅ [V2] AsyncStorage에도 데이터 없음. 정상적인 신규 사용자로 처리.');
            await userRef.update({
              deviceUID: deviceUID,
            } as any);
            const updatedData = { ...data, deviceUID };
            if (data.createdAt && (data.createdAt as FirebaseFirestoreTypes.Timestamp).toDate) {
              return { ...updatedData, createdAt: (data.createdAt as FirebaseFirestoreTypes.Timestamp).toDate() };
            }
            return updatedData;
          }
        } catch (e) {
          console.error('❌ [V2] AsyncStorage 확인 실패:', e);
          // 실패해도 기존 데이터 반환
        }
      } else {
        // deviceUID가 있거나, 데이터가 있는 경우 정상 처리
        if (!data.deviceUID) {
          console.log('🔄 [Migration] 기존 사용자 문서에 deviceUID가 없음. 추가 중...');
          try {
            await userRef.update({
              deviceUID: deviceUID,
            } as any);
            console.log('✅ [Migration] deviceUID 추가 완료:', deviceUID);
            const updatedData = { ...data, deviceUID };
            if (data.createdAt && (data.createdAt as FirebaseFirestoreTypes.Timestamp).toDate) {
              return { ...updatedData, createdAt: (data.createdAt as FirebaseFirestoreTypes.Timestamp).toDate() };
            }
            return updatedData;
          } catch (updateError: any) {
            console.error('❌ [Migration] deviceUID 추가 실패:', updateError);
          }
        }
        
        // Firestore Timestamp를 JS Date 객체로 변환
        if (data.createdAt && (data.createdAt as FirebaseFirestoreTypes.Timestamp).toDate) {
          return { ...data, createdAt: (data.createdAt as FirebaseFirestoreTypes.Timestamp).toDate() };
        }
        return data;
      }
    }

    // 2. Firestore에 데이터가 없거나, 기존 사용자가 있는 경우: 복구 시도
    console.log('⚠️ [ensureUser] 복구 시도 시작...');
    console.log('⚠️ [ensureUser] 현재 Firebase UID:', uid);
    console.log('⚠️ [ensureUser] 현재 deviceUID:', deviceUID);
    
    // 2-1. AsyncStorage 데이터 사용 (이미 위에서 검색함)
    let legacyData: any = asyncStorageData;
    let legacyDataKey: string | null = asyncStorageKey;
    
    // 위에서 찾지 못했으면 다시 검색 시도
    if (!legacyData) {
      console.log('🔍 [Recovery] AsyncStorage에서 기존 데이터 재검색 시작...');
      try {
        // 먼저 현재 deviceUID로 시도
        legacyDataKey = `userData_${deviceUID}`;
        let legacyDataJSON = await AsyncStorage.getItem(legacyDataKey);
        
        // 현재 deviceUID로 찾지 못하면 모든 userData_ 키 검색
        if (!legacyDataJSON) {
          console.log('🔍 [Recovery] 현재 deviceUID로 데이터를 찾지 못함, 모든 userData_ 키 검색 중...');
          try {
            const allKeys = await AsyncStorage.getAllKeys();
            const userDataKeys = allKeys.filter(key => key.startsWith('userData_'));
            console.log(`🔍 [Recovery] 발견된 userData_ 키: ${userDataKeys.length}개`);
            
            // 가장 최신 데이터 찾기 (totalSelections가 가장 큰 것 선택)
            for (const key of userDataKeys) {
              const data = await AsyncStorage.getItem(key);
              if (data) {
                try {
                  const parsed = JSON.parse(data);
                  // 유효한 데이터인지 확인 (points, nickname 등이 있는지)
                  if (parsed && (parsed.points !== undefined || parsed.nickname || parsed.totalSelections !== undefined)) {
                    // totalSelections가 있는 데이터를 우선 선택
                    if (!legacyData || (parsed.totalSelections || 0) > (legacyData.totalSelections || 0)) {
                      legacyDataKey = key;
                      legacyData = parsed;
                    }
                  }
                } catch (e) {
                  console.warn(`⚠️ [Recovery] ${key} 파싱 실패:`, e);
                }
              }
            }
            
            if (legacyData) {
              console.log(`✅ [Recovery] AsyncStorage에서 유효한 데이터 발견: ${legacyDataKey}`);
              console.log(`📊 [Recovery] AsyncStorage 데이터:`, {
                nickname: legacyData.nickname,
                points: legacyData.points,
                streakCount: legacyData.streakCount,
                totalSelections: legacyData.totalSelections,
              });
            }
          } catch (error) {
            console.error('❌ [Recovery] AsyncStorage 키 검색 실패:', error);
          }
        } else {
          legacyData = JSON.parse(legacyDataJSON);
          console.log(`✅ [Recovery] AsyncStorage에서 데이터 발견 (현재 deviceUID): ${legacyDataKey}`);
          console.log(`📊 [Recovery] AsyncStorage 데이터:`, {
            nickname: legacyData.nickname,
            points: legacyData.points,
            streakCount: legacyData.streakCount,
            totalSelections: legacyData.totalSelections,
          });
        }
      } catch (error) {
        console.error('❌ [Recovery] AsyncStorage 검색 실패:', error);
      }
    } else {
      console.log('✅ [Recovery] 위에서 찾은 AsyncStorage 데이터 재사용');
    }
    
    // 2-2. Firestore에서 기존 사용자 찾기 (이전 UID 우선, deviceUID 다음)
    let firestoreUserData: UserData | null = null;
    let firestoreExistingUID: string | null = null;
    
    if (existingUserByPreviousUID) {
      // 이전 UID로 찾은 사용자 우선 사용 (가장 확실한 방법)
      firestoreUserData = existingUserByPreviousUID.data;
      firestoreExistingUID = existingUserByPreviousUID.uid;
      console.log(`✅ [Recovery] 이전 Firebase UID로 기존 사용자 발견 (${firestoreExistingUID}) - 최우선 사용`);
      console.log(`📊 [Recovery] Firestore 데이터:`, {
        nickname: firestoreUserData.nickname,
        points: firestoreUserData.points,
        streakCount: firestoreUserData.streakCount,
        totalSelections: firestoreUserData.totalSelections,
        deviceUID: firestoreUserData.deviceUID || '없음',
      });
    } else if (existingUserByDeviceUID) {
      // deviceUID로 찾은 기존 사용자 사용
      firestoreUserData = existingUserByDeviceUID.data;
      firestoreExistingUID = existingUserByDeviceUID.uid;
      console.log(`✅ [Recovery] Firestore에서 기존 사용자 발견 (${firestoreExistingUID}) - deviceUID로 찾은 데이터 사용`);
      console.log(`📊 [Recovery] Firestore 데이터:`, {
        nickname: firestoreUserData.nickname,
        points: firestoreUserData.points,
        streakCount: firestoreUserData.streakCount,
        totalSelections: firestoreUserData.totalSelections,
        deviceUID: firestoreUserData.deviceUID,
      });
    } else {
      // 위에서 찾지 못했으면 다시 쿼리 (혹시 모를 경우를 대비)
      console.log('🔍 [Recovery] Firestore에서 deviceUID로 기존 사용자 찾기 시도:', deviceUID);
      try {
        const existingUsersQuery = await firestore()
          .collection('users')
          .where('deviceUID', '==', deviceUID)
          .get();
        
        if (!existingUsersQuery.empty) {
          // 여러 문서가 있으면 가장 최근 문서 선택 (createdAt 기준)
          let latestDoc = existingUsersQuery.docs[0];
          let latestCreatedAt = latestDoc.data().createdAt;
          
          if (existingUsersQuery.size > 1) {
            console.warn(`⚠️ [Recovery] 같은 deviceUID로 ${existingUsersQuery.size}개의 문서가 발견됨. 가장 최근 문서를 선택합니다.`);
            
            for (const doc of existingUsersQuery.docs) {
              const docData = doc.data();
              const docCreatedAt = docData.createdAt;
              
              // createdAt 비교 (Timestamp 또는 Date)
              const docTime = docCreatedAt && typeof (docCreatedAt as any).toDate === 'function' 
                ? (docCreatedAt as FirebaseFirestoreTypes.Timestamp).toDate().getTime()
                : docCreatedAt instanceof Date 
                  ? docCreatedAt.getTime()
                  : new Date(docCreatedAt).getTime();
              
              const latestTime = latestCreatedAt && typeof (latestCreatedAt as any).toDate === 'function'
                ? (latestCreatedAt as FirebaseFirestoreTypes.Timestamp).toDate().getTime()
                : latestCreatedAt instanceof Date
                  ? latestCreatedAt.getTime()
                  : new Date(latestCreatedAt).getTime();
              
              if (docTime > latestTime) {
                latestDoc = doc;
                latestCreatedAt = docCreatedAt;
              }
            }
          }
          
          firestoreUserData = latestDoc.data() as UserData;
          firestoreExistingUID = latestDoc.id;
          
          console.log(`✅ [Recovery] Firestore에서 기존 사용자 발견 (${firestoreExistingUID})`);
          console.log(`📊 [Recovery] Firestore 데이터:`, {
            nickname: firestoreUserData.nickname,
            points: firestoreUserData.points,
            streakCount: firestoreUserData.streakCount,
            totalSelections: firestoreUserData.totalSelections,
            deviceUID: firestoreUserData.deviceUID,
          });
        } else {
          console.log('ℹ️ [Recovery] Firestore에서 deviceUID로 기존 사용자를 찾지 못했습니다.');
          console.log(`ℹ️ [Recovery] 이전 버전 사용자는 deviceUID가 없어서 Firestore에서 찾을 수 없을 수 있음`);
          
          // deviceUID로 찾지 못했고, AsyncStorage 데이터도 없으면 복구 불가
          // (닉네임 검색이나 활동이 있는 사용자 검색은 소용없음 - 기존 닉네임을 모르거나, 어떤 사용자가 이 기기의 사용자인지 알 수 없음)
          if (!firestoreUserData && !legacyData) {
            console.log(`ℹ️ [Recovery] deviceUID로 기존 사용자를 찾지 못했고, AsyncStorage 데이터도 없습니다.`);
            console.log(`ℹ️ [Recovery] 이 경우 복구가 불가능할 수 있습니다.`);
          }
        }
      } catch (queryError: any) {
        console.error('❌ [Recovery] Firestore deviceUID 쿼리 실패:', queryError);
        console.error('❌ [Recovery] 에러 코드:', queryError?.code);
        console.error('❌ [Recovery] 에러 메시지:', queryError?.message);
      }
    }
    
    // 2-3. AsyncStorage와 Firestore 데이터 비교 및 병합
    // 우선순위: 더 최신 데이터 (totalSelections 또는 lastAnswerDate 기준)
    if (legacyData || firestoreUserData) {
      console.log('🔄 [Recovery] 기존 데이터 발견, 비교 및 병합 시작...');
      
      // 두 데이터를 비교해서 더 최신 것을 선택
      let mergedData: any;
      let sourceType: string;
      
      if (legacyData && firestoreUserData) {
        // 두 데이터가 모두 있으면 비교
        const legacyTotalSelections = Number(legacyData.totalSelections || 0);
        const firestoreTotalSelections = Number(firestoreUserData.totalSelections || 0);
        
        // lastAnswerDate 비교 (더 최근 것이 더 최신)
        const parseDateKey = (val: any): number => {
          if (!val) return 0;
          if (typeof val === 'number') return val;
          if (typeof val === 'string' && val.includes('-')) {
            return parseInt(val.replace(/-/g, ''), 10);
          }
          return 0;
        };
        
        const legacyLastDate = parseDateKey(legacyData.lastAnswerDate);
        const firestoreLastDate = parseDateKey(firestoreUserData.lastAnswerDate);
        
        // totalSelections가 더 많거나, 같으면 lastAnswerDate가 더 최근인 것을 선택
        const useFirestore = firestoreTotalSelections > legacyTotalSelections || 
                            (firestoreTotalSelections === legacyTotalSelections && firestoreLastDate > legacyLastDate);
        
        if (useFirestore) {
          console.log('📊 [Recovery] Firestore 데이터가 더 최신입니다. (totalSelections:', firestoreTotalSelections, 'vs', legacyTotalSelections, ')');
          sourceType = 'Firestore (더 최신)';
          mergedData = firestoreUserData;
        } else {
          console.log('📊 [Recovery] AsyncStorage 데이터가 더 최신입니다. (totalSelections:', legacyTotalSelections, 'vs', firestoreTotalSelections, ')');
          sourceType = 'AsyncStorage (더 최신)';
          mergedData = legacyData;
        }
        
        // 두 데이터를 병합 (선택된 데이터를 기본으로, 다른 데이터에서 누락된 필드 보완)
        mergedData = {
          nickname: mergedData.nickname || (useFirestore ? legacyData.nickname : firestoreUserData.nickname),
          points: mergedData.points !== undefined ? mergedData.points : (useFirestore ? legacyData.points : firestoreUserData.points),
          streakCount: mergedData.streakCount !== undefined ? mergedData.streakCount : (useFirestore ? legacyData.streakCount : firestoreUserData.streakCount),
          totalSelections: mergedData.totalSelections !== undefined ? mergedData.totalSelections : (useFirestore ? legacyData.totalSelections : firestoreUserData.totalSelections),
          lastAnswerDate: mergedData.lastAnswerDate || (useFirestore ? legacyData.lastAnswerDate : firestoreUserData.lastAnswerDate),
          createdAt: mergedData.createdAt || (useFirestore ? 
            (legacyData.createdAt ? (typeof legacyData.createdAt === 'string' || typeof legacyData.createdAt === 'number' ? legacyData.createdAt : legacyData.createdAt) : null) :
            (firestoreUserData.createdAt && typeof (firestoreUserData.createdAt as any).toDate === 'function' 
              ? (firestoreUserData.createdAt as FirebaseFirestoreTypes.Timestamp).toDate() 
              : firestoreUserData.createdAt)),
          characterId: mergedData.characterId || (useFirestore ? legacyData.characterId : firestoreUserData.characterId),
          adjective1: mergedData.adjective1 || (useFirestore ? legacyData.adjective1 : firestoreUserData.adjective1),
          adjective2: mergedData.adjective2 || (useFirestore ? legacyData.adjective2 : firestoreUserData.adjective2),
          tutorial: mergedData.tutorial || (useFirestore ? legacyData.tutorial : firestoreUserData.tutorial),
        };
      } else {
        // 하나만 있으면 그것을 사용
        mergedData = legacyData || firestoreUserData;
        sourceType = legacyData ? 'AsyncStorage' : 'Firestore';
      }
      
      console.log(`📊 [Recovery] ${sourceType} 데이터를 사용하여 복구합니다.`);
      
      // createdAt 백필 알고리즘 (기존 Day 진행 상태 보존)
      const parseDateKeyToDate = (val: any): Date | null => {
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
          const [y, m, d] = val.split('-').map((x: string) => parseInt(x, 10));
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
    };

      const computeCreatedAtFromProgress = (data: any): Date | null => {
      const totalSelections = Number(data.totalSelections || 0);
      const lastAns = data.lastAnswerDate;
      const lastDate = parseDateKeyToDate(
        typeof lastAns === 'string' && lastAns.includes('-') ? lastAns :
        typeof lastAns === 'number' ? lastAns : null
      );
      if (!lastDate || !totalSelections || totalSelections < 1) return null;
      const base = new Date(lastDate.getTime());
      base.setUTCHours(0,0,0,0);
      const day1 = new Date(base.getTime() - (totalSelections - 1) * 24 * 60 * 60 * 1000);
      return day1;
    };

      const backfilledCreatedAt: Date | null = mergedData.createdAt 
      ? (typeof mergedData.createdAt === 'string' || typeof mergedData.createdAt === 'number' 
          ? parseDateKeyToDate(mergedData.createdAt) 
          : mergedData.createdAt instanceof Date 
            ? mergedData.createdAt 
            : typeof (mergedData.createdAt as any).toDate === 'function'
              ? (mergedData.createdAt as FirebaseFirestoreTypes.Timestamp).toDate()
              : new Date(mergedData.createdAt))
      : computeCreatedAtFromProgress(mergedData);

      // V2 데이터 구조에 맞게 변환
      // points와 streakCount는 undefined가 아닌 경우에만 사용 (0도 유효한 값)
      const recoveredUserData = {
      uid,
      deviceUID, // deviceUID 저장 (앱 재설치 시 복구용)
      points: mergedData.points !== undefined ? mergedData.points : 0,
      streakCount: mergedData.streakCount !== undefined ? mergedData.streakCount : 0,
      lastAnswerDate: typeof mergedData.lastAnswerDate === 'string' && mergedData.lastAnswerDate.includes('-') ? 
                        parseInt(mergedData.lastAnswerDate.replace(/-/g, ''), 10) : 
                        (mergedData.lastAnswerDate !== undefined ? mergedData.lastAnswerDate : 0),
      nickname: mergedData.nickname || generateRandomNickname(),
      totalSelections: mergedData.totalSelections !== undefined ? mergedData.totalSelections : 0,
      createdAt: backfilledCreatedAt ?? firestore.FieldValue.serverTimestamp(),
      characterId: mergedData.characterId || null,
      adjective1: mergedData.adjective1 || null,
      adjective2: mergedData.adjective2 || null,
      tutorial: mergedData.tutorial || {
        mainAnswered: false,
        livepickParticipated: false,
        livepickCreated: false,
        rewardGiven500: false,
      },
    };
    
    // 복구된 데이터 로깅 (중요 필드 확인)
    console.log('✅ [Recovery] 복구된 사용자 데이터:', {
      nickname: recoveredUserData.nickname,
      points: recoveredUserData.points,
      streakCount: recoveredUserData.streakCount,
      totalSelections: recoveredUserData.totalSelections,
      lastAnswerDate: recoveredUserData.lastAnswerDate,
      deviceUID: recoveredUserData.deviceUID,
    });

      await userRef.set(recoveredUserData as any);
      
      // Firestore에서 찾은 기존 문서가 있으면 참조용으로 업데이트
      if (firestoreExistingUID && firestoreExistingUID !== uid) {
        try {
          await firestore().collection('users').doc(firestoreExistingUID).update({
            recoveredToUID: uid,
            recoveredAt: firestore.FieldValue.serverTimestamp(),
          } as any);
          console.log(`✅ [Recovery] 기존 Firestore 문서(${firestoreExistingUID})에 복구 정보 추가`);
        } catch (e) {
          console.warn(`⚠️ [Recovery] 기존 Firestore 문서 업데이트 실패 (무시):`, e);
        }
      }
      
      console.log('✅ [Recovery] 사용자 데이터 복구 완료:', uid);
      console.log(`📊 [Recovery] 복구된 데이터:`, {
        nickname: recoveredUserData.nickname,
        points: recoveredUserData.points,
        streakCount: recoveredUserData.streakCount,
        totalSelections: recoveredUserData.totalSelections,
      });
      
      return {
        ...recoveredUserData,
        createdAt: backfilledCreatedAt ?? new Date(),
      } as UserData;
    }

    // 3. 마이그레이션할 데이터도 없는 경우: 신규 사용자 생성
    console.log('❌ [ensureUser] 모든 복구 시도 실패 - 신규 사용자 생성');
    console.log('❌ [ensureUser] 복구 실패 원인 요약:');
    console.log('   - Firestore에 현재 UID로 문서 없음');
    console.log('   - deviceUID로 기존 사용자 찾기 실패');
    console.log('   - AsyncStorage 마이그레이션 실패');
      console.log('❌ [ensureUser] 신규 사용자 생성 시작 - Firebase UID:', uid);
      // deviceUID는 이미 91번 줄에서 선언되었으므로 재사용
      console.log('❌ [ensureUser] 신규 사용자 deviceUID:', deviceUID);
      const newUserData = {
    uid,
    deviceUID, // deviceUID 저장 (앱 재설치 시 복구용)
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

      await userRef.set(newUserData);
      
      return {
        ...newUserData,
        createdAt: new Date(), // JS Date 객체로 변환하여 반환
      } as UserData;
  } catch (error: any) {
    console.error('❌ [ensureUser] 전체 프로세스 실패:', error);
    console.error('❌ [ensureUser] 에러 코드:', error?.code);
    console.error('❌ [ensureUser] 에러 메시지:', error?.message);
    // 에러 발생 시에도 최소한의 사용자 데이터 반환
    const fallbackDeviceUID = await getDeviceUID();
    const fallbackUserData = {
      uid,
      deviceUID: fallbackDeviceUID,
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
    return fallbackUserData as UserData;
  }
};

/**
 * [신규] 사용자의 앱 최초 실행일(createdAt)을 기준으로 오늘에 해당하는 순차 질문을 반환합니다.
 * @param userData 사용자 데이터 객체
 * @returns 오늘의 질문 객체 또는 null
 */
export const getTodayQuestionForUser = (userData: UserData): Question | null => {
  // 테스트 유저는 totalSelections 기반으로 연속 질문 배정
  const TEST_UIDS = ['vUlyeAhYmneB5Ii6oPNR8OFCQZg1', 'C1iSsR85GoTnvVRSY2nIn9y6ZFz1'];
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
    // 보장: 인증 토큰 포함되어 호출되도록 익명 인증 확보
    const user = await ensureAnonymousAuth();
    
    if (!user) {
      console.warn('[AI] 사용자 인증 실패 - 빈 태그 반환');
      return [];
    }
    
    console.log(`[AI] 인증된 사용자: ${user.uid}`);
    
    // 약간의 딜레이를 주어 토큰이 전파되도록 함
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 서울 리전에 배포된 Callable 함수 URL로 직접 호출
    const functions = functionsModule();
    const generateTags = functions.httpsCallableFromUrl(
      'https://asia-northeast3-today-balance-fa0a5.cloudfunctions.net/generateTags'
    );
    const result = await generateTags({
      questionId: question.question_id,
      selectedText: selectedOptionText,
      questionDomain: question.domain,
    });
    const tags = (result.data as any).tags;
    if (!Array.isArray(tags)) {
      throw new Error("Cloud Function 응답 형식이 올바르지 않습니다.");
    }

    console.log(`[AI] 태그 생성 완료: [${tags.join(', ')}]`);
    return tags;
  } catch (error) {
    console.error("❌ Cloud Function 호출 실패:", error);
    
    // AI 실패 시 폴백 태그 제공 (도메인별)
    let tags: string[] = [];
    
    if (question.domain === '감정' || question.domain === '가치관') {
      // 감정/가치관 도메인 폴백
      const emotionFallbackTags = ['뜨거운', '차가운', '유연한', '예민한', '느긋한', '충동적인', '냉정한', '감성적인'];
      const randomIndex = selectedOptionText.length % emotionFallbackTags.length;
      tags = [emotionFallbackTags[randomIndex]];
    } else if (question.domain === '습관' || question.domain === '관계') {
      // 습관/관계 도메인 폴백
      const habitFallbackTags = ['전략가', '탐험가', '중재자', '창조자', '분석가', '수호자', '설득가', '통찰자', '협상가', '봉사가', '연구가', '추진가', '활동가', '행동가', '인내가', '관찰자', '통솔가', '보호자'];
      const randomIndex = selectedOptionText.length % habitFallbackTags.length;
      tags = [habitFallbackTags[randomIndex]];
    }
    
    console.warn("🔄 AI 실패로 인한 폴백 태그 사용:", tags);
    return tags;
  }
};


/**
 * [V2] 사용자의 답변을 저장하고, 연속 참여일수 업데이트 및 캐릭터 로직을 처리합니다.
 * @throws "오늘 이미 답변했습니다." - 중복 답변 시 에러 발생
 */
export const saveAnswerAndProcessLogic = async (userData: UserData, question: Question, selectedOptionIndex: 0 | 1): Promise<UserData> => {
  const todayKey = currentDateKey();
  
  // 테스트 유저는 하루 한 번 제한 없음
  const TEST_UIDS = ['vUlyeAhYmneB5Ii6oPNR8OFCQZg1', 'C1iSsR85GoTnvVRSY2nIn9y6ZFz1'];
  if (!TEST_UIDS.includes(userData.uid) && userData.lastAnswerDate === todayKey) {
    console.warn(`[Vote] User ${userData.uid} has already voted today. Aborting.`);
    throw new Error("오늘 이미 답변했습니다.");
  }

  const { uid } = userData;
  const userRef = firestore().collection('users').doc(uid);
  const selectedOptionText = selectedOptionIndex === 0 ? question.option_1_text : question.option_2_text;

  // --- 1. AI 태그 생성 & 답변 저장 (고유 ID 사용) ---
  const generatedTags = await generateTagsWithAI(question, selectedOptionText);
  
  // 문서 ID: '{uid}_{questionId}' 고정
  const docId = `${uid}_${question.question_id}`;
  const answerRef = firestore().collection('answers').doc(docId);
  
  const answerData = {
    uid,
    question_id: question.question_id,
    selected_option_index: selectedOptionIndex,
    selected_option_text: selectedOptionText,
    tags: generatedTags,
    rewarded: false,
    answeredAt: firestore.FieldValue.serverTimestamp(),
  };
  
  console.log(`[Debug] 저장하려는 데이터:`, {
    docId: `${uid}_${question.question_id}`,
    uid: uid,
    question_id: question.question_id,
    answerData: answerData
  });
  
  await answerRef.set(answerData);
  console.log(`[Logic] 답변 저장 완료: Doc ID = ${uid}_${question.question_id}`);
  
  console.log(`[Debug] 현재 사용자 상태:`, {
    uid: userData.uid,
    totalSelections: userData.totalSelections,
    characterId: userData.characterId,
    adjective1: userData.adjective1,
    adjective2: userData.adjective2
  });

  // 공개 집계용 votes 기록은 더 이상 사용하지 않습니다(경고 제거 및 단일 집계 경로 유지)

  // --- 2. 연속 참여일수, 누적 답변 수 업데이트 (Transaction) ---
  let updatedTotalSelections: number = (userData.totalSelections || 0) + 1;
  let updatedUserData: UserData = { ...userData };

  try {
    await firestore().runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw "User does not exist!";
      }
      const currentUserData = userDoc.data() as UserData;

      // 테스트 유저는 연속 참여일수 계산 단순화
      let newStreakCount = 1;
      if (TEST_UIDS.includes(uid)) {
        // 테스트 유저는 항상 연속 참여로 처리
        newStreakCount = (currentUserData.streakCount || 0) + 1;
        console.log(`[Streak] 테스트 유저 연속 참여: ${currentUserData.streakCount} → ${newStreakCount}`);
      } else {
        // 일반 유저는 기존 로직 유지
        const kstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
        const yesterdayKST = new Date(kstNow.getTime());
        yesterdayKST.setUTCDate(kstNow.getUTCDate() - 1);
        const year = yesterdayKST.getUTCFullYear();
        const month = String(yesterdayKST.getUTCMonth() + 1).padStart(2, '0');
        const day = String(yesterdayKST.getUTCDate()).padStart(2, '0');
        const yesterdayKey = parseInt(`${year}${month}${day}`, 10);

        // lastAnswerDate를 숫자로 변환 (문자열일 수 있음)
        const lastAnswerDateRaw: unknown = currentUserData.lastAnswerDate;
        let lastAnswerDateNum = 0;
        if (typeof lastAnswerDateRaw === 'string') {
          lastAnswerDateNum = parseInt(lastAnswerDateRaw.replace(/-/g, ''), 10);
        } else if (typeof lastAnswerDateRaw === 'number') {
          lastAnswerDateNum = lastAnswerDateRaw;
        }

        console.log(`[Streak] 연속 참여일수 계산:`, {
          todayKey: todayKey,
          yesterdayKey: yesterdayKey,
          lastAnswerDate: currentUserData.lastAnswerDate,
          lastAnswerDateNum: lastAnswerDateNum,
          currentStreakCount: currentUserData.streakCount,
          isYesterdayAnswered: lastAnswerDateNum === yesterdayKey,
          isTodayAnswered: lastAnswerDateNum === todayKey
        });

        // 오늘 이미 투표했는지 확인 (중복 방지)
        if (lastAnswerDateNum === todayKey) {
          // 오늘 이미 투표했으면 현재 streakCount 유지
          newStreakCount = currentUserData.streakCount || 1;
          console.log(`[Streak] 오늘 이미 투표함. 현재 streakCount 유지: ${newStreakCount}`);
        } else if (lastAnswerDateNum === yesterdayKey) {
          // 어제 투표했으면 연속 참여
          newStreakCount = (currentUserData.streakCount || 0) + 1;
          console.log(`[Streak] 연속 참여 감지: ${currentUserData.streakCount} → ${newStreakCount}`);
        } else if (lastAnswerDateNum === 0 || !currentUserData.lastAnswerDate) {
          // 첫 투표이거나 lastAnswerDate가 없으면 1일
          newStreakCount = 1;
          console.log(`[Streak] 첫 투표 또는 lastAnswerDate 없음: 1일로 설정`);
        } else {
          // 하루라도 건너뛰었으면 1일로 리셋
          newStreakCount = 1;
          console.log(`[Streak] 연속 참여 끊김: 1로 리셋 (lastAnswerDate: ${lastAnswerDateNum}, 어제: ${yesterdayKey})`);
        }
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
    
    console.log(`[Debug] 업데이트된 사용자 상태:`, {
      uid: updatedUserData!.uid,
      totalSelections: updatedUserData!.totalSelections,
      characterId: updatedUserData!.characterId,
      adjective1: updatedUserData!.adjective1,
      adjective2: updatedUserData!.adjective2,
      streakCount: updatedUserData!.streakCount
    });
    
    // 연속 참여 마일스톤 달성 시 푸시 알림 발송
    await scheduleStreakNotification(updatedUserData!.streakCount);
  } catch (error) {
    console.error("❌ 사용자 정보 업데이트 트랜잭션 실패:", error);
    throw error;
  }

  // --- 3. 포인트 보상은 광고 시청 후 별도로 지급 ---
  // (포인트 지급을 지연하여 광고 시청 완료 후 rewardWithMajority를 호출하도록 변경)
  console.log('[Points] 포인트 지급은 광고 시청 후 진행됩니다.');

  // --- 4. 누적 답변 수에 따라 로직 분기 ---
  console.log(`[Debug] 로직 분기 체크: totalSelections = ${updatedTotalSelections!}`);
  console.log(`[Debug] 현재 캐릭터 상태:`, {
    characterId: updatedUserData!.characterId,
    adjective1: updatedUserData!.adjective1,
    adjective2: updatedUserData!.adjective2,
    isLegacy: isLegacyUser(updatedUserData!)
  });
  
  if (updatedTotalSelections! >= 30 && !updatedUserData!.characterId) {
    console.log(`[Logic A] 🎯 누적 답변 ${updatedTotalSelections!}회 도달! 캐릭터 배정 로직을 실행합니다.`);
    console.log(`[Debug] Logic A 실행 전 사용자 상태:`, {
      characterId: updatedUserData!.characterId,
      adjective1: updatedUserData!.adjective1,
      adjective2: updatedUserData!.adjective2
    });
    
    try {
      updatedUserData = await assignCharacter_LogicA(updatedUserData!);
      console.log(`[Debug] Logic A 실행 후 사용자 상태:`, {
        characterId: updatedUserData.characterId,
        adjective1: updatedUserData.adjective1,
        adjective2: updatedUserData.adjective2
      });
  } catch (error) {
      console.error(`[Logic A] 실행 실패:`, error);
    }
  } else if (updatedTotalSelections! >= 60 && updatedTotalSelections! % 30 === 0) {
    console.log(`[Logic B] 🔄 누적 답변 ${updatedTotalSelections!}회 도달! 형용사 갱신 로직을 실행합니다.`);
    console.log(`[Debug] Logic B 실행 전 사용자 상태:`, {
      characterId: updatedUserData!.characterId,
      adjective1: updatedUserData!.adjective1,
      adjective2: updatedUserData!.adjective2
    });
    
    try {
      updatedUserData = await updateAdjectives_LogicB(updatedUserData!);
      console.log(`[Debug] Logic B 실행 후 사용자 상태:`, {
        characterId: updatedUserData.characterId,
        adjective1: updatedUserData.adjective1,
        adjective2: updatedUserData.adjective2
      });
    } catch (error) {
      console.error(`[Logic B] 실행 실패:`, error);
    }
    } else {
    console.log(`[Debug] 로직 실행 조건 미충족: totalSelections = ${updatedTotalSelections!}`);
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

/** [Logic B] 특정 구간의 답변을 분석하여 최빈값 형용사1, 2를 추출 - 개선된 버전 */
const analyzeAnswersForAdjectives = async (
  uid: string, 
  start: number, 
  end: number
): Promise<{ adj1: string | null, adj2: string | null }> => {
  console.log(`[Analyze] 분석 시작: uid=${uid}, start=${start}, end=${end}`);
  
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
  const adjectivesData = require('../../assets/data/adjectives_total.json');
  const validEmotionAdjectives = adjectivesData
    .filter((adj: any) => adj.domain === '감정' || adj.domain === '가치관')
    .map((adj: any) => adj.adjective);
  
  // adjective2용: 습관/관계 형용사 (adjectives_total2.json에서 동적으로 추출)
  // Logic B에서는 characters_19.json 절대 참조 금지
  const adjectivesData2 = require('../../assets/data/adjectives_total2.json');
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
        const adjectivesData = require('../../assets/data/adjectives_total.json');
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
    const adjectivesData = require('../../assets/data/adjectives_total.json');
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
    const adjectivesData = require('../../assets/data/adjectives_total.json');
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

// --- V1에서 가져와 V2에 맞게 수정/사용될 함수 ---

/**
 * Firestore 집계를 수행합니다. (기존 aggregate 함수 단순화)
 * @param questionId 질문 ID
 */
export const aggregate = async (questionId: string) => {
  const snapshot = await firestore().collection('answers').where('question_id', '==', questionId).get();
  let c0 = 0, c1 = 0;
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.selected_option_index === 0) c0++;
    else if (data.selected_option_index === 1) c1++;
  });
  const total = c0 + c1;
  const p0 = total ? Math.round((c0 / total) * 100) : 50;
  const p1 = 100 - p0;
  return { total, c0, c1, p0, p1 };
};

/**
 * [V2] 승패 보상 및 연속 참여 배수를 적용하여 포인트를 계산하고 지급합니다.
 * @param uid 사용자 ID
 * @param questionId 질문 ID
 * @param myOptionIndex 사용자의 선택
 * @param streakCount 현재 연속 참여일수
 * @returns 지급된 포인트 정보 { base, multiplier, totalPoints, myIsMajority, agg }
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
  
  const base = myIsMajority ? 5 : 10; // 다수: 5P, 소수: 10P
  
  // 연속 참여 배수 적용 (11일 이상: 2배, 31일 이상: 3배)
  const multiplier = streakCount >= 31 ? 3 : streakCount >= 11 ? 2 : 1;
  const totalPoints = base * multiplier;
  
  const majorityText = myIsMajority ? '다수' : '소수';
  const multiplierText = multiplier > 1 ? ` (${multiplier}배 적용)` : '';
  
  const userRef = firestore().collection('users').doc(uid);
  await userRef.update({
    points: firestore.FieldValue.increment(totalPoints)
  });

  // 포인트 내역 기록
  try {
    const description = `${majorityText} 선택 ${base}P${multiplierText}`;
    await recordPointHistory(uid, totalPoints, 'majority_reward', description);
  } catch (e) {
    console.warn('[Points] 포인트 내역 기록 실패(무시 가능):', (e as any)?.message || e);
  }

  // 오늘 보상 수령 완료 표시
  try {
    await firestore().collection('answers').doc(`${uid}_${questionId}`).update({ rewarded: true });
  } catch (e) {
    console.warn('[Answer] rewarded 플래그 업데이트 실패(무시 가능):', (e as any)?.message || e);
  }
  
  console.log(`[Points] 포인트 지급 완료: ${majorityText} ${base}P${multiplierText} = 총 ${totalPoints}P`);

  return { base, multiplier, totalPoints, myIsMajority, agg };
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
  const qRef = firestore().collection('answers').where('question_id', '==', questionId);
  
    const unsubscribe = qRef.onSnapshot((snapshot) => {
      let c0 = 0, c1 = 0;
      snapshot.forEach(doc => {
      const data = doc.data();
      if (data.selected_option_index === 0) c0++;
      else if (data.selected_option_index === 1) c1++;
    });
    const total = c0 + c1;
    const p0 = total ? Math.round((c0 / total) * 100) : 50;
    const p1 = 100 - p0;
    onChange({ total, c0, c1, p0, p1 });
  });

    return unsubscribe;
}

