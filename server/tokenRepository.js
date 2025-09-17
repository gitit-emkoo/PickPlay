const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let adminInitialized = false;

function initAdmin() {
  if (adminInitialized) return;

  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const fallbackPath = path.resolve(__dirname, '../firebase-service-account.json');
  let credentialPath = envPath;

  // 1) 환경변수 경로 우선
  if (credentialPath && fs.existsSync(credentialPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    adminInitialized = true;
    console.log(`[INFO] Firebase Admin initialized with: ${credentialPath}`);
    return;
  }

  // 2) 레포 내 로컬 파일(fallback) 시도 (로컬 실행용)
  if (fs.existsSync(fallbackPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    adminInitialized = true;
    console.log(`[INFO] Firebase Admin initialized with fallback: ${fallbackPath}`);
    return;
  }

  // 3) 둘 다 없으면 ADC(Application Default Credentials) 사용 (Cloud Run/Functions 권장)
  try {
    admin.initializeApp();
    adminInitialized = true;
    console.log('[INFO] Firebase Admin initialized with ADC (default credentials)');
  } catch (e) {
    console.error('[FATAL] Failed to initialize Firebase Admin (ADC fallback also failed).');
    console.error('Error:', e?.message || e);
    throw e;
  }
}

/**
 * Fetch unique Expo push tokens from Firestore
 * @returns {Promise<string[]>}
 */
async function fetchExpoTokens() {
  initAdmin();
  const db = admin.firestore();
  const snapshot = await db.collection('user_push_tokens').get();
  const unique = new Set();

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const token = data?.expo?.token;
    if (typeof token === 'string' && token.startsWith('ExponentPushToken[')) {
      unique.add(token);
    }
  });

  return Array.from(unique);
}

module.exports = {
  initAdmin,
  fetchExpoTokens,
  admin
};


