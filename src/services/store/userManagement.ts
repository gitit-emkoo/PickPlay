import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import firestore from '@react-native-firebase/firestore';
import { generateRandomNickname } from '../../utils/nickname';
import { UserData } from '../../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceUID, getPreviousUID } from '../firebase';

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
    
    // V2 버전과 동일: Firestore에 데이터가 있으면 확인
    if (userDocExists) {
      const data = doc.data() as UserData;
      console.log('✅ [V2] Firestore에서 사용자 데이터 확인:', uid);
      console.log('📊 [V2] Firestore 데이터 내용:', {
        nickname: data.nickname,
        points: data.points,
        streakCount: data.streakCount,
        totalSelections: data.totalSelections,
        deviceUID: data.deviceUID || '없음',
      });
      
      // 신규 사용자처럼 보이는 경우 (모든 값이 0) 복구 로직 실행
      const isNewUserLike = (data.points === 0 && data.streakCount === 0 && data.totalSelections === 0);
      
      if (isNewUserLike) {
        console.log('⚠️ [ensureUser] Firestore 문서가 있지만 신규 사용자처럼 보임 (모든 값이 0). 복구 로직 실행...');
        // 아래 복구 로직으로 진행
      } else {
        // 유효한 데이터가 있으면 정상 반환
        // deviceUID가 없으면 추가 (향후 복구용)
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

    // Firestore에 데이터가 없으면 복구 시도
    // 0-0. AsyncStorage를 가장 먼저 확인 (같은 기기라면 업데이트 후에도 유지됨)
    console.log('🔍 [ensureUser] AsyncStorage에서 기존 데이터 우선 확인 중...');
    let asyncStorageData: any = null;
    let asyncStorageKey: string | null = null;
    try {
      // 먼저 현재 deviceUID로 시도
      const currentDeviceKey = `userData_${deviceUID}`;
      let asyncDataJSON = await AsyncStorage.getItem(currentDeviceKey);
      
      // 현재 deviceUID로 찾지 못하면 모든 userData_ 키 검색
      if (!asyncDataJSON) {
        console.log('🔍 [ensureUser] 현재 deviceUID로 데이터를 찾지 못함, 모든 userData_ 키 검색 중...');
        const allKeys = await AsyncStorage.getAllKeys();
        const userDataKeys = allKeys.filter(key => key.startsWith('userData_'));
        console.log(`🔍 [ensureUser] 발견된 userData_ 키: ${userDataKeys.length}개`);
        
        // 가장 최신 데이터 찾기 (totalSelections가 가장 큰 것 선택)
        for (const key of userDataKeys) {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            try {
              const parsed = JSON.parse(data);
              // 유효한 데이터인지 확인 (points, nickname 등이 있고, totalSelections가 0이 아닌 경우 우선)
              if (parsed && (parsed.points !== undefined || parsed.nickname || parsed.totalSelections !== undefined)) {
                // totalSelections가 있는 데이터를 우선 선택 (더 많은 활동 = 더 최신)
                if (!asyncStorageData || (parsed.totalSelections || 0) > (asyncStorageData.totalSelections || 0)) {
                  asyncStorageKey = key;
                  asyncStorageData = parsed;
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

    // 0-1. deviceUID로 기존 사용자 찾기 (V3 이후 업데이트 시 사용)
    // V2 → V3 업데이트 시에는 deviceUID가 없으므로 자동으로 실패하고 다음 단계로 진행
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
      } else {
        console.log('ℹ️ [ensureUser] deviceUID로 기존 사용자를 찾지 못했습니다. (V2 유저는 deviceUID가 없을 수 있음)');
      }
    } catch (queryError: any) {
      console.error('❌ [ensureUser] deviceUID 쿼리 실패 (무시하고 계속):', queryError?.code || queryError?.message);
    }

    // Firestore에 데이터가 없으면 복구 시도
    // 1. AsyncStorage에 유효한 데이터가 있으면 → 최우선 복구 (같은 기기라면 업데이트 후에도 유지됨)
    if (asyncStorageData && (asyncStorageData.totalSelections > 0 || asyncStorageData.points > 0 || asyncStorageData.streakCount > 0)) {
      console.log('🔄 [Recovery] AsyncStorage에서 기존 사용자 데이터 발견. 무조건 복구 실행.');
      console.log(`📊 [Recovery] AsyncStorage 키: ${asyncStorageKey}`);
      // 복구 로직으로 진행 (아래 2번으로)
    }
    // 1-1. 이전 UID로 찾은 기존 사용자가 있으면 → 복구 (가장 확실한 방법)
    else if (existingUserByPreviousUID) {
      console.log('🔄 [Recovery] 이전 Firebase UID로 기존 사용자 발견. 복구 실행.');
      console.log(`📊 [Recovery] 이전 사용자 UID: ${existingUserByPreviousUID.uid}, 현재 UID: ${uid}`);
      // 복구 로직으로 진행 (아래 2번으로)
    }
    // 1-2. deviceUID로 찾은 기존 사용자가 있고, 현재 UID와 다르면 → 복구
    else if (existingUserByDeviceUID) {
      console.log('🔄 [Recovery] deviceUID로 기존 사용자 발견. 복구 실행.');
      console.log(`📊 [Recovery] 기존 사용자 UID: ${existingUserByDeviceUID.uid}, 현재 UID: ${uid}`);
      // 복구 로직으로 진행 (아래 2번으로)
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
      // 위에서 찾지 못했으면 deviceUID로 다시 검색 시도 (V2 유저는 deviceUID가 없으므로 자동으로 실패)
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
          console.log(`ℹ️ [Recovery] V2 유저는 deviceUID가 없어서 Firestore에서 찾을 수 없을 수 있음`);
          
          // deviceUID로 찾지 못했으면, AsyncStorage에서 닉네임을 찾아서 Firestore에서 검색 시도
          if (legacyData && legacyData.nickname) {
            console.log(`🔍 [Recovery] 닉네임으로 Firestore 검색 시도: "${legacyData.nickname}"`);
            try {
              const nicknameQuery = await firestore()
                .collection('users')
                .where('nickname', '==', legacyData.nickname)
                .get();
              
              if (!nicknameQuery.empty) {
                // 닉네임이 일치하는 사용자 중에서 points와 streakCount가 일치하는 것을 찾기
                let matchedDoc = null;
                for (const doc of nicknameQuery.docs) {
                  const docData = doc.data() as UserData;
                  // points와 streakCount가 일치하면 같은 사용자로 간주
                  if (docData.points === legacyData.points && 
                      docData.streakCount === legacyData.streakCount) {
                    matchedDoc = doc;
                    break;
                  }
                }
                
                // 일치하는 문서가 없으면 첫 번째 문서 사용 (닉네임만 일치)
                if (!matchedDoc && nicknameQuery.size === 1) {
                  matchedDoc = nicknameQuery.docs[0];
                }
                
                if (matchedDoc) {
                  firestoreUserData = matchedDoc.data() as UserData;
                  firestoreExistingUID = matchedDoc.id;
                  console.log(`✅ [Recovery] 닉네임으로 기존 사용자 발견 (${firestoreExistingUID}): "${firestoreUserData.nickname}"`);
                  console.log(`📊 [Recovery] Firestore 데이터:`, {
                    nickname: firestoreUserData.nickname,
                    points: firestoreUserData.points,
                    streakCount: firestoreUserData.streakCount,
                    totalSelections: firestoreUserData.totalSelections,
                    deviceUID: firestoreUserData.deviceUID || '없음',
                  });
                } else {
                  console.log(`⚠️ [Recovery] 닉네임은 일치하지만 points/streakCount가 다른 사용자가 ${nicknameQuery.size}명 발견됨. 첫 번째 사용자 사용하지 않음.`);
                }
              } else {
                console.log(`ℹ️ [Recovery] 닉네임 "${legacyData.nickname}"으로 Firestore에서 사용자를 찾지 못했습니다.`);
              }
            } catch (nicknameQueryError: any) {
              console.error('❌ [Recovery] Firestore 닉네임 쿼리 실패:', nicknameQueryError);
            }
          }
        }
      } catch (queryError: any) {
        console.error('❌ [Recovery] Firestore deviceUID 쿼리 실패:', queryError);
        console.error('❌ [Recovery] 에러 코드:', queryError?.code);
        console.error('❌ [Recovery] 에러 메시지:', queryError?.message);
      }
      
      // deviceUID로 찾지 못했으면 복구 실패
      // 주의: answers 컬렉션에서 UID를 찾는 것은 위험하므로 제거됨
      // (다른 사용자의 데이터로 덮어씌워질 위험이 있음)
      if (!firestoreUserData) {
        console.log('⚠️ [Recovery] deviceUID와 previousUID로 기존 사용자를 찾지 못했습니다.');
        console.log('⚠️ [Recovery] answers 컬렉션 검색은 위험하므로 제거되었습니다.');
        // 복구 실패로 처리 (신규 사용자 생성)
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
      
      // Firestore에서 찾은 기존 문서가 있으면 참조용으로 업데이트 및 answers 마이그레이션
      if (firestoreExistingUID && firestoreExistingUID !== uid) {
        try {
          await firestore().collection('users').doc(firestoreExistingUID).update({
            recoveredToUID: uid,
            recoveredAt: firestore.FieldValue.serverTimestamp(),
          } as any);
          console.log(`✅ [Recovery] 기존 Firestore 문서(${firestoreExistingUID})에 복구 정보 추가`);
          
          // answers 컬렉션 마이그레이션: 이전 UID의 answers를 새 UID로 복사
          console.log(`🔄 [Recovery] answers 컬렉션 마이그레이션 시작: ${firestoreExistingUID} → ${uid}`);
          try {
            const oldAnswersQuery = await firestore()
              .collection('answers')
              .where('uid', '==', firestoreExistingUID)
              .get();
            
            if (!oldAnswersQuery.empty) {
              console.log(`📊 [Recovery] 마이그레이션할 answers 문서 수: ${oldAnswersQuery.size}개`);
              
              const batch = firestore().batch();
              let batchCount = 0;
              const BATCH_LIMIT = 500; // Firestore 배치 제한
              
              for (const oldAnswerDoc of oldAnswersQuery.docs) {
                const oldAnswerData = oldAnswerDoc.data();
                const questionId = oldAnswerData.question_id;
                
                // 새 UID로 answers 문서 생성
                const newAnswerDocId = `${uid}_${questionId}`;
                const newAnswerRef = firestore().collection('answers').doc(newAnswerDocId);
                
                // 새 문서가 이미 있으면 건너뛰기 (중복 방지)
                const newAnswerDoc = await newAnswerRef.get();
                if (newAnswerDoc.exists) {
                  console.log(`ℹ️ [Recovery] answers 문서가 이미 존재함: ${newAnswerDocId}`);
                  continue;
                }
                
                // 새 UID로 answers 문서 생성 (uid 필드도 업데이트)
                batch.set(newAnswerRef, {
                  ...oldAnswerData,
                  uid: uid, // 새 UID로 업데이트
                });
                batchCount++;
                
                // 배치 제한에 도달하면 커밋
                if (batchCount >= BATCH_LIMIT) {
                  await batch.commit();
                  console.log(`✅ [Recovery] answers 마이그레이션 배치 커밋: ${batchCount}개`);
                  batchCount = 0;
                }
              }
              
              // 남은 배치 커밋
              if (batchCount > 0) {
                await batch.commit();
                console.log(`✅ [Recovery] answers 마이그레이션 최종 배치 커밋: ${batchCount}개`);
              }
              
              console.log(`✅ [Recovery] answers 컬렉션 마이그레이션 완료: ${oldAnswersQuery.size}개 문서`);
            } else {
              console.log(`ℹ️ [Recovery] 마이그레이션할 answers 문서가 없습니다.`);
            }
          } catch (answersMigrationError: any) {
            console.error('❌ [Recovery] answers 마이그레이션 실패:', answersMigrationError);
            console.error('❌ [Recovery] 에러 코드:', answersMigrationError?.code);
            console.error('❌ [Recovery] 에러 메시지:', answersMigrationError?.message);
            // answers 마이그레이션 실패해도 사용자 데이터 복구는 성공한 것으로 간주
          }
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

