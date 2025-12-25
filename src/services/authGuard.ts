import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

let signingIn = false;
let inflight: Promise<FirebaseAuthTypes.User | null> | null = null;
let unsub: (() => void) | null = null;
let ensureAuthRetryCount = 0;
const MAX_ENSURE_AUTH_RETRIES = 3;

/**
 * 이전 Firebase UID를 AsyncStorage에 저장합니다.
 * 앱 업데이트 시 새로운 UID가 생성되면, 이전 UID를 사용하여 기존 사용자 데이터를 복구할 수 있습니다.
 */
async function savePreviousUID(uid: string): Promise<void> {
  try {
    await AsyncStorage.setItem('previousFirebaseUID', uid);
    console.log(`[savePreviousUID] 이전 Firebase UID 저장 완료: ${uid}`);
  } catch (error) {
    console.error('[savePreviousUID] 저장 실패:', error);
  }
}

/**
 * AsyncStorage에 저장된 이전 Firebase UID를 가져옵니다.
 */
export async function getPreviousUID(): Promise<string | null> {
  try {
    const previousUID = await AsyncStorage.getItem('previousFirebaseUID');
    if (previousUID) {
      console.log(`[getPreviousUID] 이전 Firebase UID 발견: ${previousUID}`);
    }
    return previousUID;
  } catch (error) {
    console.error('[getPreviousUID] 읽기 실패:', error);
    return null;
  }
}

/**
 * Firebase가 초기화될 때까지 대기합니다.
 * React Native Firebase는 네이티브 모듈이므로, auth() 호출을 시도하여 초기화 여부를 확인합니다.
 * 실패 시 false를 반환하여 앱 크래시를 방지합니다.
 */
async function waitForFirebase(maxRetries = 20, initialDelay = 200, maxDelay = 1000): Promise<boolean> {
  console.log(`[waitForFirebase] 시작 - 최대 ${maxRetries}회 재시도`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`[waitForFirebase] 시도 ${i + 1}/${maxRetries}: auth() 호출 시도...`);
      
      // auth() 호출로 Firebase 초기화 여부 확인
      const authInstance = auth();
      console.log(`[waitForFirebase] ✅ auth() 호출 성공`);
      
      // currentUser 접근 시도 (에러가 발생하지 않으면 초기화 완료)
      const currentUser = authInstance.currentUser;
      console.log(`[waitForFirebase] ✅ currentUser 접근 성공 (currentUser: ${currentUser ? '있음' : 'null'})`);
      
      console.log(`[waitForFirebase] ✅ Firebase 초기화 완료!`);
      return true;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const errorCode = error?.code || 'N/A';
      
      console.log(`[waitForFirebase] ❌ 시도 ${i + 1} 실패:`);
      console.log(`  - 에러 메시지: ${errorMessage}`);
      console.log(`  - 에러 코드: ${errorCode}`);
      console.log(`  - 에러 타입: ${error?.constructor?.name || typeof error}`);
      
      if (errorMessage.includes("No Firebase App '[DEFAULT]'")) {
        if (i < maxRetries - 1) {
          // 지수 백오프: 대기 시간을 점진적으로 증가
          const delay = Math.min(initialDelay * Math.pow(1.2, i), maxDelay);
          console.log(`[waitForFirebase] ⏳ ${delay}ms 대기 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } else {
          console.error(`[waitForFirebase] ❌ 최대 재시도 횟수(${maxRetries}) 초과`);
        }
      } else {
        // 다른 에러도 크래시 방지를 위해 false 반환
        console.error(`[waitForFirebase] ❌ 예상치 못한 에러 발생, false 반환 (크래시 방지)`);
        console.error(`[waitForFirebase] 에러 상세:`, error);
        return false;
      }
    }
  }
  // 최대 재시도 횟수 초과 - 크래시 방지를 위해 false 반환
  console.error(`[waitForFirebase] ❌ Firebase 초기화 시간 초과 (${maxRetries}회 시도 실패)`);
  console.error(`[waitForFirebase] ⚠️ false 반환하여 앱 크래시 방지`);
  return false;
}

/**
 * 중복 호출을 막고, 모든 호출자가 같은 Promise를 공유합니다.
 * 재시도 횟수를 제한하여 무한 루프를 방지합니다.
 */
export async function ensureAnonymousAuth(): Promise<FirebaseAuthTypes.User | null> {
  console.log(`[ensureAnonymousAuth] 시작 (재시도 횟수: ${ensureAuthRetryCount}/${MAX_ENSURE_AUTH_RETRIES})`);
  
  // 재시도 횟수 제한 확인
  if (ensureAuthRetryCount >= MAX_ENSURE_AUTH_RETRIES) {
    console.error(`[ensureAnonymousAuth] ❌ 최대 재시도 횟수(${MAX_ENSURE_AUTH_RETRIES}) 초과, null 반환하여 크래시 방지`);
    ensureAuthRetryCount = 0; // 리셋
    return null;
  }
  
  // Firebase 초기화 대기
  try {
    console.log('[ensureAnonymousAuth] Firebase 초기화 대기 중...');
    const firebaseReady = await waitForFirebase();
    if (!firebaseReady) {
      console.warn('[ensureAnonymousAuth] ❌ Firebase 초기화 실패, 재시도 중...');
      ensureAuthRetryCount++;
      await new Promise(resolve => setTimeout(resolve, 500));
      return ensureAnonymousAuth(); // 재시도
    }
    console.log('[ensureAnonymousAuth] ✅ Firebase 초기화 완료');
    ensureAuthRetryCount = 0; // 성공 시 리셋
  } catch (error) {
    console.warn('[ensureAnonymousAuth] ❌ Firebase 초기화 대기 중 예외 발생:', error);
    ensureAuthRetryCount++;
    if (ensureAuthRetryCount < MAX_ENSURE_AUTH_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return ensureAnonymousAuth(); // 재시도
    } else {
      console.error(`[ensureAnonymousAuth] ❌ 최대 재시도 횟수(${MAX_ENSURE_AUTH_RETRIES}) 초과, null 반환`);
      ensureAuthRetryCount = 0; // 리셋
      return null;
    }
  }
  
  try {
    // Firebase 초기화 후 약간의 지연을 주어 기존 토큰이 복원되도록 함
    // (같은 앱 서명이면 Firebase가 기기 내부 토큰을 자동으로 복원함)
    console.log('[ensureAnonymousAuth] 기존 토큰 복원 대기 중... (200ms)');
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('[ensureAnonymousAuth] currentUser 확인 중...');
    const current = auth().currentUser;
    if (current) {
      console.log(`[ensureAnonymousAuth] ✅ 기존 사용자 발견: ${current.uid}`);
      // 현재 UID를 저장 (앱 업데이트 시 복구용)
      await savePreviousUID(current.uid);
      return Promise.resolve(current);
    }
    
    // currentUser가 없으면 onAuthStateChanged를 통해 기존 사용자 확인 시도
    // (Firebase가 비동기로 토큰을 복원할 수 있음)
    console.log('[ensureAnonymousAuth] currentUser가 null. onAuthStateChanged로 기존 사용자 확인 시도...');
    const existingUser = await new Promise<FirebaseAuthTypes.User | null>((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log('[ensureAnonymousAuth] onAuthStateChanged 타임아웃 (500ms). 기존 사용자 없음으로 간주.');
          resolve(null);
        }
      }, 500);
      
      const unsubscribe = auth().onAuthStateChanged((user) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          unsubscribe();
          if (user) {
            console.log(`[ensureAnonymousAuth] ✅ onAuthStateChanged로 기존 사용자 발견: ${user.uid}`);
            resolve(user);
          } else {
            console.log('[ensureAnonymousAuth] onAuthStateChanged: 기존 사용자 없음');
            resolve(null);
          }
        }
      });
    });
    
    if (existingUser) {
      await savePreviousUID(existingUser.uid);
      return Promise.resolve(existingUser);
    }
    
    if (inflight) {
      console.log('[ensureAnonymousAuth] ⏳ 이미 로그인 진행 중, 기존 Promise 반환');
      return inflight;
    }

    // 이전 UID 확인 (앱 업데이트 시 새로운 UID가 생성되었을 수 있음)
    const previousUID = await getPreviousUID();
    if (previousUID) {
      console.log(`[ensureAnonymousAuth] 이전 Firebase UID 발견: ${previousUID}`);
    }

    console.log('[ensureAnonymousAuth] 익명 로그인 시작...');
    signingIn = true;
    inflight = auth()
      .signInAnonymously()
      .then(async res => {
        const newUID = res.user.uid;
        console.log(`[ensureAnonymousAuth] ✅ 익명 로그인 성공: ${newUID}`);
        
        // 이전 UID와 다르면 이전 UID 유지 (앱 업데이트로 인한 새로운 UID 생성)
        // 이전 UID는 복구 로직에서 사용되므로 덮어쓰지 않음
        if (previousUID && previousUID !== newUID) {
          console.log(`[ensureAnonymousAuth] ⚠️ 새로운 UID 생성됨 (이전: ${previousUID}, 새: ${newUID})`);
          console.log(`[ensureAnonymousAuth] 이전 UID는 유지하여 복구 로직에서 사용`);
          // 이전 UID를 유지하므로 새 UID를 저장하지 않음
        } else {
          // 이전 UID가 없거나 같으면 현재 UID 저장
          await savePreviousUID(newUID);
        }
        
        return res.user;
      })
      .catch(err => {
        console.warn('[ensureAnonymousAuth] ❌ 익명 로그인 실패:', (err as any)?.code || err);
        return null;
      })
      .finally(() => {
        signingIn = false;
        inflight = null;
        console.log('[ensureAnonymousAuth] 로그인 프로세스 완료');
      });

    return inflight;
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    console.error('[ensureAnonymousAuth] ❌ 에러 발생:', errorMessage);
    
    if (errorMessage.includes("No Firebase App '[DEFAULT]'")) {
      ensureAuthRetryCount++;
      if (ensureAuthRetryCount < MAX_ENSURE_AUTH_RETRIES) {
        console.warn(`[ensureAnonymousAuth] Firebase 초기화 대기 중, 재시도... (${ensureAuthRetryCount}/${MAX_ENSURE_AUTH_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 500));
        return ensureAnonymousAuth(); // 재시도
      } else {
        console.error(`[ensureAnonymousAuth] ❌ 최대 재시도 횟수(${MAX_ENSURE_AUTH_RETRIES}) 초과, null 반환`);
        ensureAuthRetryCount = 0; // 리셋
        return null;
      }
    }
    // 다른 에러도 크래시 방지를 위해 null 반환
    console.error('[ensureAnonymousAuth] ❌ 예상치 못한 에러, null 반환하여 크래시 방지');
    ensureAuthRetryCount = 0; // 리셋
    return null;
  }
}

let watchAuthRetryCount = 0;
const MAX_WATCH_AUTH_RETRIES = 3;

/**
 * 단 하나의 상태 리스너만 유지 + 비로그인 시 1회만 로그인 시도합니다.
 * 재시도 횟수를 제한하여 무한 루프를 방지합니다.
 */
export function watchAuth(cb: (user: { uid: string } | null) => void): () => void {
  console.log(`[watchAuth] 시작 (재시도 횟수: ${watchAuthRetryCount}/${MAX_WATCH_AUTH_RETRIES})`);
  
  // 재시도 횟수 제한 확인
  if (watchAuthRetryCount >= MAX_WATCH_AUTH_RETRIES) {
    console.error(`[watchAuth] ❌ 최대 재시도 횟수(${MAX_WATCH_AUTH_RETRIES}) 초과, null 콜백 호출하여 크래시 방지`);
    watchAuthRetryCount = 0; // 리셋
    cb(null);
    return () => {}; // 빈 cleanup 함수 반환
  }
  
  if (unsub) {
    console.log('[watchAuth] 기존 리스너 제거');
    unsub();
  }

  // Firebase 초기화를 기다린 후 리스너 등록
  console.log('[watchAuth] Firebase 초기화 대기 시작...');
  waitForFirebase()
    .then((firebaseReady) => {
      if (!firebaseReady) {
        console.warn('[watchAuth] ❌ Firebase 초기화 실패, 재시도 중...');
        watchAuthRetryCount++;
        setTimeout(() => {
          watchAuth(cb);
        }, 2000);
        return;
      }
      watchAuthRetryCount = 0; // 성공 시 리셋
      console.log('[watchAuth] ✅ Firebase 초기화 완료, 리스너 등록 시도...');
      try {
        unsub = auth().onAuthStateChanged(async (u) => {
          console.log(`[watchAuth] 🔔 onAuthStateChanged 호출됨: ${u ? `사용자 있음 (${u.uid})` : '사용자 없음'}`);
          
          if (u) {
            console.log(`[watchAuth] ✅ 사용자 인증됨: ${u.uid}`);
            cb({ uid: u.uid });
            return;
          }
          
          if (!signingIn) {
            console.log('[watchAuth] 로그인되지 않음, 익명 로그인 시도...');
            try {
              const user = await ensureAnonymousAuth();
              console.log(`[watchAuth] 익명 로그인 결과: ${user ? `성공 (${user.uid})` : '실패'}`);
              cb(user ? { uid: user.uid } : null);
            } catch (error) {
              console.warn('[watchAuth] ❌ ensureAnonymousAuth 실패:', error);
              cb(null);
            }
          } else {
            console.log('[watchAuth] 이미 로그인 진행 중, 대기...');
          }
        });
        console.log('[watchAuth] ✅ onAuthStateChanged 리스너 등록 완료');
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        console.error('[watchAuth] ❌ 리스너 등록 실패:', errorMessage);
        
        if (errorMessage.includes("No Firebase App '[DEFAULT]'")) {
          watchAuthRetryCount++;
          if (watchAuthRetryCount < MAX_WATCH_AUTH_RETRIES) {
            console.warn(`[watchAuth] Firebase 초기화 대기 중, 1초 후 재시도... (${watchAuthRetryCount}/${MAX_WATCH_AUTH_RETRIES})`);
            setTimeout(() => {
              watchAuth(cb);
            }, 1000);
          } else {
            console.error(`[watchAuth] ❌ 최대 재시도 횟수(${MAX_WATCH_AUTH_RETRIES}) 초과, null 콜백 호출`);
            watchAuthRetryCount = 0; // 리셋
            cb(null);
          }
        } else {
          console.error('[watchAuth] 예상치 못한 에러:', error);
          watchAuthRetryCount = 0; // 리셋
          cb(null);
        }
      }
    })
    .catch((error) => {
      watchAuthRetryCount++;
      if (watchAuthRetryCount < MAX_WATCH_AUTH_RETRIES) {
        console.warn(`[watchAuth] ❌ Firebase 초기화 실패, 2초 후 재시도... (${watchAuthRetryCount}/${MAX_WATCH_AUTH_RETRIES})`, error?.message || error);
        setTimeout(() => {
          console.log('[watchAuth] 재시도 시작...');
          watchAuth(cb);
        }, 2000);
      } else {
        console.error(`[watchAuth] ❌ 최대 재시도 횟수(${MAX_WATCH_AUTH_RETRIES}) 초과, null 콜백 호출하여 크래시 방지`);
        watchAuthRetryCount = 0; // 리셋
        cb(null);
      }
    });

  return () => {
    console.log('[watchAuth] cleanup 함수 호출');
    if (unsub) {
      unsub();
      unsub = null;
      console.log('[watchAuth] 리스너 제거 완료');
    }
  };
}








