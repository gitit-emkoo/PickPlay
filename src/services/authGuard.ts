import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

let signingIn = false;
let inflight: Promise<FirebaseAuthTypes.User | null> | null = null;
let unsub: (() => void) | null = null;

/**
 * Firebase가 초기화될 때까지 대기합니다.
 * React Native Firebase는 네이티브 모듈이므로, auth() 호출을 시도하여 초기화 여부를 확인합니다.
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
        // 다른 에러는 즉시 throw
        console.error(`[waitForFirebase] ❌ 예상치 못한 에러 발생, 즉시 종료`);
        throw error;
      }
    }
  }
  // 최대 재시도 횟수 초과
  console.error(`[waitForFirebase] ❌ Firebase 초기화 시간 초과 (${maxRetries}회 시도 실패)`);
  throw new Error('Firebase 초기화 시간 초과');
}

/**
 * 중복 호출을 막고, 모든 호출자가 같은 Promise를 공유합니다.
 */
export async function ensureAnonymousAuth(): Promise<FirebaseAuthTypes.User | null> {
  console.log('[ensureAnonymousAuth] 시작');
  
  // Firebase 초기화 대기
  try {
    console.log('[ensureAnonymousAuth] Firebase 초기화 대기 중...');
    await waitForFirebase();
    console.log('[ensureAnonymousAuth] ✅ Firebase 초기화 완료');
  } catch (error) {
    console.warn('[ensureAnonymousAuth] ❌ Firebase 초기화 대기 실패, 재시도 중...', error);
    await new Promise(resolve => setTimeout(resolve, 500));
    return ensureAnonymousAuth(); // 재시도
  }
  
  try {
    console.log('[ensureAnonymousAuth] currentUser 확인 중...');
    const current = auth().currentUser;
    if (current) {
      console.log(`[ensureAnonymousAuth] ✅ 기존 사용자 발견: ${current.uid}`);
      return Promise.resolve(current);
    }
    
    if (inflight) {
      console.log('[ensureAnonymousAuth] ⏳ 이미 로그인 진행 중, 기존 Promise 반환');
      return inflight;
    }

    console.log('[ensureAnonymousAuth] 익명 로그인 시작...');
    signingIn = true;
    inflight = auth()
      .signInAnonymously()
      .then(res => {
        console.log(`[ensureAnonymousAuth] ✅ 익명 로그인 성공: ${res.user.uid}`);
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
      console.warn('[ensureAnonymousAuth] Firebase 초기화 대기 중, 재시도...');
      await new Promise(resolve => setTimeout(resolve, 500));
      return ensureAnonymousAuth(); // 재시도
    }
    throw error;
  }
}

/**
 * 단 하나의 상태 리스너만 유지 + 비로그인 시 1회만 로그인 시도합니다.
 */
export function watchAuth(cb: (user: { uid: string } | null) => void): () => void {
  console.log('[watchAuth] 시작');
  
  if (unsub) {
    console.log('[watchAuth] 기존 리스너 제거');
    unsub();
  }

  // Firebase 초기화를 기다린 후 리스너 등록
  console.log('[watchAuth] Firebase 초기화 대기 시작...');
  waitForFirebase()
    .then(() => {
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
          console.warn('[watchAuth] Firebase 초기화 대기 중, 1초 후 재시도...');
          // 재시도 (더 긴 대기 시간)
          setTimeout(() => {
            watchAuth(cb);
          }, 1000);
        } else {
          console.error('[watchAuth] 예상치 못한 에러:', error);
          cb(null);
        }
      }
    })
    .catch((error) => {
      console.warn('[watchAuth] ❌ Firebase 초기화 실패, 2초 후 재시도...', error?.message || error);
      // 에러가 발생해도 앱이 계속 실행되도록 재시도
      setTimeout(() => {
        console.log('[watchAuth] 재시도 시작...');
        watchAuth(cb);
      }, 2000);
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








