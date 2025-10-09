import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

let signingIn = false;
let inflight: Promise<FirebaseAuthTypes.User | null> | null = null;
let unsub: (() => void) | null = null;

/**
 * 중복 호출을 막고, 모든 호출자가 같은 Promise를 공유합니다.
 */
export function ensureAnonymousAuth(): Promise<FirebaseAuthTypes.User | null> {
  const current = auth().currentUser;
  if (current) return Promise.resolve(current);
  if (inflight) return inflight;

  signingIn = true;
  inflight = auth()
    .signInAnonymously()
    .then(res => res.user)
    .catch(err => {
      console.warn('[auth] anonymous sign-in failed:', (err as any)?.code || err);
      return null;
    })
    .finally(() => {
      signingIn = false;
      inflight = null;
    });

  return inflight;
}

/**
 * 단 하나의 상태 리스너만 유지 + 비로그인 시 1회만 로그인 시도합니다.
 */
export function watchAuth(cb: (user: { uid: string } | null) => void): () => void {
  if (unsub) unsub();

  unsub = auth().onAuthStateChanged(async (u) => {
    if (u) {
      cb({ uid: u.uid });
      return;
    }
    if (!signingIn) {
      const user = await ensureAnonymousAuth();
      cb(user ? { uid: user.uid } : null);
    }
  });

  return () => {
    if (unsub) {
      unsub();
      unsub = null;
    }
  };
}








