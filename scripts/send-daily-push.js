/*
 Minimal MVP: Expo Push API로 전체 사용자에게 메시지 발송
 - Firestore: user_push_tokens/{uid} 문서의 expo.token 수집
 - 메시지 예시: 매일 20:15 고정
 - Cloud Scheduler나 로컬에서 `npm run push:send-daily`로 실행 가능
*/

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { Expo } = require('expo-server-sdk');
const path = require('path');
const fs = require('fs');

// 서비스 계정은 환경 변수로 주입되었다고 가정(로컬 테스트 시 json 경로 사용 가능)
// Initialize Firebase Admin with explicit file (envPath if exists, else fallback), then ADC
(() => {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const fallbackPath = path.resolve(__dirname, '../firebase-service-account.json');
  try {
    // Prefer explicit file if exists
    const candidatePaths = [];
    if (envPath && fs.existsSync(envPath)) candidatePaths.push(envPath);
    if (fs.existsSync(fallbackPath)) candidatePaths.push(fallbackPath);

    if (candidatePaths.length > 0) {
      const credentialPath = candidatePaths[0];
      const json = fs.readFileSync(credentialPath, 'utf8');
      const serviceAccount = JSON.parse(json);
      initializeApp({ credential: cert(serviceAccount) });
      console.log(`[INFO] Firebase Admin initialized with service account file: ${credentialPath}`);
      return;
    }

    // Fall back to ADC
    initializeApp();
    console.log('[INFO] Firebase Admin initialized with Application Default Credentials');
  } catch (err) {
    console.error('[FATAL] Failed to initialize Firebase Admin credentials.');
    console.error('Init error:', err?.message || err);
    console.error('Tried envPath:', envPath);
    console.error('FallbackPath:', fallbackPath);
    process.exit(1);
  }
})();
const db = getFirestore();
const expo = new Expo();

async function fetchExpoTokens() {
  const snapshot = await db.collection('user_push_tokens').get();
  const unique = new Set();
  const duplicates = new Set();
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const token = data?.expo?.token;
    if (token && Expo.isExpoPushToken(token)) {
      if (unique.has(token)) {
        duplicates.add(token);
      }
      unique.add(token);
    }
  });
  const tokens = Array.from(unique);
  if (duplicates.size > 0) {
    console.log(`[INFO] Duplicate Expo tokens found and removed: ${duplicates.size}`);
  }
  return tokens;
}

async function sendBatch(messages) {
  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('sendPushNotificationsAsync error:', error);
    }
  }
  return tickets;
}

async function main() {
  const tokens = await fetchExpoTokens();
  if (!tokens.length) {
    console.log('[INFO] No Expo tokens found. Abort.');
    return;
  }

  const title = process.env.PUSH_TITLE || '오늘의 질문이 기다리고 있어요! 🎯';
  const body = process.env.PUSH_BODY || '새로운 밸런스 게임에 참여해보세요!';
  const data = { type: 'daily_question' };

  const messages = tokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
  }));

  console.log(`[INFO] Sending to ${messages.length} devices...`);
  const tickets = await sendBatch(messages);
  console.log('[INFO] Tickets:', tickets);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


